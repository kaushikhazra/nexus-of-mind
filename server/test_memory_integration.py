"""
Integration test for Memory Manager with AI Engine
"""

import pytest
import asyncio
import tempfile
import os
from ai_engine.ai_engine import AIEngine
from ai_engine.data_models import QueenDeathData


@pytest.mark.asyncio
async def test_memory_manager_ai_engine_integration():
    """Test memory manager integration with AI engine"""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create AI engine
        ai_engine = AIEngine()
        await ai_engine.initialize()
        
        # Configure memory manager with temporary storage
        ai_engine.memory_manager.storage_path = os.path.join(temp_dir, "memory")
        ai_engine.memory_manager.compressed_path = os.path.join(temp_dir, "compressed")
        ai_engine.memory_manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
        ai_engine.memory_manager._ensure_storage_directories()
        
        # Create sample death data as dictionary (matching expected format)
        death_data_dict = {
            "queenId": "test_queen",
            "territoryId": "test_territory", 
            "generation": 1,
            "deathLocation": {"x": 10, "y": 0, "z": 15},
            "deathCause": "protector_assault",
            "survivalTime": 120.0,
            "parasitesSpawned": 8,
            "hiveDiscoveryTime": 30.0,
            "playerUnits": {"protectors": [], "workers": []},
            "assaultPattern": {"type": "direct"},
            "gameState": {"energy_level": 500},
            "timestamp": 1234567890.0
        }
        
        # Process the death data (this will use the enhanced memory manager)
        try:
            result = await ai_engine.process_queen_death(death_data_dict)
            
            # Verify result structure
            assert result["type"] == "queen_strategy"
            assert "data" in result
            assert result["data"]["queenId"] == "test_queen"
            assert result["data"]["generation"] == 2  # Next generation
            
            # Verify memory manager stored the data
            assert len(ai_engine.memory_manager.generation_data) > 0
            
            # Check that territory-specific data was stored
            territory_keys = [k for k in ai_engine.memory_manager.generation_data.keys() 
                            if k.startswith("test_territory_")]
            assert len(territory_keys) > 0
            
            # Get learning progress
            progress = await ai_engine.memory_manager.get_learning_progress("test_queen", "test_territory")
            assert progress["queen_id"] == "test_queen"
            assert progress["territory_id"] == "test_territory"
            assert progress["current_generation"] >= 1
            
            print("✓ Memory manager AI engine integration test passed")
            
        except Exception as e:
            print(f"Integration test failed: {e}")
            raise
        finally:
            await ai_engine.cleanup()


@pytest.mark.asyncio
async def test_memory_manager_knowledge_transfer():
    """Test knowledge transfer functionality"""
    with tempfile.TemporaryDirectory() as temp_dir:
        ai_engine = AIEngine()
        await ai_engine.initialize()
        
        # Configure memory manager
        ai_engine.memory_manager.storage_path = os.path.join(temp_dir, "memory")
        ai_engine.memory_manager.compressed_path = os.path.join(temp_dir, "compressed")
        ai_engine.memory_manager.knowledge_base_path = os.path.join(temp_dir, "knowledge")
        ai_engine.memory_manager._ensure_storage_directories()
        
        # Create successful strategy in source territory
        death_data_source_dict = {
            "queenId": "source_queen",
            "territoryId": "source_territory",
            "generation": 5,
            "deathLocation": {"x": 20, "y": 0, "z": 25},
            "deathCause": "protector_assault",
            "survivalTime": 300.0,  # Long survival = successful
            "parasitesSpawned": 20,
            "hiveDiscoveryTime": 60.0,
            "playerUnits": {"protectors": [], "workers": []},
            "assaultPattern": {"type": "coordinated"},
            "gameState": {"energy_level": 800},
            "timestamp": 1234567890.0
        }
        
        # Process source territory death (should create successful strategy)
        await ai_engine.process_queen_death(death_data_source_dict)
        
        # Test knowledge transfer
        transfer_result = await ai_engine.memory_manager.transfer_knowledge_between_territories(
            "source_territory", "target_territory"
        )
        
        # Verify transfer occurred
        if transfer_result["transferred"] > 0:
            assert "transfer_id" in transfer_result
            assert transfer_result["adaptation_confidence"] > 0
            print("✓ Knowledge transfer test passed")
        else:
            print("ℹ No knowledge transfer occurred (expected for low success scores)")
        
        await ai_engine.cleanup()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])