"""
Death Analyzer - Analyzes Queen death circumstances for learning insights
"""

import logging
from typing import Dict, Any
from .data_models import QueenDeathData, DeathAnalysis

logger = logging.getLogger(__name__)


class DeathAnalyzer:
    """
    Analyzes Queen death circumstances to extract learning insights
    """
    
    def __init__(self):
        self.pattern_recognizer = AssaultPatternRecognizer()
        self.timing_analyzer = TimingAnalyzer()
        self.spatial_analyzer = SpatialAnalyzer()
    
    async def analyze_death(self, death_data: QueenDeathData) -> DeathAnalysis:
        """
        Analyze Queen death data and extract learning insights
        
        Args:
            death_data: Structured Queen death information
            
        Returns:
            DeathAnalysis with insights and feature vectors
        """
        try:
            logger.info(f"Analyzing death for Queen {death_data.queen_id}")
            
            # Spatial analysis
            spatial_analysis = await self.spatial_analyzer.analyze(death_data)
            
            # Temporal analysis
            temporal_analysis = await self.timing_analyzer.analyze(death_data)
            
            # Tactical analysis
            tactical_analysis = await self.pattern_recognizer.analyze(death_data)
            
            # Create comprehensive death analysis
            analysis = DeathAnalysis(
                queen_id=death_data.queen_id,
                generation=death_data.generation,
                primary_cause=death_data.death_cause,
                spatial_insights=spatial_analysis,
                temporal_insights=temporal_analysis,
                tactical_insights=tactical_analysis,
                survival_improvement=self._calculate_survival_improvement(death_data),
                failed_strategies=self._identify_failed_strategies(death_data),
                feature_vector=self._create_feature_vector(spatial_analysis, temporal_analysis, tactical_analysis),
                game_state_features=self._extract_game_state_features(death_data)
            )
            
            logger.info(f"Death analysis completed for Queen {death_data.queen_id}")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing death: {e}")
            raise
    
    def _calculate_survival_improvement(self, death_data: QueenDeathData) -> float:
        """Calculate potential survival time improvement"""
        # Placeholder implementation
        base_survival = 300.0  # 5 minutes baseline
        actual_survival = death_data.survival_time
        return max(0.0, (actual_survival - base_survival) / base_survival)
    
    def _identify_failed_strategies(self, death_data: QueenDeathData) -> list:
        """Identify which strategies failed leading to death"""
        # Placeholder implementation - will be expanded in future tasks
        failed_strategies = []
        
        # Basic strategy failure detection
        if death_data.hive_discovery_time < 60:  # Discovered too quickly
            failed_strategies.append(0)  # Hive placement strategy
        
        if death_data.parasites_spawned < 5:  # Too few parasites
            failed_strategies.append(1)  # Spawning strategy
        
        return failed_strategies
    
    def _create_feature_vector(self, spatial, temporal, tactical) -> list:
        """Create feature vector for neural network training"""
        # Placeholder implementation - 10 features for death analysis
        return [
            spatial.get('placement_score', 0.5),
            spatial.get('discovery_risk', 0.5),
            temporal.get('survival_ratio', 0.5),
            temporal.get('spawn_timing_score', 0.5),
            tactical.get('defense_effectiveness', 0.5),
            tactical.get('assault_resistance', 0.5),
            0.5,  # Reserved for future features
            0.5,
            0.5,
            0.5
        ]
    
    def _extract_game_state_features(self, death_data: QueenDeathData) -> list:
        """Extract game state features for neural network"""
        # Placeholder implementation - 20 features for game state
        features = [0.5] * 20  # Default neutral values
        
        # Basic feature extraction
        if hasattr(death_data, 'game_state') and death_data.game_state:
            game_state = death_data.game_state
            features[0] = min(1.0, game_state.get('energy_level', 500) / 1000.0)
            features[1] = min(1.0, len(game_state.get('player_units', [])) / 50.0)
            # Additional features will be implemented in future tasks
        
        return features


class AssaultPatternRecognizer:
    """Recognizes player assault patterns"""
    
    async def analyze(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze assault patterns"""
        # Placeholder implementation
        return {
            "pattern_type": death_data.assault_pattern.get('type', 'unknown'),
            "coordination_level": 0.5,
            "effectiveness": 0.7
        }


class TimingAnalyzer:
    """Analyzes timing aspects of Queen death"""
    
    async def analyze(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze timing patterns"""
        # Placeholder implementation
        return {
            "survival_ratio": min(1.0, death_data.survival_time / 600.0),
            "discovery_speed": min(1.0, death_data.hive_discovery_time / 300.0),
            "spawn_timing_score": 0.5
        }


class SpatialAnalyzer:
    """Analyzes spatial aspects of Queen death"""
    
    async def analyze(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze spatial patterns"""
        # Placeholder implementation
        return {
            "placement_score": 0.5,
            "discovery_risk": 0.6,
            "territorial_advantage": 0.4
        }