"""
Simulation Gate

Decision gate that allows/blocks spawn actions based on cost function evaluation.
Includes metrics collection and structured logging.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
import logging

from .config import SimulationGateConfig
from .cost_function import SimulationCostFunction
from .metrics import GateMetrics
from .dashboard_metrics import get_dashboard_metrics

logger = logging.getLogger(__name__)


@dataclass
class GateDecision:
    """Result of simulation gate evaluation."""

    decision: str  # 'SEND' or 'WAIT'
    reason: str    # 'positive_reward', 'negative_reward', 'insufficient_energy'
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
        spawn_chunk: int,
        spawn_type: str,
        nn_confidence: float,
        full_observation: Optional[Dict[str, Any]] = None
    ) -> GateDecision:
        """
        Evaluate proposed spawn action.

        Args:
            observation: Current game observation (simplified for cost function)
            spawn_chunk: Proposed spawn chunk ID
            spawn_type: 'energy' or 'combat'
            nn_confidence: NN's confidence in this decision
            full_observation: Full observation data for dashboard recording (optional)

        Returns:
            GateDecision with decision and details
        """
        # Store full observation for dashboard recording
        self._full_observation = full_observation
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

        # Check capacity first
        if not result['capacity_valid']:
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
        if expected_reward > self.config.reward_threshold:
            decision = GateDecision(
                decision='SEND',
                reason='positive_reward',
                expected_reward=expected_reward,
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

    def _record_to_dashboard(
        self,
        observation: Dict[str, Any],
        spawn_chunk: int,
        spawn_type: str,
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
            workers = observation.get('workersPresent', [])
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

            observation_summary = {
                'workers_count': len(workers),
                'protectors_count': len(protectors),
                'parasites_count': len(parasites_end),
                'queen_energy': queen_energy.get('current', 0),
                'player_energy_rate': round(energy_rate, 3),
                'player_mineral_rate': round(mineral_rate, 3)
            }

            nn_output = {
                'chunk_id': spawn_chunk,
                'spawn_type': spawn_type,
                'confidence': round(nn_confidence, 3),
                'skip': decision.decision == 'WAIT'
            }

            # Record gate decision with pipeline data
            dashboard.record_gate_decision(
                decision=decision.decision,
                reason=decision.reason,
                expected_reward=decision.expected_reward,
                components=decision.components,
                observation_summary=observation_summary,
                nn_output=nn_output
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
