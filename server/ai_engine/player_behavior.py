"""
Player Behavior Analyzer - Learns individual player patterns and preferences
"""

import logging
import time
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from collections import deque, defaultdict
from .data_models import GameStateSnapshot, PlayerProfile, PlayerPatterns

logger = logging.getLogger(__name__)


class PlayerBehaviorAnalyzer:
    """
    Analyzes and learns individual player behavior patterns with comprehensive tracking
    """
    
    def __init__(self):
        self.mining_patterns = MiningPatternTracker()
        self.combat_patterns = CombatPatternTracker()
        self.energy_patterns = EnergyManagementTracker()
        self.exploration_patterns = ExplorationPatternTracker()
        
        # Player profile and learning
        self.player_profile: Optional[PlayerProfile] = None
        self.pattern_history: List[Dict] = []
        self.learning_confidence = 0.0
        
        # Continuous learning tracking
        self.update_count = 0
        self.last_classification_update = 0
        self.classification_stability = deque(maxlen=20)  # Track classification changes
        
        # Advanced pattern analysis
        self.behavioral_transitions = deque(maxlen=50)  # Track behavior changes
        self.adaptation_events = deque(maxlen=30)  # Track when player adapts
        self.consistency_scores = deque(maxlen=100)  # Track pattern consistency
        
        # Meta-learning features
        self.learning_rate_estimates = deque(maxlen=50)
        self.pattern_prediction_accuracy = deque(maxlen=50)
    
    async def update_patterns(self, game_state: Dict[str, Any]):
        """
        Update player behavior patterns with continuous learning
        
        Args:
            game_state: Current game state snapshot
        """
        try:
            logger.info(f"Updating player behavior patterns (update #{self.update_count + 1})")
            
            # Convert dict to structured game state
            state_snapshot = GameStateSnapshot.from_dict(game_state)
            
            # Update individual pattern trackers
            await self.mining_patterns.update(state_snapshot)
            await self.combat_patterns.update(state_snapshot)
            await self.energy_patterns.update(state_snapshot)
            await self.exploration_patterns.update(state_snapshot)
            
            # Collect comprehensive pattern snapshot
            pattern_snapshot = {
                "timestamp": state_snapshot.timestamp,
                "update_count": self.update_count,
                "mining": self.mining_patterns.get_current_metrics(),
                "combat": self.combat_patterns.get_current_metrics(),
                "energy": self.energy_patterns.get_current_metrics(),
                "exploration": self.exploration_patterns.get_current_metrics(),
                "game_phase": self._determine_game_phase(state_snapshot.timestamp)
            }
            self.pattern_history.append(pattern_snapshot)
            
            # Maintain rolling window of pattern history
            if len(self.pattern_history) > 200:
                self.pattern_history = self.pattern_history[-200:]
            
            # Continuous pattern analysis and classification
            await self._perform_continuous_analysis(state_snapshot)
            
            # Update player profile classification (with stability checking)
            if self.update_count % 5 == 0:  # Update classification every 5 updates
                await self._update_player_classification()
            
            # Track learning progress
            self._update_learning_metrics()
            
            self.update_count += 1
            
            logger.info(f"Player patterns updated. Profile: {self.player_profile.player_type if self.player_profile else 'unknown'}, "
                       f"Confidence: {self.learning_confidence:.2f}")
            
        except Exception as e:
            logger.error(f"Error updating player patterns: {e}")
            raise
    
    async def _perform_continuous_analysis(self, game_state: GameStateSnapshot):
        """Perform continuous analysis of player behavior patterns"""
        
        # Detect behavioral transitions
        if len(self.pattern_history) > 10:
            await self._detect_behavioral_transitions()
        
        # Analyze pattern consistency
        consistency_score = self._calculate_pattern_consistency()
        self.consistency_scores.append(consistency_score)
        
        # Detect adaptation events
        if len(self.pattern_history) > 20:
            adaptation_detected = await self._detect_player_adaptation()
            if adaptation_detected:
                self.adaptation_events.append({
                    'timestamp': game_state.timestamp,
                    'patterns': self._get_current_pattern_summary(),
                    'confidence': self.learning_confidence
                })
    
    async def _detect_behavioral_transitions(self):
        """Detect significant changes in player behavior patterns"""
        if len(self.pattern_history) < 20:
            return
        
        # Compare recent patterns with earlier patterns
        recent_patterns = self.pattern_history[-10:]
        earlier_patterns = self.pattern_history[-20:-10]
        
        # Calculate pattern differences
        mining_change = self._calculate_pattern_change(
            [p['mining'] for p in recent_patterns],
            [p['mining'] for p in earlier_patterns]
        )
        
        combat_change = self._calculate_pattern_change(
            [p['combat'] for p in recent_patterns],
            [p['combat'] for p in earlier_patterns]
        )
        
        energy_change = self._calculate_pattern_change(
            [p['energy'] for p in recent_patterns],
            [p['energy'] for p in earlier_patterns]
        )
        
        # Detect significant transitions
        total_change = mining_change + combat_change + energy_change
        if total_change > 0.3:  # Threshold for significant change
            transition_event = {
                'timestamp': self.pattern_history[-1]['timestamp'],
                'mining_change': mining_change,
                'combat_change': combat_change,
                'energy_change': energy_change,
                'total_change': total_change
            }
            self.behavioral_transitions.append(transition_event)
            logger.info(f"Behavioral transition detected: {total_change:.2f} change magnitude")
    
    def _calculate_pattern_change(self, recent_patterns: List[Dict], 
                                earlier_patterns: List[Dict]) -> float:
        """Calculate magnitude of change between pattern sets"""
        if not recent_patterns or not earlier_patterns:
            return 0.0
        
        # Extract numeric values for comparison
        recent_values = []
        earlier_values = []
        
        for pattern_set, values_list in [(recent_patterns, recent_values), 
                                       (earlier_patterns, earlier_values)]:
            for pattern in pattern_set:
                for key, value in pattern.items():
                    if isinstance(value, (int, float)):
                        values_list.append(value)
                    elif isinstance(value, str):
                        # Convert string categories to numeric
                        values_list.append(hash(value) % 100 / 100.0)
        
        if not recent_values or not earlier_values:
            return 0.0
        
        # Calculate normalized difference
        recent_avg = np.mean(recent_values)
        earlier_avg = np.mean(earlier_values)
        
        if earlier_avg == 0:
            return 1.0 if recent_avg > 0 else 0.0
        
        return abs(recent_avg - earlier_avg) / abs(earlier_avg)
    
    async def _detect_player_adaptation(self) -> bool:
        """Detect if player is adapting their strategy"""
        if len(self.pattern_history) < 30:
            return False
        
        # Look for patterns that suggest learning/adaptation
        recent_consistency = np.mean(list(self.consistency_scores)[-10:]) if self.consistency_scores else 0.5
        earlier_consistency = np.mean(list(self.consistency_scores)[-20:-10]) if len(self.consistency_scores) > 10 else 0.5
        
        # Adaptation often shows as initial inconsistency followed by new consistency
        consistency_change = recent_consistency - earlier_consistency
        
        # Check for behavioral transitions
        recent_transitions = len([t for t in self.behavioral_transitions 
                                if t['timestamp'] > self.pattern_history[-10]['timestamp']])
        
        # Adaptation indicators
        adaptation_score = 0.0
        
        # Factor 1: Consistency recovery after change
        if consistency_change > 0.1 and recent_transitions > 0:
            adaptation_score += 0.4
        
        # Factor 2: Pattern diversity followed by stabilization
        if len(self.behavioral_transitions) > 2:
            adaptation_score += 0.3
        
        # Factor 3: Learning rate indicators
        if self.learning_rate_estimates:
            recent_learning_rate = np.mean(list(self.learning_rate_estimates)[-5:])
            if recent_learning_rate > 0.6:
                adaptation_score += 0.3
        
        return adaptation_score > 0.5
    
    async def _update_player_classification(self):
        """Update player profile classification with stability checking"""
        new_profile = await self.classify_player_type()
        
        # Track classification stability
        if self.player_profile:
            if new_profile.player_type == self.player_profile.player_type:
                stability_score = 1.0
            else:
                stability_score = 0.0
        else:
            stability_score = 0.5
        
        self.classification_stability.append(stability_score)
        
        # Update profile only if classification is stable or confidence is high
        stability_avg = np.mean(list(self.classification_stability)) if self.classification_stability else 0.5
        
        if stability_avg > 0.7 or new_profile.confidence > 0.8:
            self.player_profile = new_profile
            self.last_classification_update = self.update_count
        
        # Update learning confidence
        self.learning_confidence = min(1.0, stability_avg * new_profile.confidence)
    
    async def classify_player_type(self) -> PlayerProfile:
        """
        Classify player type with enhanced analysis
        
        Returns:
            PlayerProfile with classification and confidence
        """
        try:
            if self.update_count < 10:  # Need minimum data for classification
                return PlayerProfile('unknown', confidence=0.1)
            
            # Get current pattern metrics
            mining_patterns = self.mining_patterns.get_patterns()
            combat_patterns = self.combat_patterns.get_patterns()
            energy_patterns = self.energy_patterns.get_patterns()
            exploration_patterns = self.exploration_patterns.get_patterns()
            
            # Extract key classification features
            mining_aggression = mining_patterns["aggression_score"]
            combat_style = combat_patterns["combat_style"]
            combat_aggression = combat_patterns["aggression_level"]
            energy_style = energy_patterns["management_style"]
            exploration_rate = exploration_patterns["exploration_rate"]
            risk_tolerance = exploration_patterns["risk_profile"]["risk_level"]
            
            # Advanced classification logic with multiple factors
            classification_scores = {
                'aggressive': 0.0,
                'defensive': 0.0,
                'economic': 0.0,
                'adaptive': 0.0,
                'balanced': 0.0,
                'explorer': 0.0
            }
            
            # Aggressive player indicators
            if combat_style in ['aggressive', 'rush'] and combat_aggression > 0.7:
                classification_scores['aggressive'] += 0.4
            if energy_style in ['aggressive', 'burst_spender'] and risk_tolerance > 0.6:
                classification_scores['aggressive'] += 0.3
            if mining_aggression > 0.7:
                classification_scores['aggressive'] += 0.2
            if exploration_rate > 0.7 and risk_tolerance > 0.7:
                classification_scores['aggressive'] += 0.1
            
            # Defensive player indicators
            if combat_style == 'defensive' and combat_aggression < 0.4:
                classification_scores['defensive'] += 0.4
            if energy_style in ['conservative', 'accumulator']:
                classification_scores['defensive'] += 0.3
            if risk_tolerance < 0.3:
                classification_scores['defensive'] += 0.2
            if mining_aggression < 0.4:
                classification_scores['defensive'] += 0.1
            
            # Economic player indicators
            if mining_aggression > 0.8:
                classification_scores['economic'] += 0.4
            if energy_style in ['conservative', 'accumulator']:
                classification_scores['economic'] += 0.2
            if combat_style in ['defensive', 'late_game']:
                classification_scores['economic'] += 0.3
            if exploration_rate > 0.6:  # Economic players explore for resources
                classification_scores['economic'] += 0.1
            
            # Explorer player indicators
            if exploration_rate > 0.8:
                classification_scores['explorer'] += 0.4
            if risk_tolerance > 0.6:
                classification_scores['explorer'] += 0.3
            if mining_patterns["location_preferences"]["pattern"] == "diverse":
                classification_scores['explorer'] += 0.2
            if energy_style == 'balanced':
                classification_scores['explorer'] += 0.1
            
            # Adaptive player indicators
            adaptation_score = len(self.adaptation_events) / max(1, self.update_count / 50)
            if adaptation_score > 0.3:
                classification_scores['adaptive'] += 0.4
            if len(self.behavioral_transitions) > 3:
                classification_scores['adaptive'] += 0.3
            if self.consistency_scores and np.var(list(self.consistency_scores)) > 0.1:
                classification_scores['adaptive'] += 0.2
            
            # Balanced player (default with moderate scores)
            balance_score = 1.0 - max(classification_scores.values())
            classification_scores['balanced'] = balance_score * 0.5
            
            # Determine final classification
            best_type = max(classification_scores.items(), key=lambda x: x[1])
            player_type = best_type[0]
            base_confidence = best_type[1]
            
            # Adjust confidence based on data quality
            data_quality = min(1.0, self.update_count / 50.0)  # More data = higher confidence
            pattern_stability = np.mean(list(self.classification_stability)) if self.classification_stability else 0.5
            
            final_confidence = base_confidence * data_quality * pattern_stability
            final_confidence = max(0.1, min(1.0, final_confidence))
            
            return PlayerProfile(player_type, confidence=final_confidence)
                
        except Exception as e:
            logger.error(f"Error classifying player type: {e}")
            return PlayerProfile('unknown', confidence=0.0)
    
    def _determine_game_phase(self, timestamp: float) -> str:
        """Determine current game phase"""
        if timestamp < 300:  # First 5 minutes
            return "early"
        elif timestamp < 900:  # 5-15 minutes
            return "mid"
        else:  # 15+ minutes
            return "late"
    
    def _calculate_pattern_consistency(self) -> float:
        """Calculate overall pattern consistency score"""
        if len(self.pattern_history) < 10:
            return 0.5
        
        # Analyze consistency across different pattern types
        recent_patterns = self.pattern_history[-10:]
        
        consistency_scores = []
        
        # Mining consistency
        mining_scores = [p['mining'].get('aggression', 0.5) for p in recent_patterns]
        if mining_scores:
            mining_consistency = 1.0 / (1.0 + np.var(mining_scores))
            consistency_scores.append(mining_consistency)
        
        # Combat consistency
        combat_styles = [p['combat'].get('style', 'balanced') for p in recent_patterns]
        style_changes = sum(1 for i in range(1, len(combat_styles)) 
                           if combat_styles[i] != combat_styles[i-1])
        combat_consistency = 1.0 - (style_changes / max(1, len(combat_styles) - 1))
        consistency_scores.append(combat_consistency)
        
        # Energy consistency
        energy_levels = [p['energy'].get('level', 500) for p in recent_patterns]
        if energy_levels:
            energy_consistency = 1.0 / (1.0 + np.var(energy_levels) / 10000.0)
            consistency_scores.append(energy_consistency)
        
        return np.mean(consistency_scores) if consistency_scores else 0.5
    
    def _update_learning_metrics(self):
        """Update learning progress metrics"""
        # Estimate learning rate based on pattern changes
        if len(self.pattern_history) > 20:
            recent_changes = len([t for t in self.behavioral_transitions 
                                if t['timestamp'] > self.pattern_history[-10]['timestamp']])
            learning_rate = min(1.0, recent_changes / 5.0)  # Normalize
            self.learning_rate_estimates.append(learning_rate)
        
        # Update prediction accuracy (placeholder for future implementation)
        if self.player_profile:
            # This would be implemented with actual prediction validation
            accuracy = self.player_profile.confidence
            self.pattern_prediction_accuracy.append(accuracy)
    
    def _get_current_pattern_summary(self) -> Dict[str, Any]:
        """Get summary of current patterns"""
        return {
            "mining": self.mining_patterns.get_patterns(),
            "combat": self.combat_patterns.get_patterns(),
            "energy": self.energy_patterns.get_patterns(),
            "exploration": self.exploration_patterns.get_patterns()
        }
    
    def get_patterns(self) -> PlayerPatterns:
        """Get current player patterns for strategy generation"""
        return PlayerPatterns(
            mining_patterns=self.mining_patterns.get_patterns(),
            combat_patterns=self.combat_patterns.get_patterns(),
            energy_patterns=self.energy_patterns.get_patterns(),
            exploration_patterns=self.exploration_patterns.get_patterns(),
            player_profile=self.player_profile or PlayerProfile('unknown', 0.0),
            pattern_confidence=self.learning_confidence
        )
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network training (15 features)"""
        features = []
        
        # Mining pattern features (5 features)
        features.extend(self.mining_patterns.get_feature_vector())
        
        # Combat pattern features (4 features)
        features.extend(self.combat_patterns.get_feature_vector())
        
        # Energy management features (3 features)
        features.extend(self.energy_patterns.get_feature_vector())
        
        # Exploration features (3 features)
        features.extend(self.exploration_patterns.get_feature_vector())
        
        # Ensure exactly 15 features
        while len(features) < 15:
            features.append(0.5)
        
        return features[:15]
    
    def get_learning_insights(self) -> Dict[str, Any]:
        """Get detailed learning insights for UI display"""
        return {
            "player_type": self.player_profile.player_type if self.player_profile else "unknown",
            "confidence": self.learning_confidence,
            "update_count": self.update_count,
            "behavioral_transitions": len(self.behavioral_transitions),
            "adaptation_events": len(self.adaptation_events),
            "pattern_consistency": self.consistency_scores[-1] if self.consistency_scores else 0.5,
            "learning_rate": self.learning_rate_estimates[-1] if self.learning_rate_estimates else 0.5,
            "classification_stability": np.mean(list(self.classification_stability)) if self.classification_stability else 0.5,
            "patterns_summary": self._get_current_pattern_summary()
        }
    
    def get_summary(self) -> Dict[str, Any]:
        """Get comprehensive summary of player behavior for learning insights"""
        patterns = self.get_patterns()
        
        return {
            "player_type": self.player_profile.player_type if self.player_profile else "unknown",
            "confidence": self.learning_confidence,
            "mining_aggression": patterns.mining_patterns["aggression_score"],
            "combat_style": patterns.combat_patterns["combat_style"],
            "energy_management": patterns.energy_patterns["management_style"],
            "exploration_rate": patterns.exploration_patterns["exploration_rate"],
            "pattern_stability": self.classification_stability[-1] if self.classification_stability else 0.5,
            "adaptation_ability": len(self.adaptation_events) / max(1, self.update_count / 50),
            "learning_progress": {
                "updates": self.update_count,
                "transitions": len(self.behavioral_transitions),
                "adaptations": len(self.adaptation_events),
                "consistency": self.consistency_scores[-1] if self.consistency_scores else 0.5
            }
        }
    
    def _calculate_pattern_confidence(self) -> float:
        """Calculate confidence in current pattern analysis"""
        if self.update_count < 10:
            return 0.2  # Low confidence with limited data
        
        # Factor in multiple confidence indicators
        data_confidence = min(1.0, self.update_count / 100.0)  # More data = higher confidence
        stability_confidence = np.mean(list(self.classification_stability)) if self.classification_stability else 0.5
        consistency_confidence = self.consistency_scores[-1] if self.consistency_scores else 0.5
        
        # Weighted combination
        overall_confidence = (data_confidence * 0.4 + 
                            stability_confidence * 0.4 + 
                            consistency_confidence * 0.2)
        
        return min(1.0, max(0.1, overall_confidence))


class MiningPatternTracker:
    """Tracks player mining behavior patterns with comprehensive analysis"""
    
    def __init__(self):
        # Mining site tracking
        self.mining_sites_history = deque(maxlen=100)
        self.expansion_timing = deque(maxlen=50)
        self.worker_distribution = deque(maxlen=100)
        self.site_locations = deque(maxlen=200)
        
        # Pattern analysis
        self.expansion_intervals = []
        self.site_preferences = defaultdict(int)  # Track preferred mining locations
        self.worker_efficiency_scores = deque(maxlen=50)
        self.resource_focus_patterns = deque(maxlen=50)
        
        # Timing analysis
        self.last_expansion_time = 0
        self.expansion_count = 0
        self.early_game_behavior = []  # First 5 minutes
        self.mid_game_behavior = []    # 5-15 minutes
        self.late_game_behavior = []   # 15+ minutes
    
    async def update(self, game_state: GameStateSnapshot):
        """Update mining patterns with comprehensive analysis"""
        current_time = game_state.timestamp
        active_sites = len(game_state.active_mining)
        worker_count = len(game_state.worker_positions)
        
        # Track mining site count over time
        self.mining_sites_history.append({
            'timestamp': current_time,
            'site_count': active_sites,
            'worker_count': worker_count
        })
        
        # Detect new mining site expansions
        if len(self.mining_sites_history) > 1:
            prev_sites = self.mining_sites_history[-2]['site_count']
            if active_sites > prev_sites:
                expansion_interval = current_time - self.last_expansion_time
                if self.last_expansion_time > 0:
                    self.expansion_intervals.append(expansion_interval)
                    self.expansion_timing.append({
                        'timestamp': current_time,
                        'interval': expansion_interval,
                        'site_count': active_sites
                    })
                self.last_expansion_time = current_time
                self.expansion_count += 1
        
        # Track mining site locations and preferences
        for site in game_state.active_mining:
            location = site.get('location', {})
            if location:
                # Discretize location for pattern recognition
                grid_x = int(location.get('x', 0) // 50)  # 50-unit grid
                grid_z = int(location.get('z', 0) // 50)
                location_key = f"{grid_x},{grid_z}"
                self.site_preferences[location_key] += 1
                
                self.site_locations.append({
                    'timestamp': current_time,
                    'location': location,
                    'grid_key': location_key
                })
        
        # Calculate worker efficiency (workers per mining site)
        if active_sites > 0:
            efficiency = worker_count / active_sites
            self.worker_efficiency_scores.append(efficiency)
        
        # Analyze resource focus patterns
        resource_diversity = len(set(site.get('resource_type', 'energy') 
                                   for site in game_state.active_mining))
        self.resource_focus_patterns.append({
            'timestamp': current_time,
            'diversity': resource_diversity,
            'total_sites': active_sites
        })
        
        # Categorize behavior by game phase
        game_duration = current_time
        behavior_snapshot = {
            'timestamp': current_time,
            'sites': active_sites,
            'workers': worker_count,
            'efficiency': efficiency if active_sites > 0 else 0
        }
        
        if game_duration < 300:  # First 5 minutes
            self.early_game_behavior.append(behavior_snapshot)
        elif game_duration < 900:  # 5-15 minutes
            self.mid_game_behavior.append(behavior_snapshot)
        else:  # 15+ minutes
            self.late_game_behavior.append(behavior_snapshot)
    
    def get_aggression_score(self) -> float:
        """Get mining aggression score based on expansion rate and timing"""
        if not self.expansion_intervals:
            return 0.5
        
        # Calculate expansion rate (sites per minute)
        if len(self.mining_sites_history) < 2:
            return 0.5
        
        total_time = (self.mining_sites_history[-1]['timestamp'] - 
                     self.mining_sites_history[0]['timestamp']) / 60.0  # Convert to minutes
        
        if total_time <= 0:
            return 0.5
        
        expansion_rate = self.expansion_count / total_time
        
        # Normalize to 0-1 scale (aggressive = high expansion rate)
        # Assume 1 expansion per 2 minutes is very aggressive
        aggression = min(1.0, expansion_rate / 0.5)
        
        # Factor in early expansion behavior
        early_aggression = 0.5
        if self.early_game_behavior:
            early_sites = [b['sites'] for b in self.early_game_behavior]
            if early_sites:
                max_early_sites = max(early_sites)
                early_aggression = min(1.0, max_early_sites / 5.0)  # 5+ sites in early game = aggressive
        
        return (aggression * 0.7 + early_aggression * 0.3)
    
    def get_expansion_timing_pattern(self) -> str:
        """Analyze expansion timing patterns"""
        if not self.expansion_intervals:
            return "unknown"
        
        avg_interval = np.mean(self.expansion_intervals)
        
        if avg_interval < 120:  # Less than 2 minutes
            return "rapid"
        elif avg_interval < 300:  # 2-5 minutes
            return "steady"
        else:  # More than 5 minutes
            return "cautious"
    
    def get_location_preferences(self) -> Dict[str, Any]:
        """Analyze preferred mining locations"""
        if not self.site_preferences:
            return {"pattern": "unknown", "diversity": 0.5}
        
        total_sites = sum(self.site_preferences.values())
        location_diversity = len(self.site_preferences) / max(1, total_sites)
        
        # Find most preferred locations
        sorted_prefs = sorted(self.site_preferences.items(), 
                            key=lambda x: x[1], reverse=True)
        
        top_locations = sorted_prefs[:3]  # Top 3 preferred locations
        
        return {
            "pattern": "diverse" if location_diversity > 0.7 else "focused",
            "diversity": location_diversity,
            "preferred_locations": top_locations,
            "total_unique_locations": len(self.site_preferences)
        }
    
    def get_worker_efficiency_trend(self) -> Dict[str, float]:
        """Analyze worker efficiency trends"""
        if not self.worker_efficiency_scores:
            return {"trend": 0.0, "average": 2.0, "stability": 0.5}
        
        scores = list(self.worker_efficiency_scores)
        avg_efficiency = np.mean(scores)
        
        # Calculate trend (positive = improving efficiency)
        if len(scores) > 5:
            recent_avg = np.mean(scores[-5:])
            early_avg = np.mean(scores[:5])
            trend = (recent_avg - early_avg) / max(0.1, early_avg)
        else:
            trend = 0.0
        
        # Calculate stability (lower variance = more stable)
        stability = 1.0 / (1.0 + np.var(scores))
        
        return {
            "trend": trend,
            "average": avg_efficiency,
            "stability": min(1.0, stability)
        }
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get comprehensive mining patterns"""
        return {
            "aggression_score": self.get_aggression_score(),
            "expansion_timing": self.get_expansion_timing_pattern(),
            "location_preferences": self.get_location_preferences(),
            "worker_efficiency": self.get_worker_efficiency_trend(),
            "expansion_count": self.expansion_count,
            "resource_focus": self._analyze_resource_focus()
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network (5 features)"""
        patterns = self.get_patterns()
        
        # Feature 1: Aggression score
        aggression = patterns["aggression_score"]
        
        # Feature 2: Expansion timing (encoded)
        timing_map = {"rapid": 0.8, "steady": 0.5, "cautious": 0.2, "unknown": 0.5}
        timing_score = timing_map[patterns["expansion_timing"]]
        
        # Feature 3: Location diversity
        location_diversity = patterns["location_preferences"]["diversity"]
        
        # Feature 4: Worker efficiency
        efficiency = patterns["worker_efficiency"]["average"] / 5.0  # Normalize
        efficiency = min(1.0, efficiency)
        
        # Feature 5: Resource focus diversity
        resource_focus = patterns["resource_focus"]["diversity_score"]
        
        return [aggression, timing_score, location_diversity, efficiency, resource_focus]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current mining metrics"""
        latest = self.mining_sites_history[-1] if self.mining_sites_history else {}
        return {
            "active_sites": latest.get('site_count', 0),
            "workers": latest.get('worker_count', 0),
            "aggression": self.get_aggression_score(),
            "expansion_pattern": self.get_expansion_timing_pattern()
        }
    
    def _analyze_resource_focus(self) -> Dict[str, Any]:
        """Analyze resource focus patterns"""
        if not self.resource_focus_patterns:
            return {"diversity_score": 0.5, "focus_type": "balanced"}
        
        recent_patterns = list(self.resource_focus_patterns)[-10:]  # Last 10 snapshots
        avg_diversity = np.mean([p['diversity'] for p in recent_patterns])
        
        # Determine focus type
        if avg_diversity < 1.5:
            focus_type = "specialized"
        elif avg_diversity > 2.5:
            focus_type = "diverse"
        else:
            focus_type = "balanced"
        
        return {
            "diversity_score": min(1.0, avg_diversity / 3.0),  # Normalize to 0-1
            "focus_type": focus_type
        }


class CombatPatternTracker:
    """Tracks player combat behavior patterns with detailed analysis"""
    
    def __init__(self):
        # Unit composition tracking
        self.unit_compositions = deque(maxlen=100)
        self.assault_history = deque(maxlen=50)
        self.timing_patterns = deque(maxlen=100)
        
        # Combat behavior analysis
        self.engagement_distances = deque(maxlen=50)
        self.formation_patterns = deque(maxlen=50)
        self.retreat_behaviors = deque(maxlen=30)
        self.coordination_scores = deque(maxlen=50)
        
        # Tactical analysis
        self.assault_approaches = defaultdict(int)  # Track approach angles/methods
        self.unit_focus_patterns = deque(maxlen=50)  # Protector vs Worker focus
        self.timing_preferences = {"early": 0, "mid": 0, "late": 0}
        
        # Performance tracking
        self.combat_outcomes = deque(maxlen=30)
        self.damage_efficiency = deque(maxlen=50)
    
    async def update(self, game_state: GameStateSnapshot):
        """Update combat patterns with comprehensive analysis"""
        current_time = game_state.timestamp
        protector_count = len(game_state.protector_positions)
        worker_count = len(game_state.worker_positions)
        
        # Track unit composition over time
        composition = {
            'timestamp': current_time,
            'protectors': protector_count,
            'workers': worker_count,
            'total_units': protector_count + worker_count,
            'protector_ratio': protector_count / max(1, protector_count + worker_count)
        }
        self.unit_compositions.append(composition)
        
        # Analyze unit formations and positioning
        if game_state.protector_positions:
            formation_analysis = self._analyze_formation(game_state.protector_positions)
            self.formation_patterns.append({
                'timestamp': current_time,
                'spread': formation_analysis['spread'],
                'center': formation_analysis['center'],
                'coordination': formation_analysis['coordination']
            })
            
            # Track coordination score
            self.coordination_scores.append(formation_analysis['coordination'])
        
        # Analyze combat timing preferences
        game_phase = self._determine_game_phase(current_time)
        if protector_count > 0:  # Active combat preparation
            self.timing_preferences[game_phase] += 1
        
        # Track unit focus patterns (combat vs economic units)
        focus_score = protector_count / max(1, worker_count)  # Higher = more combat focused
        self.unit_focus_patterns.append({
            'timestamp': current_time,
            'focus_score': focus_score,
            'phase': game_phase
        })
        
        # Detect assault patterns based on unit movement
        if len(self.unit_compositions) > 1:
            prev_protectors = self.unit_compositions[-2]['protectors']
            if protector_count > prev_protectors + 2:  # Significant unit increase
                self._record_assault_buildup(current_time, game_state)
    
    def _analyze_formation(self, unit_positions: List[Dict[str, float]]) -> Dict[str, Any]:
        """Analyze unit formation patterns"""
        if len(unit_positions) < 2:
            return {'spread': 0.0, 'center': {'x': 0, 'z': 0}, 'coordination': 0.5}
        
        # Calculate formation center
        center_x = np.mean([pos.get('x', 0) for pos in unit_positions])
        center_z = np.mean([pos.get('z', 0) for pos in unit_positions])
        
        # Calculate formation spread (standard deviation from center)
        distances = []
        for pos in unit_positions:
            dx = pos.get('x', 0) - center_x
            dz = pos.get('z', 0) - center_z
            distance = np.sqrt(dx*dx + dz*dz)
            distances.append(distance)
        
        spread = np.std(distances) if distances else 0.0
        
        # Calculate coordination score (tighter formations = higher coordination)
        max_distance = max(distances) if distances else 1.0
        coordination = 1.0 / (1.0 + spread / max(1.0, max_distance))
        
        return {
            'spread': spread,
            'center': {'x': center_x, 'z': center_z},
            'coordination': min(1.0, coordination)
        }
    
    def _determine_game_phase(self, timestamp: float) -> str:
        """Determine current game phase"""
        if timestamp < 300:  # First 5 minutes
            return "early"
        elif timestamp < 900:  # 5-15 minutes
            return "mid"
        else:
            return "late"
    
    def _record_assault_buildup(self, timestamp: float, game_state: GameStateSnapshot):
        """Record assault preparation patterns"""
        assault_data = {
            'timestamp': timestamp,
            'unit_count': len(game_state.protector_positions),
            'formation': self._analyze_formation(game_state.protector_positions),
            'phase': self._determine_game_phase(timestamp)
        }
        self.assault_history.append(assault_data)
    
    def get_combat_style(self) -> str:
        """Get combat style classification with detailed analysis"""
        if not self.unit_compositions:
            return "balanced"
        
        # Analyze recent unit compositions
        recent_comps = list(self.unit_compositions)[-20:]  # Last 20 snapshots
        avg_protectors = np.mean([comp['protectors'] for comp in recent_comps])
        avg_ratio = np.mean([comp['protector_ratio'] for comp in recent_comps])
        
        # Analyze timing preferences
        total_timing = sum(self.timing_preferences.values())
        if total_timing > 0:
            early_pref = self.timing_preferences["early"] / total_timing
            late_pref = self.timing_preferences["late"] / total_timing
        else:
            early_pref = late_pref = 0.33
        
        # Classification logic
        if avg_protectors > 15 and avg_ratio > 0.6:
            return "aggressive"
        elif avg_protectors < 5 and early_pref < 0.2:
            return "defensive"
        elif early_pref > 0.5:
            return "rush"
        elif late_pref > 0.5:
            return "late_game"
        else:
            return "balanced"
    
    def get_aggression_level(self) -> float:
        """Calculate aggression level (0.0 to 1.0)"""
        if not self.unit_compositions:
            return 0.5
        
        recent_comps = list(self.unit_compositions)[-10:]
        
        # Factor 1: Unit count aggression
        avg_protectors = np.mean([comp['protectors'] for comp in recent_comps])
        unit_aggression = min(1.0, avg_protectors / 20.0)  # 20+ protectors = max aggression
        
        # Factor 2: Timing aggression (early attacks = more aggressive)
        total_timing = sum(self.timing_preferences.values())
        timing_aggression = 0.5
        if total_timing > 0:
            early_weight = self.timing_preferences["early"] / total_timing
            timing_aggression = early_weight
        
        # Factor 3: Formation coordination (tight formations = more aggressive)
        coord_aggression = 0.5
        if self.coordination_scores:
            coord_aggression = np.mean(list(self.coordination_scores))
        
        # Weighted combination
        return (unit_aggression * 0.4 + timing_aggression * 0.3 + coord_aggression * 0.3)
    
    def get_coordination_analysis(self) -> Dict[str, Any]:
        """Analyze unit coordination patterns"""
        if not self.coordination_scores:
            return {"level": 0.5, "consistency": 0.5, "trend": 0.0}
        
        scores = list(self.coordination_scores)
        avg_coordination = np.mean(scores)
        consistency = 1.0 / (1.0 + np.var(scores))  # Lower variance = higher consistency
        
        # Calculate trend
        if len(scores) > 5:
            recent_avg = np.mean(scores[-5:])
            early_avg = np.mean(scores[:5])
            trend = (recent_avg - early_avg) / max(0.1, early_avg)
        else:
            trend = 0.0
        
        return {
            "level": avg_coordination,
            "consistency": min(1.0, consistency),
            "trend": trend
        }
    
    def get_tactical_preferences(self) -> Dict[str, Any]:
        """Analyze tactical preferences"""
        total_timing = sum(self.timing_preferences.values())
        timing_dist = {}
        if total_timing > 0:
            timing_dist = {
                phase: count / total_timing 
                for phase, count in self.timing_preferences.items()
            }
        else:
            timing_dist = {"early": 0.33, "mid": 0.33, "late": 0.33}
        
        # Determine preferred timing
        preferred_timing = max(timing_dist.items(), key=lambda x: x[1])[0]
        
        # Analyze unit focus
        focus_scores = [fp['focus_score'] for fp in self.unit_focus_patterns]
        avg_focus = np.mean(focus_scores) if focus_scores else 1.0
        
        focus_type = "combat" if avg_focus > 1.5 else "economic" if avg_focus < 0.7 else "balanced"
        
        return {
            "timing_preference": preferred_timing,
            "timing_distribution": timing_dist,
            "unit_focus": focus_type,
            "focus_score": avg_focus
        }
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get comprehensive combat patterns"""
        return {
            "combat_style": self.get_combat_style(),
            "aggression_level": self.get_aggression_level(),
            "coordination": self.get_coordination_analysis(),
            "tactical_preferences": self.get_tactical_preferences(),
            "assault_frequency": len(self.assault_history),
            "formation_consistency": self._calculate_formation_consistency()
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network (4 features)"""
        patterns = self.get_patterns()
        
        # Feature 1: Combat style (encoded)
        style_map = {
            "aggressive": 0.9, "rush": 0.8, "balanced": 0.5, 
            "defensive": 0.2, "late_game": 0.3
        }
        style_score = style_map.get(patterns["combat_style"], 0.5)
        
        # Feature 2: Aggression level
        aggression = patterns["aggression_level"]
        
        # Feature 3: Coordination level
        coordination = patterns["coordination"]["level"]
        
        # Feature 4: Tactical complexity (timing preference diversity)
        timing_dist = patterns["tactical_preferences"]["timing_distribution"]
        timing_entropy = -sum(p * np.log(p + 1e-10) for p in timing_dist.values())
        tactical_complexity = timing_entropy / np.log(3)  # Normalize by max entropy
        
        return [style_score, aggression, coordination, tactical_complexity]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current combat metrics"""
        latest = self.unit_compositions[-1] if self.unit_compositions else {}
        return {
            "style": self.get_combat_style(),
            "protector_count": latest.get('protectors', 0),
            "aggression": self.get_aggression_level(),
            "coordination": self.coordination_scores[-1] if self.coordination_scores else 0.5
        }
    
    def _calculate_formation_consistency(self) -> float:
        """Calculate how consistent formation patterns are"""
        if not self.formation_patterns:
            return 0.5
        
        spreads = [fp['spread'] for fp in self.formation_patterns]
        if not spreads:
            return 0.5
        
        # Lower variance in spread = higher consistency
        consistency = 1.0 / (1.0 + np.var(spreads))
        return min(1.0, consistency)


class EnergyManagementTracker:
    """Tracks player energy management patterns with detailed analysis"""
    
    def __init__(self):
        # Energy level tracking
        self.energy_history = deque(maxlen=200)
        self.spending_patterns = deque(maxlen=100)
        self.conservation_events = deque(maxlen=50)
        
        # Spending analysis
        self.spending_categories = defaultdict(list)  # Track spending by category
        self.spending_timing = deque(maxlen=100)
        self.efficiency_scores = deque(maxlen=50)
        
        # Risk analysis
        self.low_energy_events = deque(maxlen=30)  # Times when energy was critically low
        self.recovery_patterns = deque(maxlen=30)
        self.risk_tolerance_scores = deque(maxlen=50)
        
        # Strategic analysis
        self.energy_phases = {"buildup": 0, "spending": 0, "conservation": 0}
        self.spending_bursts = deque(maxlen=30)  # Large spending events
    
    async def update(self, game_state: GameStateSnapshot):
        """Update energy management patterns"""
        current_time = game_state.timestamp
        current_energy = game_state.energy_level
        
        # Track energy level over time
        energy_snapshot = {
            'timestamp': current_time,
            'energy': current_energy,
            'phase': self._determine_energy_phase(current_energy)
        }
        self.energy_history.append(energy_snapshot)
        
        # Detect spending patterns
        if len(self.energy_history) > 1:
            prev_energy = self.energy_history[-2]['energy']
            energy_change = current_energy - prev_energy
            
            if energy_change < -50:  # Significant spending
                spending_event = {
                    'timestamp': current_time,
                    'amount': abs(energy_change),
                    'remaining': current_energy,
                    'phase': self._determine_game_phase(current_time)
                }
                self.spending_patterns.append(spending_event)
                
                # Track large spending bursts
                if abs(energy_change) > 200:
                    self.spending_bursts.append(spending_event)
            
            elif energy_change > 20:  # Energy recovery/conservation
                conservation_event = {
                    'timestamp': current_time,
                    'recovery': energy_change,
                    'level': current_energy
                }
                self.conservation_events.append(conservation_event)
        
        # Track energy phases
        phase = self._determine_energy_phase(current_energy)
        self.energy_phases[phase] += 1
        
        # Detect low energy risk events
        if current_energy < 100:  # Critically low energy
            risk_event = {
                'timestamp': current_time,
                'energy': current_energy,
                'duration': self._calculate_low_energy_duration()
            }
            self.low_energy_events.append(risk_event)
        
        # Calculate current risk tolerance
        risk_score = self._calculate_current_risk_tolerance(current_energy, current_time)
        self.risk_tolerance_scores.append(risk_score)
        
        # Calculate spending efficiency
        if self.spending_patterns:
            efficiency = self._calculate_spending_efficiency()
            self.efficiency_scores.append(efficiency)
    
    def _determine_energy_phase(self, energy_level: int) -> str:
        """Determine current energy management phase"""
        if energy_level > 800:
            return "buildup"
        elif energy_level < 300:
            return "conservation"
        else:
            return "spending"
    
    def _determine_game_phase(self, timestamp: float) -> str:
        """Determine current game phase"""
        if timestamp < 300:
            return "early"
        elif timestamp < 900:
            return "mid"
        else:
            return "late"
    
    def _calculate_low_energy_duration(self) -> float:
        """Calculate how long player has been in low energy state"""
        if len(self.energy_history) < 2:
            return 0.0
        
        # Count consecutive low energy snapshots
        duration = 0.0
        for i in range(len(self.energy_history) - 1, -1, -1):
            if self.energy_history[i]['energy'] < 100:
                if i > 0:
                    duration += (self.energy_history[i]['timestamp'] - 
                               self.energy_history[i-1]['timestamp'])
                else:
                    break
            else:
                break
        
        return duration
    
    def _calculate_current_risk_tolerance(self, energy: int, timestamp: float) -> float:
        """Calculate current risk tolerance based on energy management"""
        # Base risk tolerance on current energy level
        base_risk = 1.0 - (energy / 1000.0)  # Lower energy = higher risk tolerance
        
        # Adjust based on recent spending patterns
        if self.spending_patterns:
            recent_spending = list(self.spending_patterns)[-5:]  # Last 5 spending events
            avg_remaining = np.mean([sp['remaining'] for sp in recent_spending])
            spending_risk = 1.0 - (avg_remaining / 1000.0)
        else:
            spending_risk = 0.5
        
        # Combine factors
        risk_tolerance = (base_risk * 0.6 + spending_risk * 0.4)
        return min(1.0, max(0.0, risk_tolerance))
    
    def _calculate_spending_efficiency(self) -> float:
        """Calculate spending efficiency score"""
        if not self.spending_patterns:
            return 0.5
        
        recent_spending = list(self.spending_patterns)[-10:]
        
        # Efficiency based on spending timing and amounts
        total_spent = sum(sp['amount'] for sp in recent_spending)
        time_span = (recent_spending[-1]['timestamp'] - 
                    recent_spending[0]['timestamp']) if len(recent_spending) > 1 else 1.0
        
        # Higher efficiency = more spending in shorter time (burst spending)
        if time_span > 0:
            spending_rate = total_spent / time_span
            efficiency = min(1.0, spending_rate / 100.0)  # Normalize
        else:
            efficiency = 0.5
        
        return efficiency
    
    def get_management_style(self) -> str:
        """Get energy management style classification"""
        if not self.energy_history:
            return "balanced"
        
        recent_energy = [eh['energy'] for eh in list(self.energy_history)[-20:]]
        avg_energy = np.mean(recent_energy)
        energy_variance = np.var(recent_energy)
        
        # Analyze spending patterns
        total_phases = sum(self.energy_phases.values())
        if total_phases > 0:
            conservation_ratio = self.energy_phases["conservation"] / total_phases
            buildup_ratio = self.energy_phases["buildup"] / total_phases
        else:
            conservation_ratio = buildup_ratio = 0.33
        
        # Classification logic
        if avg_energy > 700 and conservation_ratio > 0.4:
            return "conservative"
        elif avg_energy < 400 and energy_variance > 10000:  # High variance + low energy
            return "aggressive"
        elif buildup_ratio > 0.5:
            return "accumulator"
        elif len(self.spending_bursts) > 3:  # Frequent large spending
            return "burst_spender"
        else:
            return "balanced"
    
    def get_risk_analysis(self) -> Dict[str, Any]:
        """Analyze risk tolerance and management"""
        if not self.risk_tolerance_scores:
            return {"tolerance": 0.5, "consistency": 0.5, "recovery_ability": 0.5}
        
        scores = list(self.risk_tolerance_scores)
        avg_tolerance = np.mean(scores)
        consistency = 1.0 / (1.0 + np.var(scores))
        
        # Recovery ability based on conservation events
        recovery_ability = 0.5
        if self.conservation_events:
            avg_recovery = np.mean([ce['recovery'] for ce in self.conservation_events])
            recovery_ability = min(1.0, avg_recovery / 100.0)  # Normalize
        
        return {
            "tolerance": avg_tolerance,
            "consistency": min(1.0, consistency),
            "recovery_ability": recovery_ability,
            "low_energy_frequency": len(self.low_energy_events)
        }
    
    def get_spending_analysis(self) -> Dict[str, Any]:
        """Analyze spending patterns and efficiency"""
        if not self.spending_patterns:
            return {"efficiency": 0.5, "burst_frequency": 0, "timing_preference": "balanced"}
        
        # Calculate spending efficiency
        avg_efficiency = np.mean(list(self.efficiency_scores)) if self.efficiency_scores else 0.5
        
        # Analyze spending timing preferences
        spending_by_phase = defaultdict(int)
        for sp in self.spending_patterns:
            spending_by_phase[sp['phase']] += 1
        
        total_spending_events = sum(spending_by_phase.values())
        if total_spending_events > 0:
            phase_prefs = {phase: count / total_spending_events 
                          for phase, count in spending_by_phase.items()}
            preferred_phase = max(phase_prefs.items(), key=lambda x: x[1])[0]
        else:
            preferred_phase = "balanced"
        
        return {
            "efficiency": avg_efficiency,
            "burst_frequency": len(self.spending_bursts),
            "timing_preference": preferred_phase,
            "average_spending": np.mean([sp['amount'] for sp in self.spending_patterns])
        }
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get comprehensive energy management patterns"""
        return {
            "management_style": self.get_management_style(),
            "risk_analysis": self.get_risk_analysis(),
            "spending_analysis": self.get_spending_analysis(),
            "energy_stability": self._calculate_energy_stability(),
            "conservation_ability": self._calculate_conservation_ability()
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network (3 features)"""
        patterns = self.get_patterns()
        
        # Feature 1: Management style (encoded)
        style_map = {
            "conservative": 0.8, "accumulator": 0.7, "balanced": 0.5,
            "burst_spender": 0.3, "aggressive": 0.2
        }
        style_score = style_map.get(patterns["management_style"], 0.5)
        
        # Feature 2: Risk tolerance
        risk_tolerance = patterns["risk_analysis"]["tolerance"]
        
        # Feature 3: Spending efficiency
        spending_efficiency = patterns["spending_analysis"]["efficiency"]
        
        return [style_score, risk_tolerance, spending_efficiency]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current energy metrics"""
        latest = self.energy_history[-1] if self.energy_history else {}
        return {
            "style": self.get_management_style(),
            "level": latest.get('energy', 500),
            "risk_tolerance": self.risk_tolerance_scores[-1] if self.risk_tolerance_scores else 0.5,
            "phase": latest.get('phase', 'spending')
        }
    
    def _calculate_energy_stability(self) -> float:
        """Calculate energy level stability"""
        if not self.energy_history:
            return 0.5
        
        energy_levels = [eh['energy'] for eh in self.energy_history]
        stability = 1.0 / (1.0 + np.var(energy_levels) / 10000.0)  # Normalize variance
        return min(1.0, stability)
    
    def _calculate_conservation_ability(self) -> float:
        """Calculate ability to conserve and recover energy"""
        if not self.conservation_events:
            return 0.5
        
        # Average recovery rate
        avg_recovery = np.mean([ce['recovery'] for ce in self.conservation_events])
        conservation_ability = min(1.0, avg_recovery / 150.0)  # Normalize
        
        return conservation_ability


class ExplorationPatternTracker:
    """Tracks player exploration behavior patterns with comprehensive analysis"""
    
    def __init__(self):
        # Territory exploration tracking
        self.exploration_events = deque(maxlen=100)
        self.territory_coverage = deque(maxlen=100)
        self.exploration_paths = deque(maxlen=50)
        
        # Risk and efficiency analysis
        self.risk_taking_events = deque(maxlen=50)
        self.exploration_efficiency = deque(maxlen=50)
        self.discovery_patterns = deque(maxlen=50)
        
        # Strategic exploration analysis
        self.exploration_timing = {"early": 0, "mid": 0, "late": 0}
        self.exploration_methods = defaultdict(int)  # Systematic vs random
        self.territory_priorities = defaultdict(int)  # Which areas explored first
        
        # Performance tracking
        self.exploration_outcomes = deque(maxlen=30)
        self.resource_discovery_rate = deque(maxlen=30)
    
    async def update(self, game_state: GameStateSnapshot):
        """Update exploration patterns with detailed analysis"""
        current_time = game_state.timestamp
        explored_count = len(game_state.explored_areas) if hasattr(game_state, 'explored_areas') else 5
        
        # Track territory coverage over time
        coverage_snapshot = {
            'timestamp': current_time,
            'explored_areas': explored_count,
            'exploration_rate': self._calculate_exploration_rate(),
            'phase': self._determine_game_phase(current_time)
        }
        self.territory_coverage.append(coverage_snapshot)
        
        # Detect new exploration events
        if len(self.territory_coverage) > 1:
            prev_explored = self.territory_coverage[-2]['explored_areas']
            if explored_count > prev_explored:
                exploration_event = {
                    'timestamp': current_time,
                    'new_areas': explored_count - prev_explored,
                    'total_explored': explored_count,
                    'phase': self._determine_game_phase(current_time)
                }
                self.exploration_events.append(exploration_event)
                
                # Track exploration timing
                phase = self._determine_game_phase(current_time)
                self.exploration_timing[phase] += exploration_event['new_areas']
        
        # Analyze exploration efficiency
        if game_state.worker_positions:
            efficiency = self._calculate_exploration_efficiency(
                game_state.worker_positions, explored_count, current_time
            )
            self.exploration_efficiency.append(efficiency)
        
        # Track risk-taking behavior in exploration
        risk_score = self._assess_exploration_risk(game_state, current_time)
        self.risk_taking_events.append({
            'timestamp': current_time,
            'risk_score': risk_score,
            'explored_areas': explored_count
        })
        
        # Analyze exploration methods (systematic vs random)
        if len(self.exploration_events) > 2:
            method = self._classify_exploration_method()
            self.exploration_methods[method] += 1
    
    def _calculate_exploration_rate(self) -> float:
        """Calculate current exploration rate (areas per minute)"""
        if len(self.territory_coverage) < 2:
            return 0.0
        
        recent_snapshots = list(self.territory_coverage)[-10:]  # Last 10 snapshots
        if len(recent_snapshots) < 2:
            return 0.0
        
        time_span = (recent_snapshots[-1]['timestamp'] - 
                    recent_snapshots[0]['timestamp']) / 60.0  # Convert to minutes
        
        if time_span <= 0:
            return 0.0
        
        area_increase = (recent_snapshots[-1]['explored_areas'] - 
                        recent_snapshots[0]['explored_areas'])
        
        return max(0.0, area_increase / time_span)
    
    def _determine_game_phase(self, timestamp: float) -> str:
        """Determine current game phase"""
        if timestamp < 300:
            return "early"
        elif timestamp < 900:
            return "mid"
        else:
            return "late"
    
    def _calculate_exploration_efficiency(self, worker_positions: List[Dict], 
                                        explored_count: int, timestamp: float) -> Dict[str, float]:
        """Calculate exploration efficiency metrics"""
        worker_count = len(worker_positions)
        
        # Efficiency = explored areas per worker over time
        if worker_count > 0 and timestamp > 0:
            areas_per_worker = explored_count / worker_count
            areas_per_minute = explored_count / (timestamp / 60.0)
            efficiency_score = min(1.0, areas_per_worker / 10.0)  # Normalize
        else:
            areas_per_worker = 0.0
            areas_per_minute = 0.0
            efficiency_score = 0.0
        
        return {
            'timestamp': timestamp,
            'areas_per_worker': areas_per_worker,
            'areas_per_minute': areas_per_minute,
            'efficiency_score': efficiency_score
        }
    
    def _assess_exploration_risk(self, game_state: GameStateSnapshot, timestamp: float) -> float:
        """Assess risk level of current exploration behavior"""
        # Risk factors:
        # 1. Exploring with low energy
        # 2. Exploring far from base
        # 3. Exploring early in game
        
        risk_factors = []
        
        # Energy risk
        energy_risk = max(0.0, (500 - game_state.energy_level) / 500.0)
        risk_factors.append(energy_risk)
        
        # Timing risk (early exploration is riskier)
        phase = self._determine_game_phase(timestamp)
        timing_risk = {"early": 0.8, "mid": 0.4, "late": 0.2}[phase]
        risk_factors.append(timing_risk)
        
        # Worker distribution risk (spreading workers thin)
        if game_state.worker_positions:
            worker_spread = self._calculate_worker_spread(game_state.worker_positions)
            spread_risk = min(1.0, worker_spread / 100.0)  # Normalize
            risk_factors.append(spread_risk)
        else:
            risk_factors.append(0.5)
        
        return np.mean(risk_factors)
    
    def _calculate_worker_spread(self, worker_positions: List[Dict[str, float]]) -> float:
        """Calculate how spread out workers are"""
        if len(worker_positions) < 2:
            return 0.0
        
        # Calculate center of mass
        center_x = np.mean([pos.get('x', 0) for pos in worker_positions])
        center_z = np.mean([pos.get('z', 0) for pos in worker_positions])
        
        # Calculate average distance from center
        distances = []
        for pos in worker_positions:
            dx = pos.get('x', 0) - center_x
            dz = pos.get('z', 0) - center_z
            distance = np.sqrt(dx*dx + dz*dz)
            distances.append(distance)
        
        return np.mean(distances)
    
    def _classify_exploration_method(self) -> str:
        """Classify exploration method as systematic or random"""
        if len(self.exploration_events) < 3:
            return "unknown"
        
        recent_events = list(self.exploration_events)[-5:]
        
        # Analyze consistency in exploration rate
        rates = [event['new_areas'] for event in recent_events]
        rate_variance = np.var(rates)
        
        # Analyze timing consistency
        intervals = []
        for i in range(1, len(recent_events)):
            interval = (recent_events[i]['timestamp'] - 
                       recent_events[i-1]['timestamp'])
            intervals.append(interval)
        
        timing_variance = np.var(intervals) if intervals else 0
        
        # Classification logic
        if rate_variance < 1.0 and timing_variance < 3600:  # Low variance = systematic
            return "systematic"
        elif rate_variance > 4.0 or timing_variance > 7200:  # High variance = random
            return "random"
        else:
            return "mixed"
    
    def get_exploration_rate(self) -> float:
        """Get overall exploration rate (0.0 to 1.0)"""
        if not self.territory_coverage:
            return 0.5
        
        # Calculate average exploration rate
        recent_coverage = list(self.territory_coverage)[-20:]
        if len(recent_coverage) < 2:
            return 0.5
        
        total_explored = recent_coverage[-1]['explored_areas']
        total_time = recent_coverage[-1]['timestamp'] / 60.0  # Convert to minutes
        
        if total_time <= 0:
            return 0.5
        
        exploration_rate = total_explored / total_time
        return min(1.0, exploration_rate / 5.0)  # Normalize (5 areas/min = max rate)
    
    def get_risk_profile(self) -> Dict[str, Any]:
        """Analyze exploration risk-taking behavior"""
        if not self.risk_taking_events:
            return {"risk_level": 0.5, "consistency": 0.5, "timing": "balanced"}
        
        risk_scores = [event['risk_score'] for event in self.risk_taking_events]
        avg_risk = np.mean(risk_scores)
        risk_consistency = 1.0 / (1.0 + np.var(risk_scores))
        
        # Analyze risk timing
        total_timing = sum(self.exploration_timing.values())
        if total_timing > 0:
            early_risk_ratio = self.exploration_timing["early"] / total_timing
            if early_risk_ratio > 0.5:
                risk_timing = "early_risk_taker"
            elif early_risk_ratio < 0.2:
                risk_timing = "cautious"
            else:
                risk_timing = "balanced"
        else:
            risk_timing = "balanced"
        
        return {
            "risk_level": avg_risk,
            "consistency": min(1.0, risk_consistency),
            "timing": risk_timing
        }
    
    def get_efficiency_analysis(self) -> Dict[str, Any]:
        """Analyze exploration efficiency patterns"""
        if not self.exploration_efficiency:
            return {"efficiency": 0.5, "trend": 0.0, "method": "unknown"}
        
        efficiencies = [eff['efficiency_score'] for eff in self.exploration_efficiency]
        avg_efficiency = np.mean(efficiencies)
        
        # Calculate efficiency trend
        if len(efficiencies) > 5:
            recent_avg = np.mean(efficiencies[-5:])
            early_avg = np.mean(efficiencies[:5])
            trend = (recent_avg - early_avg) / max(0.1, early_avg)
        else:
            trend = 0.0
        
        # Determine exploration method
        total_methods = sum(self.exploration_methods.values())
        if total_methods > 0:
            method_prefs = {method: count / total_methods 
                           for method, count in self.exploration_methods.items()}
            preferred_method = max(method_prefs.items(), key=lambda x: x[1])[0]
        else:
            preferred_method = "unknown"
        
        return {
            "efficiency": avg_efficiency,
            "trend": trend,
            "method": preferred_method,
            "method_distribution": dict(self.exploration_methods)
        }
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get comprehensive exploration patterns"""
        return {
            "exploration_rate": self.get_exploration_rate(),
            "risk_profile": self.get_risk_profile(),
            "efficiency_analysis": self.get_efficiency_analysis(),
            "timing_preferences": self._analyze_timing_preferences(),
            "exploration_consistency": self._calculate_exploration_consistency()
        }
    
    def get_feature_vector(self) -> List[float]:
        """Get feature vector for neural network (3 features)"""
        patterns = self.get_patterns()
        
        # Feature 1: Exploration rate
        exploration_rate = patterns["exploration_rate"]
        
        # Feature 2: Risk level
        risk_level = patterns["risk_profile"]["risk_level"]
        
        # Feature 3: Efficiency score
        efficiency = patterns["efficiency_analysis"]["efficiency"]
        
        return [exploration_rate, risk_level, efficiency]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current exploration metrics"""
        latest = self.territory_coverage[-1] if self.territory_coverage else {}
        return {
            "rate": self.get_exploration_rate(),
            "coverage": latest.get('explored_areas', 5),
            "risk_level": self.risk_taking_events[-1]['risk_score'] if self.risk_taking_events else 0.5,
            "efficiency": self.exploration_efficiency[-1]['efficiency_score'] if self.exploration_efficiency else 0.5
        }
    
    def _analyze_timing_preferences(self) -> Dict[str, Any]:
        """Analyze when player prefers to explore"""
        total_exploration = sum(self.exploration_timing.values())
        if total_exploration > 0:
            timing_prefs = {phase: count / total_exploration 
                           for phase, count in self.exploration_timing.items()}
            preferred_phase = max(timing_prefs.items(), key=lambda x: x[1])[0]
        else:
            timing_prefs = {"early": 0.33, "mid": 0.33, "late": 0.33}
            preferred_phase = "balanced"
        
        return {
            "preferred_phase": preferred_phase,
            "phase_distribution": timing_prefs
        }
    
    def _calculate_exploration_consistency(self) -> float:
        """Calculate how consistent exploration patterns are"""
        if not self.exploration_events:
            return 0.5
        
        # Analyze consistency in exploration intervals
        if len(self.exploration_events) < 3:
            return 0.5
        
        intervals = []
        events = list(self.exploration_events)
        for i in range(1, len(events)):
            interval = events[i]['timestamp'] - events[i-1]['timestamp']
            intervals.append(interval)
        
        if not intervals:
            return 0.5
        
        # Lower variance = higher consistency
        consistency = 1.0 / (1.0 + np.var(intervals) / 3600.0)  # Normalize by hour
        return min(1.0, consistency)