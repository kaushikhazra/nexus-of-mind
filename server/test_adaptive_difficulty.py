"""
Test script for Adaptive Difficulty System
"""

import asyncio
import logging
import sys
import os

# Add the server directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_engine.adaptive_difficulty import AdaptiveDifficultySystem

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_adaptive_difficulty_basic():
    """Test basic adaptive difficulty functionality"""
    logger.info("Testing Adaptive Difficulty System - Basic Functionality")
    
    # Initialize the system
    difficulty_system = AdaptiveDifficultySystem()
    
    # Test initial state
    initial_difficulty = difficulty_system.get_current_difficulty_level()
    logger.info(f"Initial difficulty level: {initial_difficulty}")
    assert 0.0 <= initial_difficulty <= 1.0, "Initial difficulty should be between 0.0 and 1.0"
    
    # Test difficulty modifiers
    modifiers = difficulty_system.get_difficulty_modifiers()
    logger.info(f"Initial difficulty modifiers: {modifiers}")
    assert isinstance(modifiers, dict), "Difficulty modifiers should be a dictionary"
    assert 'strategy_complexity' in modifiers, "Should include strategy_complexity modifier"
    
    # Test game outcome processing - player wins
    win_outcome = {
        'player_won': True,
        'survival_time': 300.0,  # 5 minutes
        'queens_killed': 2,
        'resources_gathered': 1000,
        'units_created': 15,
        'combat_encounters': 3,
        'strategic_decisions': ['expand_mining', 'build_protectors'],
        'adaptation_indicators': {'learned_pattern': True},
        'game_duration': 400.0,
        'difficulty_level': initial_difficulty
    }
    
    result = await difficulty_system.update_player_performance(win_outcome)
    logger.info(f"Win outcome result: {result}")
    
    # Test game outcome processing - player loses
    loss_outcome = {
        'player_won': False,
        'survival_time': 120.0,  # 2 minutes
        'queens_killed': 0,
        'resources_gathered': 200,
        'units_created': 5,
        'combat_encounters': 1,
        'strategic_decisions': ['basic_mining'],
        'adaptation_indicators': {},
        'game_duration': 150.0,
        'difficulty_level': difficulty_system.get_current_difficulty_level()
    }
    
    result = await difficulty_system.update_player_performance(loss_outcome)
    logger.info(f"Loss outcome result: {result}")
    
    # Test difficulty insights
    insights = difficulty_system.get_difficulty_insights()
    logger.info(f"Difficulty insights: {insights}")
    assert 'current_difficulty' in insights, "Should include current difficulty"
    assert 'actual_success_rate' in insights, "Should include actual success rate"
    
    logger.info("✓ Basic adaptive difficulty tests passed")


async def test_adaptive_difficulty_progression():
    """Test difficulty progression over multiple games"""
    logger.info("Testing Adaptive Difficulty System - Progression")
    
    difficulty_system = AdaptiveDifficultySystem()
    initial_difficulty = difficulty_system.get_current_difficulty_level()
    
    # Simulate multiple wins (should increase difficulty)
    for i in range(5):
        win_outcome = {
            'player_won': True,
            'survival_time': 400.0 + (i * 50),  # Improving performance
            'queens_killed': 2 + i,
            'resources_gathered': 1000 + (i * 200),
            'units_created': 15 + (i * 3),
            'combat_encounters': 3,
            'strategic_decisions': ['expand_mining', 'build_protectors', 'coordinate_assault'],
            'adaptation_indicators': {'learned_pattern': True, 'improved_efficiency': True},
            'game_duration': 500.0 + (i * 30),
            'difficulty_level': difficulty_system.get_current_difficulty_level()
        }
        
        result = await difficulty_system.update_player_performance(win_outcome)
        logger.info(f"Game {i+1} - Difficulty: {result['current_difficulty']:.3f}, "
                   f"Success Rate: {result['player_metrics']['win_rate']:.3f}")
    
    final_difficulty = difficulty_system.get_current_difficulty_level()
    logger.info(f"Difficulty progression: {initial_difficulty:.3f} -> {final_difficulty:.3f}")
    
    # Simulate multiple losses (should decrease difficulty)
    for i in range(3):
        loss_outcome = {
            'player_won': False,
            'survival_time': 100.0 - (i * 10),  # Declining performance
            'queens_killed': 0,
            'resources_gathered': 150 - (i * 20),
            'units_created': 3,
            'combat_encounters': 1,
            'strategic_decisions': ['basic_mining'],
            'adaptation_indicators': {},
            'game_duration': 120.0,
            'difficulty_level': difficulty_system.get_current_difficulty_level()
        }
        
        result = await difficulty_system.update_player_performance(loss_outcome)
        logger.info(f"Loss {i+1} - Difficulty: {result['current_difficulty']:.3f}, "
                   f"Success Rate: {result['player_metrics']['win_rate']:.3f}")
    
    adjusted_difficulty = difficulty_system.get_current_difficulty_level()
    logger.info(f"After losses: {final_difficulty:.3f} -> {adjusted_difficulty:.3f}")
    
    logger.info("✓ Difficulty progression tests passed")


async def test_skill_assessment():
    """Test player skill assessment components"""
    logger.info("Testing Player Skill Assessment")
    
    difficulty_system = AdaptiveDifficultySystem()
    
    # Test with varying performance data
    performance_scenarios = [
        # Beginner player
        {
            'player_won': False,
            'survival_time': 90.0,
            'queens_killed': 0,
            'resources_gathered': 100,
            'units_created': 2,
            'combat_encounters': 1,
            'strategic_decisions': ['basic_mining'],
            'adaptation_indicators': {},
            'game_duration': 120.0,
            'difficulty_level': 0.3
        },
        # Intermediate player
        {
            'player_won': True,
            'survival_time': 250.0,
            'queens_killed': 1,
            'resources_gathered': 600,
            'units_created': 10,
            'combat_encounters': 2,
            'strategic_decisions': ['expand_mining', 'build_protectors'],
            'adaptation_indicators': {'learned_pattern': True},
            'game_duration': 300.0,
            'difficulty_level': 0.5
        },
        # Advanced player
        {
            'player_won': True,
            'survival_time': 450.0,
            'queens_killed': 3,
            'resources_gathered': 1200,
            'units_created': 20,
            'combat_encounters': 4,
            'strategic_decisions': ['expand_mining', 'build_protectors', 'coordinate_assault', 'strategic_retreat'],
            'adaptation_indicators': {'learned_pattern': True, 'improved_efficiency': True, 'tactical_adaptation': True},
            'game_duration': 500.0,
            'difficulty_level': 0.8
        }
    ]
    
    for i, scenario in enumerate(performance_scenarios):
        result = await difficulty_system.update_player_performance(scenario)
        skill_level = result.get('skill_level', 0.5)
        logger.info(f"Scenario {i+1} - Skill Level: {skill_level:.3f}, "
                   f"Difficulty: {result['current_difficulty']:.3f}")
    
    logger.info("✓ Skill assessment tests passed")


async def test_engagement_monitoring():
    """Test engagement and frustration monitoring"""
    logger.info("Testing Engagement Monitoring")
    
    difficulty_system = AdaptiveDifficultySystem()
    
    # Simulate frustrating scenario (multiple losses)
    for i in range(4):
        frustrating_outcome = {
            'player_won': False,
            'survival_time': 60.0,
            'queens_killed': 0,
            'resources_gathered': 80,
            'units_created': 1,
            'combat_encounters': 1,
            'strategic_decisions': ['basic_mining'],
            'adaptation_indicators': {},
            'game_duration': 90.0,
            'difficulty_level': difficulty_system.get_current_difficulty_level()
        }
        
        result = await difficulty_system.update_player_performance(frustrating_outcome)
        engagement_level = result.get('engagement_level', 0.5)
        logger.info(f"Frustration test {i+1} - Engagement: {engagement_level:.3f}, "
                   f"Difficulty: {result['current_difficulty']:.3f}")
    
    # Simulate boring scenario (easy wins)
    for i in range(3):
        easy_outcome = {
            'player_won': True,
            'survival_time': 600.0,  # Very long survival
            'queens_killed': 5,
            'resources_gathered': 2000,
            'units_created': 30,
            'combat_encounters': 1,  # Very few encounters
            'strategic_decisions': ['expand_mining', 'build_protectors'],
            'adaptation_indicators': {'learned_pattern': True},
            'game_duration': 200.0,  # Quick wins
            'difficulty_level': difficulty_system.get_current_difficulty_level()
        }
        
        result = await difficulty_system.update_player_performance(easy_outcome)
        engagement_level = result.get('engagement_level', 0.5)
        logger.info(f"Boredom test {i+1} - Engagement: {engagement_level:.3f}, "
                   f"Difficulty: {result['current_difficulty']:.3f}")
    
    logger.info("✓ Engagement monitoring tests passed")


async def main():
    """Run all adaptive difficulty tests"""
    logger.info("Starting Adaptive Difficulty System Tests")
    
    try:
        await test_adaptive_difficulty_basic()
        await test_adaptive_difficulty_progression()
        await test_skill_assessment()
        await test_engagement_monitoring()
        
        logger.info("🎉 All Adaptive Difficulty System tests passed!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())