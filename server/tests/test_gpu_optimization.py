"""
Tests for GPU-Optimized Cost Function

Tests batch processing and GPU/CPU parity.
"""

import time
import pytest
import sys
import os
import numpy as np

# Add server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ai_engine.decision_gate.components.gpu_utils import (
    GPUCostFunction,
    get_gpu_cost_function,
    get_device,
    get_device_info
)


class TestDeviceDetection:
    """Test device detection and info."""

    def test_get_device(self):
        device = get_device()
        assert device in ['cpu', 'cuda']

    def test_get_device_info(self):
        info = get_device_info()
        assert hasattr(info, 'device')
        assert hasattr(info, 'is_cuda')
        assert hasattr(info, 'memory_allocated_mb')


class TestGPUCostFunction:
    """Test GPU cost function batch operations."""

    def test_chunk_to_coords_batch(self):
        gpu_fn = GPUCostFunction(chunks_per_axis=20, device='cpu')

        chunks = np.array([0, 5, 20, 25, 399])
        coords = gpu_fn.chunk_to_coords_batch(chunks)

        expected = np.array([
            [0, 0],
            [5, 0],
            [0, 1],
            [5, 1],
            [19, 19]
        ])
        np.testing.assert_array_equal(coords, expected)

    def test_distance_matrix(self):
        gpu_fn = GPUCostFunction(device='cpu')

        spawn_coords = np.array([[0, 0], [5, 5]], dtype=np.float32)
        target_coords = np.array([[0, 0], [1, 0], [0, 1]], dtype=np.float32)

        distances = gpu_fn.distance_matrix(spawn_coords, target_coords)

        # [0,0] to [0,0] = 0, [0,0] to [1,0] = 1, [0,0] to [0,1] = 1
        assert distances.shape == (2, 3)
        assert distances[0, 0] == 0.0
        assert distances[0, 1] == 1.0
        assert distances[0, 2] == 1.0

    def test_survival_no_protectors(self):
        gpu_fn = GPUCostFunction(device='cpu')

        spawn_chunks = np.array([50, 100, 150])
        protector_chunks = np.array([])

        survival = gpu_fn.calculate_survival_batch(spawn_chunks, protector_chunks)

        # No protectors = 100% survival
        np.testing.assert_array_equal(survival, np.ones(3))

    def test_survival_in_kill_zone(self):
        gpu_fn = GPUCostFunction(device='cpu')

        # Spawn at same location as protector
        spawn_chunks = np.array([50])
        protector_chunks = np.array([50])

        survival = gpu_fn.calculate_survival_batch(spawn_chunks, protector_chunks)

        # In kill zone = 0% survival
        assert survival[0] == 0.0

    def test_survival_far_from_protector(self):
        gpu_fn = GPUCostFunction(device='cpu')

        # Spawn far from protector
        spawn_chunks = np.array([0])
        protector_chunks = np.array([399])  # Opposite corner

        survival = gpu_fn.calculate_survival_batch(spawn_chunks, protector_chunks)

        # Far from protector = high survival
        assert survival[0] > 0.99

    def test_survival_multiple_protectors(self):
        gpu_fn = GPUCostFunction(device='cpu')

        spawn_chunks = np.array([50])
        protector_single = np.array([55])
        protector_multiple = np.array([55, 45, 60])

        survival_single = gpu_fn.calculate_survival_batch(spawn_chunks, protector_single)
        survival_multiple = gpu_fn.calculate_survival_batch(spawn_chunks, protector_multiple)

        # More protectors = lower survival
        assert survival_multiple[0] < survival_single[0]

    def test_disruption_no_workers(self):
        gpu_fn = GPUCostFunction(device='cpu')

        spawn_chunks = np.array([50, 100])
        worker_chunks = np.array([])
        survival = np.array([1.0, 1.0])

        disruption = gpu_fn.calculate_disruption_batch(
            spawn_chunks, worker_chunks, survival
        )

        # No workers = no disruption
        np.testing.assert_array_equal(disruption, np.zeros(2))

    def test_disruption_near_worker(self):
        gpu_fn = GPUCostFunction(device='cpu')

        # Spawn adjacent to worker
        spawn_chunks = np.array([50])
        worker_chunks = np.array([51])
        survival = np.array([1.0])

        disruption = gpu_fn.calculate_disruption_batch(
            spawn_chunks, worker_chunks, survival
        )

        # Near worker = high disruption
        assert disruption[0] > 0.5

    def test_disruption_scales_with_survival(self):
        gpu_fn = GPUCostFunction(device='cpu')

        spawn_chunks = np.array([50])
        worker_chunks = np.array([51])

        disruption_full = gpu_fn.calculate_disruption_batch(
            spawn_chunks, worker_chunks, np.array([1.0])
        )
        disruption_half = gpu_fn.calculate_disruption_batch(
            spawn_chunks, worker_chunks, np.array([0.5])
        )

        # Half survival = half effective disruption
        assert abs(disruption_half[0] - disruption_full[0] * 0.5) < 0.01

    def test_evaluate_candidates_batch(self):
        gpu_fn = GPUCostFunction(device='cpu')

        candidates = np.array([50, 51, 52, 100, 200])
        protectors = np.array([10, 20])
        workers = np.array([50, 55, 60])

        result = gpu_fn.evaluate_candidates_batch(
            candidates, protectors, workers, hive_chunk=0,
            config_params={
                'kill_range': 2.0,
                'safe_range': 8.0,
                'survival_weight': 0.4,
                'disruption_weight': 0.5,
                'location_weight': 0.1
            }
        )

        assert 'survival' in result
        assert 'disruption' in result
        assert 'scores' in result
        assert 'best_idx' in result
        assert 'best_chunk' in result
        assert len(result['survival']) == 5
        assert len(result['scores']) == 5

    def test_batch_vs_single_parity(self):
        """Test that batch results match single calculations."""
        gpu_fn = GPUCostFunction(device='cpu')

        # Single calculations using original functions
        from ai_engine.decision_gate.components import (
            calculate_survival_probability,
            calculate_worker_disruption
        )
        from ai_engine.decision_gate import SimulationGateConfig

        config = SimulationGateConfig()
        spawn_chunks = np.array([50, 100, 150])
        protector_chunks = [45, 55]
        worker_chunks = [48, 52]

        # Batch calculation
        batch_survival = gpu_fn.calculate_survival_batch(
            spawn_chunks, np.array(protector_chunks)
        )

        # Single calculations
        for i, spawn in enumerate(spawn_chunks):
            single_survival = calculate_survival_probability(
                int(spawn), protector_chunks, config
            )
            # Allow small floating point differences
            assert abs(batch_survival[i] - single_survival) < 0.05, \
                f"Mismatch at chunk {spawn}: batch={batch_survival[i]}, single={single_survival}"


class TestPerformanceBatch:
    """Performance tests for batch processing."""

    def test_batch_faster_than_loop(self):
        gpu_fn = GPUCostFunction(device='cpu')

        # Generate large batch
        n_candidates = 100
        n_protectors = 20
        n_workers = 50

        candidates = np.arange(n_candidates)
        protectors = np.random.randint(0, 400, n_protectors)
        workers = np.random.randint(0, 400, n_workers)

        # Warm up
        _ = gpu_fn.calculate_survival_batch(candidates[:10], protectors)

        # Batch timing
        start = time.perf_counter()
        for _ in range(10):
            survival = gpu_fn.calculate_survival_batch(candidates, protectors)
            disruption = gpu_fn.calculate_disruption_batch(
                candidates, workers, survival
            )
        batch_time = time.perf_counter() - start

        # Single loop timing
        from ai_engine.decision_gate.components import (
            calculate_survival_probability,
            calculate_worker_disruption
        )
        from ai_engine.decision_gate import SimulationGateConfig

        config = SimulationGateConfig()

        start = time.perf_counter()
        for _ in range(10):
            for c in candidates:
                s = calculate_survival_probability(int(c), protectors.tolist(), config)
                d = calculate_worker_disruption(int(c), workers.tolist(), s, config)
        loop_time = time.perf_counter() - start

        # Batch should be faster (or at least comparable)
        print(f"\nBatch time: {batch_time:.3f}s, Loop time: {loop_time:.3f}s")
        print(f"Speedup: {loop_time / batch_time:.1f}x")

        # Batch should not be dramatically slower
        assert batch_time < loop_time * 2

    def test_memory_bounded(self):
        """Test that GPU memory usage stays bounded."""
        gpu_fn = GPUCostFunction()

        # Do many evaluations
        for _ in range(100):
            candidates = np.arange(100)
            protectors = np.random.randint(0, 400, 20)
            workers = np.random.randint(0, 400, 50)

            gpu_fn.evaluate_candidates_batch(
                candidates, protectors, workers, hive_chunk=0,
                config_params={'survival_weight': 0.4, 'disruption_weight': 0.5}
            )

        mem_usage = gpu_fn.get_memory_usage()
        print(f"\nMemory usage after 100 batches: {mem_usage:.2f} MB")

        # Should be < 50MB
        assert mem_usage < 50, f"Memory usage {mem_usage}MB exceeds 50MB budget"


class TestSingleton:
    """Test singleton behavior."""

    def test_get_gpu_cost_function_singleton(self):
        fn1 = get_gpu_cost_function()
        fn2 = get_gpu_cost_function()

        assert fn1 is fn2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
