"""
Experience Replay Buffer for continuous training.

Thread-safe buffer that stores both SEND and WAIT experiences.
"""

import threading
import random
import logging
from collections import deque
from typing import List, Dict, Optional

from .experience import Experience

logger = logging.getLogger(__name__)


class ExperienceReplayBuffer:
    """
    Thread-safe experience replay buffer.

    Supports:
    - Fixed capacity with FIFO eviction
    - Pending reward tracking (for SEND actions only)
    - Random batch sampling of all experiences
    - Thread-safe operations
    """

    def __init__(self, capacity: int = 10000, lock_timeout: float = 5.0):
        self.capacity = capacity
        self.lock_timeout = lock_timeout

        # Main storage - ALL experiences (SEND and WAIT)
        self._buffer: deque = deque(maxlen=capacity)
        self._lock = threading.Lock()

        # Pending SEND experiences (waiting for actual_reward)
        self._pending: Dict[str, Experience] = {}

        # Statistics
        self._total_added = 0
        self._send_count = 0
        self._wait_count = 0

    def add(self, experience: Experience) -> bool:
        """
        Add experience to buffer.

        SEND actions with no actual_reward are stored as pending.
        WAIT actions go directly to main buffer.
        Called from inference thread.

        Returns True if added successfully, False if lock timeout.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("[Buffer] Failed to acquire lock for add()")
            return False

        try:
            if experience.is_send:
                self._send_count += 1
                if experience.has_actual_reward:
                    # SEND with reward - add to main buffer
                    self._buffer.append(experience)
                    self._total_added += 1
                else:
                    # SEND pending reward - track by territory
                    self._pending[experience.territory_id] = experience
            else:
                # WAIT - add directly to buffer (no reward expected)
                self._wait_count += 1
                self._buffer.append(experience)
                self._total_added += 1

            return True
        finally:
            self._lock.release()

    def update_pending_reward(
        self,
        territory_id: str,
        actual_reward: float
    ) -> Optional[Experience]:
        """
        Update pending SEND experience with actual reward.

        Moves experience from pending to main buffer.
        Returns the completed experience, or None if not found.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("[Buffer] Failed to acquire lock for update_pending_reward()")
            return None

        try:
            if territory_id not in self._pending:
                return None

            experience = self._pending.pop(territory_id)
            experience.actual_reward = actual_reward
            self._buffer.append(experience)
            self._total_added += 1
            return experience
        finally:
            self._lock.release()

    def sample(self, batch_size: int) -> List[Experience]:
        """
        Sample random batch of experiences.

        Includes both SEND and WAIT experiences.
        Called from training thread.

        Note: For "train once and remove" behavior, use drain() instead.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("[Buffer] Failed to acquire lock for sample()")
            return []

        try:
            if len(self._buffer) == 0:
                return []

            # Random sample (without replacement)
            sample_size = min(batch_size, len(self._buffer))
            return random.sample(list(self._buffer), sample_size)
        finally:
            self._lock.release()

    def drain(self) -> List[Experience]:
        """
        Remove and return ALL experiences from buffer.

        Used for "train once, then remove" behavior.
        Returns all experiences and clears the buffer.
        Called from training thread when buffer >= min_batch_size.
        """
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("[Buffer] Failed to acquire lock for drain()")
            return []

        try:
            if len(self._buffer) == 0:
                return []

            # Get all experiences and clear buffer
            all_experiences = list(self._buffer)
            self._buffer.clear()
            return all_experiences
        finally:
            self._lock.release()

    def get_stats(self) -> dict:
        """Get buffer statistics (thread-safe)."""
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            return {}

        try:
            send_in_buffer = sum(1 for e in self._buffer if e.is_send)
            wait_in_buffer = sum(1 for e in self._buffer if e.is_wait)
            send_with_reward = sum(
                1 for e in self._buffer if e.is_send and e.has_actual_reward
            )

            # Calculate average gate signal
            if len(self._buffer) > 0:
                avg_gate_signal = sum(e.gate_signal for e in self._buffer) / len(self._buffer)
            else:
                avg_gate_signal = 0.0

            return {
                "buffer_size": len(self._buffer),
                "pending_count": len(self._pending),
                "send_count": send_in_buffer,
                "wait_count": wait_in_buffer,
                "send_with_reward": send_with_reward,
                "total_added": self._total_added,
                "total_sends": self._send_count,
                "total_waits": self._wait_count,
                "capacity": self.capacity,
                "utilization": len(self._buffer) / self.capacity if self.capacity > 0 else 0,
                "avg_gate_signal": avg_gate_signal,
            }
        finally:
            self._lock.release()

    def clear(self) -> None:
        """Clear all experiences (thread-safe)."""
        acquired = self._lock.acquire(timeout=self.lock_timeout)
        if not acquired:
            logger.warning("[Buffer] Failed to acquire lock for clear()")
            return

        try:
            self._buffer.clear()
            self._pending.clear()
        finally:
            self._lock.release()

    def __len__(self) -> int:
        """Return current buffer size (not thread-safe for performance)."""
        return len(self._buffer)
