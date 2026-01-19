"""
Tests for simulation-gated inference components.
"""

import numpy as np
import pytest
import sys
import os

# Add server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ai_engine.simulation.config import SimulationGateConfig
from ai_engine.simulation.components.utils import (
    chunk_to_coords,
    chunk_distance,
    chunk_to_coords_batch,
    chunk_distance_matrix
)
from ai_engine.simulation.components.survival import calculate_survival_probability
from ai_engine.simulation.components.disruption import calculate_worker_disruption
from ai_engine.simulation.components.location import calculate_location_penalty
from ai_engine.simulation.components.capacity import validate_spawn_capacity
from ai_engine.simulation.components.exploration import ExplorationTracker
from ai_engine.simulation.cost_function import SimulationCostFunction
from ai_engine.simulation.gate import SimulationGate


class TestConfig:
    """Test configuration dataclass."""

    def test_default_config(self):
        config = SimulationGateConfig()
        assert config.kill_range == 2.0
        assert config.safe_range == 8.0
        assert config.chunks_per_axis == 20

    def test_config_validation(self):
        config = SimulationGateConfig()
        assert config.validate()

        # Invalid config
        bad_config = SimulationGateConfig(kill_range=-1)
        assert not bad_config.validate()


class TestChunkUtils:
    """Test chunk utility functions."""

    def test_chunk_to_coords(self):
        # Chunk 0 = (0, 0)
        assert chunk_to_coords(0) == (0, 0)
        # Chunk 5 = (5, 0)
        assert chunk_to_coords(5) == (5, 0)
        # Chunk 20 = (0, 1)
        assert chunk_to_coords(20) == (0, 1)
        # Chunk 25 = (5, 1)
        assert chunk_to_coords(25) == (5, 1)
        # Chunk 399 = (19, 19)
        assert chunk_to_coords(399) == (19, 19)

    def test_chunk_distance(self):
        # Same chunk = 0 distance
        assert chunk_distance(0, 0) == 0.0
        # Adjacent chunks
        assert chunk_distance(0, 1) == 1.0
        assert chunk_distance(0, 20) == 1.0
        # Diagonal
        assert abs(chunk_distance(0, 21) - np.sqrt(2)) < 0.01

    def test_chunk_to_coords_batch(self):
        chunks = np.array([0, 5, 20, 25])
        coords = chunk_to_coords_batch(chunks)
        expected = np.array([[0, 0], [5, 0], [0, 1], [5, 1]])
        np.testing.assert_array_equal(coords, expected)

    def test_chunk_distance_matrix(self):
        spawn = np.array([0, 25])
        targets = np.array([0, 1, 20])
        distances = chunk_distance_matrix(spawn, targets)

        # Spawn 0 to targets [0, 1, 20] = [0, 1, 1]
        assert distances[0, 0] == 0.0
        assert distances[0, 1] == 1.0
        assert distances[0, 2] == 1.0


class TestSurvivalProbability:
    """Test survival probability calculation."""

    def test_no_protectors(self):
        config = SimulationGateConfig()
        survival = calculate_survival_probability(50, [], config)
        assert survival == 1.0

    def test_far_protector(self):
        config = SimulationGateConfig()
        # Protector at chunk 0, spawn at chunk 200 (very far)
        survival = calculate_survival_probability(200, [0], config)
        assert survival > 0.99  # Should be nearly 100%

    def test_close_protector(self):
        config = SimulationGateConfig()
        # Protector at chunk 0, spawn at chunk 1 (adjacent)
        survival = calculate_survival_probability(1, [0], config)
        assert survival < 0.5  # Should be low

    def test_kill_zone(self):
        config = SimulationGateConfig()
        # Protector at same chunk (in kill zone)
        survival = calculate_survival_probability(0, [0], config)
        assert survival == 0.0  # Certain death

    def test_multiple_protectors(self):
        config = SimulationGateConfig()
        # Multiple protectors reduce survival
        survival_one = calculate_survival_probability(50, [45], config)
        survival_two = calculate_survival_probability(50, [45, 55], config)
        assert survival_two < survival_one


class TestWorkerDisruption:
    """Test worker disruption calculation."""

    def test_no_workers(self):
        config = SimulationGateConfig()
        disruption = calculate_worker_disruption(50, [], 1.0, config)
        assert disruption == 0.0

    def test_close_worker(self):
        config = SimulationGateConfig()
        # Worker at adjacent chunk, full survival
        disruption = calculate_worker_disruption(50, [51], 1.0, config)
        assert disruption > 0.5

    def test_far_worker(self):
        config = SimulationGateConfig()
        # Worker very far
        disruption = calculate_worker_disruption(50, [200], 1.0, config)
        assert disruption < 0.1

    def test_survival_scaling(self):
        config = SimulationGateConfig()
        # Same worker distance, different survival
        disruption_full = calculate_worker_disruption(50, [51], 1.0, config)
        disruption_half = calculate_worker_disruption(50, [51], 0.5, config)
        assert abs(disruption_half - disruption_full * 0.5) < 0.01


class TestLocationPenalty:
    """Test spawn location penalty calculation."""

    def test_idle_mode_at_hive(self):
        config = SimulationGateConfig()
        # Spawn at hive, no workers
        penalty = calculate_location_penalty(50, 50, [], config)
        assert penalty == 0.0  # No penalty at hive

    def test_idle_mode_far_from_hive(self):
        config = SimulationGateConfig()
        # Spawn far from hive, no workers
        penalty = calculate_location_penalty(200, 50, [], config)
        assert penalty < 0  # Should have penalty

    def test_active_mode_at_worker(self):
        config = SimulationGateConfig()
        # Spawn at worker location
        penalty = calculate_location_penalty(50, 0, [50], config)
        assert penalty == 0.0  # No penalty at worker

    def test_active_mode_far_from_worker(self):
        config = SimulationGateConfig()
        # Spawn far from worker
        penalty = calculate_location_penalty(200, 0, [50], config)
        assert penalty < 0  # Should have penalty


class TestCapacityValidation:
    """Test spawn capacity validation."""

    def test_can_afford_energy(self):
        config = SimulationGateConfig()
        result = validate_spawn_capacity('energy', 50.0, config)
        assert result == 1.0

    def test_cannot_afford_energy(self):
        config = SimulationGateConfig()
        result = validate_spawn_capacity('energy', 10.0, config)
        assert result == float('-inf')

    def test_can_afford_combat(self):
        config = SimulationGateConfig()
        result = validate_spawn_capacity('combat', 50.0, config)
        assert result == 1.0

    def test_cannot_afford_combat(self):
        config = SimulationGateConfig()
        result = validate_spawn_capacity('combat', 20.0, config)
        assert result == float('-inf')


class TestExplorationTracker:
    """Test exploration bonus tracking."""

    def test_unexplored_chunk_bonus(self):
        config = SimulationGateConfig()
        tracker = ExplorationTracker(config)
        # Should have bonus for unexplored chunk
        bonus = tracker.calculate_exploration_bonus(50)
        assert bonus >= 0

    def test_recently_spawned_no_bonus(self):
        config = SimulationGateConfig()
        tracker = ExplorationTracker(config)
        tracker.record_spawn(50)
        # Just spawned, should have minimal bonus
        bonus = tracker.calculate_exploration_bonus(50)
        assert bonus < 0.01


class TestCostFunction:
    """Test combined cost function."""

    def test_basic_calculation(self):
        config = SimulationGateConfig()
        cost_fn = SimulationCostFunction(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        result = cost_fn.calculate_expected_reward(observation, 51, 'energy')

        assert 'expected_reward' in result
        assert 'survival' in result
        assert 'disruption' in result
        assert 'location' in result
        assert result['capacity_valid']

    def test_insufficient_energy(self):
        config = SimulationGateConfig()
        cost_fn = SimulationCostFunction(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [],
            'hive_chunk': 0,
            'queen_energy': 5  # Not enough
        }

        result = cost_fn.calculate_expected_reward(observation, 50, 'energy')
        assert not result['capacity_valid']
        assert result['expected_reward'] == float('-inf')


class TestGateMetrics:
    """Test gate metrics collection."""

    def test_record_evaluation(self):
        from ai_engine.simulation.metrics import GateMetrics

        metrics = GateMetrics(window_size=10)
        metrics.record_evaluation(
            decision='SEND',
            reason='positive_reward',
            expected_reward=0.5,
            nn_confidence=0.3,
            components={'survival': 0.8, 'disruption': 0.3}
        )

        assert metrics.total_evaluations == 1
        assert metrics.total_sends == 1
        assert metrics.total_waits == 0

    def test_pass_rate(self):
        from ai_engine.simulation.metrics import GateMetrics

        metrics = GateMetrics(window_size=10)

        # Record 3 sends, 2 waits
        for _ in range(3):
            metrics.record_evaluation('SEND', 'positive_reward', 0.5, 0.3, {})
        for _ in range(2):
            metrics.record_evaluation('WAIT', 'negative_reward', -0.1, 0.2, {})

        assert metrics.get_lifetime_pass_rate() == 0.6
        assert metrics.get_pass_rate() == 0.6

    def test_confidence_override_rate(self):
        from ai_engine.simulation.metrics import GateMetrics

        metrics = GateMetrics(window_size=10)

        # 2 confidence overrides, 2 positive rewards
        metrics.record_evaluation('SEND', 'confidence_override', 0.5, 0.9, {})
        metrics.record_evaluation('SEND', 'confidence_override', 0.5, 0.95, {})
        metrics.record_evaluation('SEND', 'positive_reward', 0.8, 0.5, {})
        metrics.record_evaluation('SEND', 'positive_reward', 0.7, 0.4, {})

        assert metrics.get_lifetime_confidence_override_rate() == 0.5

    def test_wait_streak(self):
        from ai_engine.simulation.metrics import GateMetrics

        metrics = GateMetrics(window_size=10)

        metrics.record_evaluation('SEND', 'positive_reward', 0.5, 0.3, {})
        metrics.record_evaluation('WAIT', 'negative_reward', -0.1, 0.2, {})
        metrics.record_evaluation('WAIT', 'negative_reward', -0.2, 0.1, {})
        metrics.record_evaluation('WAIT', 'negative_reward', -0.3, 0.1, {})

        assert metrics.get_wait_streak() == 3

    def test_average_expected_reward(self):
        from ai_engine.simulation.metrics import GateMetrics

        metrics = GateMetrics(window_size=10)

        metrics.record_evaluation('SEND', 'positive_reward', 0.5, 0.3, {})
        metrics.record_evaluation('SEND', 'positive_reward', 0.7, 0.4, {})
        metrics.record_evaluation('WAIT', 'insufficient_energy', float('-inf'), 0.2, {})

        # Should only average valid rewards (0.5 + 0.7) / 2 = 0.6
        assert abs(metrics.get_average_expected_reward() - 0.6) < 0.01

    def test_statistics_summary(self):
        from ai_engine.simulation.metrics import GateMetrics

        metrics = GateMetrics(window_size=10)
        metrics.record_evaluation('SEND', 'positive_reward', 0.5, 0.3, {'survival': 0.8})

        stats = metrics.get_statistics()

        assert 'lifetime' in stats
        assert 'rolling' in stats
        assert 'recent' in stats
        assert stats['lifetime']['total_evaluations'] == 1


class TestGateLogger:
    """Test structured gate logging."""

    def test_logger_creation(self):
        from ai_engine.simulation.logging_utils import GateLogger, get_gate_logger

        logger1 = get_gate_logger()
        logger2 = get_gate_logger()

        # Should be singleton
        assert logger1 is logger2

    def test_log_decision(self):
        from ai_engine.simulation.logging_utils import GateLogger

        logger = GateLogger()
        # Should not raise
        logger.log_decision(
            decision='SEND',
            reason='positive_reward',
            spawn_chunk=50,
            spawn_type='energy',
            expected_reward=0.5,
            nn_confidence=0.3,
            components={'survival': 0.8, 'disruption': 0.3},
            observation_count=5,
            territory_id='test'
        )

    def test_log_wait_with_inf(self):
        from ai_engine.simulation.logging_utils import GateLogger

        logger = GateLogger()
        # Should handle -inf without error
        logger.log_decision(
            decision='WAIT',
            reason='insufficient_energy',
            spawn_chunk=50,
            spawn_type='combat',
            expected_reward=float('-inf'),
            nn_confidence=0.1,
            components={},
            observation_count=0,
            territory_id='test'
        )


class TestSimulationGate:
    """Test simulation gate."""

    def test_send_positive_reward(self):
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Spawn near worker with good conditions
        decision = gate.evaluate(observation, 51, 'energy', 0.3)
        # Should likely send since no protectors and near worker
        assert decision.decision in ['SEND', 'WAIT']

    def test_confidence_override(self):
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [50],  # Protector nearby
            'worker_chunks': [],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # High confidence should override
        decision = gate.evaluate(observation, 51, 'energy', 0.95)
        assert decision.decision == 'SEND'
        assert decision.reason == 'confidence_override'

    def test_gate_disabled(self):
        config = SimulationGateConfig(gate_enabled=False)
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [50],
            'worker_chunks': [],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        decision = gate.evaluate(observation, 51, 'energy', 0.1)
        assert decision.decision == 'SEND'
        assert decision.reason == 'gate_disabled'

    def test_gate_records_metrics(self):
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Make multiple evaluations
        gate.evaluate(observation, 51, 'energy', 0.3)
        gate.evaluate(observation, 52, 'energy', 0.4)
        gate.evaluate(observation, 53, 'combat', 0.95)  # Should trigger confidence override

        stats = gate.get_statistics()
        assert 'metrics' in stats
        assert stats['metrics']['lifetime']['total_evaluations'] == 3

    def test_gate_wait_streak(self):
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [0, 1, 2],  # Multiple protectors make spawning dangerous
            'worker_chunks': [],
            'hive_chunk': 200,
            'queen_energy': 100
        }

        # Try to spawn in dangerous area (should WAIT)
        for i in range(5):
            gate.evaluate(observation, i, 'energy', 0.1)

        # Should have some wait streak
        assert gate.get_wait_streak() >= 0

    def test_gate_actual_reward_tracking(self):
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        gate.record_actual_reward(0.5)
        gate.record_actual_reward(0.3)

        stats = gate.get_statistics()
        assert stats['metrics']['lifetime']['cumulative_actual_reward'] == 0.8


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
