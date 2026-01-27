"""
Unit tests for Game Simulator Implementation
Task 8: Add unit tests for simulation
"""

import unittest
import os
import sys

# Add server directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from game_simulator.config import SimulationConfig
from game_simulator.entities import Worker, Protector, Parasite, WorkerState, ProtectorState
from game_simulator.state import SimulatedGameState
from game_simulator.simulator import Simulator
from game_simulator.observation import generate_observation


class TestEntityMovement(unittest.TestCase):
    """Test entity movement functionality - Requirements 2.2, 3.2"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = SimulationConfig(
            grid_size=20,
            worker_speed=1.0,
            protector_speed=1.5,
            flee_radius=3,
            flee_duration=5,
            detection_radius=5,
            kill_radius=2,
            mining_rate=1.0
        )
    
    def test_worker_moves_toward_target(self):
        """Test that worker moves toward target chunk - Requirement 2.2"""
        # Create worker at chunk 0 (top-left) targeting chunk 19 (top-right)
        worker = Worker(chunk=0, target_chunk=19)
        
        # Update worker with no parasites
        mining = worker.update([], self.config)
        
        # Worker should move toward target
        self.assertEqual(worker.state, WorkerState.MOVING)
        self.assertNotEqual(worker.chunk, 0, "Worker should have moved from starting position")
        self.assertEqual(mining, 0.0, "Worker should not generate resources while moving")
        
        # Worker should be closer to target after movement
        initial_distance = 19  # Distance from 0 to 19 on same row
        new_distance = abs((worker.chunk % 20) - (19 % 20))  # Distance on x-axis
        self.assertLess(new_distance, initial_distance, "Worker should be closer to target")
    
    def test_worker_reaches_target_and_mines(self):
        """Test that worker mines when reaching target - Requirement 2.2"""
        # Create worker already at target
        worker = Worker(chunk=100, target_chunk=100)
        
        # Update worker with no parasites
        mining = worker.update([], self.config)
        
        # Worker should be mining
        self.assertEqual(worker.state, WorkerState.MINING)
        self.assertEqual(worker.chunk, 100, "Worker should stay at target")
        self.assertEqual(mining, self.config.mining_rate, "Worker should generate resources")
    
    def test_protector_follows_patrol_path(self):
        """Test that protector follows patrol path - Requirement 3.2"""
        # Create protector with simple patrol path
        patrol_path = [100, 101, 102, 103]
        protector = Protector(chunk=100, patrol_path=patrol_path, patrol_index=0)
        
        # Update protector with no parasites
        killed = protector.update([], self.config)
        
        # Protector should be patrolling
        self.assertEqual(protector.state, ProtectorState.PATROLLING)
        self.assertIsNone(killed, "No parasite should be killed")
        
        # Since protector starts at first patrol point, it should move to next
        self.assertEqual(protector.patrol_index, 1, "Should advance to next patrol point")
        
        # Continue patrol - should move toward next point
        killed = protector.update([], self.config)
        self.assertNotEqual(protector.chunk, 100, "Protector should move toward next patrol point")
    
    def test_protector_cycles_through_patrol_path(self):
        """Test that protector cycles through entire patrol path - Requirement 3.2"""
        # Create protector with patrol path
        patrol_path = [100, 101]
        protector = Protector(chunk=100, patrol_path=patrol_path, patrol_index=0)
        
        # Move through patrol cycle
        protector.update([], self.config)  # Advance to index 1
        self.assertEqual(protector.patrol_index, 1)
        
        # Move to second patrol point
        protector.chunk = 101  # Simulate reaching the point
        protector.update([], self.config)  # Should cycle back to index 0
        self.assertEqual(protector.patrol_index, 0, "Should cycle back to start of patrol")


class TestWorkerFleeing(unittest.TestCase):
    """Test worker fleeing behavior - Requirement 2.3"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = SimulationConfig(
            flee_radius=3,
            flee_duration=5,
            worker_speed=1.0,
            mining_rate=1.0
        )
    
    def test_worker_flees_from_parasite(self):
        """Test that worker flees when parasite is nearby - Requirement 2.3"""
        # Create worker and nearby parasite
        worker = Worker(chunk=100, target_chunk=100)  # Worker at mining spot
        parasite = Parasite(chunk=101, type='energy', spawn_time=0)  # Adjacent parasite
        
        # Verify distance is within flee radius
        distance = worker.distance_to(parasite.chunk)
        self.assertLess(distance, self.config.flee_radius, "Parasite should be within flee radius")
        
        # Update worker with nearby parasite
        mining = worker.update([parasite], self.config)
        
        # Worker should flee
        self.assertEqual(worker.state, WorkerState.FLEEING)
        self.assertEqual(worker.flee_timer, self.config.flee_duration)
        self.assertEqual(mining, 0.0, "Fleeing worker should not generate resources")
        # Note: Worker position may not change immediately if move_away_from doesn't move far enough
    
    def test_worker_returns_after_flee_timer(self):
        """Test that worker returns to mining after flee timer expires - Requirement 2.3"""
        # Create worker in fleeing state
        worker = Worker(chunk=105, target_chunk=100, state=WorkerState.FLEEING, flee_timer=1)
        
        # Update with no parasites - should continue fleeing for 1 more tick
        mining = worker.update([], self.config)
        self.assertEqual(worker.state, WorkerState.FLEEING)
        self.assertEqual(worker.flee_timer, 0)
        self.assertEqual(mining, 0.0, "Should not mine while flee timer active")
        
        # Update again - flee timer expired, should return to moving
        mining = worker.update([], self.config)
        self.assertEqual(worker.state, WorkerState.MOVING)
        self.assertEqual(worker.flee_timer, 0)
    
    def test_worker_ignores_distant_parasite(self):
        """Test that worker ignores parasites outside flee radius - Requirement 2.3"""
        # Create worker and distant parasite
        worker = Worker(chunk=100, target_chunk=100)
        parasite = Parasite(chunk=110, type='energy', spawn_time=0)  # Distant parasite
        
        # Update worker - should continue mining
        mining = worker.update([parasite], self.config)
        
        # Worker should not flee from distant parasite
        self.assertEqual(worker.state, WorkerState.MINING)
        self.assertEqual(worker.flee_timer, 0)
        self.assertEqual(mining, self.config.mining_rate, "Should continue mining")


class TestProtectorChasing(unittest.TestCase):
    """Test protector chasing behavior - Requirements 3.3, 3.4"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = SimulationConfig(
            detection_radius=5,
            kill_radius=2,
            protector_speed=1.5
        )
    
    def test_protector_detects_parasite(self):
        """Test that protector detects nearby parasite - Requirement 3.3"""
        # Create protector and nearby parasite (far enough to not be killed immediately)
        patrol_path = [100, 101, 102]
        protector = Protector(chunk=100, patrol_path=patrol_path)
        parasite = Parasite(chunk=104, type='energy', spawn_time=0)  # Within detection range but not kill range
        
        # Verify distance is within detection radius but outside kill radius after movement
        distance = protector.distance_to(parasite.chunk)
        self.assertLess(distance, self.config.detection_radius, "Parasite should be within detection radius")
        self.assertGreater(distance - self.config.protector_speed, self.config.kill_radius, 
                          "Parasite should not be killed immediately after one move")
        
        # Update protector
        killed = protector.update([parasite], self.config)
        
        # Protector should start chasing (and not kill immediately)
        self.assertEqual(protector.state, ProtectorState.CHASING)
        self.assertEqual(protector.chase_target, parasite)
        self.assertIsNone(killed, "Should not kill parasite immediately")
    
    def test_protector_kills_parasite(self):
        """Test that protector kills parasite when close enough - Requirement 3.4"""
        # Create protector and parasite within kill radius
        patrol_path = [100, 101, 102]
        protector = Protector(chunk=100, patrol_path=patrol_path, 
                            state=ProtectorState.CHASING)
        parasite = Parasite(chunk=101, type='energy', spawn_time=0)  # Within kill radius
        protector.chase_target = parasite
        
        # Update protector
        killed = protector.update([parasite], self.config)
        
        # Protector should kill parasite and return to patrol
        self.assertEqual(killed, parasite, "Should kill the parasite")
        self.assertEqual(protector.state, ProtectorState.PATROLLING)
        self.assertIsNone(protector.chase_target, "Should clear chase target")
    
    def test_protector_ignores_distant_parasite(self):
        """Test that protector ignores parasites outside detection radius - Requirement 3.3"""
        # Create protector and distant parasite
        patrol_path = [100, 101, 102]
        protector = Protector(chunk=100, patrol_path=patrol_path)
        parasite = Parasite(chunk=319, type='energy', spawn_time=0)  # Far corner of map
        
        # Verify distance is outside detection radius
        distance = protector.distance_to(parasite.chunk)
        self.assertGreater(distance, self.config.detection_radius, "Parasite should be outside detection radius")
        
        # Update protector
        killed = protector.update([parasite], self.config)
        
        # Protector should continue patrolling
        self.assertEqual(protector.state, ProtectorState.PATROLLING)
        self.assertIsNone(protector.chase_target)
        self.assertIsNone(killed, "Should not kill distant parasite")
    
    def test_protector_returns_to_patrol_when_target_removed(self):
        """Test that protector returns to patrol when chase target is removed - Requirement 3.4"""
        # Create protector in chasing state
        patrol_path = [100, 101, 102]
        protector = Protector(chunk=100, patrol_path=patrol_path, 
                            state=ProtectorState.CHASING)
        parasite = Parasite(chunk=105, type='energy', spawn_time=0)
        protector.chase_target = parasite
        
        # Update with empty parasite list (target was removed)
        killed = protector.update([], self.config)
        
        # Protector should return to patrolling
        self.assertEqual(protector.state, ProtectorState.PATROLLING)
        self.assertIsNone(protector.chase_target)
        self.assertIsNone(killed, "Should not kill non-existent parasite")


class TestResourceGeneration(unittest.TestCase):
    """Test resource generation mechanics - Requirement 2.4"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = SimulationConfig(
            mining_rate=1.0,
            flee_radius=3,
            flee_duration=5
        )
    
    def test_mining_workers_generate_resources(self):
        """Test that mining workers generate resources - Requirement 2.4"""
        # Create worker at mining spot
        worker = Worker(chunk=100, target_chunk=100)
        
        # Update worker with no parasites
        mining = worker.update([], self.config)
        
        # Should generate resources
        self.assertEqual(worker.state, WorkerState.MINING)
        self.assertEqual(mining, self.config.mining_rate, "Mining worker should generate resources")
    
    def test_fleeing_workers_dont_generate_resources(self):
        """Test that fleeing workers don't generate resources - Requirement 2.4"""
        # Create worker with nearby parasite
        worker = Worker(chunk=100, target_chunk=100)
        parasite = Parasite(chunk=101, type='energy', spawn_time=0)
        
        # Update worker - should flee
        mining = worker.update([parasite], self.config)
        
        # Should not generate resources while fleeing
        self.assertEqual(worker.state, WorkerState.FLEEING)
        self.assertEqual(mining, 0.0, "Fleeing worker should not generate resources")
    
    def test_moving_workers_dont_generate_resources(self):
        """Test that moving workers don't generate resources - Requirement 2.4"""
        # Create worker away from target
        worker = Worker(chunk=100, target_chunk=120)
        
        # Update worker with no parasites
        mining = worker.update([], self.config)
        
        # Should not generate resources while moving
        self.assertEqual(worker.state, WorkerState.MOVING)
        self.assertEqual(mining, 0.0, "Moving worker should not generate resources")


class TestObservationFormat(unittest.TestCase):
    """Test observation format - Requirement 7.1"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = SimulationConfig(
            grid_size=20,
            queen_chunk=200,
            mining_spots=[45, 67, 123],
            num_workers=3,
            num_protectors=2,
            queen_start_energy=50.0,
            player_start_energy=100.0,
            player_start_minerals=50.0
        )
        self.state = SimulatedGameState.create_initial(self.config)
    
    def test_observation_has_all_required_fields(self):
        """Test that observation contains all required fields - Requirement 7.1"""
        observation = generate_observation(self.state)
        
        # Verify all required fields are present
        required_fields = [
            "territoryId", "aiPlayer", "tick", "chunks", "queenEnergy",
            "playerEnergyStart", "playerEnergyEnd", "playerMineralsStart", 
            "playerMineralsEnd", "hiveChunk"
        ]
        
        for field in required_fields:
            self.assertIn(field, observation, f"Missing required field: {field}")
    
    def test_observation_field_types(self):
        """Test that observation fields have correct data types - Requirement 7.1"""
        observation = generate_observation(self.state)
        
        # Verify data types
        self.assertIsInstance(observation["territoryId"], str)
        self.assertIsInstance(observation["aiPlayer"], int)
        self.assertIsInstance(observation["tick"], int)
        self.assertIsInstance(observation["chunks"], dict)
        self.assertIsInstance(observation["queenEnergy"], (int, float))
        self.assertIsInstance(observation["playerEnergyStart"], (int, float))
        self.assertIsInstance(observation["playerEnergyEnd"], (int, float))
        self.assertIsInstance(observation["playerMineralsStart"], (int, float))
        self.assertIsInstance(observation["playerMineralsEnd"], (int, float))
        self.assertIsInstance(observation["hiveChunk"], int)
    
    def test_observation_static_values(self):
        """Test that observation has correct static values - Requirement 7.1"""
        observation = generate_observation(self.state)
        
        # Verify static values match expected format
        self.assertEqual(observation["territoryId"], "sim-territory")
        self.assertEqual(observation["aiPlayer"], 1)
        self.assertEqual(observation["hiveChunk"], self.config.queen_chunk)
    
    def test_observation_state_values(self):
        """Test that observation reflects current state values - Requirement 7.1"""
        # Modify state values
        self.state.tick = 42
        self.state.queen_energy = 75.5
        self.state.player_energy = 120.0
        self.state.player_minerals = 80.0
        self.state.player_energy_prev = 110.0
        self.state.player_minerals_prev = 70.0
        
        observation = generate_observation(self.state)
        
        # Verify state values are reflected
        self.assertEqual(observation["tick"], 42)
        self.assertEqual(observation["queenEnergy"], 75.5)
        self.assertEqual(observation["playerEnergyStart"], 110.0)
        self.assertEqual(observation["playerEnergyEnd"], 120.0)
        self.assertEqual(observation["playerMineralsStart"], 70.0)
        self.assertEqual(observation["playerMineralsEnd"], 80.0)
    
    def test_chunks_structure(self):
        """Test that chunks field has correct structure - Requirement 7.1"""
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Each chunk entry should have the required structure
        for chunk_id, chunk_data in chunks.items():
            self.assertIsInstance(chunk_id, str, "Chunk ID should be string")
            self.assertIsInstance(chunk_data, dict, "Chunk data should be dict")
            
            # Verify chunk data structure
            required_chunk_fields = ["workers", "protectors", "energyParasites", "combatParasites"]
            for field in required_chunk_fields:
                self.assertIn(field, chunk_data, f"Missing chunk field: {field}")
                self.assertIsInstance(chunk_data[field], int, f"Chunk field {field} should be int")
                self.assertGreaterEqual(chunk_data[field], 0, f"Chunk field {field} should be non-negative")


class TestChunkCounting(unittest.TestCase):
    """Test chunk counting functionality - Requirement 7.2"""
    
    def setUp(self):
        """Set up test environment"""
        self.config = SimulationConfig(
            grid_size=20,
            queen_chunk=200,
            mining_spots=[45, 67, 123],
            num_workers=0,  # Start with no entities, add manually
            num_protectors=0
        )
        self.state = SimulatedGameState.create_initial(self.config)
        # Clear entities to start fresh
        self.state.workers = []
        self.state.protectors = []
        self.state.parasites = []
    
    def test_multiple_workers_same_chunk(self):
        """Test counting multiple workers in same chunk - Requirement 7.2"""
        # Add multiple workers to same chunk
        chunk = 100
        self.state.workers = [
            Worker(chunk=chunk, target_chunk=chunk),
            Worker(chunk=chunk, target_chunk=chunk),
            Worker(chunk=chunk, target_chunk=chunk)
        ]
        
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Verify worker count
        self.assertIn(str(chunk), chunks)
        self.assertEqual(chunks[str(chunk)]["workers"], 3)
        self.assertEqual(chunks[str(chunk)]["protectors"], 0)
        self.assertEqual(chunks[str(chunk)]["energyParasites"], 0)
        self.assertEqual(chunks[str(chunk)]["combatParasites"], 0)
    
    def test_workers_and_protectors_same_chunk(self):
        """Test counting workers and protectors in same chunk - Requirement 7.2"""
        # Add workers and protectors to same chunk
        chunk = 150
        self.state.workers = [
            Worker(chunk=chunk, target_chunk=chunk),
            Worker(chunk=chunk, target_chunk=chunk)
        ]
        self.state.protectors = [
            Protector(chunk=chunk, patrol_path=[chunk, chunk+1, chunk+2])
        ]
        
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Verify counts
        self.assertIn(str(chunk), chunks)
        self.assertEqual(chunks[str(chunk)]["workers"], 2)
        self.assertEqual(chunks[str(chunk)]["protectors"], 1)
        self.assertEqual(chunks[str(chunk)]["energyParasites"], 0)
        self.assertEqual(chunks[str(chunk)]["combatParasites"], 0)
    
    def test_parasites_by_type_same_chunk(self):
        """Test counting parasites by type in same chunk - Requirement 7.2"""
        # Add different parasite types to same chunk
        chunk = 200
        self.state.parasites = [
            Parasite(chunk=chunk, type="energy", spawn_time=0),
            Parasite(chunk=chunk, type="energy", spawn_time=1),
            Parasite(chunk=chunk, type="combat", spawn_time=2)
        ]
        
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Verify parasite counts by type
        self.assertIn(str(chunk), chunks)
        self.assertEqual(chunks[str(chunk)]["workers"], 0)
        self.assertEqual(chunks[str(chunk)]["protectors"], 0)
        self.assertEqual(chunks[str(chunk)]["energyParasites"], 2)
        self.assertEqual(chunks[str(chunk)]["combatParasites"], 1)
    
    def test_all_entity_types_same_chunk(self):
        """Test counting all entity types in same chunk - Requirement 7.2"""
        # Add all entity types to same chunk
        chunk = 250
        self.state.workers = [Worker(chunk=chunk, target_chunk=chunk)]
        self.state.protectors = [Protector(chunk=chunk, patrol_path=[chunk, chunk+1])]
        self.state.parasites = [
            Parasite(chunk=chunk, type="energy", spawn_time=0),
            Parasite(chunk=chunk, type="combat", spawn_time=1)
        ]
        
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Verify all counts
        self.assertIn(str(chunk), chunks)
        self.assertEqual(chunks[str(chunk)]["workers"], 1)
        self.assertEqual(chunks[str(chunk)]["protectors"], 1)
        self.assertEqual(chunks[str(chunk)]["energyParasites"], 1)
        self.assertEqual(chunks[str(chunk)]["combatParasites"], 1)
    
    def test_entities_in_different_chunks(self):
        """Test that entities in different chunks are counted separately - Requirement 7.2"""
        # Add entities to different chunks
        chunk1, chunk2 = 100, 200
        self.state.workers = [
            Worker(chunk=chunk1, target_chunk=chunk1),
            Worker(chunk=chunk2, target_chunk=chunk2)
        ]
        self.state.protectors = [
            Protector(chunk=chunk1, patrol_path=[chunk1, chunk1+1])
        ]
        self.state.parasites = [
            Parasite(chunk=chunk2, type="energy", spawn_time=0)
        ]
        
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Verify chunk1 counts
        self.assertIn(str(chunk1), chunks)
        self.assertEqual(chunks[str(chunk1)]["workers"], 1)
        self.assertEqual(chunks[str(chunk1)]["protectors"], 1)
        self.assertEqual(chunks[str(chunk1)]["energyParasites"], 0)
        self.assertEqual(chunks[str(chunk1)]["combatParasites"], 0)
        
        # Verify chunk2 counts
        self.assertIn(str(chunk2), chunks)
        self.assertEqual(chunks[str(chunk2)]["workers"], 1)
        self.assertEqual(chunks[str(chunk2)]["protectors"], 0)
        self.assertEqual(chunks[str(chunk2)]["energyParasites"], 1)
        self.assertEqual(chunks[str(chunk2)]["combatParasites"], 0)
    
    def test_empty_chunks_not_included(self):
        """Test that chunks with no entities are not included - Requirement 7.2"""
        # Add entities only to specific chunks
        self.state.workers = [Worker(chunk=100, target_chunk=100)]
        
        observation = generate_observation(self.state)
        chunks = observation["chunks"]
        
        # Only chunk 100 should be present
        self.assertIn("100", chunks)
        self.assertNotIn("101", chunks)  # Empty chunk should not be included
        self.assertNotIn("200", chunks)  # Empty chunk should not be included


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)