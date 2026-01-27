#!/usr/bin/env python3
"""
Integration test for Player Behavior Learning System with AI Engine
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from ai_engine.ai_engine import AIEngine
from ai_engine.data_models import QueenDeathData
import asyncio
import time
import json

async def test_integration():
    """Test the integration of player behavior learning with AI engine"""
    print("Testing Player Behavior Learning System Integration...")
    
    # Initialize AI Engine
    ai_engine = AIEngine()
    await ai_engine.initialize()
    
    # Create sample Queen death data
    death_data = {
        'queenId': 'test-queen-1',
        'territoryId': 'territory-1',
        'generation': 1,
        'deathLocation': {'x': 150.0, 'y': 10.0, 'z': 75.0},
        'deathCause': 'protector_assault',
        'survivalTime': 180.0,
        'parasitesSpawned': 5,
        'hiveDiscoveryTime': 120.0,
        'playerUnits': {
            'protectors': [
                {'id': 'p1', 'position': {'x': 140, 'z': 70}},
                {'id': 'p2', 'position': {'x': 160, 'z': 80}}
            ],
            'workers': [
                {'id': 'w1', 'position': {'x': 100, 'z': 50}},
                {'id': 'w2', 'position': {'x': 200, 'z': 100}}
            ]
        },
        'assaultPattern': {
            'type': 'coordinated_attack',
            'approach_angle': 45,
            'unit_coordination': 0.8
        },
        'gameState': {
            'timestamp': time.time(),
            'energy_level': 400,
            'active_mining': [
                {'location': {'x': 100, 'z': 50}, 'resource_type': 'energy'},
                {'location': {'x': 200, 'z': 100}, 'resource_type': 'energy'},
                {'location': {'x': 300, 'z': 150}, 'resource_type': 'energy'}
            ],
            'protector_positions': [
                {'x': 140, 'z': 70},
                {'x': 160, 'z': 80},
                {'x': 180, 'z': 90}
            ],
            'worker_positions': [
                {'x': 100, 'z': 50},
                {'x': 200, 'z': 100},
                {'x': 300, 'z': 150},
                {'x': 250, 'z': 125}
            ],
            'explored_areas': [
                {'area_id': 1}, {'area_id': 2}, {'area_id': 3}, {'area_id': 4}
            ]
        },
        'timestamp': time.time()
    }
    
    print("Processing Queen death and generating strategy...")
    
    # Process the death and get new strategy
    result = await ai_engine.process_queen_death(death_data)
    
    print(f"✅ Strategy generated for generation {result['data']['generation']}")
    
    # Test player behavior analysis
    learning_insights = result['data']['learningInsights']
    player_patterns = learning_insights['playerPatterns']
    
    print(f"\nPlayer Behavior Analysis:")
    print(f"  Player Type: {player_patterns['player_type']}")
    print(f"  Confidence: {player_patterns['confidence']:.2f}")
    print(f"  Mining Aggression: {player_patterns['mining_aggression']:.2f}")
    print(f"  Combat Style: {player_patterns['combat_style']}")
    print(f"  Energy Management: {player_patterns['energy_management']}")
    print(f"  Exploration Rate: {player_patterns['exploration_rate']:.2f}")
    
    # Test continuous learning with multiple deaths
    print(f"\nTesting continuous learning with multiple Queen deaths...")
    
    for generation in range(2, 6):
        # Simulate evolving player behavior
        death_data['generation'] = generation
        death_data['survivalTime'] = 180.0 + generation * 30  # Player getting better
        death_data['gameState']['energy_level'] = 400 - generation * 50  # More aggressive energy use
        death_data['gameState']['active_mining'].append({
            'location': {'x': 100 + generation * 100, 'z': 50 + generation * 50}, 
            'resource_type': 'energy'
        })
        death_data['gameState']['protector_positions'].append({
            'x': 140 + generation * 20, 'z': 70 + generation * 15
        })
        death_data['timestamp'] = time.time() + generation * 60
        
        result = await ai_engine.process_queen_death(death_data)
        player_patterns = result['data']['learningInsights']['playerPatterns']
        
        print(f"  Generation {generation}: {player_patterns['player_type']} "
              f"(confidence: {player_patterns['confidence']:.2f}, "
              f"mining: {player_patterns['mining_aggression']:.2f})")
    
    # Test learning progress retrieval
    print(f"\nTesting learning progress retrieval...")
    progress = await ai_engine.get_learning_progress('test-queen-1')
    
    if 'error' not in progress:
        print(f"✅ Learning progress retrieved successfully")
    else:
        print(f"⚠️  Learning progress: {progress['error']}")
    
    # Test feature vector generation
    print(f"\nTesting feature vector generation...")
    feature_vector = ai_engine.player_behavior.get_feature_vector()
    print(f"✅ Feature vector generated: {len(feature_vector)} features")
    print(f"  Sample features: {[f'{f:.2f}' for f in feature_vector[:5]]}")
    
    # Test learning insights
    print(f"\nTesting detailed learning insights...")
    insights = ai_engine.player_behavior.get_learning_insights()
    print(f"✅ Learning insights generated:")
    print(f"  Updates: {insights['update_count']}")
    print(f"  Behavioral Transitions: {insights['behavioral_transitions']}")
    print(f"  Adaptation Events: {insights['adaptation_events']}")
    print(f"  Pattern Consistency: {insights['pattern_consistency']:.2f}")
    print(f"  Classification Stability: {insights['classification_stability']:.2f}")
    
    # Cleanup
    await ai_engine.cleanup()
    
    print(f"\n✅ Player Behavior Learning System integration test completed successfully!")
    return True

if __name__ == "__main__":
    # Run the integration test
    try:
        result = asyncio.run(test_integration())
        if result:
            print("🎉 All integration tests passed!")
        else:
            print("❌ Integration tests failed!")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Integration test failed with error: {e}")
        sys.exit(1)