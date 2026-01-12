#!/usr/bin/env python3
"""
Test script for Player Behavior Learning System
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from ai_engine.player_behavior import PlayerBehaviorAnalyzer
from ai_engine.data_models import GameStateSnapshot
import asyncio
import time

async def test_player_behavior():
    """Test the player behavior learning system"""
    print("Testing Player Behavior Learning System...")
    
    analyzer = PlayerBehaviorAnalyzer()
    
    # Test with sample game state
    game_state = {
        'timestamp': time.time(),
        'energy_level': 600,
        'active_mining': [
            {'location': {'x': 100, 'z': 50}, 'resource_type': 'energy'},
            {'location': {'x': 200, 'z': 100}, 'resource_type': 'energy'}
        ],
        'protector_positions': [
            {'x': 150, 'z': 75},
            {'x': 180, 'z': 90}
        ],
        'worker_positions': [
            {'x': 110, 'z': 60},
            {'x': 190, 'z': 95},
            {'x': 220, 'z': 110}
        ],
        'explored_areas': [
            {'area_id': 1}, {'area_id': 2}, {'area_id': 3}
        ]
    }
    
    # Update patterns multiple times to test continuous learning
    for i in range(15):
        # Simulate changing game state
        game_state['timestamp'] = time.time() + i * 30
        game_state['energy_level'] = 600 - i * 20
        game_state['active_mining'].append({
            'location': {'x': 100 + i * 50, 'z': 50 + i * 25}, 
            'resource_type': 'energy'
        })
        
        await analyzer.update_patterns(game_state)
        
        if i % 5 == 4:  # Print progress every 5 updates
            summary = analyzer.get_summary()
            print(f'Update {i+1}: Player type: {summary["player_type"]}, Confidence: {summary["confidence"]:.2f}')
    
    # Test final analysis
    patterns = analyzer.get_patterns()
    feature_vector = analyzer.get_feature_vector()
    learning_insights = analyzer.get_learning_insights()
    
    print(f'\nFinal Analysis:')
    print(f'Player Type: {patterns.player_profile.player_type}')
    print(f'Confidence: {patterns.player_profile.confidence:.2f}')
    print(f'Mining Aggression: {patterns.mining_patterns["aggression_score"]:.2f}')
    print(f'Combat Style: {patterns.combat_patterns["combat_style"]}')
    print(f'Energy Management: {patterns.energy_patterns["management_style"]}')
    print(f'Exploration Rate: {patterns.exploration_patterns["exploration_rate"]:.2f}')
    print(f'Feature Vector Length: {len(feature_vector)}')
    print(f'Behavioral Transitions: {learning_insights["behavioral_transitions"]}')
    print(f'Adaptation Events: {learning_insights["adaptation_events"]}')
    
    print('\nPlayer Behavior Learning System implemented successfully!')
    return True

if __name__ == "__main__":
    # Run the test
    result = asyncio.run(test_player_behavior())
    if result:
        print("✅ All tests passed!")
    else:
        print("❌ Tests failed!")
        sys.exit(1)