"""
Test Strategy Generation System - Validates enhanced strategy generation
"""

import pytest
import asyncio
from ai_engine.strategy_generator import (
    StrategyGenerator, 
    HivePlacementGenerator, 
    SpawnTimingGenerator,
    DefensiveCoordinationGenerator,
    PredictiveBehaviorGenerator
)
from ai_engine.data_models import PlayerPatterns, DeathAnalysis, PlayerProfile


class TestStrategyGeneration:
    """Test enhanced strategy generation system"""
    
    @pytest.fixture
    def strategy_generator(self):
        """Create strategy generator instance"""
        return StrategyGenerator()
    
    @pytest.fixture
    def sample_player_patterns(self):
        """Create sample player patterns for testing"""
        player_profile = PlayerProfile('aggressive', 0.8)
        return PlayerPatterns(
            mining_patterns={
                'expansion_rate': 0.7,
                'intensity': 0.6,
                'preferred_locations': [{'x': 50, 'z': 30}],
                'timing_patterns': {'early_aggression': True}
            },
            combat_patterns={
                'timing_patterns': {'early_aggression': True},
                'approach_vectors': [45, 135],
                'coordination': 0.7
            },
            energy_patterns={
                'spending_patterns': {'aggressive': True},
                'conservation_behavior': 'low'
            },
            exploration_patterns={},
            player_profile=player_profile,
            pattern_confidence=0.7
        )
    
    @pytest.fixture
    def sample_death_analysis(self):
        """Create sample death analysis for testing"""
        return DeathAnalysis(
            queen_id='test_queen',
            generation=3,
            primary_cause='protector_assault',
            spatial_insights={
                'failed_locations': [{'x': 10, 'y': 5, 'z': 15}],
                'placement_score': 0.3
            },
            temporal_insights={'spawn_timing_score': 0.4},
            tactical_insights={
                'spawn_effectiveness': 0.3,
                'defensive_failures': ['poor_coordination'],
                'parasites_spawned': 8
            },
            survival_improvement=0.2,
            failed_strategies=[0, 1],
            feature_vector=[0.5] * 10,
            game_state_features=[0.5] * 20
        )
    
    @pytest.mark.asyncio
    async def test_hive_placement_generation(self):
        """Test hive placement strategy generation"""
        generator = HivePlacementGenerator()
        
        failed_locations = [{'x': 10, 'y': 5, 'z': 15}]
        approach_patterns = {'preferred_angles': [45, 135]}
        complexity = 0.6
        
        strategy = await generator.generate(failed_locations, approach_patterns, complexity)
        
        assert strategy['strategy_type'] == 'learned_adaptive_placement'
        assert 'optimal_zones' in strategy
        assert 'placement_criteria' in strategy
        assert 'avoid_zones' in strategy
        assert len(strategy['avoid_zones']) > 0
        assert strategy['placement_criteria']['concealment_priority'] > 0.5
    
    @pytest.mark.asyncio
    async def test_spawn_timing_generation(self):
        """Test spawn timing strategy generation"""
        generator = SpawnTimingGenerator()
        
        mining_patterns = {
            'expansion_rate': 0.7,
            'intensity': 0.6,
            'behavior_type': 'aggressive_expansion'
        }
        effectiveness = 0.4
        complexity = 0.5
        
        strategy = await generator.generate(mining_patterns, effectiveness, complexity)
        
        assert strategy['strategy_type'] == 'adaptive_intelligent_spawning'
        assert 'base_spawn_rate' in strategy
        assert 'burst_spawn_triggers' in strategy
        assert 'spawn_distribution' in strategy
        assert strategy['base_spawn_rate'] > 8.0  # Should be adaptive
        assert 'player_expansion' in strategy['burst_spawn_triggers']
    
    @pytest.mark.asyncio
    async def test_defensive_coordination_generation(self):
        """Test defensive coordination strategy generation"""
        generator = DefensiveCoordinationGenerator()
        
        assault_patterns = {
            'primary_pattern': 'coordinated',
            'coordination': 0.8,
            'assault_style': 'highly_coordinated'
        }
        failures = ['poor_coordination', 'predictable_retreats']
        complexity = 0.7
        
        strategy = await generator.generate(assault_patterns, failures, complexity)
        
        assert strategy['strategy_type'] == 'intelligent_coordinated_defense'
        assert 'swarm_coordination' in strategy
        assert 'formation_tactics' in strategy
        assert 'counter_attack' in strategy
        assert strategy['swarm_coordination']['enabled'] is True
        assert strategy['counter_attack']['enabled'] is True
    
    @pytest.mark.asyncio
    async def test_predictive_behavior_generation(self):
        """Test predictive behavior generation for advanced generations"""
        generator = PredictiveBehaviorGenerator()
        
        player_profile = PlayerProfile('economic', 0.8)
        player_patterns = PlayerPatterns(
            mining_patterns={'expansion_rate': 0.8, 'intensity': 0.7},
            combat_patterns={'timing_patterns': {'late_game_focus': True}},
            energy_patterns={'spending_patterns': {'conservative': True}},
            exploration_patterns={},
            player_profile=player_profile,
            pattern_confidence=0.8
        )
        
        strategy = await generator.generate(player_patterns, 60, 0.7)
        
        assert strategy['strategy_type'] == 'advanced_predictive_behavior'
        assert 'behavioral_predictions' in strategy
        assert 'counter_strategies' in strategy
        assert 'meta_learning' in strategy
        assert strategy['meta_learning']['enabled'] is True
        assert strategy['prediction_horizon'] == 60
    
    @pytest.mark.asyncio
    async def test_complete_strategy_generation(self, strategy_generator, sample_player_patterns, sample_death_analysis):
        """Test complete strategy generation pipeline"""
        strategy = await strategy_generator.generate_strategy(
            generation=4,
            learned_patterns=sample_player_patterns,
            death_lessons=sample_death_analysis
        )
        
        # Verify strategy structure
        assert hasattr(strategy, 'generation')
        assert hasattr(strategy, 'hive_placement')
        assert hasattr(strategy, 'parasite_spawning')
        assert hasattr(strategy, 'defensive_coordination')
        assert hasattr(strategy, 'predictive_behavior')
        assert hasattr(strategy, 'complexity_level')
        
        # Verify generation 4+ has predictive behavior
        assert strategy.generation == 4
        assert strategy.predictive_behavior is not None
        assert strategy.complexity_level == 0.4  # generation * 0.1
        
        # Verify strategy types
        assert strategy.hive_placement['strategy_type'] == 'learned_adaptive_placement'
        assert strategy.parasite_spawning['strategy_type'] == 'adaptive_intelligent_spawning'
        assert strategy.defensive_coordination['strategy_type'] == 'intelligent_coordinated_defense'
        assert strategy.predictive_behavior['strategy_type'] == 'advanced_predictive_behavior'
    
    @pytest.mark.asyncio
    async def test_generation_complexity_scaling(self, strategy_generator, sample_player_patterns, sample_death_analysis):
        """Test that strategy complexity scales with generation"""
        # Test low generation (1)
        strategy_gen1 = await strategy_generator.generate_strategy(
            generation=1,
            learned_patterns=sample_player_patterns,
            death_lessons=sample_death_analysis
        )
        
        # Test high generation (8)
        strategy_gen8 = await strategy_generator.generate_strategy(
            generation=8,
            learned_patterns=sample_player_patterns,
            death_lessons=sample_death_analysis
        )
        
        # Verify complexity scaling
        assert strategy_gen1.complexity_level < strategy_gen8.complexity_level
        assert strategy_gen1.predictive_behavior is None  # Gen 1 < 4
        assert strategy_gen8.predictive_behavior is not None  # Gen 8 >= 4
        
        # Verify spawn rates scale with complexity
        gen1_spawn_rate = strategy_gen1.parasite_spawning['base_spawn_rate']
        gen8_spawn_rate = strategy_gen8.parasite_spawning['base_spawn_rate']
        assert gen8_spawn_rate > gen1_spawn_rate
    
    @pytest.mark.asyncio
    async def test_player_pattern_adaptation(self, strategy_generator, sample_death_analysis):
        """Test that strategies adapt to different player patterns"""
        # Create aggressive player pattern
        aggressive_profile = PlayerProfile('aggressive', 0.9)
        aggressive_patterns = PlayerPatterns(
            mining_patterns={'expansion_rate': 0.9, 'intensity': 0.8},
            combat_patterns={'timing_patterns': {'early_aggression': True}},
            energy_patterns={'spending_patterns': {'aggressive': True}},
            exploration_patterns={},
            player_profile=aggressive_profile,
            pattern_confidence=0.8
        )
        
        # Create defensive player pattern
        defensive_profile = PlayerProfile('defensive', 0.8)
        defensive_patterns = PlayerPatterns(
            mining_patterns={'expansion_rate': 0.3, 'intensity': 0.4},
            combat_patterns={'timing_patterns': {'late_game_focus': True}},
            energy_patterns={'spending_patterns': {'conservative': True}},
            exploration_patterns={},
            player_profile=defensive_profile,
            pattern_confidence=0.7
        )
        
        # Generate strategies for both patterns
        aggressive_strategy = await strategy_generator.generate_strategy(
            generation=5,
            learned_patterns=aggressive_patterns,
            death_lessons=sample_death_analysis
        )
        
        defensive_strategy = await strategy_generator.generate_strategy(
            generation=5,
            learned_patterns=defensive_patterns,
            death_lessons=sample_death_analysis
        )
        
        # Verify strategies adapt to player types
        assert aggressive_strategy.parasite_spawning['base_spawn_rate'] != defensive_strategy.parasite_spawning['base_spawn_rate']
        
        # Aggressive players should trigger more responsive spawning
        aggressive_spawn_multiplier = aggressive_strategy.parasite_spawning['adaptive_spawn_rates']['mining_response_multiplier']
        defensive_spawn_multiplier = defensive_strategy.parasite_spawning['adaptive_spawn_rates']['mining_response_multiplier']
        
        # Both should be adaptive, but potentially different based on patterns
        assert aggressive_spawn_multiplier > 1.0
        assert defensive_spawn_multiplier > 1.0
    
    @pytest.mark.asyncio
    async def test_failure_learning_integration(self, strategy_generator, sample_player_patterns):
        """Test that strategies learn from specific failures"""
        # Create death analysis with specific failure patterns
        failure_analysis = DeathAnalysis(
            queen_id='test_queen',
            generation=3,
            primary_cause='worker_infiltration',
            spatial_insights={
                'failed_locations': [
                    {'x': 10, 'y': 5, 'z': 15},
                    {'x': 12, 'y': 5, 'z': 17}  # Clustered failures
                ],
                'placement_score': 0.2
            },
            temporal_insights={'spawn_timing_score': 0.3},
            tactical_insights={
                'spawn_effectiveness': 0.2,
                'defensive_failures': ['inadequate_spawning', 'poor_infiltration_counter'],
                'parasites_spawned': 3  # Very low
            },
            survival_improvement=0.1,
            failed_strategies=[0, 1, 2],
            feature_vector=[0.3] * 10,
            game_state_features=[0.3] * 20
        )
        
        strategy = await strategy_generator.generate_strategy(
            generation=4,
            learned_patterns=sample_player_patterns,
            death_lessons=failure_analysis
        )
        
        # Verify strategy adapts to infiltration failures
        assert len(strategy.hive_placement['avoid_zones']) > 0
        
        # Should increase spawn rates due to inadequate spawning
        assert strategy.parasite_spawning['base_spawn_rate'] > 8.0
        
        # Should have counter-infiltration tactics
        defensive_tactics = strategy.defensive_coordination['formation_tactics']
        assert 'counter_formations' in defensive_tactics


if __name__ == '__main__':
    pytest.main([__file__, '-v'])