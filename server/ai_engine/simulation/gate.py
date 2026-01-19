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

logger = logging.getLogger(__name__)


@dataclass
class GateDecision:
    """Result of simulation gate evaluation."""

    decision: str  # 'SEND' or 'WAIT'
    reason: str    # 'positive_reward', 'confidence_override', 'negative_reward'
    expected_reward: float
    nn_confidence: float
    components: Dict[str, float]  # Breakdown of cost function components


class SimulationGate:
    """
    Evaluates spawn actions and decides whether to execute or wait.

    Decision logic:
    1. If NN confidence > threshold: SEND (confidence override)
    2. If expected_reward > reward_threshold: SEND
    3. Otherwise: WAIT
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
        nn_confidence: float
    ) -> GateDecision:
        """
        Evaluate proposed spawn action.

        Args:
            observation: Current game observation
            spawn_chunk: Proposed spawn chunk ID
            spawn_type: 'energy' or 'combat'
            nn_confidence: NN's confidence in this decision

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
            return decision

        # Check confidence override
        if nn_confidence > self.config.confidence_threshold:
            logger.debug(
                f"Confidence override triggered: {nn_confidence:.3f} > {self.config.confidence_threshold}"
            )
            decision = GateDecision(
                decision='SEND',
                reason='confidence_override',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )
            self.metrics.record_evaluation(
                decision.decision, decision.reason,
                decision.expected_reward, decision.nn_confidence,
                decision.components
            )
            return decision

        # Check reward threshold
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
        return decision

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
