"""
Integration Tests for Simulation-Gated Inference

Tests the full pipeline from observation to gate decision.
"""

import time
import tempfile
import pytest
import sys
import os
from pathlib import Path

# Add server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ai_engine.simulation import (
    SimulationGateConfig,
    SimulationGate,
    ConfigLoader,
    load_simulation_config
)


class TestFullPipeline:
    """Test complete simulation-gated inference pipeline."""

    def test_observation_to_decision_basic(self):
        """Test basic flow from observation to gate decision."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50, 51, 52],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Get decision for spawning near workers
        decision = gate.evaluate(observation, 53, 'energy', 0.5)

        # Should pass - no protectors, near workers, have energy
        assert decision.decision == 'SEND'
        assert decision.expected_reward > 0
        assert 'survival' in decision.components
        assert 'disruption' in decision.components

    def test_dangerous_spawn_blocked(self):
        """Test that dangerous spawns are blocked."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        # Protector at spawn location
        observation = {
            'protector_chunks': [50],
            'worker_chunks': [],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        decision = gate.evaluate(observation, 50, 'energy', 0.1)

        # Should be blocked - spawning on protector is suicide
        assert decision.decision == 'WAIT'
        assert decision.components['survival'] == 0.0

    def test_insufficient_energy_blocked(self):
        """Test that spawns without energy are blocked."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50],
            'hive_chunk': 0,
            'queen_energy': 10  # Less than spawn cost
        }

        decision = gate.evaluate(observation, 51, 'energy', 0.5)

        assert decision.decision == 'WAIT'
        assert decision.reason == 'insufficient_energy'
        assert decision.expected_reward == float('-inf')

    def test_confidence_override_in_danger(self):
        """Test that high confidence overrides danger assessment."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        # Dangerous situation
        observation = {
            'protector_chunks': [48, 49, 50],  # Multiple nearby protectors
            'worker_chunks': [100],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Low confidence should be blocked
        decision_low = gate.evaluate(observation, 51, 'energy', 0.1)
        # High confidence should override
        decision_high = gate.evaluate(observation, 51, 'energy', 0.95)

        # Low confidence blocked due to danger
        if decision_low.components['survival'] < 0.3:
            assert decision_low.decision == 'WAIT' or decision_low.reason == 'confidence_override'

        # High confidence always passes
        assert decision_high.decision == 'SEND'
        assert decision_high.reason == 'confidence_override'

    def test_exploration_bonus_prevents_deadlock(self):
        """Test that exploration bonus increases over time for unvisited chunks."""
        config = SimulationGateConfig(exploration_coefficient=0.5)
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # First evaluation at chunk 100
        decision1 = gate.evaluate(observation, 100, 'energy', 0.3)
        reward1 = decision1.expected_reward

        # Record spawn at chunk 100
        gate.record_spawn(100)

        # Evaluation at chunk 100 should have lower reward now
        decision2 = gate.evaluate(observation, 100, 'energy', 0.3)
        reward2 = decision2.expected_reward

        # Chunk 200 (unexplored) should have higher exploration bonus
        decision3 = gate.evaluate(observation, 200, 'energy', 0.3)
        reward3 = decision3.expected_reward

        # Recently spawned chunk should have lower reward
        assert reward2 < reward1 or abs(reward2 - reward1) < 0.1
        # Unexplored chunk should have bonus
        assert decision3.components['exploration'] >= 0

    def test_metrics_accumulate(self):
        """Test that metrics accumulate correctly over multiple decisions."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Make 10 evaluations
        for i in range(10):
            gate.evaluate(observation, 50 + i, 'energy', 0.3 + i * 0.05)

        stats = gate.get_statistics()

        assert stats['metrics']['lifetime']['total_evaluations'] == 10
        assert stats['metrics']['rolling']['window_size'] == 10

    def test_gate_disabled_passthrough(self):
        """Test that disabled gate passes all spawns."""
        config = SimulationGateConfig(gate_enabled=False)
        gate = SimulationGate(config)

        # Even dangerous spawns should pass
        observation = {
            'protector_chunks': [50, 51, 52],
            'worker_chunks': [],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        decision = gate.evaluate(observation, 50, 'energy', 0.1)

        assert decision.decision == 'SEND'
        assert decision.reason == 'gate_disabled'


class TestConfigLoader:
    """Test configuration loading and hot-reload."""

    def test_load_default_config(self):
        """Test loading config with defaults when file missing."""
        loader = ConfigLoader(config_path=Path("/nonexistent/path.yaml"))
        config = loader.load()

        # Should return defaults
        assert isinstance(config, SimulationGateConfig)
        assert config.kill_range == 2.0

    def test_load_yaml_config(self):
        """Test loading config from YAML file."""
        # Create temp config file
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.yaml', delete=False
        ) as f:
            f.write("""
kill_range: 3.0
safe_range: 10.0
gate_enabled: false
            """)
            temp_path = f.name

        try:
            loader = ConfigLoader(config_path=Path(temp_path))
            config = loader.load()

            assert config.kill_range == 3.0
            assert config.safe_range == 10.0
            assert config.gate_enabled is False
        finally:
            os.unlink(temp_path)

    def test_invalid_yaml_fallback(self):
        """Test fallback to defaults on invalid YAML."""
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.yaml', delete=False
        ) as f:
            f.write("invalid: yaml: content: [}")
            temp_path = f.name

        try:
            loader = ConfigLoader(config_path=Path(temp_path))
            config = loader.load()

            # Should fall back to defaults
            assert isinstance(config, SimulationGateConfig)
        finally:
            os.unlink(temp_path)

    def test_hot_reload_detects_changes(self):
        """Test that hot reload detects file changes."""
        # Create temp config file
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.yaml', delete=False
        ) as f:
            f.write("kill_range: 2.0\n")
            temp_path = f.name

        reload_count = [0]

        def on_reload(config):
            reload_count[0] += 1

        try:
            loader = ConfigLoader(
                config_path=Path(temp_path),
                on_reload=on_reload
            )
            loader.load()

            # Modify file
            time.sleep(0.1)
            with open(temp_path, 'w') as f:
                f.write("kill_range: 5.0\n")

            # Check for changes
            changed = loader.check_for_changes()

            assert changed
            assert reload_count[0] == 1
            assert loader.get_config().kill_range == 5.0

        finally:
            os.unlink(temp_path)

    def test_config_validation_on_load(self):
        """Test that invalid config values are rejected."""
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.yaml', delete=False
        ) as f:
            f.write("kill_range: -5.0\n")  # Invalid negative value
            temp_path = f.name

        try:
            loader = ConfigLoader(config_path=Path(temp_path))
            config = loader.load()

            # Should fall back to defaults due to validation failure
            assert config.kill_range == 2.0  # Default value
        finally:
            os.unlink(temp_path)


class TestPerformance:
    """Performance tests for simulation gate."""

    def test_cost_function_performance(self):
        """Test that cost function runs within performance budget."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        # Create observation with many entities
        observation = {
            'protector_chunks': list(range(0, 50, 5)),  # 10 protectors
            'worker_chunks': list(range(100, 200, 2)),  # 50 workers
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Warm up
        for _ in range(5):
            gate.evaluate(observation, 150, 'energy', 0.5)

        # Measure time for 100 evaluations
        start = time.perf_counter()
        for i in range(100):
            gate.evaluate(observation, 150 + (i % 50), 'energy', 0.5)
        elapsed = time.perf_counter() - start

        avg_time_ms = (elapsed / 100) * 1000

        # Should be < 10ms per evaluation on CPU
        assert avg_time_ms < 50, f"Average evaluation time {avg_time_ms:.2f}ms exceeds budget"

    def test_metrics_memory_bounded(self):
        """Test that metrics don't grow unbounded."""
        config = SimulationGateConfig()
        gate = SimulationGate(config)

        observation = {
            'protector_chunks': [],
            'worker_chunks': [50],
            'hive_chunk': 0,
            'queen_energy': 100
        }

        # Make many evaluations (more than window size)
        for i in range(200):
            gate.evaluate(observation, i % 400, 'energy', 0.3)

        stats = gate.get_statistics()

        # Rolling window should be bounded
        assert stats['metrics']['rolling']['window_size'] <= 100


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
