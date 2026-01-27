"""
Test Enhanced Memory Manager functionality
"""

import pytest
import asyncio
import tempfile
import shutil
import os
from unittest.mock import Mock, patch
from ai_engine.memory_manager import QueenMemoryManager
from ai_engine.data_models import DeathAnalysis, QueenStrategy, PlayerPatterns, PlayerProfile


class TestEnhancedMemoryManager:
    """Test enhanced memory management features"""
    
    @pytest.fixture
    async def memory_manager(self):
        """Create memory manager with temporary storage"""
        with tempfile.TemporaryDirectory() as temp_dir:
            manager = QueenMemoryManager()
            manager.storage_path = os.path.join(temp_dir, "memory")
            manager.compressed_path = os.path.join(temp_dir, "compressed")
            manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
            manager._ensure_storage_directories()
            try:
                yield manager
            finally:
                await manager.cleanup()
    
    @pytest.fixture
    def sample_death_analysis(self):
        """Create sample death analysis"""
        return DeathAnalysis(
            queen_id="test_queen_1",
            generation=3,
            primary_cause="protector_assault",
            spatial_insights={"failed_locations": [{"x": 10, "y": 0, "z": 15}], "placement_effectiveness": 0.6},
            temporal_insights={"survival_time": 180.0, "hive_discovery_time": 45.0},
            tactical_insights={"parasites_spawned": 12, "spawn_effectiveness": 0.7, "defensive_failures": ["swarm_coordination"]},
            survival_improvement=0.3,
            failed_strategies=[1, 3, 7],
            feature_vector=[0.5] * 50,
            game_state_features=[0.3] * 20
        )
    
    @pytest.fixture
    def sample_strategy(self):
        """Create sample strategy"""
        return QueenStrategy(
            generation=4,
            hive_placement={"stealth_focus": True, "avoid_locations": [{"x": 10, "y": 0, "z": 15}]},
            parasite_spawning={"rapid_spawn": False, "timing_adaptation": 0.8},
            defensive_coordination={"swarm_tactics": True, "coordination_level": 0.7},
            predictive_behavior={"enabled": True, "prediction_horizon": 60},
            complexity_level=0.4
        )
    
    @pytest.fixture
    def sample_player_patterns(self):
        """Create sample player patterns"""
        return PlayerPatterns(
            mining_patterns={"preferred_locations": [{"x": 5, "z": 5}], "efficiency": 0.8},
            combat_patterns={"aggression_score": 0.6, "tactics": ["flanking", "coordinated"]},
            energy_patterns={"management_style": "balanced", "avg_spending_rate": 0.5},
            exploration_patterns={"coverage": 0.7, "speed": 0.6},
            player_profile=PlayerProfile("aggressive", 0.8),
            pattern_confidence=0.75
        )
    
    @pytest.mark.asyncio
    async def test_rolling_window_memory_management(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test rolling window maintains last 10 generations (Requirement 9.1)"""
        territory_id = "territory_alpha"
        
        # Store 15 generations
        for generation in range(1, 16):
            sample_death_analysis.generation = generation
            sample_strategy.generation = generation + 1
            
            await memory_manager.store_generation_data(
                generation, sample_death_analysis, sample_strategy, territory_id
            )
        
        # Check that only last 10 generations are kept in memory
        territory_keys = [k for k in memory_manager.generation_data.keys() if k.startswith(f"{territory_id}_")]
        assert len(territory_keys) <= memory_manager.max_generations
        
        # Check that the most recent generations are kept
        generations = [int(k.split("_")[-1]) for k in territory_keys]
        assert max(generations) == 15
        assert min(generations) >= 6  # Should keep generations 6-15
    
    @pytest.mark.asyncio
    async def test_data_compression(self, memory_manager, sample_player_patterns):
        """Test data compression for player behavior patterns (Requirement 9.2)"""
        territory_id = "territory_beta"
        
        # Compress player patterns
        pattern_id = await memory_manager.compress_player_patterns(sample_player_patterns, territory_id)
        
        assert pattern_id is not None
        assert pattern_id in memory_manager.compressed_patterns
        
        # Check compression ratio
        compression_info = memory_manager.compressed_patterns[pattern_id]
        assert compression_info["compression_ratio"] < 1.0  # Should be compressed
        assert compression_info["territory_id"] == territory_id
        
        # Test retrieval
        decompressed = await memory_manager.get_compressed_pattern(pattern_id)
        assert decompressed is not None
        assert "mining_summary" in decompressed
        assert "combat_summary" in decompressed
        assert "player_type" in decompressed
    
    @pytest.mark.asyncio
    async def test_knowledge_transfer_between_territories(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test knowledge transfer between Queens in different territories (Requirement 9.3)"""
        source_territory = "territory_gamma"
        target_territory = "territory_delta"
        
        # Create successful strategy in source territory
        sample_death_analysis.survival_improvement = 0.8  # High success
        sample_strategy.complexity_level = 0.6
        
        await memory_manager.store_generation_data(
            5, sample_death_analysis, sample_strategy, source_territory
        )
        
        # Perform knowledge transfer
        transfer_result = await memory_manager.transfer_knowledge_between_territories(
            source_territory, target_territory
        )
        
        assert transfer_result["transferred"] > 0
        assert "transfer_id" in transfer_result
        assert transfer_result["adaptation_confidence"] > 0
        
        # Check that knowledge was stored in target territory
        assert target_territory in memory_manager.territory_knowledge
        
        # Check knowledge transfer cache
        transfer_id = transfer_result["transfer_id"]
        assert transfer_id in memory_manager.knowledge_transfer_cache
    
    @pytest.mark.asyncio
    async def test_memory_cleanup_and_garbage_collection(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test memory cleanup prevents unbounded growth (Requirement 9.5)"""
        territory_id = "territory_epsilon"
        
        # Store multiple generations
        for generation in range(1, 8):
            await memory_manager.store_generation_data(
                generation, sample_death_analysis, sample_strategy, territory_id
            )
        
        initial_memory = memory_manager._estimate_memory_usage()
        
        # Trigger cleanup
        await memory_manager._perform_memory_cleanup()
        
        # Memory usage should be reasonable
        final_memory = memory_manager._estimate_memory_usage()
        assert final_memory <= memory_manager.max_memory_mb
        
        # Check that cleanup preserved important data
        assert len(memory_manager.generation_data) > 0
    
    @pytest.mark.asyncio
    async def test_memory_priority_calculation(self, memory_manager, sample_death_analysis):
        """Test memory priority calculation for data retention (Requirement 9.6)"""
        # Test high-priority data (recent, successful)
        sample_death_analysis.generation = 10
        sample_death_analysis.survival_improvement = 0.8
        
        high_priority = memory_manager._calculate_memory_priority(10, sample_death_analysis)
        
        # Test low-priority data (old, unsuccessful)
        sample_death_analysis.generation = 2
        sample_death_analysis.survival_improvement = -0.2
        
        low_priority = memory_manager._calculate_memory_priority(2, sample_death_analysis)
        
        assert high_priority > low_priority
        assert 0.0 <= high_priority <= 1.0
        assert 0.0 <= low_priority <= 1.0
    
    @pytest.mark.asyncio
    async def test_enhanced_learning_progress(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test enhanced learning progress with territory context"""
        territory_id = "territory_zeta"
        queen_id = "queen_test"
        
        # Store some generation data
        for generation in range(1, 4):
            sample_death_analysis.generation = generation
            sample_strategy.generation = generation + 1
            
            await memory_manager.store_generation_data(
                generation, sample_death_analysis, sample_strategy, territory_id
            )
        
        # Get learning progress
        progress = await memory_manager.get_learning_progress(queen_id, territory_id)
        
        assert progress["queen_id"] == queen_id
        assert progress["territory_id"] == territory_id
        assert progress["current_generation"] >= 1
        assert "progress_metrics" in progress
        assert "knowledge_transfers" in progress
        assert "memory_usage" in progress
        
        # Check progress metrics
        metrics = progress["progress_metrics"]
        assert "survival_improvement" in metrics
        assert "strategy_effectiveness" in metrics
        assert "knowledge_transfer_benefit" in metrics
        assert "data_compression_ratio" in metrics
    
    @pytest.mark.asyncio
    async def test_territory_statistics(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test comprehensive territory statistics"""
        territory_id = "territory_eta"
        
        # Store generation data
        for generation in range(1, 6):
            sample_death_analysis.generation = generation
            sample_death_analysis.temporal_insights["survival_time"] = 100 + generation * 20
            
            await memory_manager.store_generation_data(
                generation, sample_death_analysis, sample_strategy, territory_id
            )
        
        # Get territory statistics
        stats = await memory_manager.get_territory_statistics(territory_id)
        
        assert stats["territory_id"] == territory_id
        assert stats["total_generations"] == 5
        assert stats["average_survival_time"] > 0
        assert stats["average_success_score"] >= 0
        assert "dominant_strategies" in stats
        assert "knowledge_transfers" in stats
        assert "memory_usage" in stats
    
    @pytest.mark.asyncio
    async def test_data_persistence_across_sessions(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test data persistence across game sessions (Requirement 9.4)"""
        territory_id = "territory_theta"
        
        # Store data
        await memory_manager.store_generation_data(
            3, sample_death_analysis, sample_strategy, territory_id
        )
        
        # Save to disk
        await memory_manager.cleanup()
        
        # Create new memory manager and load data
        new_manager = QueenMemoryManager()
        new_manager.storage_path = memory_manager.storage_path
        new_manager.compressed_path = memory_manager.compressed_path
        new_manager.knowledge_base_path = memory_manager.knowledge_base_path
        
        success = await new_manager.load_from_disk(territory_id)
        assert success
        
        # Check that data was loaded
        territory_keys = [k for k in new_manager.generation_data.keys() if k.startswith(f"{territory_id}_")]
        assert len(territory_keys) > 0
        
        await new_manager.cleanup()
    
    @pytest.mark.asyncio
    async def test_memory_statistics(self, memory_manager, sample_death_analysis, sample_strategy):
        """Test comprehensive memory usage statistics"""
        territory_id = "territory_iota"
        
        # Store some data
        await memory_manager.store_generation_data(
            1, sample_death_analysis, sample_strategy, territory_id
        )
        
        # Get memory statistics
        stats = memory_manager.get_memory_statistics()
        
        assert "memory_usage_mb" in stats
        assert "max_memory_mb" in stats
        assert "memory_efficiency" in stats
        assert "active_generations" in stats
        assert "compressed_generations" in stats
        assert "territories" in stats
        assert "compression_ratios" in stats
        assert "cleanup_info" in stats
        
        # Check that values are reasonable
        assert stats["memory_usage_mb"] >= 0
        assert stats["memory_efficiency"] >= 0
        assert stats["active_generations"] >= 0
    
    def test_strategy_classification(self, memory_manager):
        """Test strategy type classification for knowledge transfer"""
        # Test stealth strategy
        stealth_strategy = {
            "hive_placement": {"stealth_focus": True},
            "parasite_spawning": {},
            "defensive_coordination": {}
        }
        
        strategy_type = memory_manager._classify_strategy_type(stealth_strategy)
        assert strategy_type == "stealth_placement"
        
        # Test aggressive defense strategy
        aggressive_strategy = {
            "hive_placement": {},
            "parasite_spawning": {},
            "defensive_coordination": {"aggressive_swarm": True}
        }
        
        strategy_type = memory_manager._classify_strategy_type(aggressive_strategy)
        assert strategy_type == "aggressive_defense"
        
        # Test rapid expansion strategy
        rapid_strategy = {
            "hive_placement": {},
            "parasite_spawning": {"rapid_spawn": True},
            "defensive_coordination": {}
        }
        
        strategy_type = memory_manager._classify_strategy_type(rapid_strategy)
        assert strategy_type == "rapid_expansion"
    
    @pytest.mark.asyncio
    async def test_background_cleanup_task(self, memory_manager):
        """Test background cleanup task functionality"""
        # Mock the cleanup interval to be very short for testing
        memory_manager.cleanup_interval = 0.1
        memory_manager._last_cleanup = 0  # Force cleanup
        
        # Wait for background task to run
        await asyncio.sleep(0.2)
        
        # Check that cleanup was performed
        assert memory_manager._last_cleanup > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])