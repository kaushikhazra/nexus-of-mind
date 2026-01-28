"""
Handler for neural network observation messages.

Processes game observations and generates spawn decisions using
the neural network with simulation-gated inference.
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, Callable, Tuple, TYPE_CHECKING

from websocket.schemas import ParsedMessage
from websocket.handlers.base import create_error_response
from ai_engine.exceptions import (
    InvalidObservationError,
    ModelNotInitializedError,
    GateEvaluationError,
    FeatureExtractionError
)

if TYPE_CHECKING:
    from ai_engine.feature_extractor import FeatureExtractor
    from ai_engine.nn_model import NNModel
    from ai_engine.reward_calculator import RewardCalculator
    from ai_engine.decision_gate import SimulationGate, PreprocessGate
    from ai_engine.decision_gate.gate import GateDecision
    from ai_engine.training import ExperienceReplayBuffer
    from ai_engine.training.trainer import ContinuousTrainer as BackgroundTrainer
    from ai_engine.decision_gate.dashboard_metrics import DashboardMetrics

import numpy as np

logger = logging.getLogger(__name__)


class ObservationHandler:
    """
    Handles NN observation messages from the game client.

    Processes observation data through the following pipeline:
    1. Preprocess gate (early skip detection)
    2. Feature extraction
    3. NN inference
    4. Simulation gate evaluation
    5. Experience buffer storage
    6. Response generation
    """

    def __init__(
        self,
        feature_extractor: Optional["FeatureExtractor"],
        nn_model: Optional["NNModel"],
        reward_calculator: Optional["RewardCalculator"],
        simulation_gate: Optional["SimulationGate"],
        preprocess_gate: Optional["PreprocessGate"],
        replay_buffer: Optional["ExperienceReplayBuffer"],
        background_trainer: Optional["BackgroundTrainer"],
        nn_config: Any,
        get_dashboard_metrics_func: Callable[[], "DashboardMetrics"]
    ) -> None:
        """
        Initialize the observation handler.

        Args:
            feature_extractor: FeatureExtractor instance
            nn_model: NNModel instance for inference
            reward_calculator: RewardCalculator instance
            simulation_gate: SimulationGate instance
            preprocess_gate: PreprocessGate instance
            replay_buffer: ExperienceReplayBuffer instance
            background_trainer: BackgroundTrainer instance
            nn_config: NN configuration object
            get_dashboard_metrics_func: Function to get dashboard metrics singleton
        """
        self.feature_extractor: Optional["FeatureExtractor"] = feature_extractor
        self.nn_model: Optional["NNModel"] = nn_model
        self.reward_calculator: Optional["RewardCalculator"] = reward_calculator
        self.simulation_gate: Optional["SimulationGate"] = simulation_gate
        self.preprocess_gate: Optional["PreprocessGate"] = preprocess_gate
        self.replay_buffer: Optional["ExperienceReplayBuffer"] = replay_buffer
        self.background_trainer: Optional["BackgroundTrainer"] = background_trainer
        self.nn_config: Any = nn_config
        self.get_dashboard_metrics: Callable[[], "DashboardMetrics"] = get_dashboard_metrics_func

        # Store previous observations for reward calculation (per territory)
        self.prev_observations: Dict[str, Dict[str, Any]] = {}
        self.prev_decisions: Dict[str, Dict[str, Any]] = {}

        # Thinking loop statistics
        self.thinking_stats = {
            'observations_since_last_action': 0,
            'total_gate_evaluations': 0,
            'gate_passes': 0,
            'confidence_overrides': 0
        }

    async def handle(self, message: ParsedMessage) -> Optional[Dict[str, Any]]:
        """
        Handle observation message using new ParsedMessage format.

        Args:
            message: Parsed observation message

        Returns:
            Spawn decision response or error
        """
        return await self.handle_raw(
            {"type": "observation_data", "data": message.data},
            message.client_id
        )

    async def handle_raw(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle chunk-based observation data for NN spawning.

        Processes observation -> extracts features -> runs NN inference -> returns spawn decision.
        Also calculates rewards and trains the model based on previous observations.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Spawn decision response or error
        """
        try:
            observation = message.get("data")
            if not observation:
                logger.warning(f"[Observation] Missing observation data from client {client_id}")
                raise InvalidObservationError("data", "Missing observation data")

            # Log raw observation data from frontend
            logger.info(f"[RAW] {json.dumps(observation)}")

            # Check components are available
            if not self.feature_extractor:
                logger.warning(f"[Observation] FeatureExtractor not available for client {client_id}")
                raise ModelNotInitializedError("FeatureExtractor")

            if not self.nn_model:
                logger.warning(f"[Observation] NNModel not available for client {client_id}")
                raise ModelNotInitializedError("NNModel")

            territory_id = observation.get("territoryId", "unknown")
            logger.info(f"[Observation] Processing observation for territory {territory_id} from client {client_id}")

            return await self._process_observation(observation, territory_id, client_id)

        except InvalidObservationError as e:
            logger.warning(f"[Observation] Invalid observation: {e}")
            return create_error_response(str(e), error_code="INVALID_OBSERVATION")

        except ModelNotInitializedError as e:
            logger.warning(f"[Observation] Model not initialized: {e}")
            return create_error_response(str(e), error_code="MODEL_NOT_INITIALIZED")

        except GateEvaluationError as e:
            logger.error(f"[Observation] Gate evaluation failed: {e}")
            return create_error_response(str(e), error_code="GATE_ERROR")

        except FeatureExtractionError as e:
            logger.error(f"[Observation] Feature extraction failed: {e}")
            return create_error_response(str(e), error_code="FEATURE_EXTRACTION_ERROR")

        except Exception as e:
            logger.error(f"[Observation] Error processing observation: {e}")
            return create_error_response(
                f"Failed to process observation: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def _process_observation(
        self,
        observation: Dict[str, Any],
        territory_id: str,
        client_id: str
    ) -> Dict[str, Any]:
        """Process observation through the full pipeline."""
        try:
            # Log raw observation data
            workers_mining = observation.get('miningWorkers', [])
            workers_present = observation.get('workersPresent', [])
            protectors = observation.get('protectors', [])
            queen_energy = observation.get('queenEnergy', {})
            player_energy = observation.get('playerEnergy', {})
            player_minerals = observation.get('playerMinerals', {})

            logger.info(
                f"[Observation] Raw data: present={len(workers_present)}, mining={len(workers_mining)}, "
                f"protectors={len(protectors)}, queenE={queen_energy.get('current', 0)}, "
                f"playerE={player_energy.get('end', 0)}, minerals={player_minerals.get('end', 0)}"
            )

            # === PREPROCESS GATE: Skip NN pipeline if no activity ===
            if self.preprocess_gate:
                preprocess_result = self._check_preprocess_gate(observation, queen_energy)
                if preprocess_result is not None:
                    return preprocess_result

            # Update dashboard game state
            self._update_dashboard_game_state(observation, territory_id, queen_energy, workers_present, workers_mining, protectors)

            # Calculate reward from previous observation
            self._calculate_and_update_reward(territory_id, observation)

            # Extract features
            features = self.feature_extractor.extract(observation)
            logger.info(f"[FEATURES] {','.join(f'{f:.4f}' for f in features)}")

            # Run NN inference
            spawn_decision = await self._run_nn_inference(features)
            nn_decision = spawn_decision['nnDecision']
            confidence = spawn_decision['confidence']
            spawn_chunk = spawn_decision['spawnChunk']
            spawn_type = spawn_decision['spawnType']

            logger.debug(f"[NN Decision] {nn_decision.upper()}, confidence={confidence:.3f}")

            # Record entropy for distribution health monitoring
            self._record_entropy(features)

            # === SIMULATION-GATED INFERENCE ===
            gate_decision, should_skip = self._evaluate_gate(
                observation, spawn_chunk, spawn_type, confidence, nn_decision, territory_id
            )

            # Add experience to replay buffer
            self._add_experience_to_buffer(
                features, spawn_chunk, spawn_type, confidence, gate_decision, territory_id
            )

            # Store for next reward calculation
            self.prev_observations[territory_id] = observation
            self.prev_decisions[territory_id] = {
                **spawn_decision,
                'skipped': should_skip,
                'was_executed': gate_decision.decision == 'SEND' if gate_decision else not should_skip
            }

            # Generate response
            return self._generate_response(spawn_decision, gate_decision, nn_decision, confidence)

        except asyncio.TimeoutError:
            logger.warning(f"[Observation] Inference timeout for client {client_id}")
            return create_error_response(
                "NN inference timeout",
                error_code="INFERENCE_TIMEOUT"
            )

    def _check_preprocess_gate(
        self,
        observation: Dict[str, Any],
        queen_energy: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Check preprocess gate and return skip response if needed."""
        preprocess_decision = self.preprocess_gate.evaluate(observation)
        if preprocess_decision.should_skip:
            logger.info(
                f"[PreprocessGate] SKIP: {preprocess_decision.reason} "
                f"(workers={preprocess_decision.workers_count}, "
                f"protectors={preprocess_decision.protectors_count})"
            )

            # Update dashboard pipeline visualization
            try:
                dashboard = self.get_dashboard_metrics()
                dashboard.last_pipeline = {
                    'observation': {
                        'workers_count': preprocess_decision.workers_count,
                        'protectors_count': preprocess_decision.protectors_count,
                        'parasites_count': len(observation.get('parasitesEnd', [])),
                        'queen_energy': queen_energy.get('current', 0),
                        'worker_chunks': [],
                        'protector_chunks': [],
                        'parasite_chunks': [],
                    },
                    'nn_inference': {
                        'chunk_id': -1,
                        'spawn_type': None,
                        'confidence': 0.0,
                        'nn_decision': 'skipped'
                    },
                    'gate_components': {},
                    'combined_reward': {
                        'expected_reward': 0.0,
                        'formula': 'N/A - preprocess skipped'
                    },
                    'decision': {
                        'action': 'SKIP',
                        'reason': preprocess_decision.reason,
                        'timestamp': asyncio.get_event_loop().time()
                    }
                }
            except Exception as e:
                logger.warning(f"Failed to update dashboard on preprocess skip: {e}")

            return {
                "type": "spawn_decision",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {
                    "spawnChunk": -1,
                    "spawnType": None,
                    "confidence": 0.0,
                    "skipped": True,
                    "skipReason": preprocess_decision.reason
                }
            }
        return None

    def _update_dashboard_game_state(
        self,
        observation: Dict[str, Any],
        territory_id: str,
        queen_energy: Dict[str, Any],
        workers_present: list,
        workers_mining: list,
        protectors: list
    ) -> None:
        """Update dashboard with current game state."""
        try:
            dashboard = self.get_dashboard_metrics()
            dashboard.update_game_state({
                'queen_energy': queen_energy.get('current', 0),
                'workers_visible': len(workers_present) + len(workers_mining),
                'protectors_visible': len(protectors),
                'territory_id': territory_id
            })
        except Exception as e:
            logger.warning(f"Failed to update dashboard game state: {e}")

    def _calculate_and_update_reward(
        self,
        territory_id: str,
        observation: Dict[str, Any]
    ) -> None:
        """Calculate reward from previous observation and update buffer."""
        if territory_id not in self.prev_observations or not self.reward_calculator:
            logger.info(f"[Observation] First observation for territory - no reward calculation")
            return

        prev_obs = self.prev_observations[territory_id]
        prev_decision = self.prev_decisions.get(territory_id)

        # Calculate reward
        reward_info = self.reward_calculator.calculate_reward(
            prev_obs, observation, prev_decision
        )
        logger.info(
            f"[Observation] Reward calculated: {reward_info['reward']:.3f}, "
            f"components={reward_info.get('components', {})}"
        )

        # Update pending reward in replay buffer
        if self.replay_buffer is not None and prev_decision and prev_decision.get('was_executed'):
            updated_exp = self.replay_buffer.update_pending_reward(
                territory_id,
                reward_info['reward']
            )
            if updated_exp:
                logger.debug(f"[BackgroundTraining] Updated pending reward: {reward_info['reward']:.3f}")

            # Record actual reward in gate metrics
            if self.simulation_gate:
                self.simulation_gate.record_actual_reward(reward_info['reward'])

    async def _run_nn_inference(self, features) -> Dict[str, Any]:
        """Run NN inference with timeout."""
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                self.nn_model.get_spawn_decision,
                features
            ),
            timeout=2.0  # 2s timeout to allow TensorFlow warm-up
        )

    def _record_entropy(self, features) -> None:
        """Record entropy for distribution health monitoring."""
        try:
            dist_stats = self.nn_model.get_distribution_stats(features)
            dashboard = self.get_dashboard_metrics()
            dashboard.record_entropy(
                entropy=dist_stats['entropy'],
                max_entropy=dist_stats['max_entropy'],
                effective_actions=dist_stats['effective_actions']
            )
        except Exception as e:
            logger.debug(f"Failed to record entropy: {e}")

    def _evaluate_gate(
        self,
        observation: Dict[str, Any],
        spawn_chunk: int,
        spawn_type: str,
        confidence: float,
        nn_decision: str,
        territory_id: str
    ) -> Tuple[Optional["GateDecision"], bool]:
        """Evaluate simulation gate and return decision."""
        should_skip = False
        gate_decision = None

        if not self.simulation_gate:
            # Fallback to confidence threshold
            threshold = self.nn_config.spawn_gating.confidence_threshold
            exploration_rate = self.nn_config.spawn_gating.exploration_rate
            should_skip = confidence < threshold

            import random
            if should_skip and random.random() < exploration_rate:
                should_skip = False
                logger.info(f"[Observation] Exploration override: spawning despite low confidence {confidence:.3f}")

            return None, should_skip

        # Build observation for simulation gate
        sim_observation = self._build_simulation_observation(observation)

        # Evaluate through simulation gate
        gate_decision = self.simulation_gate.evaluate(
            sim_observation,
            spawn_chunk,
            spawn_type,
            confidence,
            full_observation=observation
        )

        # Update thinking loop statistics
        self.thinking_stats['total_gate_evaluations'] += 1
        obs_count = self.thinking_stats['observations_since_last_action']

        # Process gate decision
        if nn_decision == 'no_spawn':
            logger.info(f"[Gate Validation] {gate_decision.decision}")
            should_skip = True
        elif gate_decision.decision == 'SEND':
            if gate_decision.reason == 'simulation_mode':
                should_skip = False
            else:
                nn_threshold = self.nn_config.spawn_gating.confidence_threshold
                should_skip = confidence < nn_threshold

            self.thinking_stats['gate_passes'] += 1
            self.thinking_stats['observations_since_last_action'] = 0

            if gate_decision.reason == 'confidence_override':
                self.thinking_stats['confidence_overrides'] += 1

            self.simulation_gate.record_spawn(spawn_chunk)
        else:
            should_skip = True
            self.thinking_stats['observations_since_last_action'] += 1

        return gate_decision, should_skip

    def _build_simulation_observation(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        """Build observation dict for simulation gate evaluation."""
        protectors = observation.get('protectors', [])
        protector_chunks = [p.get('chunkId', -1) for p in protectors if isinstance(p, dict)]

        workers_present = observation.get('workersPresent', [])
        workers_mining = observation.get('miningWorkers', [])
        all_workers = workers_present + workers_mining
        worker_chunks = list(set(w.get('chunkId', -1) for w in all_workers if isinstance(w, dict)))

        hive_chunk = observation.get('hiveChunk', 0)
        queen_energy_data = observation.get('queenEnergy', {})
        queen_energy = queen_energy_data.get('current', 50) if isinstance(queen_energy_data, dict) else 50

        return {
            'protector_chunks': protector_chunks,
            'worker_chunks': worker_chunks,
            'hive_chunk': hive_chunk,
            'queen_energy': queen_energy
        }

    def _add_experience_to_buffer(
        self,
        features,
        spawn_chunk: int,
        spawn_type: str,
        confidence: float,
        gate_decision,
        territory_id: str
    ) -> None:
        """Add experience to replay buffer for background training."""
        if self.replay_buffer is None:
            logger.warning("[BackgroundTraining] replay_buffer is None - not initialized!")
            return

        if gate_decision is None:
            logger.warning("[BackgroundTraining] gate_decision is None - experiences not being stored!")
            return

        expected_reward = gate_decision.expected_reward
        was_executed = gate_decision.decision == 'SEND'
        gate_signal = (
            expected_reward - self.simulation_gate.config.reward_threshold
            if expected_reward != float('-inf') else -1.0
        )

        try:
            from ai_engine.training import Experience as TrainingExperience
            experience = TrainingExperience(
                observation=features,
                spawn_chunk=spawn_chunk,
                spawn_type=spawn_type,
                nn_confidence=confidence,
                gate_signal=gate_signal,
                R_expected=expected_reward if expected_reward != float('-inf') else -1.0,
                was_executed=was_executed,
                actual_reward=None,
                territory_id=territory_id,
                model_version=self.background_trainer.model_version if self.background_trainer else 0
            )
            self.replay_buffer.add(experience)
            logger.debug(f"[BackgroundTraining] Added experience: chunk={spawn_chunk}")
        except Exception as e:
            logger.warning(f"[BackgroundTraining] Failed to add experience: {e}")

    def _generate_response(
        self,
        spawn_decision: Dict[str, Any],
        gate_decision,
        nn_decision: str,
        confidence: float
    ) -> Dict[str, Any]:
        """Generate response based on gate decision."""
        # Gate blocks spawn decision - send acknowledgement
        if nn_decision == 'spawn' and gate_decision and gate_decision.decision != 'SEND':
            return {
                "type": "observation_ack",
                "timestamp": asyncio.get_event_loop().time(),
                "data": {"status": "processed", "action": "none"}
            }

        # Send NN decision in clean format
        response_data = {
            "spawnChunk": spawn_decision["spawnChunk"],
            "spawnType": spawn_decision["spawnType"],
            "confidence": confidence
        }

        if nn_decision == 'spawn':
            response_data["typeConfidence"] = spawn_decision["typeConfidence"]

        return {
            "type": "spawn_decision",
            "timestamp": asyncio.get_event_loop().time(),
            "data": response_data
        }

    def get_thinking_stats(self) -> Dict[str, Any]:
        """Get thinking loop statistics."""
        return self.thinking_stats.copy()
