"""
Adaptive Difficulty System - Dynamically adjusts Queen strategies based on player performance
"""

import logging
import time
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from collections import deque, defaultdict
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class PlayerPerformanceMetrics:
    """Comprehensive player performance metrics for difficulty assessment"""
    queen_kills: int = 0
    average_survival_time: float = 0.0
    win_rate: float = 0.0
    resource_efficiency: float = 0.0
    combat_effectiveness: float = 0.0
    strategic_adaptation: float = 0.0
    learning_curve_slope: float = 0.0
    consistency_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class DifficultyAdjustment:
    """Represents a difficulty adjustment decision"""
    timestamp: float
    previous_level: float
    new_level: float
    adjustment_reason: str
    player_metrics: PlayerPerformanceMetrics
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


class AdaptiveDifficultySystem:
    """
    Manages dynamic difficulty scaling based on comprehensive player performance analysis
    """
    
    def __init__(self):
        # Core difficulty state
        self.current_difficulty: float = 0.5  # 0.0 = easiest, 1.0 = hardest
        self.target_difficulty: float = 0.5
        self.difficulty_history: deque = deque(maxlen=100)
        
        # Player performance tracking
        self.performance_history: deque = deque(maxlen=50)
        self.skill_assessments: deque = deque(maxlen=30)
        self.adaptation_events: deque = deque(maxlen=20)
        
        # Success rate tracking
        self.recent_outcomes: deque = deque(maxlen=20)  # Win/loss history
        self.success_rate_history: deque = deque(maxlen=50)
        self.target_success_rate: float = 0.4  # Target 40% player success rate
        
        # Performance metrics tracking
        self.survival_times: deque = deque(maxlen=30)
        self.queen_kill_counts: deque = deque(maxlen=30)
        self.resource_efficiency_scores: deque = deque(maxlen=30)
        self.combat_effectiveness_scores: deque = deque(maxlen=30)
        
        # Difficulty adjustment parameters
        self.adjustment_sensitivity: float = 0.1  # How quickly to adjust
        self.stability_threshold: float = 0.05  # Minimum change to trigger adjustment
        self.max_adjustment_per_step: float = 0.15  # Maximum single adjustment
        
        # Feedback loop prevention
        self.adjustment_cooldown: float = 300.0  # 5 minutes between major adjustments
        self.last_major_adjustment: float = 0.0
        self.oscillation_detection: deque = deque(maxlen=10)
        
        # Skill assessment components
        self.skill_analyzer = PlayerSkillAnalyzer()
        self.engagement_monitor = EngagementMonitor()
        self.strategy_effectiveness_tracker = StrategyEffectivenessTracker()
        
        # Learning curve analysis
        self.learning_curve_analyzer = LearningCurveAnalyzer()
        
        logger.info("Adaptive Difficulty System initialized")
    
    async def update_player_performance(self, game_outcome: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update player performance metrics and adjust difficulty if needed
        
        Args:
            game_outcome: Dictionary containing game outcome data
            
        Returns:
            Dictionary containing difficulty adjustment information
        """
        try:
            current_time = time.time()
            
            # Extract performance data from game outcome
            performance_data = self._extract_performance_data(game_outcome)
            
            # Update performance tracking
            await self._update_performance_tracking(performance_data, current_time)
            
            # Assess current player skill level
            skill_assessment = await self.skill_analyzer.assess_skill(
                performance_data, self.performance_history
            )
            self.skill_assessments.append(skill_assessment)
            
            # Monitor engagement levels
            engagement_data = await self.engagement_monitor.analyze_engagement(
                performance_data, self.recent_outcomes
            )
            
            # Calculate comprehensive performance metrics
            current_metrics = self._calculate_performance_metrics()
            self.performance_history.append({
                'timestamp': current_time,
                'metrics': current_metrics,
                'skill_assessment': skill_assessment,
                'engagement': engagement_data
            })
            
            # Determine if difficulty adjustment is needed
            adjustment_decision = await self._evaluate_difficulty_adjustment(
                current_metrics, skill_assessment, engagement_data, current_time
            )
            
            # Apply difficulty adjustment if needed
            if adjustment_decision['should_adjust']:
                await self._apply_difficulty_adjustment(
                    adjustment_decision, current_time
                )
            
            # Update learning curve analysis
            await self.learning_curve_analyzer.update(
                current_metrics, current_time
            )
            
            return {
                'current_difficulty': self.current_difficulty,
                'target_difficulty': self.target_difficulty,
                'adjustment_made': adjustment_decision['should_adjust'],
                'adjustment_reason': adjustment_decision.get('reason', 'none'),
                'player_metrics': current_metrics.to_dict(),
                'skill_level': skill_assessment['skill_level'],
                'engagement_level': engagement_data['engagement_level'],
                'success_rate': self._calculate_recent_success_rate(),
                'learning_progress': self.learning_curve_analyzer.get_progress_summary()
            }
            
        except Exception as e:
            logger.error(f"Error updating player performance: {e}")
            return {'error': str(e)}
    
    def _extract_performance_data(self, game_outcome: Dict[str, Any]) -> Dict[str, Any]:
        """Extract relevant performance data from game outcome"""
        return {
            'player_won': game_outcome.get('player_won', False),
            'survival_time': game_outcome.get('survival_time', 0.0),
            'queens_killed': game_outcome.get('queens_killed', 0),
            'resources_gathered': game_outcome.get('resources_gathered', 0),
            'units_created': game_outcome.get('units_created', 0),
            'combat_encounters': game_outcome.get('combat_encounters', 0),
            'strategic_decisions': game_outcome.get('strategic_decisions', []),
            'adaptation_indicators': game_outcome.get('adaptation_indicators', {}),
            'game_duration': game_outcome.get('game_duration', 0.0),
            'difficulty_level': game_outcome.get('difficulty_level', self.current_difficulty)
        }
    
    async def _update_performance_tracking(self, performance_data: Dict[str, Any], 
                                         timestamp: float):
        """Update various performance tracking metrics"""
        
        # Update outcome history
        self.recent_outcomes.append({
            'timestamp': timestamp,
            'won': performance_data['player_won'],
            'survival_time': performance_data['survival_time'],
            'difficulty': self.current_difficulty
        })
        
        # Update specific metric tracking
        self.survival_times.append(performance_data['survival_time'])
        self.queen_kill_counts.append(performance_data['queens_killed'])
        
        # Calculate and store resource efficiency
        if performance_data['game_duration'] > 0:
            resource_efficiency = (performance_data['resources_gathered'] / 
                                 performance_data['game_duration'])
            self.resource_efficiency_scores.append(resource_efficiency)
        
        # Calculate and store combat effectiveness
        if performance_data['combat_encounters'] > 0:
            combat_effectiveness = (performance_data['queens_killed'] / 
                                  performance_data['combat_encounters'])
            self.combat_effectiveness_scores.append(combat_effectiveness)
        
        # Update success rate history
        recent_success_rate = self._calculate_recent_success_rate()
        self.success_rate_history.append({
            'timestamp': timestamp,
            'success_rate': recent_success_rate,
            'sample_size': len(self.recent_outcomes)
        })
    
    def _calculate_performance_metrics(self) -> PlayerPerformanceMetrics:
        """Calculate comprehensive player performance metrics"""
        
        # Queen kills
        queen_kills = int(np.mean(list(self.queen_kill_counts))) if self.queen_kill_counts else 0
        
        # Average survival time
        avg_survival = float(np.mean(list(self.survival_times))) if self.survival_times else 0.0
        
        # Win rate
        win_rate = self._calculate_recent_success_rate()
        
        # Resource efficiency
        resource_efficiency = (float(np.mean(list(self.resource_efficiency_scores))) 
                             if self.resource_efficiency_scores else 0.0)
        
        # Combat effectiveness
        combat_effectiveness = (float(np.mean(list(self.combat_effectiveness_scores))) 
                              if self.combat_effectiveness_scores else 0.0)
        
        # Strategic adaptation (based on recent performance variance)
        strategic_adaptation = self._calculate_strategic_adaptation()
        
        # Learning curve slope
        learning_curve_slope = self.learning_curve_analyzer.get_current_slope()
        
        # Consistency score
        consistency_score = self._calculate_consistency_score()
        
        return PlayerPerformanceMetrics(
            queen_kills=queen_kills,
            average_survival_time=avg_survival,
            win_rate=win_rate,
            resource_efficiency=resource_efficiency,
            combat_effectiveness=combat_effectiveness,
            strategic_adaptation=strategic_adaptation,
            learning_curve_slope=learning_curve_slope,
            consistency_score=consistency_score
        )
    
    def _calculate_recent_success_rate(self) -> float:
        """Calculate recent player success rate"""
        if not self.recent_outcomes:
            return 0.5  # Default neutral success rate
        
        recent_wins = sum(1 for outcome in self.recent_outcomes if outcome['won'])
        return recent_wins / len(self.recent_outcomes)
    
    def _calculate_strategic_adaptation(self) -> float:
        """Calculate player's strategic adaptation ability"""
        if len(self.performance_history) < 5:
            return 0.5
        
        # Look at performance improvement over recent games
        recent_performances = list(self.performance_history)[-10:]
        if len(recent_performances) < 5:
            return 0.5
        
        # Calculate trend in win rate
        win_rates = [p['metrics'].win_rate for p in recent_performances]
        if len(win_rates) > 1:
            # Simple linear trend
            x = np.arange(len(win_rates))
            slope = np.polyfit(x, win_rates, 1)[0]
            # Normalize slope to 0-1 range
            adaptation_score = min(1.0, max(0.0, 0.5 + slope * 5))
        else:
            adaptation_score = 0.5
        
        return adaptation_score
    
    def _calculate_consistency_score(self) -> float:
        """Calculate player performance consistency"""
        if not self.survival_times or len(self.survival_times) < 3:
            return 0.5
        
        # Consistency based on survival time variance
        survival_variance = np.var(list(self.survival_times))
        mean_survival = np.mean(list(self.survival_times))
        
        if mean_survival > 0:
            coefficient_of_variation = np.sqrt(survival_variance) / mean_survival
            # Lower CV = higher consistency
            consistency = 1.0 / (1.0 + coefficient_of_variation)
        else:
            consistency = 0.5
        
        return min(1.0, consistency)
    
    async def _evaluate_difficulty_adjustment(self, metrics: PlayerPerformanceMetrics,
                                            skill_assessment: Dict[str, Any],
                                            engagement_data: Dict[str, Any],
                                            current_time: float) -> Dict[str, Any]:
        """Evaluate whether difficulty adjustment is needed"""
        
        # Check cooldown period
        if current_time - self.last_major_adjustment < self.adjustment_cooldown:
            return {'should_adjust': False, 'reason': 'cooldown_active'}
        
        # Calculate adjustment factors
        success_rate_factor = self._calculate_success_rate_adjustment_factor(metrics.win_rate)
        skill_factor = self._calculate_skill_adjustment_factor(skill_assessment)
        engagement_factor = self._calculate_engagement_adjustment_factor(engagement_data)
        learning_factor = self._calculate_learning_adjustment_factor(metrics.learning_curve_slope)
        
        # Weighted combination of factors
        adjustment_signal = (
            success_rate_factor * 0.4 +
            skill_factor * 0.25 +
            engagement_factor * 0.2 +
            learning_factor * 0.15
        )
        
        # Determine if adjustment is significant enough
        if abs(adjustment_signal) < self.stability_threshold:
            return {'should_adjust': False, 'reason': 'adjustment_too_small'}
        
        # Check for oscillation prevention
        if self._detect_oscillation(adjustment_signal):
            return {'should_adjust': False, 'reason': 'oscillation_prevention'}
        
        # Calculate new target difficulty
        new_target = self.current_difficulty + adjustment_signal
        new_target = max(0.0, min(1.0, new_target))  # Clamp to valid range
        
        # Determine adjustment reason
        reason = self._determine_adjustment_reason(
            success_rate_factor, skill_factor, engagement_factor, learning_factor
        )
        
        return {
            'should_adjust': True,
            'reason': reason,
            'adjustment_signal': adjustment_signal,
            'new_target': new_target,
            'factors': {
                'success_rate': success_rate_factor,
                'skill': skill_factor,
                'engagement': engagement_factor,
                'learning': learning_factor
            }
        }
    
    def _calculate_success_rate_adjustment_factor(self, current_success_rate: float) -> float:
        """Calculate adjustment factor based on success rate deviation from target"""
        deviation = current_success_rate - self.target_success_rate
        
        # Scale adjustment based on deviation magnitude
        if abs(deviation) < 0.05:  # Within 5% of target
            return 0.0
        elif abs(deviation) < 0.15:  # Moderate deviation
            return deviation * 0.5
        else:  # Large deviation
            return deviation * 0.8
    
    def _calculate_skill_adjustment_factor(self, skill_assessment: Dict[str, Any]) -> float:
        """Calculate adjustment factor based on skill assessment"""
        skill_level = skill_assessment.get('skill_level', 0.5)
        skill_trend = skill_assessment.get('skill_trend', 0.0)
        
        # If skill is improving rapidly, increase difficulty
        if skill_trend > 0.1:
            return 0.1
        elif skill_trend < -0.1:
            return -0.1
        
        # Adjust based on absolute skill level vs current difficulty
        skill_difficulty_gap = skill_level - self.current_difficulty
        return skill_difficulty_gap * 0.2
    
    def _calculate_engagement_adjustment_factor(self, engagement_data: Dict[str, Any]) -> float:
        """Calculate adjustment factor based on engagement levels"""
        engagement_level = engagement_data.get('engagement_level', 0.5)
        frustration_level = engagement_data.get('frustration_level', 0.0)
        boredom_level = engagement_data.get('boredom_level', 0.0)
        
        # High frustration = decrease difficulty
        if frustration_level > 0.7:
            return -0.15
        
        # High boredom = increase difficulty
        if boredom_level > 0.7:
            return 0.15
        
        # Optimal engagement is around 0.7-0.8
        if engagement_level < 0.5:
            return -0.05  # Slightly decrease difficulty
        elif engagement_level > 0.9:
            return -0.05  # Slightly decrease difficulty (too intense)
        
        return 0.0
    
    def _calculate_learning_adjustment_factor(self, learning_slope: float) -> float:
        """Calculate adjustment factor based on learning curve"""
        # Positive slope = player is improving, can handle more difficulty
        if learning_slope > 0.1:
            return 0.08
        elif learning_slope < -0.1:
            return -0.08
        
        return 0.0
    
    def _detect_oscillation(self, adjustment_signal: float) -> bool:
        """Detect if difficulty adjustments are oscillating"""
        self.oscillation_detection.append(adjustment_signal)
        
        if len(self.oscillation_detection) < 6:
            return False
        
        # Check for alternating positive/negative adjustments
        recent_signals = list(self.oscillation_detection)[-6:]
        sign_changes = 0
        
        for i in range(1, len(recent_signals)):
            if (recent_signals[i] > 0) != (recent_signals[i-1] > 0):
                sign_changes += 1
        
        # If more than 4 sign changes in 6 adjustments, we're oscillating
        return sign_changes > 4
    
    def _determine_adjustment_reason(self, success_rate_factor: float, skill_factor: float,
                                   engagement_factor: float, learning_factor: float) -> str:
        """Determine the primary reason for difficulty adjustment"""
        factors = {
            'success_rate_too_high': success_rate_factor > 0.1,
            'success_rate_too_low': success_rate_factor < -0.1,
            'skill_improving': skill_factor > 0.05,
            'skill_declining': skill_factor < -0.05,
            'player_frustrated': engagement_factor < -0.05,
            'player_bored': engagement_factor > 0.05,
            'learning_progress': learning_factor > 0.05,
            'learning_plateau': learning_factor < -0.05
        }
        
        # Return the most significant factor
        for reason, condition in factors.items():
            if condition:
                return reason
        
        return 'general_adjustment'
    
    async def _apply_difficulty_adjustment(self, adjustment_decision: Dict[str, Any],
                                         current_time: float):
        """Apply the difficulty adjustment"""
        
        previous_difficulty = self.current_difficulty
        new_difficulty = adjustment_decision['new_target']
        
        # Limit adjustment magnitude
        max_change = self.max_adjustment_per_step
        actual_change = new_difficulty - previous_difficulty
        
        if abs(actual_change) > max_change:
            actual_change = max_change if actual_change > 0 else -max_change
            new_difficulty = previous_difficulty + actual_change
        
        # Apply the adjustment
        self.current_difficulty = new_difficulty
        self.target_difficulty = new_difficulty
        
        # Record the adjustment
        adjustment_record = DifficultyAdjustment(
            timestamp=current_time,
            previous_level=previous_difficulty,
            new_level=new_difficulty,
            adjustment_reason=adjustment_decision['reason'],
            player_metrics=self._calculate_performance_metrics(),
            confidence=0.8  # TODO: Calculate actual confidence
        )
        
        self.difficulty_history.append(adjustment_record)
        
        # Update last major adjustment time
        if abs(actual_change) > 0.05:
            self.last_major_adjustment = current_time
        
        logger.info(f"Difficulty adjusted from {previous_difficulty:.3f} to {new_difficulty:.3f} "
                   f"(reason: {adjustment_decision['reason']})")
    
    def get_current_difficulty_level(self) -> float:
        """Get current difficulty level (0.0 to 1.0)"""
        return self.current_difficulty
    
    def get_difficulty_modifiers(self) -> Dict[str, float]:
        """Get difficulty modifiers for Queen strategy generation"""
        base_difficulty = self.current_difficulty
        
        return {
            'strategy_complexity': base_difficulty,
            'reaction_speed': 0.5 + (base_difficulty * 0.5),
            'resource_efficiency': 0.3 + (base_difficulty * 0.7),
            'adaptation_rate': 0.2 + (base_difficulty * 0.8),
            'predictive_ability': max(0.0, base_difficulty - 0.3),
            'coordination_level': 0.4 + (base_difficulty * 0.6),
            'learning_rate': 0.1 + (base_difficulty * 0.9)
        }
    
    def get_difficulty_insights(self) -> Dict[str, Any]:
        """Get insights about current difficulty state and player performance"""
        current_metrics = self._calculate_performance_metrics()
        
        return {
            'current_difficulty': self.current_difficulty,
            'target_success_rate': self.target_success_rate,
            'actual_success_rate': current_metrics.win_rate,
            'player_skill_level': (self.skill_assessments[-1]['skill_level'] 
                                 if self.skill_assessments else 0.5),
            'learning_progress': self.learning_curve_analyzer.get_progress_summary(),
            'recent_adjustments': [adj.to_dict() for adj in list(self.difficulty_history)[-5:]],
            'performance_trends': {
                'survival_time_trend': self._calculate_trend(list(self.survival_times)),
                'success_rate_trend': self._calculate_trend([sr['success_rate'] 
                                                           for sr in self.success_rate_history]),
                'consistency_trend': current_metrics.consistency_score
            },
            'engagement_status': (self.engagement_monitor.get_current_engagement() 
                                if hasattr(self.engagement_monitor, 'get_current_engagement') 
                                else {'level': 0.5, 'status': 'unknown'})
        }
    
    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend direction for a list of values"""
        if len(values) < 3:
            return 0.0
        
        x = np.arange(len(values))
        slope = np.polyfit(x, values, 1)[0]
        return slope


class PlayerSkillAnalyzer:
    """Analyzes player skill level across multiple dimensions"""
    
    def __init__(self):
        self.skill_history = deque(maxlen=30)
        self.skill_dimensions = {
            'strategic_thinking': deque(maxlen=20),
            'tactical_execution': deque(maxlen=20),
            'resource_management': deque(maxlen=20),
            'adaptation_speed': deque(maxlen=20),
            'pattern_recognition': deque(maxlen=20)
        }
    
    async def assess_skill(self, performance_data: Dict[str, Any], 
                          performance_history: deque) -> Dict[str, Any]:
        """Assess player skill across multiple dimensions"""
        
        # Strategic thinking (long-term planning)
        strategic_score = self._assess_strategic_thinking(performance_data, performance_history)
        self.skill_dimensions['strategic_thinking'].append(strategic_score)
        
        # Tactical execution (short-term decisions)
        tactical_score = self._assess_tactical_execution(performance_data)
        self.skill_dimensions['tactical_execution'].append(tactical_score)
        
        # Resource management
        resource_score = self._assess_resource_management(performance_data)
        self.skill_dimensions['resource_management'].append(resource_score)
        
        # Adaptation speed
        adaptation_score = self._assess_adaptation_speed(performance_history)
        self.skill_dimensions['adaptation_speed'].append(adaptation_score)
        
        # Pattern recognition
        pattern_score = self._assess_pattern_recognition(performance_history)
        self.skill_dimensions['pattern_recognition'].append(pattern_score)
        
        # Calculate overall skill level
        overall_skill = np.mean([
            strategic_score, tactical_score, resource_score, 
            adaptation_score, pattern_score
        ])
        
        # Calculate skill trend
        skill_trend = self._calculate_skill_trend()
        
        skill_assessment = {
            'skill_level': overall_skill,
            'skill_trend': skill_trend,
            'dimensions': {
                'strategic_thinking': strategic_score,
                'tactical_execution': tactical_score,
                'resource_management': resource_score,
                'adaptation_speed': adaptation_score,
                'pattern_recognition': pattern_score
            },
            'confidence': self._calculate_assessment_confidence()
        }
        
        self.skill_history.append(skill_assessment)
        return skill_assessment
    
    def _assess_strategic_thinking(self, performance_data: Dict[str, Any], 
                                 performance_history: deque) -> float:
        """Assess strategic thinking ability"""
        # Look at long-term performance trends and decision quality
        if len(performance_history) < 5:
            return 0.5
        
        # Analyze improvement over time
        recent_performances = list(performance_history)[-10:]
        win_rates = [p['metrics'].win_rate for p in recent_performances]
        
        if len(win_rates) > 1:
            improvement_trend = np.polyfit(range(len(win_rates)), win_rates, 1)[0]
            strategic_score = 0.5 + (improvement_trend * 2)  # Scale trend
        else:
            strategic_score = 0.5
        
        return max(0.0, min(1.0, strategic_score))
    
    def _assess_tactical_execution(self, performance_data: Dict[str, Any]) -> float:
        """Assess tactical execution ability"""
        # Based on combat effectiveness and survival time
        combat_effectiveness = performance_data.get('combat_encounters', 0)
        survival_time = performance_data.get('survival_time', 0)
        
        if combat_effectiveness > 0:
            tactical_score = min(1.0, performance_data.get('queens_killed', 0) / combat_effectiveness)
        else:
            tactical_score = 0.5
        
        # Factor in survival time (longer survival = better tactics)
        if survival_time > 0:
            survival_factor = min(1.0, survival_time / 600.0)  # 10 minutes = max
            tactical_score = (tactical_score * 0.7) + (survival_factor * 0.3)
        
        return tactical_score
    
    def _assess_resource_management(self, performance_data: Dict[str, Any]) -> float:
        """Assess resource management ability"""
        game_duration = performance_data.get('game_duration', 1.0)
        resources_gathered = performance_data.get('resources_gathered', 0)
        units_created = performance_data.get('units_created', 0)
        
        # Resource efficiency
        if game_duration > 0:
            resource_rate = resources_gathered / game_duration
            resource_score = min(1.0, resource_rate / 100.0)  # Normalize
        else:
            resource_score = 0.5
        
        # Unit creation efficiency
        if resources_gathered > 0:
            unit_efficiency = units_created / resources_gathered
            efficiency_score = min(1.0, unit_efficiency * 10)  # Scale
        else:
            efficiency_score = 0.5
        
        return (resource_score * 0.6) + (efficiency_score * 0.4)
    
    def _assess_adaptation_speed(self, performance_history: deque) -> float:
        """Assess how quickly player adapts to new challenges"""
        if len(performance_history) < 8:
            return 0.5
        
        # Look at performance recovery after losses
        recent_history = list(performance_history)[-8:]
        
        # Find loss events and measure recovery
        recovery_scores = []
        for i in range(len(recent_history) - 3):
            if recent_history[i]['metrics'].win_rate < 0.3:  # Loss event
                # Measure improvement in next 3 games
                post_loss_performance = [
                    recent_history[j]['metrics'].win_rate 
                    for j in range(i+1, min(i+4, len(recent_history)))
                ]
                if post_loss_performance:
                    recovery_score = np.mean(post_loss_performance)
                    recovery_scores.append(recovery_score)
        
        if recovery_scores:
            return np.mean(recovery_scores)
        else:
            return 0.5
    
    def _assess_pattern_recognition(self, performance_history: deque) -> float:
        """Assess pattern recognition ability"""
        if len(performance_history) < 10:
            return 0.5
        
        # Look at consistency in similar situations
        recent_history = list(performance_history)[-10:]
        
        # Group by similar difficulty levels and measure consistency
        difficulty_groups = defaultdict(list)
        for perf in recent_history:
            difficulty_bucket = round(perf.get('difficulty', 0.5) * 4) / 4  # Round to quarters
            difficulty_groups[difficulty_bucket].append(perf['metrics'].win_rate)
        
        # Calculate consistency within difficulty groups
        consistency_scores = []
        for difficulty, win_rates in difficulty_groups.items():
            if len(win_rates) > 2:
                consistency = 1.0 / (1.0 + np.var(win_rates))
                consistency_scores.append(consistency)
        
        if consistency_scores:
            return np.mean(consistency_scores)
        else:
            return 0.5
    
    def _calculate_skill_trend(self) -> float:
        """Calculate overall skill trend"""
        if len(self.skill_history) < 5:
            return 0.0
        
        skill_levels = [assessment['skill_level'] for assessment in self.skill_history]
        x = np.arange(len(skill_levels))
        slope = np.polyfit(x, skill_levels, 1)[0]
        
        return slope
    
    def _calculate_assessment_confidence(self) -> float:
        """Calculate confidence in skill assessment"""
        # More data = higher confidence
        data_confidence = min(1.0, len(self.skill_history) / 20.0)
        
        # Consistency in assessments = higher confidence
        if len(self.skill_history) > 3:
            recent_skills = [assessment['skill_level'] for assessment in list(self.skill_history)[-5:]]
            consistency = 1.0 / (1.0 + np.var(recent_skills))
        else:
            consistency = 0.5
        
        return (data_confidence * 0.6) + (consistency * 0.4)


class EngagementMonitor:
    """Monitors player engagement and frustration levels"""
    
    def __init__(self):
        self.engagement_history = deque(maxlen=20)
        self.frustration_indicators = deque(maxlen=15)
        self.boredom_indicators = deque(maxlen=15)
    
    async def analyze_engagement(self, performance_data: Dict[str, Any], 
                               recent_outcomes: deque) -> Dict[str, Any]:
        """Analyze player engagement levels"""
        
        # Calculate frustration indicators
        frustration_level = self._calculate_frustration_level(recent_outcomes)
        self.frustration_indicators.append(frustration_level)
        
        # Calculate boredom indicators
        boredom_level = self._calculate_boredom_level(performance_data, recent_outcomes)
        self.boredom_indicators.append(boredom_level)
        
        # Calculate overall engagement
        engagement_level = self._calculate_engagement_level(frustration_level, boredom_level)
        
        engagement_data = {
            'engagement_level': engagement_level,
            'frustration_level': frustration_level,
            'boredom_level': boredom_level,
            'engagement_trend': self._calculate_engagement_trend(),
            'optimal_challenge_zone': self._assess_challenge_zone(engagement_level)
        }
        
        self.engagement_history.append(engagement_data)
        return engagement_data
    
    def _calculate_frustration_level(self, recent_outcomes: deque) -> float:
        """Calculate player frustration based on recent losses"""
        if not recent_outcomes:
            return 0.0
        
        recent_games = list(recent_outcomes)[-10:]  # Last 10 games
        
        # Count consecutive losses
        consecutive_losses = 0
        for outcome in reversed(recent_games):
            if not outcome['won']:
                consecutive_losses += 1
            else:
                break
        
        # Count total losses in recent games
        total_losses = sum(1 for outcome in recent_games if not outcome['won'])
        loss_rate = total_losses / len(recent_games)
        
        # Frustration increases with consecutive losses and high loss rate
        frustration = min(1.0, (consecutive_losses * 0.2) + (loss_rate * 0.6))
        
        return frustration
    
    def _calculate_boredom_level(self, performance_data: Dict[str, Any], 
                               recent_outcomes: deque) -> float:
        """Calculate player boredom based on easy wins and lack of challenge"""
        if not recent_outcomes:
            return 0.0
        
        recent_games = list(recent_outcomes)[-10:]
        
        # Count consecutive wins
        consecutive_wins = 0
        for outcome in reversed(recent_games):
            if outcome['won']:
                consecutive_wins += 1
            else:
                break
        
        # Count easy wins (short survival time but still won)
        easy_wins = 0
        for outcome in recent_games:
            if outcome['won'] and outcome['survival_time'] < 300:  # Less than 5 minutes
                easy_wins += 1
        
        # Boredom increases with consecutive wins and easy victories
        boredom = min(1.0, (consecutive_wins * 0.15) + (easy_wins * 0.1))
        
        return boredom
    
    def _calculate_engagement_level(self, frustration: float, boredom: float) -> float:
        """Calculate overall engagement level"""
        # Optimal engagement is low frustration and low boredom
        # High frustration or high boredom reduces engagement
        
        base_engagement = 1.0 - max(frustration, boredom)
        
        # Sweet spot is moderate challenge (slight frustration is okay)
        if 0.1 <= frustration <= 0.3 and boredom < 0.2:
            base_engagement += 0.1  # Bonus for optimal challenge
        
        return max(0.0, min(1.0, base_engagement))
    
    def _calculate_engagement_trend(self) -> float:
        """Calculate trend in engagement levels"""
        if len(self.engagement_history) < 5:
            return 0.0
        
        engagement_levels = [data['engagement_level'] for data in self.engagement_history]
        x = np.arange(len(engagement_levels))
        slope = np.polyfit(x, engagement_levels, 1)[0]
        
        return slope
    
    def _assess_challenge_zone(self, engagement_level: float) -> str:
        """Assess if player is in optimal challenge zone"""
        if engagement_level > 0.8:
            return "optimal"
        elif engagement_level > 0.6:
            return "good"
        elif engagement_level > 0.4:
            return "moderate"
        else:
            return "poor"


class StrategyEffectivenessTracker:
    """Tracks effectiveness of different Queen strategies against player"""
    
    def __init__(self):
        self.strategy_outcomes = defaultdict(list)
        self.strategy_effectiveness = defaultdict(float)
        self.adaptation_resistance = defaultdict(float)
    
    async def track_strategy_outcome(self, strategy_type: str, outcome: Dict[str, Any]):
        """Track outcome of a specific strategy"""
        effectiveness_score = self._calculate_strategy_effectiveness(outcome)
        
        self.strategy_outcomes[strategy_type].append({
            'timestamp': time.time(),
            'effectiveness': effectiveness_score,
            'player_won': outcome.get('player_won', False),
            'survival_time': outcome.get('survival_time', 0.0)
        })
        
        # Update rolling average effectiveness
        recent_outcomes = self.strategy_outcomes[strategy_type][-10:]
        self.strategy_effectiveness[strategy_type] = np.mean([
            outcome['effectiveness'] for outcome in recent_outcomes
        ])
        
        # Update adaptation resistance (how well strategy works over time)
        self.adaptation_resistance[strategy_type] = self._calculate_adaptation_resistance(
            strategy_type
        )
    
    def _calculate_strategy_effectiveness(self, outcome: Dict[str, Any]) -> float:
        """Calculate effectiveness score for a strategy outcome"""
        base_score = 0.0 if outcome.get('player_won', False) else 1.0
        
        # Factor in survival time (longer = more effective for Queen)
        survival_time = outcome.get('survival_time', 0.0)
        if survival_time > 0:
            # Normalize survival time (10 minutes = max effectiveness)
            time_factor = min(1.0, survival_time / 600.0)
            base_score = (base_score * 0.7) + (time_factor * 0.3)
        
        return base_score
    
    def _calculate_adaptation_resistance(self, strategy_type: str) -> float:
        """Calculate how resistant a strategy is to player adaptation"""
        outcomes = self.strategy_outcomes[strategy_type]
        if len(outcomes) < 5:
            return 0.5
        
        # Look at effectiveness trend over time
        effectiveness_scores = [outcome['effectiveness'] for outcome in outcomes]
        x = np.arange(len(effectiveness_scores))
        slope = np.polyfit(x, effectiveness_scores, 1)[0]
        
        # Positive slope = strategy getting more effective (resistant to adaptation)
        # Negative slope = strategy getting less effective (player adapting)
        resistance = 0.5 + (slope * 2)  # Scale slope
        
        return max(0.0, min(1.0, resistance))
    
    def get_most_effective_strategies(self, top_n: int = 3) -> List[Tuple[str, float]]:
        """Get most effective strategies"""
        strategy_scores = [(strategy, effectiveness) 
                          for strategy, effectiveness in self.strategy_effectiveness.items()]
        strategy_scores.sort(key=lambda x: x[1], reverse=True)
        
        return strategy_scores[:top_n]
    
    def get_adaptation_resistant_strategies(self, top_n: int = 3) -> List[Tuple[str, float]]:
        """Get strategies most resistant to player adaptation"""
        resistance_scores = [(strategy, resistance) 
                           for strategy, resistance in self.adaptation_resistance.items()]
        resistance_scores.sort(key=lambda x: x[1], reverse=True)
        
        return resistance_scores[:top_n]


class LearningCurveAnalyzer:
    """Analyzes player learning curve and progress"""
    
    def __init__(self):
        self.performance_timeline = deque(maxlen=100)
        self.learning_phases = []
        self.current_phase = "initial"
        self.plateau_detection = deque(maxlen=20)
    
    async def update(self, metrics: PlayerPerformanceMetrics, timestamp: float):
        """Update learning curve analysis"""
        self.performance_timeline.append({
            'timestamp': timestamp,
            'skill_level': metrics.win_rate,  # Use win rate as primary skill indicator
            'consistency': metrics.consistency_score,
            'adaptation': metrics.strategic_adaptation
        })
        
        # Detect learning phases
        await self._detect_learning_phase()
        
        # Update plateau detection
        self._update_plateau_detection()
    
    async def _detect_learning_phase(self):
        """Detect current learning phase"""
        if len(self.performance_timeline) < 10:
            self.current_phase = "initial"
            return
        
        recent_performance = list(self.performance_timeline)[-10:]
        skill_levels = [p['skill_level'] for p in recent_performance]
        
        # Calculate learning rate (slope of recent performance)
        x = np.arange(len(skill_levels))
        slope = np.polyfit(x, skill_levels, 1)[0]
        
        # Classify learning phase
        if slope > 0.02:
            new_phase = "rapid_learning"
        elif slope > 0.005:
            new_phase = "steady_learning"
        elif abs(slope) <= 0.005:
            new_phase = "plateau"
        else:
            new_phase = "declining"
        
        # Record phase change
        if new_phase != self.current_phase:
            self.learning_phases.append({
                'timestamp': self.performance_timeline[-1]['timestamp'],
                'previous_phase': self.current_phase,
                'new_phase': new_phase,
                'learning_rate': slope
            })
            self.current_phase = new_phase
    
    def _update_plateau_detection(self):
        """Update plateau detection"""
        if len(self.performance_timeline) < 15:
            return
        
        recent_performance = list(self.performance_timeline)[-15:]
        skill_levels = [p['skill_level'] for p in recent_performance]
        
        # Check for plateau (low variance in recent performance)
        variance = np.var(skill_levels)
        is_plateau = variance < 0.01  # Low variance threshold
        
        self.plateau_detection.append(is_plateau)
    
    def get_current_slope(self) -> float:
        """Get current learning curve slope"""
        if len(self.performance_timeline) < 5:
            return 0.0
        
        recent_performance = list(self.performance_timeline)[-10:]
        skill_levels = [p['skill_level'] for p in recent_performance]
        
        x = np.arange(len(skill_levels))
        slope = np.polyfit(x, skill_levels, 1)[0]
        
        return slope
    
    def get_progress_summary(self) -> Dict[str, Any]:
        """Get learning progress summary"""
        current_slope = self.get_current_slope()
        
        # Detect if in plateau
        plateau_ratio = sum(self.plateau_detection) / len(self.plateau_detection) if self.plateau_detection else 0
        is_plateaued = plateau_ratio > 0.7
        
        return {
            'current_phase': self.current_phase,
            'learning_rate': current_slope,
            'is_plateaued': is_plateaued,
            'plateau_duration': len([p for p in self.plateau_detection if p]),
            'phase_history': self.learning_phases[-5:],  # Last 5 phase changes
            'total_progress': self._calculate_total_progress()
        }
    
    def _calculate_total_progress(self) -> float:
        """Calculate total learning progress"""
        if len(self.performance_timeline) < 5:
            return 0.0
        
        initial_performance = np.mean([p['skill_level'] for p in list(self.performance_timeline)[:5]])
        recent_performance = np.mean([p['skill_level'] for p in list(self.performance_timeline)[-5:]])
        
        progress = recent_performance - initial_performance
        return max(0.0, progress)  # Only positive progress