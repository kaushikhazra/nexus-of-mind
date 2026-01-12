"""
Player Behavior Analyzer - Learns individual player patterns and preferences
"""

import logging
from typing import Dict, Any, List
from .data_models import GameStateSnapshot, PlayerProfile, PlayerPatterns

logger = logging.getLogger(__name__)


class PlayerBehaviorAnalyzer:
    """
    Analyzes and learns individual player behavior patterns
    """
    
    def __init__(self):
        self.mining_patterns = MiningPatternTracker()
        self.combat_patterns = CombatPatternTracker()
        self.energy_patterns = EnergyManagementTracker()
        self.exploration_patterns = ExplorationPatternTracker()
        self.player_profile: PlayerProfile = None
        self.pattern_history: List[Dict] = []
    
    async def update_patterns(self, game_state: Dict[str, Any]):
        """
        Update player behavior patterns based on game state
        
        Args:
            game_state: Current game state snapshot
        """
        try:
            logger.info("Updating player behavior patterns")
            
            # Convert dict to structured game state
            state_snapshot = GameStateSnapshot.from_dict(game_state)
            
            # Update individual pattern trackers
            await self.mining_patterns.update(state_snapshot)
            await self.combat_patterns.update(state_snapshot)
            await self.energy_patterns.update(state_snapshot)
            await self.exploration_patterns.update(state_snapshot)
            
            # Store pattern snapshot
            pattern_snapshot = {
                "timestamp": state_snapshot.timestamp,
                "mining": self.mining_patterns.get_current_metrics(),
                "combat": self.combat_patterns.get_current_metrics(),
                "energy": self.energy_patterns.get_current_metrics(),
                "exploration": self.exploration_patterns.get_current_metrics()
            }
            self.pattern_history.append(pattern_snapshot)
            
            # Keep only recent history (last 100 snapshots)
            if len(self.pattern_history) > 100:
                self.pattern_history = self.pattern_history[-100:]
            
            # Update player profile classification
            self.player_profile = await self.classify_player_type()
            
            logger.info(f"Player patterns updated. Profile: {self.player_profile.player_type}")
            
        except Exception as e:
            logger.error(f"Error updating player patterns: {e}")
            raise
    
    async def classify_player_type(self) -> PlayerProfile:
        """
        Classify player type based on behavior patterns
        
        Returns:
            PlayerProfile with classification and confidence
        """
        try:
            # Get current pattern metrics
            mining_aggression = self.mining_patterns.get_aggression_score()
            combat_preference = self.combat_patterns.get_combat_style()
            energy_management = self.energy_patterns.get_management_style()
            exploration_rate = self.exploration_patterns.get_exploration_rate()
            
            # Classification logic
            if combat_preference == 'aggressive' and energy_management == 'aggressive':
                return PlayerProfile('aggressive', confidence=0.8)
            elif mining_aggression > 0.7 and combat_preference == 'defensive':
                return PlayerProfile('economic', confidence=0.75)
            elif combat_preference == 'defensive' and energy_management == 'conservative':
                return PlayerProfile('defensive', confidence=0.8)
            elif exploration_rate > 0.6 and mining_aggression > 0.5:
                return PlayerProfile('adaptive', confidence=0.7)
            else:
                return PlayerProfile('balanced', confidence=0.6)
                
        except Exception as e:
            logger.error(f"Error classifying player type: {e}")
            return PlayerProfile('unknown', confidence=0.0)
    
    def get_patterns(self) -> PlayerPatterns:
        """Get current player patterns for strategy generation"""
        return PlayerPatterns(
            mining_patterns=self.mining_patterns.get_patterns(),
            combat_patterns=self.combat_patterns.get_patterns(),
            energy_patterns=self.energy_patterns.get_patterns(),
            exploration_patterns=self.exploration_patterns.get_patterns(),
            player_profile=self.player_profile,
            pattern_confidence=self._calculate_pattern_confidence()
        )
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network training (15 features)"""
        features = []
        
        # Mining pattern features (5 features)
        features.extend(self.mining_patterns.get_feature_vector()[:5])
        
        # Combat pattern features (4 features)
        features.extend(self.combat_patterns.get_feature_vector()[:4])
        
        # Energy management features (3 features)
        features.extend(self.energy_patterns.get_feature_vector()[:3])
        
        # Exploration features (3 features)
        features.extend(self.exploration_patterns.get_feature_vector()[:3])
        
        # Ensure exactly 15 features
        while len(features) < 15:
            features.append(0.5)
        
        return features[:15]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of player behavior for learning insights"""
        return {
            "player_type": self.player_profile.player_type if self.player_profile else "unknown",
            "confidence": self.player_profile.confidence if self.player_profile else 0.0,
            "mining_aggression": self.mining_patterns.get_aggression_score(),
            "combat_style": self.combat_patterns.get_combat_style(),
            "energy_management": self.energy_patterns.get_management_style(),
            "exploration_rate": self.exploration_patterns.get_exploration_rate(),
            "pattern_stability": self._calculate_pattern_confidence()
        }
    
    def _calculate_pattern_confidence(self) -> float:
        """Calculate confidence in current pattern analysis"""
        if len(self.pattern_history) < 10:
            return 0.3  # Low confidence with limited data
        
        # Calculate pattern stability over recent history
        recent_patterns = self.pattern_history[-20:]  # Last 20 snapshots
        
        # Placeholder confidence calculation
        return min(1.0, len(recent_patterns) / 20.0 * 0.8 + 0.2)


class MiningPatternTracker:
    """Tracks player mining behavior patterns"""
    
    def __init__(self):
        self.mining_sites_history = []
        self.expansion_timing = []
        self.worker_distribution = []
    
    async def update(self, game_state: GameStateSnapshot):
        """Update mining patterns"""
        # Placeholder implementation
        self.mining_sites_history.append(len(game_state.active_mining))
        
        # Keep recent history
        if len(self.mining_sites_history) > 50:
            self.mining_sites_history = self.mining_sites_history[-50:]
    
    def get_aggression_score(self) -> float:
        """Get mining aggression score (0.0 to 1.0)"""
        if not self.mining_sites_history:
            return 0.5
        
        # Calculate based on mining site expansion rate
        avg_sites = sum(self.mining_sites_history) / len(self.mining_sites_history)
        return min(1.0, avg_sites / 10.0)  # Normalize to 0-1
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get mining patterns"""
        return {
            "aggression_score": self.get_aggression_score(),
            "expansion_rate": 0.5,  # Placeholder
            "site_preference": "balanced"  # Placeholder
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network"""
        return [
            self.get_aggression_score(),
            0.5,  # Expansion timing
            0.5,  # Site diversity
            0.5,  # Worker efficiency
            0.5   # Resource focus
        ]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current mining metrics"""
        return {
            "active_sites": self.mining_sites_history[-1] if self.mining_sites_history else 0,
            "aggression": self.get_aggression_score()
        }


class CombatPatternTracker:
    """Tracks player combat behavior patterns"""
    
    def __init__(self):
        self.assault_history = []
        self.unit_compositions = []
        self.timing_patterns = []
    
    async def update(self, game_state: GameStateSnapshot):
        """Update combat patterns"""
        # Placeholder implementation
        protector_count = len(game_state.protector_positions)
        self.unit_compositions.append(protector_count)
        
        # Keep recent history
        if len(self.unit_compositions) > 50:
            self.unit_compositions = self.unit_compositions[-50:]
    
    def get_combat_style(self) -> str:
        """Get combat style classification"""
        if not self.unit_compositions:
            return "balanced"
        
        avg_protectors = sum(self.unit_compositions) / len(self.unit_compositions)
        
        if avg_protectors > 15:
            return "aggressive"
        elif avg_protectors < 5:
            return "defensive"
        else:
            return "balanced"
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get combat patterns"""
        return {
            "combat_style": self.get_combat_style(),
            "aggression_level": 0.5,  # Placeholder
            "coordination": 0.5  # Placeholder
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network"""
        style_map = {"aggressive": 0.8, "defensive": 0.2, "balanced": 0.5}
        return [
            style_map.get(self.get_combat_style(), 0.5),
            0.5,  # Timing preference
            0.5,  # Unit coordination
            0.5   # Tactical complexity
        ]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current combat metrics"""
        return {
            "style": self.get_combat_style(),
            "unit_count": self.unit_compositions[-1] if self.unit_compositions else 0
        }


class EnergyManagementTracker:
    """Tracks player energy management patterns"""
    
    def __init__(self):
        self.energy_history = []
        self.spending_patterns = []
    
    async def update(self, game_state: GameStateSnapshot):
        """Update energy patterns"""
        # Placeholder implementation
        self.energy_history.append(game_state.energy_level)
        
        # Keep recent history
        if len(self.energy_history) > 50:
            self.energy_history = self.energy_history[-50:]
    
    def get_management_style(self) -> str:
        """Get energy management style"""
        if not self.energy_history:
            return "balanced"
        
        avg_energy = sum(self.energy_history) / len(self.energy_history)
        
        if avg_energy > 800:
            return "conservative"
        elif avg_energy < 300:
            return "aggressive"
        else:
            return "balanced"
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get energy patterns"""
        return {
            "management_style": self.get_management_style(),
            "efficiency": 0.5,  # Placeholder
            "risk_tolerance": 0.5  # Placeholder
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network"""
        style_map = {"conservative": 0.8, "aggressive": 0.2, "balanced": 0.5}
        return [
            style_map.get(self.get_management_style(), 0.5),
            0.5,  # Spending efficiency
            0.5   # Risk tolerance
        ]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current energy metrics"""
        return {
            "style": self.get_management_style(),
            "level": self.energy_history[-1] if self.energy_history else 500
        }


class ExplorationPatternTracker:
    """Tracks player exploration behavior patterns"""
    
    def __init__(self):
        self.exploration_events = []
        self.territory_coverage = []
    
    async def update(self, game_state: GameStateSnapshot):
        """Update exploration patterns"""
        # Placeholder implementation
        coverage = len(game_state.explored_areas) if hasattr(game_state, 'explored_areas') else 5
        self.territory_coverage.append(coverage)
        
        # Keep recent history
        if len(self.territory_coverage) > 50:
            self.territory_coverage = self.territory_coverage[-50:]
    
    def get_exploration_rate(self) -> float:
        """Get exploration rate (0.0 to 1.0)"""
        if not self.territory_coverage:
            return 0.5
        
        avg_coverage = sum(self.territory_coverage) / len(self.territory_coverage)
        return min(1.0, avg_coverage / 20.0)  # Normalize to 0-1
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get exploration patterns"""
        return {
            "exploration_rate": self.get_exploration_rate(),
            "risk_taking": 0.5,  # Placeholder
            "efficiency": 0.5  # Placeholder
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network"""
        return [
            self.get_exploration_rate(),
            0.5,  # Risk preference
            0.5   # Efficiency score
        ]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current exploration metrics"""
        return {
            "rate": self.get_exploration_rate(),
            "coverage": self.territory_coverage[-1] if self.territory_coverage else 5
        }