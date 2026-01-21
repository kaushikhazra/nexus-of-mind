"""
Basic test for Enhanced Memory Manager functionality
"""

import pytest
import asyncio
import tempfile
import os
from ai_engine.memory_manager import QueenMemoryManager
from ai_engine.data_models import DeathAnalysis, QueenStrategy, PlayerPatterns, PlayerProfile


@pytest.mark.asyncio
async def test_memory_manager_creation():
    """Test basic memory manager creation"""
    with tempfile.TemporaryDirectory() as temp_dir:
        manager = QueenMemoryManager()
        manager.storage_path = os.path.join(temp_dir, "memory")
        manager.compressed_path = os.path.join(temp_dir, "compressed")
        manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
        manager._ensure_storage_directories()
        
        # Check that directories were created
        assert os.path.exists(manager.storage_path)
        assert os.path.exists(manager.compressed_path)
        assert os.path.exists(manager.knowledge_base_path)
        
        # Check initial state
        assert manager.max_generations == 10
        assert len(manager.generation_data) == 0
        assert len(manager.territory_knowledge) == 0
        assert len(manager.compressed_patterns) == 0
        
        await manager.cleanup()


@pytest.mark.asyncio
async def test_store_generation_data():
    """Test storing generation data"""
    with tempfile.TemporaryDirectory() as temp_dir:
        manager = QueenMemoryManager()
        manager.storage_path = os.path.join(temp_dir, "memory")
        manager.compressed_path = os.path.join(temp_dir, "compressed")
        manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
        manager._ensure_storage_directories()
        
        # Create sample data
        death_analysis = DeathAnalysis(
            queen_id="test_queen",
            generation=1,
            primary_cause="protector_assault",
            spatial_insights={"failed_locations": []},
            temporal_insights={"survival_time": 120.0},
            tactical_insights={"parasites_spawned": 8},
            survival_improvement=0.2,
            failed_strategies=[1, 2],
            feature_vector=[0.5] * 50,
            game_state_features=[0.3] * 20
        )
        
        strategy = QueenStrategy(
            generation=2,
            hive_placement={"stealth_focus": False},
            parasite_spawning={"rapid_spawn": True},
            defensive_coordination={"swarm_tactics": False},
            predictive_behavior=None,
            complexity_level=0.2
        )
        
        # Store data
        await manager.store_generation_data(1, death_analysis, strategy, "territory_test")
        
        # Check that data was stored
        assert len(manager.generation_data) == 1
        key = "territory_test_1"
        assert key in manager.generation_data
        
        stored_data = manager.generation_data[key]
        assert stored_data["generation"] == 1
        assert stored_data["territory_id"] == "territory_test"
        assert "learning_metrics" in stored_data
        assert "memory_priority" in stored_data
        
        await manager.cleanup()


@pytest.mark.asyncio
async def test_compress_player_patterns():
    """Test player pattern compression"""
    with tempfile.TemporaryDirectory() as temp_dir:
        manager = QueenMemoryManager()
        manager.storage_path = os.path.join(temp_dir, "memory")
        manager.compressed_path = os.path.join(temp_dir, "compressed")
        manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
        manager._ensure_storage_directories()
        
        # Create sample player patterns
        patterns = PlayerPatterns(
            mining_patterns={"preferred_locations": [{"x": 5, "z": 5}], "efficiency": 0.8},
            combat_patterns={"aggression_score": 0.6, "tactics": ["flanking"]},
            energy_patterns={"management_style": "balanced"},
            exploration_patterns={"coverage": 0.7},
            player_profile=PlayerProfile("aggressive", 0.8),
            pattern_confidence=0.75
        )
        
        # Compress patterns
        pattern_id = await manager.compress_player_patterns(patterns, "territory_test")
        
        # Check compression
        assert pattern_id is not None
        assert pattern_id in manager.compressed_patterns
        
        compression_info = manager.compressed_patterns[pattern_id]
        assert compression_info["territory_id"] == "territory_test"
        assert compression_info["compression_ratio"] > 0
        
        # Test retrieval
        decompressed = await manager.get_compressed_pattern(pattern_id)
        assert decompressed is not None
        assert "mining_summary" in decompressed
        assert "player_type" in decompressed
        
        await manager.cleanup()


@pytest.mark.asyncio
async def test_memory_statistics():
    """Test memory statistics"""
    with tempfile.TemporaryDirectory() as temp_dir:
        manager = QueenMemoryManager()
        manager.storage_path = os.path.join(temp_dir, "memory")
        manager.compressed_path = os.path.join(temp_dir, "compressed")
        manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
        manager._ensure_storage_directories()
        
        # Get statistics
        stats = manager.get_memory_statistics()
        
        # Check statistics structure
        assert "memory_usage_mb" in stats
        assert "max_memory_mb" in stats
        assert "memory_efficiency" in stats
        assert "active_generations" in stats
        assert "compressed_generations" in stats
        assert "territories" in stats
        assert "compression_ratios" in stats
        assert "cleanup_info" in stats
        
        # Check values are reasonable
        assert stats["memory_usage_mb"] >= 0
        assert stats["max_memory_mb"] == 200  # Default value
        assert 0 <= stats["memory_efficiency"] <= 1
        
        await manager.cleanup()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])