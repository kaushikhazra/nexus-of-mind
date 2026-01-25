"""
Dashboard Metrics Collection

Singleton class for collecting and aggregating dashboard metrics.
Thread-safe for concurrent access from message handler and API endpoint.
"""

import time
import threading
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Deque, Any
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class NNDecisionRecord:
    """Single NN decision record for dashboard display."""
    chunk: int
    spawn_type: str  # 'energy' or 'combat'
    confidence: float
    sent: bool
    expected_reward: float
    timestamp: float


@dataclass
class GateDecisionRecord:
    """Record of gate decision for analytics."""
    decision: str  # 'SEND' or 'WAIT'
    reason: str  # 'positive_reward', 'negative_reward', 'insufficient_energy'
    expected_reward: float
    components: Dict[str, float]
    timestamp: float


class DashboardMetrics:
    """
    Singleton class for collecting and aggregating dashboard metrics.
    Thread-safe for concurrent access from message handler and API endpoint.
    """
    _instance: Optional['DashboardMetrics'] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, '_initialized', False):
            return

        # NN Decisions tracking (16x16 = 256 spawn chunks, matching NN output)
        self.chunk_frequency: List[int] = [0] * 256  # 16x16 grid (total)
        self.chunk_sent: List[int] = [0] * 256  # Chunks where spawn was sent
        self.chunk_skipped: List[int] = [0] * 256  # Chunks where spawn was skipped
        self.recent_decisions: Deque[NNDecisionRecord] = deque(maxlen=20)
        self.type_counts: Dict[str, int] = {'energy': 0, 'combat': 0}
        self.confidence_bins: List[int] = [0] * 10  # 0.0-0.1, 0.1-0.2, ..., 0.9-1.0

        # No-spawn statistics
        self.no_spawn_decisions: int = 0
        self.correct_no_spawn: int = 0
        self.missed_opportunities: int = 0

        # Gate behavior tracking
        self.gate_decisions: Deque[GateDecisionRecord] = deque(maxlen=100)
        self.wait_streak: int = 0
        self.last_action_time: float = time.time()

        # Training tracking
        self.loss_history: Deque[float] = deque(maxlen=1000)
        self.simulation_rewards: Deque[float] = deque(maxlen=500)
        self.real_rewards: Deque[float] = deque(maxlen=500)
        self.total_training_steps: int = 0

        # Background training tracking
        self.model_version: int = 0
        self.buffer_size: int = 0

        # Entropy tracking (distribution health)
        self.entropy_history: Deque[float] = deque(maxlen=500)
        self.current_entropy: float = 0.0
        self.max_entropy: float = 5.549  # log(257) for 257 chunks
        self.effective_actions: float = 0.0

        # Server info
        self.start_time: float = time.time()

        # Current game state (updated each observation)
        self.current_game_state: Dict = {}

        # Pipeline visualization - stores the most recent decision details
        self.last_pipeline: Optional[Dict] = None

        self._initialized = True
        self._data_lock = threading.Lock()

        logger.info("DashboardMetrics singleton initialized")

    def record_nn_decision(
        self,
        chunk: int,
        spawn_type: str,
        confidence: float,
        sent: bool,
        expected_reward: float
    ) -> None:
        """
        Record an NN inference decision.

        Args:
            chunk: Spawn chunk ID (0-399)
            spawn_type: 'energy' or 'combat'
            confidence: NN confidence score (0-1)
            sent: Whether the decision was sent to frontend
            expected_reward: Expected reward from cost function
        """
        with self._data_lock:
            # Update chunk frequency (total and sent/skipped)
            # NN outputs chunks 0-255 (256 spawn locations)
            if 0 <= chunk < 256:
                self.chunk_frequency[chunk] += 1
                if sent:
                    self.chunk_sent[chunk] += 1
                else:
                    self.chunk_skipped[chunk] += 1

            # Add to recent decisions
            decision = NNDecisionRecord(
                chunk=chunk,
                spawn_type=spawn_type,
                confidence=confidence,
                sent=sent,
                expected_reward=expected_reward,
                timestamp=time.time()
            )
            self.recent_decisions.append(decision)

            # Update type counts
            if spawn_type in self.type_counts:
                self.type_counts[spawn_type] += 1

            # Update confidence histogram
            bin_idx = min(int(confidence * 10), 9)
            self.confidence_bins[bin_idx] += 1

    def record_gate_decision(
        self,
        decision: str,
        reason: str,
        expected_reward: float,
        components: Dict[str, float],
        observation_summary: Optional[Dict[str, Any]] = None,
        nn_inference: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Record a simulation gate decision.

        Args:
            decision: 'SEND' or 'WAIT'
            reason: Decision reason
            expected_reward: Calculated expected reward
            components: Breakdown of cost function components
            observation_summary: Summary of observation data (for pipeline viz)
            nn_inference: NN inference data (for pipeline viz)
        """
        with self._data_lock:
            # Handle -inf by converting to a large negative number for JSON
            safe_reward = expected_reward
            if expected_reward == float('-inf'):
                safe_reward = -1000.0

            # Sanitize components (replace any inf/nan values)
            safe_components = {}
            for k, v in components.items():
                if isinstance(v, (int, float)):
                    if v == float('-inf') or v == float('inf') or v != v:  # nan check
                        safe_components[k] = 0.0
                    else:
                        safe_components[k] = v
                else:
                    safe_components[k] = v

            record = GateDecisionRecord(
                decision=decision,
                reason=reason,
                expected_reward=safe_reward,
                components=safe_components,
                timestamp=time.time()
            )
            self.gate_decisions.append(record)

            # Update wait streak
            if decision == 'WAIT':
                self.wait_streak += 1
            else:
                self.wait_streak = 0
                self.last_action_time = time.time()

            # Track no-spawn statistics
            if nn_inference and nn_inference.get('nn_decision') == 'no_spawn':
                self.no_spawn_decisions += 1
                if decision == 'CORRECT_WAIT':
                    self.correct_no_spawn += 1
                elif decision == 'SHOULD_SPAWN':
                    self.missed_opportunities += 1

            # Store pipeline data for visualization (use sanitized components)
            self.last_pipeline = {
                'observation': observation_summary or {},
                'nn_inference': nn_inference or {},
                'gate_components': {
                    **safe_components,
                    'weights': {
                        'survival': 0.4,
                        'disruption': 0.5,
                        'location': 0.1
                    }
                },
                'combined_reward': {
                    'expected_reward': round(safe_reward, 3),
                    'formula': 'V × (0.4×S + 0.5×D + 0.1×L) + E'
                },
                'decision': {
                    'action': decision,
                    'reason': reason,
                    'timestamp': time.time()
                }
            }

    def record_training_step(
        self,
        loss: float,
        reward: float,
        is_simulation: bool = False,
        model_version: Optional[int] = None,
        buffer_size: Optional[int] = None
    ) -> None:
        """
        Record a training step.

        Args:
            loss: Training loss value
            reward: Reward signal used for training
            is_simulation: Whether this is simulation feedback vs real game feedback
            model_version: Current model version (from background trainer)
            buffer_size: Current replay buffer size
        """
        with self._data_lock:
            self.loss_history.append(loss)
            if is_simulation:
                self.simulation_rewards.append(reward)
            else:
                self.real_rewards.append(reward)
            self.total_training_steps += 1

            # Update background training stats
            if model_version is not None:
                self.model_version = model_version
            if buffer_size is not None:
                self.buffer_size = buffer_size

    def record_entropy(
        self,
        entropy: float,
        max_entropy: float,
        effective_actions: float
    ) -> None:
        """
        Record entropy metrics for distribution health monitoring.

        Args:
            entropy: Current entropy of chunk probability distribution
            max_entropy: Maximum possible entropy (log of num chunks)
            effective_actions: Perplexity - effective number of choices
        """
        with self._data_lock:
            self.current_entropy = entropy
            self.max_entropy = max_entropy
            self.effective_actions = effective_actions
            self.entropy_history.append(entropy)

    def update_game_state(self, game_state: Dict) -> None:
        """
        Update current game state.

        Args:
            game_state: Dictionary with current game state info
        """
        with self._data_lock:
            self.current_game_state = game_state.copy()

    def get_snapshot(self) -> Dict:
        """
        Get complete metrics snapshot for API response.

        Returns:
            Dictionary with all dashboard data
        """
        with self._data_lock:
            current_time = time.time()

            # Calculate gate statistics
            recent_gate = list(self.gate_decisions)
            total_decisions = len(recent_gate)
            sent_count = sum(1 for d in recent_gate if d.decision == 'SEND')
            pass_rate = sent_count / total_decisions if total_decisions > 0 else 0.0

            # Decision reasons breakdown
            reasons = {
                'positive_reward': 0,
                'negative_reward': 0,
                'insufficient_energy': 0
            }
            for d in recent_gate:
                if d.reason in reasons:
                    reasons[d.reason] += 1

            # Average components
            avg_components = {
                'survival': 0.0,
                'disruption': 0.0,
                'location': 0.0,
                'exploration': 0.0
            }
            if recent_gate:
                for comp in avg_components:
                    values = [d.components.get(comp, 0.0) for d in recent_gate]
                    avg_components[comp] = sum(values) / len(values) if values else 0.0

            # Reward history from gate decisions (filter out -inf values)
            reward_history = [
                d.expected_reward for d in recent_gate
                if d.expected_reward > -999
            ][-50:]

            # Training statistics
            loss_list = list(self.loss_history)
            sim_rewards = list(self.simulation_rewards)
            real_rewards = list(self.real_rewards)

            # Calculate averages
            avg_loss = sum(loss_list) / len(loss_list) if loss_list else 0.0
            all_rewards = sim_rewards + real_rewards
            avg_reward = sum(all_rewards) / len(all_rewards) if all_rewards else 0.0

            return {
                'timestamp': current_time,
                'uptime_seconds': current_time - self.start_time,
                'nn_decisions': {
                    'chunk_frequency': self.chunk_frequency.copy(),
                    'chunk_sent': self.chunk_sent.copy(),
                    'chunk_skipped': self.chunk_skipped.copy(),
                    'recent_decisions': [
                        {
                            'chunk': d.chunk,
                            'type': d.spawn_type,
                            'confidence': round(d.confidence, 3),
                            'sent': d.sent,
                            'timestamp': d.timestamp
                        }
                        for d in list(self.recent_decisions)[-10:]
                    ],
                    'type_counts': self.type_counts.copy(),
                    'confidence_histogram': self.confidence_bins.copy(),
                    'no_spawn_stats': {
                        'total_no_spawn': self.no_spawn_decisions,
                        'correct_no_spawn': self.correct_no_spawn,
                        'missed_opportunities': self.missed_opportunities,
                        'no_spawn_accuracy': round(
                            self.correct_no_spawn / self.no_spawn_decisions if self.no_spawn_decisions > 0 else 0.0, 3
                        )
                    }
                },
                'gate_behavior': {
                    'pass_rate': round(pass_rate, 3),
                    'decision_reasons': reasons,
                    'avg_components': {k: round(v, 3) for k, v in avg_components.items()},
                    'reward_history': [round(r, 3) for r in reward_history],
                    'wait_streak': self.wait_streak,
                    'time_since_last_action': round(current_time - self.last_action_time, 1)
                },
                'training': {
                    'loss_history': [round(l, 4) for l in loss_list],
                    'simulation_rewards': [round(r, 3) for r in sim_rewards],
                    'real_rewards': [round(r, 3) for r in real_rewards],
                    'total_steps': self.total_training_steps,
                    'avg_loss': round(avg_loss, 4),
                    'avg_reward': round(avg_reward, 3),
                    'model_version': self.model_version,
                    'buffer_size': self.buffer_size,
                    'stats': {
                        'training_count': self.total_training_steps
                    }
                },
                'entropy': {
                    'current': round(self.current_entropy, 3),
                    'max': round(self.max_entropy, 3),
                    'ratio': round(self.current_entropy / self.max_entropy, 3) if self.max_entropy > 0 else 0,
                    'effective_actions': round(self.effective_actions, 1),
                    'total_actions': 6,  # 5 chunks + NO_SPAWN in 5-NN architecture
                    'history': [round(e, 3) for e in list(self.entropy_history)[-100:]],
                    'health': self._get_entropy_health()
                },
                'game_state': self.current_game_state.copy(),
                'pipeline': self.last_pipeline
            }

    def _get_entropy_health(self) -> str:
        """
        Get a human-readable health status for entropy.

        Returns:
            'healthy', 'warning', or 'collapsed'
        """
        if self.max_entropy == 0:
            return 'unknown'

        ratio = self.current_entropy / self.max_entropy

        if ratio >= 0.5:
            return 'healthy'  # Good exploration
        elif ratio >= 0.25:
            return 'warning'  # Starting to collapse
        else:
            return 'collapsed'  # Distribution has collapsed

    def reset(self) -> None:
        """Reset all metrics to initial state."""
        with self._data_lock:
            self.chunk_frequency = [0] * 256
            self.chunk_sent = [0] * 256
            self.chunk_skipped = [0] * 256
            self.recent_decisions.clear()
            self.type_counts = {'energy': 0, 'combat': 0}
            self.confidence_bins = [0] * 10

            # Reset no-spawn statistics
            self.no_spawn_decisions = 0
            self.correct_no_spawn = 0
            self.missed_opportunities = 0

            self.gate_decisions.clear()
            self.wait_streak = 0
            self.last_action_time = time.time()

            self.loss_history.clear()
            self.simulation_rewards.clear()
            self.real_rewards.clear()
            self.total_training_steps = 0
            self.model_version = 0
            self.buffer_size = 0

            # Reset entropy tracking
            self.entropy_history.clear()
            self.current_entropy = 0.0
            self.effective_actions = 0.0

            self.start_time = time.time()
            self.current_game_state = {}
            self.last_pipeline = None

            logger.info("DashboardMetrics reset")


# Convenience function to get the singleton instance
def get_dashboard_metrics() -> DashboardMetrics:
    """Get the DashboardMetrics singleton instance."""
    return DashboardMetrics()
