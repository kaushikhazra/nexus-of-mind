"""
Simulation Gate

Decision gate that allows/blocks spawn actions based on cost function evaluation.
Full implementation in Phase 3.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
import logging

from .config import SimulationGateConfig
from .cost_function import SimulationCostFunction

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

    def __init__(self, config: Optional[SimulationGateConfig] = None):
        """
        Initialize simulation gate.

        Args:
            config: Simulation configuration (uses defaults if None)
        """
        self.config = config or SimulationGateConfig()
        self.cost_function = SimulationCostFunction(self.config)

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
            return GateDecision(
                decision='SEND',
                reason='gate_disabled',
                expected_reward=0.0,
                nn_confidence=nn_confidence,
                components={}
            )

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
            return GateDecision(
                decision='WAIT',
                reason='insufficient_energy',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )

        # Check confidence override
        if nn_confidence > self.config.confidence_threshold:
            logger.info(
                f"[SimGate] Confidence override: {nn_confidence:.3f} > {self.config.confidence_threshold}"
            )
            return GateDecision(
                decision='SEND',
                reason='confidence_override',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )

        # Check reward threshold
        if expected_reward > self.config.reward_threshold:
            return GateDecision(
                decision='SEND',
                reason='positive_reward',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )
        else:
            return GateDecision(
                decision='WAIT',
                reason='negative_reward',
                expected_reward=expected_reward,
                nn_confidence=nn_confidence,
                components=components
            )

    def record_spawn(self, chunk_id: int) -> None:
        """Record that spawn was executed at chunk."""
        self.cost_function.record_spawn(chunk_id)

    def get_statistics(self) -> Dict:
        """Get gate statistics."""
        return {
            'exploration': self.cost_function.get_exploration_stats()
        }
