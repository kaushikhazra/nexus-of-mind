"""
Unit tests for continuous training module.

Tests for Experience, ExperienceReplayBuffer, ContinuousTrainingConfig,
TrainingMetrics, and ContinuousTrainer.
"""

import pytest
import numpy as np
import threading
import time
from unittest.mock import Mock, MagicMock, patch

import sys
import os

# Add server directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_engine.training.experience import Experience
from ai_engine.training.buffer import ExperienceReplayBuffer
from ai_engine.training.config import ContinuousTrainingConfig
from ai_engine.training.metrics import TrainingMetrics
from ai_engine.training.trainer import ContinuousTrainer


# ============================================================================
# Experience Tests
# ============================================================================

class TestExperience:
    """Tests for Experience dataclass."""

    def _create_experience(
        self,
        was_executed: bool = True,
        gate_signal: float = 0.2,
        actual_reward: float = None
    ) -> Experience:
        """Helper to create test experience."""
        return Experience(
            observation=np.zeros(28),
            spawn_chunk=150,
            spawn_type="energy",
            nn_confidence=0.85,
            gate_signal=gate_signal,
            R_expected=gate_signal + 0.6,
            was_executed=was_executed,
            actual_reward=actual_reward,
            territory_id="test-territory",
            model_version=1,
        )

    def test_send_experience(self):
        """Test SEND experience properties."""
        exp = self._create_experience(was_executed=True, gate_signal=0.2)

        assert exp.is_send is True
        assert exp.is_wait is False
        assert exp.was_executed is True

    def test_wait_experience(self):
        """Test WAIT experience properties."""
        exp = self._create_experience(was_executed=False, gate_signal=-0.3)

        assert exp.is_send is False
        assert exp.is_wait is True
        assert exp.was_executed is False

    def test_has_actual_reward(self):
        """Test actual_reward availability check."""
        exp_pending = self._create_experience(actual_reward=None)
        exp_complete = self._create_experience(actual_reward=0.8)

        assert exp_pending.has_actual_reward is False
        assert exp_complete.has_actual_reward is True

    def test_negative_gate_signal(self):
        """Test that gate_signal can be negative (WAIT case)."""
        exp = self._create_experience(was_executed=False, gate_signal=-0.4)

        assert exp.gate_signal == -0.4
        assert exp.R_expected == pytest.approx(0.2)  # -0.4 + 0.6


# ============================================================================
# Buffer Tests
# ============================================================================

class TestExperienceReplayBuffer:
    """Tests for ExperienceReplayBuffer."""

    def _create_experience(
        self,
        was_executed: bool = True,
        gate_signal: float = 0.2,
        actual_reward: float = None,
        territory_id: str = "test"
    ) -> Experience:
        """Helper to create test experience."""
        return Experience(
            observation=np.zeros(28),
            spawn_chunk=150,
            spawn_type="energy",
            nn_confidence=0.85,
            gate_signal=gate_signal,
            R_expected=gate_signal + 0.6,
            was_executed=was_executed,
            actual_reward=actual_reward,
            territory_id=territory_id,
            model_version=1,
        )

    def test_add_wait_experience(self):
        """WAIT experiences should be added directly to buffer."""
        buffer = ExperienceReplayBuffer(capacity=100)
        exp = self._create_experience(was_executed=False, gate_signal=-0.3)

        buffer.add(exp)

        stats = buffer.get_stats()
        assert stats["buffer_size"] == 1
        assert stats["wait_count"] == 1
        assert stats["pending_count"] == 0

    def test_add_send_pending(self):
        """SEND without reward should be stored as pending."""
        buffer = ExperienceReplayBuffer(capacity=100)
        exp = self._create_experience(was_executed=True, actual_reward=None, territory_id="t1")

        buffer.add(exp)

        stats = buffer.get_stats()
        assert stats["buffer_size"] == 0
        assert stats["pending_count"] == 1

    def test_add_send_with_reward(self):
        """SEND with reward should be added directly to buffer."""
        buffer = ExperienceReplayBuffer(capacity=100)
        exp = self._create_experience(was_executed=True, actual_reward=0.8)

        buffer.add(exp)

        stats = buffer.get_stats()
        assert stats["buffer_size"] == 1
        assert stats["send_count"] == 1
        assert stats["pending_count"] == 0

    def test_update_pending_reward(self):
        """Test updating pending SEND with actual reward."""
        buffer = ExperienceReplayBuffer(capacity=100)
        exp = self._create_experience(was_executed=True, actual_reward=None, territory_id="t1")

        buffer.add(exp)
        assert buffer.get_stats()["pending_count"] == 1
        assert buffer.get_stats()["buffer_size"] == 0

        # Update with reward
        updated = buffer.update_pending_reward("t1", 0.75)

        assert updated is not None
        assert updated.actual_reward == 0.75
        assert buffer.get_stats()["pending_count"] == 0
        assert buffer.get_stats()["buffer_size"] == 1

    def test_update_nonexistent_pending(self):
        """Updating non-existent pending should return None."""
        buffer = ExperienceReplayBuffer(capacity=100)

        result = buffer.update_pending_reward("nonexistent", 0.5)

        assert result is None

    def test_sample_empty_buffer(self):
        """Sampling empty buffer should return empty list."""
        buffer = ExperienceReplayBuffer(capacity=100)

        batch = buffer.sample(32)

        assert batch == []

    def test_sample_batch(self):
        """Test random batch sampling."""
        buffer = ExperienceReplayBuffer(capacity=100)

        # Add 10 experiences
        for i in range(10):
            exp = self._create_experience(
                was_executed=i % 2 == 0,
                gate_signal=0.1 * i - 0.3,
                actual_reward=0.5 if i % 2 == 0 else None,
                territory_id=f"t{i}"
            )
            # WAIT goes directly, SEND with reward goes directly
            if not exp.is_send or exp.has_actual_reward:
                buffer.add(exp)

        stats = buffer.get_stats()
        # 5 WAIT + 5 SEND with reward = 10 in buffer
        # But SEND needs actual_reward to go to buffer directly
        # Our loop adds: SEND(reward), WAIT, SEND(reward), WAIT, ...

        batch = buffer.sample(5)

        assert len(batch) == 5
        assert all(isinstance(e, Experience) for e in batch)

    def test_sample_larger_than_buffer(self):
        """Sampling more than buffer size should return all."""
        buffer = ExperienceReplayBuffer(capacity=100)

        for i in range(5):
            exp = self._create_experience(
                was_executed=False,
                gate_signal=-0.2,
                territory_id=f"t{i}"
            )
            buffer.add(exp)

        batch = buffer.sample(100)

        assert len(batch) == 5

    def test_fifo_eviction(self):
        """Test FIFO eviction when capacity exceeded."""
        buffer = ExperienceReplayBuffer(capacity=3)

        for i in range(5):
            exp = self._create_experience(
                was_executed=False,
                gate_signal=float(i),
                territory_id=f"t{i}"
            )
            buffer.add(exp)

        stats = buffer.get_stats()
        assert stats["buffer_size"] == 3

        # Check that oldest were evicted (gate_signal 0, 1 removed)
        batch = buffer.sample(3)
        signals = [e.gate_signal for e in batch]
        assert 0.0 not in signals
        assert 1.0 not in signals

    def test_clear(self):
        """Test clearing buffer."""
        buffer = ExperienceReplayBuffer(capacity=100)

        # Add some experiences
        for i in range(5):
            exp = self._create_experience(was_executed=False, territory_id=f"t{i}")
            buffer.add(exp)

        # Add pending
        exp = self._create_experience(was_executed=True, actual_reward=None, territory_id="pending")
        buffer.add(exp)

        buffer.clear()

        stats = buffer.get_stats()
        assert stats["buffer_size"] == 0
        assert stats["pending_count"] == 0

    def test_thread_safety_concurrent_add(self):
        """Test thread safety with concurrent adds."""
        buffer = ExperienceReplayBuffer(capacity=1000)
        num_threads = 10
        adds_per_thread = 50

        def add_experiences(thread_id):
            for i in range(adds_per_thread):
                exp = self._create_experience(
                    was_executed=False,
                    gate_signal=float(thread_id * 100 + i),
                    territory_id=f"t{thread_id}_{i}"
                )
                buffer.add(exp)

        threads = [
            threading.Thread(target=add_experiences, args=(i,))
            for i in range(num_threads)
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        stats = buffer.get_stats()
        assert stats["buffer_size"] == num_threads * adds_per_thread

    def test_thread_safety_concurrent_add_sample(self):
        """Test thread safety with concurrent add and sample."""
        buffer = ExperienceReplayBuffer(capacity=1000)
        num_adds = 100
        num_samples = 50
        sample_results = []

        def add_experiences():
            for i in range(num_adds):
                exp = self._create_experience(
                    was_executed=False,
                    gate_signal=float(i),
                    territory_id=f"add_{i}"
                )
                buffer.add(exp)
                time.sleep(0.001)

        def sample_experiences():
            for _ in range(num_samples):
                batch = buffer.sample(10)
                sample_results.append(len(batch))
                time.sleep(0.002)

        add_thread = threading.Thread(target=add_experiences)
        sample_thread = threading.Thread(target=sample_experiences)

        add_thread.start()
        sample_thread.start()

        add_thread.join()
        sample_thread.join()

        # All samples should have succeeded (returned 0 or more)
        assert len(sample_results) == num_samples
        assert all(r >= 0 for r in sample_results)


# ============================================================================
# Config Tests
# ============================================================================

class TestContinuousTrainingConfig:
    """Tests for ContinuousTrainingConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ContinuousTrainingConfig()

        assert config.training_interval == 1.0
        assert config.batch_size == 32
        assert config.min_batch_size == 8
        assert config.buffer_capacity == 10000
        assert config.gate_weight == 0.3
        assert config.actual_weight == 0.7
        assert config.enabled is True

    def test_validate_valid_config(self):
        """Test validation passes for valid config."""
        config = ContinuousTrainingConfig()
        assert config.validate() is True

    def test_validate_invalid_training_interval(self):
        """Test validation fails for invalid training_interval."""
        config = ContinuousTrainingConfig(training_interval=0)
        assert config.validate() is False

        config = ContinuousTrainingConfig(training_interval=-1)
        assert config.validate() is False

    def test_validate_invalid_batch_size(self):
        """Test validation fails for invalid batch_size."""
        config = ContinuousTrainingConfig(batch_size=0)
        assert config.validate() is False

    def test_validate_min_batch_exceeds_batch(self):
        """Test validation fails when min_batch > batch."""
        config = ContinuousTrainingConfig(batch_size=10, min_batch_size=20)
        assert config.validate() is False

    def test_validate_weights_not_sum_to_one(self):
        """Test validation fails when weights don't sum to 1."""
        config = ContinuousTrainingConfig(gate_weight=0.5, actual_weight=0.3)
        assert config.validate() is False

    def test_to_dict(self):
        """Test conversion to dictionary."""
        config = ContinuousTrainingConfig()
        d = config.to_dict()

        assert d["training_interval"] == 1.0
        assert d["batch_size"] == 32
        assert d["enabled"] is True


# ============================================================================
# Metrics Tests
# ============================================================================

class TestTrainingMetrics:
    """Tests for TrainingMetrics."""

    def test_record_step(self):
        """Test recording a training step."""
        metrics = TrainingMetrics()

        metrics.record_step(
            loss=0.5,
            batch_size=32,
            step_time_ms=100.0,
            avg_gate_signal=0.1
        )

        stats = metrics.get_stats()
        assert stats["total_steps"] == 1
        assert stats["total_samples_trained"] == 32
        assert stats["average_loss"] == 0.5

    def test_rolling_average(self):
        """Test rolling average calculation."""
        metrics = TrainingMetrics()

        for i in range(5):
            metrics.record_step(
                loss=float(i),
                batch_size=10,
                step_time_ms=50.0,
                avg_gate_signal=0.0
            )

        stats = metrics.get_stats()
        assert stats["total_steps"] == 5
        assert stats["average_loss"] == 2.0  # (0+1+2+3+4)/5

    def test_record_error(self):
        """Test error recording."""
        metrics = TrainingMetrics()

        metrics.record_error()
        metrics.record_error()

        stats = metrics.get_stats()
        assert stats["total_errors"] == 2

    def test_reset(self):
        """Test metrics reset."""
        metrics = TrainingMetrics()

        metrics.record_step(loss=0.5, batch_size=32, step_time_ms=100.0)
        metrics.record_error()
        metrics.reset()

        stats = metrics.get_stats()
        assert stats["total_steps"] == 0
        assert stats["total_errors"] == 0


# ============================================================================
# Trainer Tests
# ============================================================================

class TestContinuousTrainer:
    """Tests for ContinuousTrainer."""

    def _create_mock_model(self):
        """Create mock NN model."""
        model = Mock()
        model.train_with_reward = Mock(return_value={"loss": 0.1})
        return model

    def _create_experience(
        self,
        was_executed: bool = True,
        gate_signal: float = 0.2,
        actual_reward: float = None
    ) -> Experience:
        """Helper to create test experience."""
        return Experience(
            observation=np.zeros(28),
            spawn_chunk=150,
            spawn_type="energy",
            nn_confidence=0.85,
            gate_signal=gate_signal,
            R_expected=gate_signal + 0.6,
            was_executed=was_executed,
            actual_reward=actual_reward,
            territory_id="test",
            model_version=1,
        )

    def test_calculate_training_reward_send_with_actual(self):
        """Test reward calculation for SEND with actual_reward."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig(gate_weight=0.3, actual_weight=0.7)
        trainer = ContinuousTrainer(model, buffer, config)

        exp = self._create_experience(
            was_executed=True,
            gate_signal=0.2,
            actual_reward=0.8
        )

        reward = trainer._calculate_training_reward(exp)

        # 0.3 * 0.2 + 0.7 * 0.8 = 0.06 + 0.56 = 0.62
        assert abs(reward - 0.62) < 0.001

    def test_calculate_training_reward_send_pending(self):
        """Test reward calculation for SEND without actual_reward."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig()
        trainer = ContinuousTrainer(model, buffer, config)

        exp = self._create_experience(
            was_executed=True,
            gate_signal=0.2,
            actual_reward=None
        )

        reward = trainer._calculate_training_reward(exp)

        assert reward == 0.2  # gate_signal only

    def test_calculate_training_reward_wait(self):
        """Test reward calculation for WAIT (negative gate_signal)."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig()
        trainer = ContinuousTrainer(model, buffer, config)

        exp = self._create_experience(
            was_executed=False,
            gate_signal=-0.35,
            actual_reward=None
        )

        reward = trainer._calculate_training_reward(exp)

        assert reward == -0.35  # gate_signal directly (penalty)

    def test_start_stop(self):
        """Test trainer start and stop."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig(training_interval=0.1)
        trainer = ContinuousTrainer(model, buffer, config)

        assert trainer.is_running is False

        trainer.start()
        assert trainer.is_running is True

        time.sleep(0.05)  # Let it run briefly

        trainer.stop()
        assert trainer.is_running is False

    def test_model_version_increments(self):
        """Test that model version increments after training."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig(
            training_interval=0.1,
            min_batch_size=2,
            batch_size=10
        )
        trainer = ContinuousTrainer(model, buffer, config)

        # Add some experiences
        for i in range(5):
            exp = self._create_experience(
                was_executed=False,
                gate_signal=-0.1,
            )
            exp.territory_id = f"t{i}"
            buffer.add(exp)

        initial_version = trainer.model_version

        trainer.start()
        time.sleep(0.25)  # Allow 2 training steps
        trainer.stop()

        assert trainer.model_version > initial_version

    def test_get_metrics(self):
        """Test getting trainer metrics."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig()
        trainer = ContinuousTrainer(model, buffer, config)

        metrics = trainer.get_metrics()

        assert "buffer" in metrics
        assert "training" in metrics
        assert "model_version" in metrics
        assert "is_running" in metrics

    def test_get_model_for_inference(self):
        """Test getting model for inference."""
        model = self._create_mock_model()
        buffer = ExperienceReplayBuffer()
        config = ContinuousTrainingConfig()
        trainer = ContinuousTrainer(model, buffer, config)

        returned_model = trainer.get_model_for_inference()

        assert returned_model is model
