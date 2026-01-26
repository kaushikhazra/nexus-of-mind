"""
Simulation Gate

Decision gate that allows/blocks spawn actions based on cost function evaluation.
Includes metrics collection and structured logging.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, Tuple
import logging

from .config import SimulationGateConfig
from .cost_function import SimulationCostFunction
from .metrics import GateMetrics
from .dashboard_metrics import get_dashboard_metrics

logger = logging.getLogger(__name__)


@dataclass
class GateDecision:
    """Result of simulation gate evaluation."""

    decision: str  # 'SEND', 'WAIT', 'CORRECT_WAIT', 'SHOULD_SPAWN'
    reason: str    # 'positive_reward', 'negative_reward', 'insufficient_energy', 'no_viable_targets', 'missed_opportunity'
    expected_reward: float
    nn_confidence: float
    components: Dict[str, float]  # Breakdown of cost function components


class SimulationGate:
    """
    Evaluates spawn actions and decides whether to execute or wait.

    Decision logic:
    1. If expected_reward > reward_threshold: SEND
    2. Otherwise: WAIT

    Note: Gate is the final authority. No confidence override - NN confidence
    cannot bypass the gate's game state evaluation.
    """

    def __init__(self, config: Optional[SimulationGateConfig] = None, metrics_window: int = 100):
        """
        Initialize simulation gate.

        Args:
            config: Simulation configuration (uses defaults if None)
            metrics_window: Number of samples for rolling metrics
        """
        self.config = config or SimulationGateConfig()
        self.cost_function = SimulationCostFunction(self.config)
        self.metrics = GateMetrics(window_size=metrics_window)

    def evaluate(
        self,
        observation: Dict[str, Any],
        spawn_chunk: int,  # -1 for no-spawn
        spawn_type: Optional[str],
        nn_confidence: float,
        full_observation: Optional[Dict[str, Any]] = None
    ) -> GateDecision:
        """
        Evaluate proposed spawn action or no-spawn decision.

        Args:
            observation: Current game observation (simplified for cost function)
            spawn_chunk: Proposed spawn chunk ID (-1 for no-spawn)
            spawn_type: 'energy' or 'combat' (None for no-spawn)
            nn_confidence: NN's confidence in this decision
            full_observation: Full observation data for dashboard recording (optional)

        Returns:
            GateDecision with decision and details
        """
        # Store full observation for dashboard recording
        self._full_observation = full_observation

        # In simulation mode, always pass through (100% transparent)
        simulation_mode = self.config.reward_threshold < -1000
        if simulation_mode:
            decision = GateDecision(
                decision='SEND',
                reason='simulation_mode',
                expected_reward=0.0,
                nn_confidence=nn_confidence,
                components={}
            )
            self.metrics.record_evaluation(
                decision.decision, decision.reason,
                decision.expected_reward, decision.nn_confidence,
                decision.components
            )
            self._record_to_dashboard(
                full_observation or observation,
                spawn_chunk, spawn_type, nn_confidence, decision
            )
            return decision

        # Production mode: route to appropriate evaluation method
        if spawn_chunk == -1:
            return self._evaluate_no_spawn(observation, nn_confidence, full_observation)
        else:
            return self._evaluate_spawn(observation, spawn_chunk, spawn_type, nn_confidence, full_observation)
    def _evaluate_spawn(
        self,
        observation: Dict[str, Any],
        spawn_chunk: int,
        spawn_type: str,
        nn_confidence: float,
        full_observation: Optional[Dict[str, Any]] = None
    ) -> GateDecision:
        """
        Evaluate NN's decision to spawn at a specific location.
        
        Args:
            observation: Current game observation (simplified for cost function)
            spawn_chunk: Proposed spawn chunk ID
            spawn_type: 'energy' or 'combat'
            nn_confidence: NN's confidence in this decision
            full_observation: Full observation data for dashboard recording (optional)
            
        Returns:
            GateDecision with decision and details
        """
        # Skip if gate disabled
        if not self.config.gate_enabled:
            decision = GateDecision(
                decision='SEND',
                reason='gate_disabled',
                expected_reward=0.0,
                nn_confidence=nn_confidence,
                components={}
            )
            self.metrics.record_evaluation(
                decision.decision, decision.reason,
                decision.expected_reward, decision.nn_confidence,
                decision.components
            )
            return decision

        # Calculate expected reward
        result = self.cost_function.calculate_expected_reward(
            observation, spawn_chunk, spawn_type
        )

        expected_reward = result['expected_reward']
        components = {
            'survival': result['survival'],
            'disruption': result['disruption'],
            'location': result['location'],
            'exploration': result['exploration']
        }

        # Check capacity - in simulation mode (threshold < -1000), pass through anyway
        # so the simulation can provide real feedback
        simulation_mode = self.config.reward_threshold < -1000

        if not result['capacity_valid'] and not simulation_mode:
            # Production mode: block insufficient energy
            decision = GateDecision(
                decision='WAIT',
                reason='insufficient_energy',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )
            self.metrics.record_evaluation(
                decision.decision, decision.reason,
                decision.expected_reward, decision.nn_confidence,
                decision.components
            )
            # Record to dashboard before returning
            dashboard_obs = self._full_observation if self._full_observation else observation
            self._record_to_dashboard(dashboard_obs, spawn_chunk, spawn_type, nn_confidence, decision)
            return decision

        # Check reward threshold (gate is the final authority)
        # In simulation mode, pass everything through for real feedback
        if simulation_mode or expected_reward > self.config.reward_threshold:
            decision = GateDecision(
                decision='SEND',
                reason='simulation_mode' if simulation_mode else 'positive_reward',
                expected_reward=expected_reward if expected_reward != float('-inf') else 0.0,
                nn_confidence=nn_confidence,
                components=components
            )
        else:
            decision = GateDecision(
                decision='WAIT',
                reason='negative_reward',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )

        self.metrics.record_evaluation(
            decision.decision, decision.reason,
            decision.expected_reward, decision.nn_confidence,
            decision.components
        )

        # Record to dashboard metrics (use full_observation if available)
        dashboard_obs = self._full_observation if self._full_observation else observation
        self._record_to_dashboard(dashboard_obs, spawn_chunk, spawn_type, nn_confidence, decision)

        return decision

    def _evaluate_no_spawn(
        self,
        observation: Dict[str, Any],
        nn_confidence: float,
        full_observation: Optional[Dict[str, Any]] = None
    ) -> GateDecision:
        """
        Evaluate NN's decision to NOT spawn.

        Find the best possible spawn and compare:
        - If best_reward > threshold: NN missed an opportunity
        - If best_reward <= threshold: NN was correct to wait
        
        Args:
            observation: Current game observation
            nn_confidence: NN's confidence in this decision
            full_observation: Full observation data for dashboard recording (optional)
            
        Returns:
            GateDecision with decision and details
        """
        # Find best available chunk
        best_chunk, best_reward, best_type = self._find_best_spawn(observation)

        components = {
            'best_chunk': best_chunk,
            'best_reward': best_reward,
            'best_type': best_type
        }

        if best_reward > self.config.reward_threshold:
            # NN should have spawned - missed opportunity
            decision = GateDecision(
                decision='SHOULD_SPAWN',
                reason='missed_opportunity',
                expected_reward=-best_reward,  # Negative signal
                nn_confidence=nn_confidence,
                components=components
            )
        else:
            # NN was correct to wait
            decision = GateDecision(
                decision='CORRECT_WAIT',
                reason='no_viable_targets',
                expected_reward=0.2,  # Small positive signal
                nn_confidence=nn_confidence,
                components=components
            )

        self.metrics.record_evaluation(
            decision.decision, decision.reason,
            decision.expected_reward, decision.nn_confidence,
            decision.components
        )

        # Record to dashboard metrics (use full_observation if available)
        dashboard_obs = self._full_observation if self._full_observation else observation
        self._record_to_dashboard(dashboard_obs, -1, None, nn_confidence, decision)

        return decision

    def _record_to_dashboard(
        self,
        observation: Dict[str, Any],
        spawn_chunk: int,
        spawn_type: Optional[str],
        nn_confidence: float,
        decision: GateDecision
    ) -> None:
        """Record decision to dashboard metrics for visualization."""
        try:
            dashboard = get_dashboard_metrics()

            # Record NN decision
            dashboard.record_nn_decision(
                chunk=spawn_chunk,
                spawn_type=spawn_type,
                confidence=nn_confidence,
                sent=(decision.decision == 'SEND'),
                expected_reward=decision.expected_reward
            )

            # Build observation summary for pipeline visualization
            # Note: simulator uses 'miningWorkers', backend uses 'workersPresent'
            workers = observation.get('miningWorkers', observation.get('workersPresent', []))
            protectors = observation.get('protectors', [])
            parasites_end = observation.get('parasitesEnd', [])
            queen_energy = observation.get('queenEnergy', {})
            player_energy = observation.get('playerEnergy', {})
            player_minerals = observation.get('playerMinerals', {})

            # Calculate player rates
            energy_start = player_energy.get('start', 0)
            energy_end = player_energy.get('end', 0)
            energy_rate = 0.0
            if max(energy_start, energy_end) > 0:
                energy_rate = (energy_end - energy_start) / max(energy_start, energy_end)

            mineral_start = player_minerals.get('start', 0)
            mineral_end = player_minerals.get('end', 0)
            mineral_rate = 0.0
            if max(mineral_start, mineral_end) > 0:
                mineral_rate = (mineral_end - mineral_start) / max(mineral_start, mineral_end)

            # Extract chunk IDs for heatmap visualization
            worker_chunks = [w.get('chunkId', -1) for w in workers if isinstance(w, dict)]
            protector_chunks = [p.get('chunkId', -1) for p in protectors if isinstance(p, dict)]
            parasite_chunks = [p.get('chunkId', -1) for p in parasites_end if isinstance(p, dict)]

            observation_summary = {
                'workers_count': len(workers),
                'protectors_count': len(protectors),
                'parasites_count': len(parasites_end),
                'queen_energy': queen_energy.get('current', 0),
                'player_energy_rate': round(energy_rate, 3),
                'player_mineral_rate': round(mineral_rate, 3),
                'worker_chunks': worker_chunks,
                'protector_chunks': protector_chunks,
                'parasite_chunks': parasite_chunks
            }

            nn_output = {
                'chunk_id': spawn_chunk,
                'spawn_type': spawn_type,
                'confidence': round(nn_confidence, 3),
                'nn_decision': 'no_spawn' if spawn_chunk == -1 else 'spawn'
            }

            # Record gate decision with pipeline data
            dashboard.record_gate_decision(
                decision=decision.decision,
                reason=decision.reason,
                expected_reward=decision.expected_reward,
                components=decision.components,
                observation_summary=observation_summary,
                nn_inference=nn_output
            )
        except Exception as e:
            logger.warning(f"Failed to record to dashboard metrics: {e}")

    def record_spawn(self, chunk_id: int) -> None:
        """Record that spawn was executed at chunk."""
        self.cost_function.record_spawn(chunk_id)

    def get_statistics(self) -> Dict:
        """Get comprehensive gate statistics."""
        return {
            'exploration': self.cost_function.get_exploration_stats(),
            'metrics': self.metrics.get_statistics()
        }

    def record_actual_reward(self, reward: float) -> None:
        """Record actual reward from game for metrics tracking."""
        self.metrics.record_actual_reward(reward)

    def get_wait_streak(self) -> int:
        """Get current consecutive WAIT streak."""
        return self.metrics.get_wait_streak()

    def get_time_since_last_action(self) -> float:
        """Get seconds since last SEND decision."""
        return self.metrics.get_time_since_last_action()

    def _get_candidate_chunks(self, observation: Dict[str, Any]) -> list[int]:
        """
        Get candidate chunks to evaluate (chunks near workers/activity).
        
        Args:
            observation: Current game observation
            
        Returns:
            List of chunk IDs to evaluate (limited to 20 for performance)
        """
        candidates = set()

        # Add chunks with workers
        for worker in observation.get('workersPresent', []):
            if 'chunk' in worker:
                candidates.add(worker['chunk'])
                # Add neighboring chunks
                for neighbor in self._get_neighbors(worker['chunk']):
                    candidates.add(neighbor)

        # Add chunks with mining workers
        for worker in observation.get('workersMining', []):
            if 'chunk' in worker:
                candidates.add(worker['chunk'])

        # Limit to prevent performance issues
        return list(candidates)[:20]

    def _get_neighbors(self, chunk_id: int) -> list[int]:
        """
        Get neighboring chunk IDs for a given chunk.
        
        Args:
            chunk_id: Center chunk ID
            
        Returns:
            List of neighboring chunk IDs
        """
        # Assuming 16x16 grid (256 chunks total)
        grid_size = 16
        row = chunk_id // grid_size
        col = chunk_id % grid_size
        
        neighbors = []
        
        # Check all 8 directions (including diagonals)
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue  # Skip center chunk
                    
                new_row = row + dr
                new_col = col + dc
                
                # Check bounds
                if 0 <= new_row < grid_size and 0 <= new_col < grid_size:
                    neighbor_id = new_row * grid_size + new_col
                    neighbors.append(neighbor_id)
        
        return neighbors

    def _find_best_spawn(self, observation: Dict[str, Any]) -> tuple[int, float, str]:
        """
        Find the best possible spawn location and its expected reward.

        Evaluates top candidate chunks (e.g., near workers) and returns
        the one with highest expected reward.
        
        Args:
            observation: Current game observation
            
        Returns:
            Tuple of (best_chunk, best_reward, best_type)
        """
        candidate_chunks = self._get_candidate_chunks(observation)

        best_chunk = -1
        best_reward = float('-inf')
        best_type = 'energy'

        for chunk in candidate_chunks:
            for spawn_type in ['energy', 'combat']:
                result = self.cost_function.calculate_expected_reward(
                    observation, chunk, spawn_type
                )
                reward = result['expected_reward']
                
                if reward > best_reward:
                    best_reward = reward
                    best_chunk = chunk
                    best_type = spawn_type

        return best_chunk, best_reward, best_type
