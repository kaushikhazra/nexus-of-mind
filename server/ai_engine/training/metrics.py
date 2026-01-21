"""
Training metrics for continuous training loop.
"""

from dataclasses import dataclass, field
from collections import deque
import time


@dataclass
class TrainingMetrics:
    """Metrics for continuous training."""

    # Rolling windows
    window_size: int = 100
    loss_history: deque = field(default_factory=lambda: deque(maxlen=100))
    batch_size_history: deque = field(default_factory=lambda: deque(maxlen=100))
    step_time_history: deque = field(default_factory=lambda: deque(maxlen=100))
    gate_signal_history: deque = field(default_factory=lambda: deque(maxlen=100))

    # Lifetime counters
    total_steps: int = 0
    total_samples_trained: int = 0
    total_errors: int = 0
    start_time: float = field(default_factory=time.time)

    def record_step(
        self,
        loss: float,
        batch_size: int,
        step_time_ms: float,
        avg_gate_signal: float = 0.0
    ) -> None:
        """Record metrics for a training step."""
        self.loss_history.append(loss)
        self.batch_size_history.append(batch_size)
        self.step_time_history.append(step_time_ms)
        self.gate_signal_history.append(avg_gate_signal)
        self.total_steps += 1
        self.total_samples_trained += batch_size

    def record_error(self) -> None:
        """Record a training error."""
        self.total_errors += 1

    def get_stats(self) -> dict:
        """Get current statistics."""
        uptime = time.time() - self.start_time

        return {
            "total_steps": self.total_steps,
            "total_samples_trained": self.total_samples_trained,
            "total_errors": self.total_errors,
            "steps_per_second": self.total_steps / uptime if uptime > 0 else 0,
            "average_loss": (
                sum(self.loss_history) / len(self.loss_history)
                if self.loss_history else 0
            ),
            "average_batch_size": (
                sum(self.batch_size_history) / len(self.batch_size_history)
                if self.batch_size_history else 0
            ),
            "average_step_time_ms": (
                sum(self.step_time_history) / len(self.step_time_history)
                if self.step_time_history else 0
            ),
            "average_gate_signal": (
                sum(self.gate_signal_history) / len(self.gate_signal_history)
                if self.gate_signal_history else 0
            ),
            "uptime_seconds": uptime,
        }

    def reset(self) -> None:
        """Reset all metrics."""
        self.loss_history.clear()
        self.batch_size_history.clear()
        self.step_time_history.clear()
        self.gate_signal_history.clear()
        self.total_steps = 0
        self.total_samples_trained = 0
        self.total_errors = 0
        self.start_time = time.time()
