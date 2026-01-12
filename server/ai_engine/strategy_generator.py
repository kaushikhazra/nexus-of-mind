"""
Strategy Generator - Generates Queen strategies based on neural network learning
"""

import logging
import math
from typing import Dict, Any, List
from .data_models import QueenStrategy, PlayerPatterns, DeathAnalysis

logger = logging.getLogger(__name__)


class StrategyGenerator:
    """
    Generates diverse and effective strategies based on neural network learning
    """
    
    def __init__(self):
        self.hive_placement = HivePlacementGenerator()
        self.spawn_timing = SpawnTimingGenerator()
        self.defensive_coordination = DefensiveCoordinationGenerator()
        self.predictive_behavior = PredictiveBehaviorGenerator()
    
    async def generate_strategy(self, generation: int, learned_patterns: PlayerPatterns, 
                               death_lessons: DeathAnalysis, difficulty_modifiers: Dict[str, float] = None) -> QueenStrategy:
        """
        Generate comprehensive Queen strategy based on learning and difficulty adjustment
        
        Args:
            generation: Queen generation number
            learned_patterns: Player behavior patterns
            death_lessons: Analysis of previous death
            difficulty_modifiers: Difficulty adjustment modifiers
            
        Returns:
            QueenStrategy with all behavioral components
        """
        try:
            logger.info(f"Generating strategy for generation {generation}")
            
            # Use difficulty modifiers if provided, otherwise use generation-based complexity
            if difficulty_modifiers:
                complexity_level = difficulty_modifiers.get('strategy_complexity', min(1.0, generation * 0.1))
                logger.info(f"Using difficulty-adjusted complexity: {complexity_level}")
            else:
                complexity_level = min(1.0, generation * 0.1)
            
            # Generate hive placement strategy with difficulty adjustment
            hive_strategy = await self.hive_placement.generate(
                failed_locations=death_lessons.get_failed_locations(),
                player_approach_patterns=learned_patterns.get_approach_vectors(),
                generation_complexity=complexity_level,
                difficulty_modifiers=difficulty_modifiers
            )
            
            # Generate parasite spawning strategy with difficulty adjustment
            spawn_strategy = await self.spawn_timing.generate(
                player_mining_patterns=learned_patterns.mining_patterns,
                previous_spawn_effectiveness=death_lessons.get_spawn_effectiveness(),
                generation_complexity=complexity_level,
                difficulty_modifiers=difficulty_modifiers
            )
            
            # Generate defensive coordination strategy with difficulty adjustment
            defensive_strategy = await self.defensive_coordination.generate(
                assault_patterns=learned_patterns.combat_patterns,
                defensive_failures=death_lessons.get_defensive_failures(),
                generation_complexity=complexity_level,
                difficulty_modifiers=difficulty_modifiers
            )
            
            # Generate predictive behavior (advanced generations only) with difficulty adjustment
            predictive_strategy = None
            if generation >= 4 or (difficulty_modifiers and difficulty_modifiers.get('predictive_ability', 0) > 0.3):
                predictive_strategy = await self.predictive_behavior.generate(
                    player_behavior_model=learned_patterns,
                    prediction_horizon=60,  # 60 seconds ahead
                    confidence_threshold=0.7,
                    difficulty_modifiers=difficulty_modifiers
                )
            
            strategy = QueenStrategy(
                generation=generation,
                hive_placement=hive_strategy,
                parasite_spawning=spawn_strategy,
                defensive_coordination=defensive_strategy,
                predictive_behavior=predictive_strategy,
                complexity_level=complexity_level
            )
            
            logger.info(f"Strategy generated for generation {generation} with complexity {complexity_level}")
            return strategy
            
        except Exception as e:
            logger.error(f"Error generating strategy: {e}")
            raise


class HivePlacementGenerator:
    """Generates hive placement strategies based on death analysis"""
    
    def __init__(self):
        self.placement_history = []
        self.successful_zones = []
        self.territory_bounds = {'x': [-100, 100], 'y': [-10, 50], 'z': [-100, 100]}
    
    async def generate(self, failed_locations: list, player_approach_patterns: dict, 
                      generation_complexity: float, difficulty_modifiers: Dict[str, float] = None) -> Dict[str, Any]:
        """Generate comprehensive hive placement strategy based on death analysis"""
        try:
            logger.info(f"Generating hive placement strategy with complexity {generation_complexity}")
            
            # Analyze failed locations to identify patterns
            failure_analysis = self._analyze_failure_patterns(failed_locations)
            
            # Generate optimal placement zones
            optimal_zones = self._identify_optimal_zones(failed_locations, player_approach_patterns, generation_complexity)
            
            # Create placement criteria based on learning
            placement_criteria = self._create_placement_criteria(failure_analysis, generation_complexity)
            
            # Generate fallback strategies
            fallback_strategies = self._generate_fallback_strategies(generation_complexity)
            
            # Create adaptive placement rules
            adaptive_rules = self._create_adaptive_rules(player_approach_patterns, generation_complexity)
            
            strategy = {
                "strategy_type": "learned_adaptive_placement",
                "generation": int(generation_complexity * 10) + 1,
                "avoid_zones": self._create_avoidance_zones(failed_locations),
                "optimal_zones": optimal_zones,
                "placement_criteria": placement_criteria,
                "fallback_strategies": fallback_strategies,
                "adaptive_rules": adaptive_rules,
                "risk_assessment": self._create_risk_assessment_rules(generation_complexity),
                "concealment_strategy": self._create_concealment_strategy(failure_analysis, generation_complexity)
            }
            
            logger.info(f"Hive placement strategy generated with {len(optimal_zones)} optimal zones")
            return strategy
            
        except Exception as e:
            logger.error(f"Error generating hive placement strategy: {e}")
            return self._get_fallback_placement_strategy(generation_complexity)
    
    def _analyze_failure_patterns(self, failed_locations: list) -> Dict[str, Any]:
        """Analyze patterns in failed hive locations"""
        if not failed_locations:
            return {"pattern_type": "insufficient_data", "risk_factors": []}
        
        # Analyze spatial clustering of failures
        failure_clusters = self._identify_failure_clusters(failed_locations)
        
        # Identify high-risk zones
        high_risk_zones = []
        for cluster in failure_clusters:
            if len(cluster['locations']) >= 2:  # Multiple failures in same area
                high_risk_zones.append({
                    'center': cluster['center'],
                    'radius': cluster['radius'] + 20,  # Add safety margin
                    'failure_count': len(cluster['locations'])
                })
        
        # Analyze failure timing patterns
        timing_pattern = "random"
        if len(failed_locations) >= 3:
            discovery_times = [loc.get('discovery_time', 120) for loc in failed_locations[-3:]]
            if all(t < 60 for t in discovery_times):
                timing_pattern = "quick_discovery"
            elif all(t > 180 for t in discovery_times):
                timing_pattern = "slow_discovery"
        
        return {
            "pattern_type": timing_pattern,
            "failure_clusters": failure_clusters,
            "high_risk_zones": high_risk_zones,
            "risk_factors": self._identify_risk_factors(failed_locations)
        }
    
    def _identify_failure_clusters(self, failed_locations: list) -> List[Dict]:
        """Identify clusters of failed locations"""
        clusters = []
        processed = set()
        
        for i, loc1 in enumerate(failed_locations):
            if i in processed:
                continue
                
            cluster_locations = [loc1]
            cluster_indices = {i}
            
            for j, loc2 in enumerate(failed_locations):
                if j <= i or j in processed:
                    continue
                    
                distance = self._calculate_distance(loc1, loc2)
                if distance < 40:  # Cluster threshold
                    cluster_locations.append(loc2)
                    cluster_indices.add(j)
            
            if len(cluster_locations) > 1:
                center = self._calculate_cluster_center(cluster_locations)
                radius = max(self._calculate_distance(center, loc) for loc in cluster_locations)
                clusters.append({
                    'center': center,
                    'radius': radius,
                    'locations': cluster_locations
                })
                processed.update(cluster_indices)
        
        return clusters
    
    def _identify_optimal_zones(self, failed_locations: list, approach_patterns: dict, complexity: float) -> List[Dict]:
        """Identify optimal placement zones based on learning"""
        zones = []
        
        # Base zones - areas that haven't failed recently
        safe_zones = self._identify_safe_zones(failed_locations)
        
        # Counter-approach zones - areas that counter player approach patterns
        counter_zones = self._identify_counter_approach_zones(approach_patterns, complexity)
        
        # Combine and rank zones
        all_zones = safe_zones + counter_zones
        ranked_zones = self._rank_zones_by_effectiveness(all_zones, complexity)
        
        return ranked_zones[:5 + int(complexity * 3)]  # More zones for higher generations
    
    def _create_placement_criteria(self, failure_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create placement criteria based on failure analysis"""
        base_criteria = {
            "min_distance_from_failures": 50 + (complexity * 30),
            "min_distance_from_mining": 80 + (complexity * 40),
            "concealment_priority": 0.6 + (complexity * 0.3),
            "escape_route_count": max(3, int(2 + complexity * 4)),
            "height_preference": "elevated" if complexity > 0.4 else "neutral"
        }
        
        # Adapt criteria based on failure patterns
        if failure_analysis["pattern_type"] == "quick_discovery":
            base_criteria["concealment_priority"] = min(1.0, base_criteria["concealment_priority"] + 0.2)
            base_criteria["min_distance_from_mining"] += 30
        elif failure_analysis["pattern_type"] == "slow_discovery":
            base_criteria["escape_route_count"] += 1
            base_criteria["height_preference"] = "elevated"
        
        return base_criteria
    
    def _generate_fallback_strategies(self, complexity: float) -> List[Dict]:
        """Generate fallback placement strategies"""
        strategies = [
            {
                "name": "emergency_relocation",
                "trigger": "immediate_threat_detected",
                "action": "relocate_to_furthest_safe_zone",
                "enabled": complexity > 0.3
            },
            {
                "name": "decoy_placement",
                "trigger": "repeated_discovery_pattern",
                "action": "place_decoy_hives",
                "enabled": complexity > 0.6
            },
            {
                "name": "mobile_hive",
                "trigger": "high_pressure_environment",
                "action": "implement_mobile_strategy",
                "enabled": complexity > 0.8
            }
        ]
        
        return [s for s in strategies if s["enabled"]]
    
    def _create_adaptive_rules(self, approach_patterns: dict, complexity: float) -> Dict[str, Any]:
        """Create adaptive placement rules based on player patterns"""
        rules = {
            "approach_counter_strategy": "enabled" if complexity > 0.2 else "disabled",
            "pattern_prediction": "enabled" if complexity > 0.5 else "disabled",
            "dynamic_repositioning": "enabled" if complexity > 0.7 else "disabled"
        }
        
        # Specific counter-strategies based on approach patterns
        if approach_patterns:
            preferred_angles = approach_patterns.get("preferred_angles", [])
            if preferred_angles:
                # Place hive opposite to preferred approach angles
                counter_angles = [(angle + 180) % 360 for angle in preferred_angles]
                rules["counter_approach_angles"] = counter_angles
            
            timing_patterns = approach_patterns.get("timing_patterns", {})
            if timing_patterns:
                rules["timing_adaptation"] = {
                    "early_game_strategy": "high_concealment" if timing_patterns.get("early_aggression", False) else "standard",
                    "mid_game_strategy": "adaptive_positioning",
                    "late_game_strategy": "survival_focused"
                }
        
        return rules
    
    def _create_risk_assessment_rules(self, complexity: float) -> Dict[str, Any]:
        """Create risk assessment rules for placement decisions"""
        return {
            "threat_detection_range": 60 + (complexity * 40),
            "risk_tolerance": max(0.1, 0.5 - (complexity * 0.3)),
            "assessment_frequency": "continuous" if complexity > 0.4 else "periodic",
            "risk_factors": {
                "player_proximity": 0.8,
                "mining_activity": 0.6,
                "exploration_patterns": 0.7,
                "unit_concentration": 0.9
            }
        }
    
    def _create_concealment_strategy(self, failure_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create concealment strategy based on failure patterns"""
        strategy = {
            "concealment_level": "standard",
            "decoy_usage": False,
            "misdirection": False,
            "camouflage_priority": 0.5
        }
        
        if failure_analysis["pattern_type"] == "quick_discovery":
            strategy["concealment_level"] = "maximum"
            strategy["camouflage_priority"] = 0.9
            if complexity > 0.5:
                strategy["decoy_usage"] = True
        
        if complexity > 0.7:
            strategy["misdirection"] = True
            strategy["advanced_concealment"] = {
                "false_signatures": True,
                "signature_masking": True,
                "adaptive_camouflage": True
            }
        
        return strategy
    
    def _identify_safe_zones(self, failed_locations: list) -> List[Dict]:
        """Identify zones that are safe from recent failures"""
        safe_zones = []
        
        # Grid-based zone generation
        for x in range(-80, 81, 40):
            for z in range(-80, 81, 40):
                zone_center = {'x': x, 'y': 10, 'z': z}
                
                # Check distance from all failed locations
                min_failure_distance = float('inf')
                for failed_loc in failed_locations:
                    distance = self._calculate_distance(zone_center, failed_loc)
                    min_failure_distance = min(min_failure_distance, distance)
                
                if min_failure_distance > 50 or not failed_locations:
                    safe_zones.append({
                        'center': zone_center,
                        'radius': 25,
                        'safety_score': min(1.0, min_failure_distance / 100.0),
                        'zone_type': 'safe'
                    })
        
        return safe_zones
    
    def _identify_counter_approach_zones(self, approach_patterns: dict, complexity: float) -> List[Dict]:
        """Identify zones that counter player approach patterns"""
        if not approach_patterns or complexity < 0.3:
            return []
        
        counter_zones = []
        preferred_angles = approach_patterns.get("preferred_angles", [])
        
        for angle in preferred_angles:
            # Place zones opposite to preferred approach angles
            counter_angle = (angle + 180) % 360
            counter_x = 60 * math.cos(math.radians(counter_angle))
            counter_z = 60 * math.sin(math.radians(counter_angle))
            
            counter_zones.append({
                'center': {'x': counter_x, 'y': 15, 'z': counter_z},
                'radius': 30,
                'safety_score': 0.7 + (complexity * 0.2),
                'zone_type': 'counter_approach',
                'counter_angle': counter_angle
            })
        
        return counter_zones
    
    def _rank_zones_by_effectiveness(self, zones: List[Dict], complexity: float) -> List[Dict]:
        """Rank zones by their effectiveness score"""
        for zone in zones:
            effectiveness = zone['safety_score']
            
            # Bonus for counter-approach zones in higher generations
            if zone['zone_type'] == 'counter_approach' and complexity > 0.5:
                effectiveness += 0.2
            
            # Bonus for elevated positions
            if zone['center']['y'] > 20:
                effectiveness += 0.1
            
            zone['effectiveness'] = effectiveness
        
        return sorted(zones, key=lambda z: z['effectiveness'], reverse=True)
    
    def _calculate_distance(self, pos1: Dict, pos2: Dict) -> float:
        """Calculate 3D distance between two positions"""
        dx = pos1.get('x', 0) - pos2.get('x', 0)
        dy = pos1.get('y', 0) - pos2.get('y', 0)
        dz = pos1.get('z', 0) - pos2.get('z', 0)
        return math.sqrt(dx*dx + dy*dy + dz*dz)
    
    def _calculate_cluster_center(self, locations: List[Dict]) -> Dict[str, float]:
        """Calculate the center point of a cluster of locations"""
        if not locations:
            return {'x': 0, 'y': 0, 'z': 0}
        
        avg_x = sum(loc.get('x', 0) for loc in locations) / len(locations)
        avg_y = sum(loc.get('y', 0) for loc in locations) / len(locations)
        avg_z = sum(loc.get('z', 0) for loc in locations) / len(locations)
        
        return {'x': avg_x, 'y': avg_y, 'z': avg_z}
    
    def _identify_risk_factors(self, failed_locations: list) -> List[str]:
        """Identify common risk factors from failed locations"""
        risk_factors = []
        
        if not failed_locations:
            return risk_factors
        
        # Check for common patterns
        center_failures = sum(1 for loc in failed_locations if self._calculate_distance(loc, {'x': 0, 'y': 0, 'z': 0}) < 30)
        if center_failures > len(failed_locations) * 0.6:
            risk_factors.append("center_zone_vulnerability")
        
        edge_failures = sum(1 for loc in failed_locations if self._is_near_edge(loc))
        if edge_failures > len(failed_locations) * 0.6:
            risk_factors.append("edge_zone_vulnerability")
        
        low_height_failures = sum(1 for loc in failed_locations if loc.get('y', 0) < 5)
        if low_height_failures > len(failed_locations) * 0.7:
            risk_factors.append("low_elevation_vulnerability")
        
        return risk_factors
    
    def _is_near_edge(self, location: Dict) -> bool:
        """Check if location is near territory edge"""
        x, z = location.get('x', 0), location.get('z', 0)
        return (abs(x) > 70 or abs(z) > 70)
    
    def _create_avoidance_zones(self, failed_locations: list) -> List[Dict]:
        """Create zones to avoid based on failed locations"""
        avoidance_zones = []
        
        for location in failed_locations[-5:]:  # Last 5 failures
            avoidance_zones.append({
                'center': location,
                'radius': 35,
                'reason': 'recent_failure',
                'priority': 'high'
            })
        
        return avoidance_zones
    
    def _get_fallback_placement_strategy(self, complexity: float) -> Dict[str, Any]:
        """Get fallback strategy when generation fails"""
        return {
            "strategy_type": "fallback_placement",
            "generation": 1,
            "avoid_zones": [],
            "optimal_zones": [{'center': {'x': 0, 'y': 10, 'z': 0}, 'radius': 30, 'effectiveness': 0.5}],
            "placement_criteria": {
                "min_distance_from_failures": 50,
                "min_distance_from_mining": 80,
                "concealment_priority": 0.6,
                "escape_route_count": 3,
                "height_preference": "neutral"
            },
            "fallback_strategies": [],
            "adaptive_rules": {"approach_counter_strategy": "disabled"},
            "risk_assessment": {"threat_detection_range": 60, "risk_tolerance": 0.5},
            "concealment_strategy": {"concealment_level": "standard", "decoy_usage": False}
        }


class SpawnTimingGenerator:
    """Generates parasite spawning strategies based on player patterns and death analysis"""
    
    def __init__(self):
        self.spawn_history = []
        self.effectiveness_tracking = {}
        self.player_pattern_memory = {}
    
    async def generate(self, player_mining_patterns: dict, previous_spawn_effectiveness: float,
                      generation_complexity: float, difficulty_modifiers: Dict[str, float] = None) -> Dict[str, Any]:
        """Generate comprehensive spawning strategy based on learning"""
        try:
            logger.info(f"Generating spawn strategy with effectiveness {previous_spawn_effectiveness}")
            
            # Analyze player mining patterns for spawn timing
            mining_analysis = self._analyze_mining_patterns(player_mining_patterns)
            
            # Create adaptive spawn rates based on player behavior
            adaptive_rates = self._create_adaptive_spawn_rates(mining_analysis, generation_complexity)
            
            # Generate burst spawn triggers
            burst_triggers = self._create_burst_spawn_triggers(mining_analysis, generation_complexity)
            
            # Create spawn distribution strategy
            spawn_distribution = self._create_spawn_distribution(mining_analysis, generation_complexity)
            
            # Generate timing adaptation rules
            timing_rules = self._create_timing_adaptation_rules(previous_spawn_effectiveness, generation_complexity)
            
            # Create counter-strategy spawning
            counter_strategies = self._create_counter_spawn_strategies(player_mining_patterns, generation_complexity)
            
            strategy = {
                "strategy_type": "adaptive_intelligent_spawning",
                "generation": int(generation_complexity * 10) + 1,
                "base_spawn_rate": adaptive_rates["base_rate"],
                "adaptive_spawn_rates": adaptive_rates,
                "burst_spawn_triggers": burst_triggers,
                "spawn_distribution": spawn_distribution,
                "timing_adaptation": timing_rules,
                "counter_strategies": counter_strategies,
                "effectiveness_threshold": max(0.3, previous_spawn_effectiveness + 0.1),
                "learning_adjustments": self._create_learning_adjustments(previous_spawn_effectiveness, generation_complexity)
            }
            
            logger.info(f"Spawn strategy generated with base rate {adaptive_rates['base_rate']}")
            return strategy
            
        except Exception as e:
            logger.error(f"Error generating spawn strategy: {e}")
            return self._get_fallback_spawn_strategy(generation_complexity)
    
    def _analyze_mining_patterns(self, mining_patterns: dict) -> Dict[str, Any]:
        """Analyze player mining patterns to optimize spawn timing"""
        if not mining_patterns:
            return {"pattern_type": "unknown", "intensity": 0.5, "timing": "random"}
        
        analysis = {
            "expansion_rate": mining_patterns.get("expansion_rate", 0.5),
            "mining_intensity": mining_patterns.get("intensity", 0.5),
            "preferred_locations": mining_patterns.get("preferred_locations", []),
            "timing_patterns": mining_patterns.get("timing_patterns", {}),
            "resource_focus": mining_patterns.get("resource_focus", "balanced")
        }
        
        # Classify mining behavior
        if analysis["expansion_rate"] > 0.7:
            analysis["behavior_type"] = "aggressive_expansion"
        elif analysis["mining_intensity"] > 0.8:
            analysis["behavior_type"] = "intensive_mining"
        elif len(analysis["preferred_locations"]) <= 2:
            analysis["behavior_type"] = "conservative_mining"
        else:
            analysis["behavior_type"] = "balanced_mining"
        
        return analysis
    
    def _create_adaptive_spawn_rates(self, mining_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create adaptive spawn rates based on mining patterns"""
        base_rate = 8.0 + (complexity * 4.0)  # 8-12 spawns per minute
        
        # Adjust based on mining behavior
        behavior_type = mining_analysis.get("behavior_type", "balanced_mining")
        
        if behavior_type == "aggressive_expansion":
            # Counter aggressive expansion with higher spawn rates
            base_rate *= 1.3
            response_multiplier = 1.5 + (complexity * 0.5)
        elif behavior_type == "intensive_mining":
            # Counter intensive mining with focused spawning
            base_rate *= 1.1
            response_multiplier = 1.2 + (complexity * 0.3)
        elif behavior_type == "conservative_mining":
            # Match conservative pace but be ready to escalate
            base_rate *= 0.9
            response_multiplier = 1.0 + (complexity * 0.4)
        else:
            response_multiplier = 1.1 + (complexity * 0.3)
        
        return {
            "base_rate": base_rate,
            "mining_response_multiplier": response_multiplier,
            "expansion_response_rate": base_rate * 1.4,
            "threat_response_rate": base_rate * 1.8,
            "adaptive_scaling": {
                "early_game": base_rate * 0.8,
                "mid_game": base_rate,
                "late_game": base_rate * 1.2
            }
        }
    
    def _create_burst_spawn_triggers(self, mining_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create intelligent burst spawn triggers"""
        triggers = {
            "player_expansion": {
                "enabled": True,
                "threshold": max(1, 3 - int(complexity * 2)),  # Fewer expansions needed to trigger at higher complexity
                "burst_multiplier": 2.0 + (complexity * 1.0),
                "duration": 30 + (complexity * 20)
            },
            "energy_threshold": {
                "enabled": True,
                "threshold": max(200, 400 - (complexity * 100)),  # Lower threshold for higher generations
                "burst_multiplier": 1.5 + (complexity * 0.5),
                "duration": 20 + (complexity * 15)
            },
            "threat_detection": {
                "enabled": complexity > 0.3,
                "proximity_threshold": 80 - (complexity * 20),
                "burst_multiplier": 2.5 + (complexity * 0.5),
                "duration": 15 + (complexity * 10)
            },
            "mining_disruption": {
                "enabled": complexity > 0.4,
                "disruption_threshold": 0.3,  # 30% mining disruption
                "burst_multiplier": 1.8 + (complexity * 0.7),
                "duration": 25 + (complexity * 15)
            }
        }
        
        # Advanced triggers for higher generations
        if complexity > 0.6:
            triggers["predictive_spawning"] = {
                "enabled": True,
                "prediction_window": 60,  # 60 seconds ahead
                "confidence_threshold": 0.7,
                "burst_multiplier": 1.6 + (complexity * 0.4),
                "duration": 40
            }
        
        if complexity > 0.8:
            triggers["coordinated_assault_prep"] = {
                "enabled": True,
                "unit_concentration_threshold": 8,
                "burst_multiplier": 3.0,
                "duration": 45,
                "spawn_type": "defensive_swarm"
            }
        
        return triggers
    
    def _create_spawn_distribution(self, mining_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create intelligent spawn distribution based on player patterns"""
        base_distribution = {
            "defensive": 0.4,
            "offensive": 0.3,
            "scout": 0.3
        }
        
        # Adjust based on mining behavior
        behavior_type = mining_analysis.get("behavior_type", "balanced_mining")
        
        if behavior_type == "aggressive_expansion":
            # More scouts to track expansion, more offensive to counter
            base_distribution["scout"] += 0.1
            base_distribution["offensive"] += 0.1
            base_distribution["defensive"] -= 0.2
        elif behavior_type == "intensive_mining":
            # More offensive to disrupt mining
            base_distribution["offensive"] += 0.2
            base_distribution["defensive"] -= 0.1
            base_distribution["scout"] -= 0.1
        elif behavior_type == "conservative_mining":
            # More defensive, prepare for eventual push
            base_distribution["defensive"] += 0.2
            base_distribution["offensive"] -= 0.1
            base_distribution["scout"] -= 0.1
        
        # Complexity adjustments
        if complexity > 0.5:
            # Higher generations use more sophisticated distributions
            base_distribution["specialist"] = 0.1
            for key in ["defensive", "offensive", "scout"]:
                base_distribution[key] *= 0.9
        
        if complexity > 0.7:
            # Advanced tactical spawning
            base_distribution["tactical_coordinator"] = 0.05
            base_distribution["adaptive_response"] = 0.05
            for key in ["defensive", "offensive", "scout"]:
                base_distribution[key] *= 0.9
        
        return {
            "distribution": base_distribution,
            "dynamic_adjustment": complexity > 0.4,
            "situation_responsive": complexity > 0.6,
            "predictive_spawning": complexity > 0.8
        }
    
    def _create_timing_adaptation_rules(self, previous_effectiveness: float, complexity: float) -> Dict[str, Any]:
        """Create timing adaptation rules based on previous performance"""
        rules = {
            "effectiveness_threshold": max(0.3, previous_effectiveness + 0.1),
            "adaptation_speed": "slow" if complexity < 0.3 else "medium" if complexity < 0.7 else "fast",
            "learning_rate": 0.1 + (complexity * 0.2)
        }
        
        # Adjust timing based on previous effectiveness
        if previous_effectiveness < 0.3:
            # Previous spawning was ineffective, try different approach
            rules["timing_shift"] = "aggressive"
            rules["spawn_rate_adjustment"] = 1.4
            rules["burst_frequency_increase"] = 0.3
        elif previous_effectiveness > 0.7:
            # Previous spawning was effective, refine the approach
            rules["timing_shift"] = "refinement"
            rules["spawn_rate_adjustment"] = 1.1
            rules["pattern_optimization"] = True
        else:
            # Moderate effectiveness, gradual improvement
            rules["timing_shift"] = "gradual"
            rules["spawn_rate_adjustment"] = 1.2
            rules["adaptive_learning"] = True
        
        # Advanced adaptation for higher generations
        if complexity > 0.6:
            rules["predictive_timing"] = {
                "enabled": True,
                "prediction_accuracy_target": 0.7 + (complexity * 0.2),
                "adaptation_window": 30 - (complexity * 10)
            }
        
        return rules
    
    def _create_counter_spawn_strategies(self, mining_patterns: dict, complexity: float) -> Dict[str, Any]:
        """Create counter-strategies based on specific player patterns"""
        if not mining_patterns or complexity < 0.3:
            return {"enabled": False}
        
        strategies = {
            "enabled": True,
            "pattern_counters": {}
        }
        
        # Counter specific mining patterns
        if "expansion_timing" in mining_patterns:
            expansion_timing = mining_patterns["expansion_timing"]
            if expansion_timing == "early":
                strategies["pattern_counters"]["early_expansion"] = {
                    "spawn_timing": "preemptive",
                    "spawn_rate_multiplier": 1.3,
                    "focus": "scout_and_disrupt"
                }
            elif expansion_timing == "late":
                strategies["pattern_counters"]["late_expansion"] = {
                    "spawn_timing": "patient_buildup",
                    "spawn_rate_multiplier": 0.9,
                    "focus": "defensive_preparation"
                }
        
        # Counter mining location preferences
        if "preferred_locations" in mining_patterns:
            preferred_locs = mining_patterns["preferred_locations"]
            if len(preferred_locs) <= 2:
                strategies["pattern_counters"]["focused_mining"] = {
                    "spawn_timing": "concentrated_pressure",
                    "spawn_distribution": {"offensive": 0.6, "scout": 0.2, "defensive": 0.2},
                    "target_focus": "mining_disruption"
                }
            else:
                strategies["pattern_counters"]["distributed_mining"] = {
                    "spawn_timing": "distributed_response",
                    "spawn_distribution": {"scout": 0.5, "offensive": 0.3, "defensive": 0.2},
                    "target_focus": "expansion_tracking"
                }
        
        # Advanced counter-strategies for higher generations
        if complexity > 0.7:
            strategies["advanced_counters"] = {
                "behavioral_prediction": True,
                "adaptive_counter_timing": True,
                "multi_phase_strategies": True
            }
        
        return strategies
    
    def _create_learning_adjustments(self, previous_effectiveness: float, complexity: float) -> Dict[str, Any]:
        """Create learning-based adjustments for spawn strategy"""
        adjustments = {
            "effectiveness_feedback": previous_effectiveness,
            "adjustment_magnitude": min(0.5, (1.0 - previous_effectiveness) * complexity),
            "learning_focus": []
        }
        
        # Identify areas for improvement
        if previous_effectiveness < 0.4:
            adjustments["learning_focus"].extend(["spawn_timing", "spawn_rate", "distribution"])
        elif previous_effectiveness < 0.7:
            adjustments["learning_focus"].extend(["timing_optimization", "pattern_recognition"])
        else:
            adjustments["learning_focus"].extend(["fine_tuning", "predictive_spawning"])
        
        # Complexity-based learning adjustments
        if complexity > 0.5:
            adjustments["advanced_learning"] = {
                "pattern_memory": True,
                "effectiveness_tracking": True,
                "adaptive_optimization": True
            }
        
        if complexity > 0.8:
            adjustments["meta_learning"] = {
                "strategy_evolution": True,
                "cross_generation_learning": True,
                "emergent_behavior_development": True
            }
        
        return adjustments
    
    def _get_fallback_spawn_strategy(self, complexity: float) -> Dict[str, Any]:
        """Get fallback strategy when generation fails"""
        return {
            "strategy_type": "fallback_spawning",
            "generation": 1,
            "base_spawn_rate": 6.0,
            "adaptive_spawn_rates": {"base_rate": 6.0, "mining_response_multiplier": 1.2},
            "burst_spawn_triggers": {
                "player_expansion": {"enabled": True, "threshold": 3, "burst_multiplier": 1.5, "duration": 30},
                "energy_threshold": {"enabled": True, "threshold": 300, "burst_multiplier": 1.3, "duration": 20}
            },
            "spawn_distribution": {"distribution": {"defensive": 0.4, "offensive": 0.3, "scout": 0.3}},
            "timing_adaptation": {"effectiveness_threshold": 0.4, "adaptation_speed": "slow"},
            "counter_strategies": {"enabled": False},
            "learning_adjustments": {"effectiveness_feedback": 0.5, "learning_focus": ["basic_timing"]}
        }


class DefensiveCoordinationGenerator:
    """Generates defensive coordination strategies based on assault patterns"""
    
    def __init__(self):
        self.defense_history = []
        self.assault_pattern_memory = {}
        self.coordination_effectiveness = {}
    
    async def generate(self, assault_patterns: dict, defensive_failures: list,
                      generation_complexity: float, difficulty_modifiers: Dict[str, float] = None) -> Dict[str, Any]:
        """Generate comprehensive defensive coordination strategy"""
        try:
            logger.info(f"Generating defensive strategy with complexity {generation_complexity}")
            
            # Analyze assault patterns to create counter-strategies
            assault_analysis = self._analyze_assault_patterns(assault_patterns)
            
            # Create swarm coordination strategies
            swarm_coordination = self._create_swarm_coordination(assault_analysis, generation_complexity)
            
            # Generate retreat and repositioning strategies
            retreat_strategies = self._create_retreat_strategies(defensive_failures, generation_complexity)
            
            # Create counter-attack strategies
            counter_attack = self._create_counter_attack_strategies(assault_analysis, generation_complexity)
            
            # Generate formation tactics
            formation_tactics = self._create_formation_tactics(assault_analysis, generation_complexity)
            
            # Create adaptive defense rules
            adaptive_rules = self._create_adaptive_defense_rules(defensive_failures, generation_complexity)
            
            strategy = {
                "strategy_type": "intelligent_coordinated_defense",
                "generation": int(generation_complexity * 10) + 1,
                "swarm_coordination": swarm_coordination,
                "retreat_strategies": retreat_strategies,
                "counter_attack": counter_attack,
                "formation_tactics": formation_tactics,
                "adaptive_rules": adaptive_rules,
                "threat_assessment": self._create_threat_assessment_system(generation_complexity),
                "coordination_protocols": self._create_coordination_protocols(generation_complexity)
            }
            
            logger.info(f"Defensive strategy generated with {len(formation_tactics)} formation tactics")
            return strategy
            
        except Exception as e:
            logger.error(f"Error generating defensive strategy: {e}")
            return self._get_fallback_defensive_strategy(generation_complexity)
    
    def _analyze_assault_patterns(self, assault_patterns: dict) -> Dict[str, Any]:
        """Analyze player assault patterns to create effective counters"""
        if not assault_patterns:
            return {"pattern_type": "unknown", "coordination": 0.5, "predictability": 0.5}
        
        analysis = {
            "primary_pattern": assault_patterns.get("primary_pattern", "direct"),
            "coordination_level": assault_patterns.get("coordination", 0.5),
            "timing_patterns": assault_patterns.get("timing_patterns", {}),
            "unit_composition": assault_patterns.get("unit_composition", {}),
            "approach_vectors": assault_patterns.get("approach_vectors", [])
        }
        
        # Classify assault style
        coordination = analysis["coordination_level"]
        if coordination > 0.8:
            analysis["assault_style"] = "highly_coordinated"
        elif coordination > 0.5:
            analysis["assault_style"] = "moderately_coordinated"
        else:
            analysis["assault_style"] = "uncoordinated"
        
        # Analyze predictability
        timing_patterns = analysis["timing_patterns"]
        if timing_patterns and len(timing_patterns) > 0:
            pattern_consistency = sum(timing_patterns.values()) / len(timing_patterns)
            analysis["predictability"] = pattern_consistency
        else:
            analysis["predictability"] = 0.5
        
        return analysis
    
    def _create_swarm_coordination(self, assault_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create swarm coordination strategies based on assault patterns"""
        coordination = {
            "enabled": complexity > 0.2,
            "coordination_level": min(1.0, 0.3 + (complexity * 0.7)),
            "swarm_size": {
                "minimum": max(3, int(5 + complexity * 5)),
                "optimal": max(8, int(10 + complexity * 10)),
                "maximum": max(15, int(20 + complexity * 15))
            }
        }
        
        # Adapt coordination based on assault style
        assault_style = assault_analysis.get("assault_style", "uncoordinated")
        
        if assault_style == "highly_coordinated":
            # Counter with even higher coordination
            coordination["coordination_level"] = min(1.0, coordination["coordination_level"] + 0.2)
            coordination["tactics"] = ["synchronized_attacks", "flanking_maneuvers", "coordinated_retreats"]
        elif assault_style == "moderately_coordinated":
            # Use disruption tactics
            coordination["tactics"] = ["disruption_swarms", "hit_and_run", "divide_and_conquer"]
        else:
            # Use overwhelming numbers
            coordination["tactics"] = ["mass_assault", "overwhelming_numbers", "simple_coordination"]
        
        # Advanced coordination for higher generations
        if complexity > 0.6:
            coordination["advanced_tactics"] = {
                "multi_group_coordination": True,
                "adaptive_formation_switching": True,
                "predictive_positioning": True
            }
        
        if complexity > 0.8:
            coordination["elite_tactics"] = {
                "psychological_warfare": True,
                "deceptive_maneuvers": True,
                "emergent_coordination": True
            }
        
        return coordination
    
    def _create_retreat_strategies(self, defensive_failures: list, complexity: float) -> Dict[str, Any]:
        """Create intelligent retreat and repositioning strategies"""
        strategies = {
            "retreat_thresholds": {
                "health_percentage": max(0.1, 0.4 - (complexity * 0.15)),
                "overwhelming_force": max(1.5, 4.0 - (complexity * 1.0)),
                "tactical_disadvantage": 0.3 + (complexity * 0.2)
            },
            "retreat_patterns": ["scattered", "coordinated", "feint_retreat"],
            "repositioning": {
                "enabled": complexity > 0.3,
                "repositioning_speed": "fast" if complexity > 0.5 else "medium",
                "tactical_repositioning": complexity > 0.7
            }
        }
        
        # Learn from defensive failures
        if defensive_failures:
            failure_analysis = self._analyze_defensive_failures(defensive_failures)
            
            if "poor_retreat_timing" in failure_analysis:
                strategies["retreat_thresholds"]["health_percentage"] += 0.1
                strategies["early_warning_system"] = True
            
            if "poor_coordination" in failure_analysis:
                strategies["coordination_emphasis"] = True
                strategies["retreat_patterns"].append("coordinated_fallback")
            
            if "predictable_retreats" in failure_analysis and complexity > 0.4:
                strategies["retreat_patterns"].extend(["deceptive_retreat", "false_retreat"])
        
        # Advanced retreat strategies
        if complexity > 0.6:
            strategies["advanced_retreats"] = {
                "tactical_withdrawal": True,
                "regrouping_strategies": True,
                "counter_retreat_preparation": True
            }
        
        return strategies
    
    def _create_counter_attack_strategies(self, assault_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create counter-attack strategies based on assault patterns"""
        counter_attack = {
            "enabled": complexity > 0.4,
            "timing": {
                "delay_seconds": max(3, 20 - int(complexity * 12)),
                "opportunity_detection": complexity > 0.5,
                "predictive_timing": complexity > 0.7
            },
            "force_composition": {
                "counter_force_multiplier": 1.0 + (complexity * 0.8),
                "specialized_units": complexity > 0.6,
                "adaptive_composition": complexity > 0.8
            }
        }
        
        # Adapt counter-attacks based on assault patterns
        primary_pattern = assault_analysis.get("primary_pattern", "direct")
        
        if primary_pattern == "direct":
            counter_attack["strategy"] = "flanking_counter"
            counter_attack["timing"]["delay_seconds"] = max(5, counter_attack["timing"]["delay_seconds"])
        elif primary_pattern == "flanking":
            counter_attack["strategy"] = "center_reinforcement_counter"
            counter_attack["force_composition"]["defensive_focus"] = True
        elif primary_pattern == "coordinated":
            counter_attack["strategy"] = "disruption_counter"
            counter_attack["timing"]["opportunity_detection"] = True
        elif primary_pattern == "infiltration":
            counter_attack["strategy"] = "detection_and_elimination"
            counter_attack["force_composition"]["scout_emphasis"] = True
        
        # Predictability-based adjustments
        predictability = assault_analysis.get("predictability", 0.5)
        if predictability > 0.7 and complexity > 0.5:
            counter_attack["predictive_counters"] = {
                "enabled": True,
                "prediction_window": 30 + (complexity * 30),
                "counter_preparation": True
            }
        
        return counter_attack
    
    def _create_formation_tactics(self, assault_analysis: Dict, complexity: float) -> Dict[str, Any]:
        """Create formation tactics based on assault patterns and complexity"""
        tactics = {
            "basic_formations": ["defensive_circle", "scattered_defense"],
            "formation_switching": complexity > 0.4,
            "adaptive_formations": complexity > 0.6
        }
        
        # Add formations based on complexity
        if complexity > 0.3:
            tactics["basic_formations"].extend(["layered_defense", "mobile_defense"])
        
        if complexity > 0.5:
            tactics["advanced_formations"] = [
                "pincer_movement",
                "flanking_maneuvers",
                "coordinated_swarms"
            ]
        
        if complexity > 0.7:
            tactics["elite_formations"] = [
                "feint_attacks",
                "deceptive_positioning",
                "multi_vector_assault"
            ]
        
        # Adapt formations to counter specific assault patterns
        primary_pattern = assault_analysis.get("primary_pattern", "direct")
        
        if primary_pattern == "direct":
            tactics["counter_formations"] = ["layered_defense", "funnel_formation"]
        elif primary_pattern == "flanking":
            tactics["counter_formations"] = ["all_around_defense", "mobile_response"]
        elif primary_pattern == "coordinated":
            tactics["counter_formations"] = ["disruption_formation", "chaos_tactics"]
        elif primary_pattern == "infiltration":
            tactics["counter_formations"] = ["detection_grid", "patrol_formation"]
        
        return tactics
    
    def _create_adaptive_defense_rules(self, defensive_failures: list, complexity: float) -> Dict[str, Any]:
        """Create adaptive defense rules based on past failures"""
        rules = {
            "adaptation_speed": "slow" if complexity < 0.3 else "medium" if complexity < 0.7 else "fast",
            "learning_from_failures": True,
            "real_time_adaptation": complexity > 0.5,
            "predictive_adaptation": complexity > 0.7
        }
        
        # Analyze failures to create specific rules
        if defensive_failures:
            failure_patterns = self._categorize_defensive_failures(defensive_failures)
            
            rules["failure_counters"] = {}
            for failure_type in failure_patterns:
                if failure_type == "overwhelmed_by_numbers":
                    rules["failure_counters"]["number_disadvantage"] = {
                        "early_retreat_threshold": 0.6,
                        "call_for_reinforcements": True,
                        "hit_and_run_tactics": True
                    }
                elif failure_type == "poor_coordination":
                    rules["failure_counters"]["coordination_failure"] = {
                        "enhanced_communication": True,
                        "simplified_tactics": True,
                        "coordination_training": True
                    }
                elif failure_type == "predictable_behavior":
                    rules["failure_counters"]["predictability"] = {
                        "randomized_tactics": True,
                        "deceptive_maneuvers": complexity > 0.4,
                        "adaptive_behavior": True
                    }
        
        # Advanced adaptive rules
        if complexity > 0.6:
            rules["advanced_adaptation"] = {
                "meta_learning": True,
                "cross_situation_learning": True,
                "emergent_strategy_development": True
            }
        
        return rules
    
    def _create_threat_assessment_system(self, complexity: float) -> Dict[str, Any]:
        """Create threat assessment system for defensive decisions"""
        assessment = {
            "threat_detection_range": 60 + (complexity * 40),
            "assessment_frequency": "continuous" if complexity > 0.4 else "periodic",
            "threat_prioritization": complexity > 0.3,
            "predictive_threat_analysis": complexity > 0.6
        }
        
        # Threat classification system
        assessment["threat_levels"] = {
            "low": {"response": "monitor", "force_allocation": 0.2},
            "medium": {"response": "defensive_positioning", "force_allocation": 0.5},
            "high": {"response": "active_defense", "force_allocation": 0.8},
            "critical": {"response": "all_out_defense", "force_allocation": 1.0}
        }
        
        # Advanced threat assessment
        if complexity > 0.5:
            assessment["advanced_assessment"] = {
                "multi_factor_analysis": True,
                "threat_prediction": True,
                "dynamic_threat_modeling": True
            }
        
        return assessment
    
    def _create_coordination_protocols(self, complexity: float) -> Dict[str, Any]:
        """Create coordination protocols for defensive units"""
        protocols = {
            "communication_system": "basic" if complexity < 0.4 else "advanced",
            "command_structure": "centralized" if complexity < 0.6 else "distributed",
            "coordination_range": 50 + (complexity * 50),
            "response_time": max(1.0, 5.0 - (complexity * 3.0))
        }
        
        # Protocol complexity scaling
        if complexity > 0.4:
            protocols["advanced_protocols"] = {
                "situational_awareness": True,
                "dynamic_role_assignment": True,
                "coordinated_maneuvers": True
            }
        
        if complexity > 0.7:
            protocols["elite_protocols"] = {
                "predictive_coordination": True,
                "emergent_behavior": True,
                "adaptive_command_structure": True
            }
        
        return protocols
    
    def _analyze_defensive_failures(self, failures: list) -> List[str]:
        """Analyze defensive failures to identify patterns"""
        failure_types = []
        
        for failure in failures:
            if "overwhelmed" in failure.lower():
                failure_types.append("poor_retreat_timing")
            elif "coordination" in failure.lower():
                failure_types.append("poor_coordination")
            elif "predictable" in failure.lower():
                failure_types.append("predictable_retreats")
        
        return list(set(failure_types))
    
    def _categorize_defensive_failures(self, failures: list) -> List[str]:
        """Categorize defensive failures for learning"""
        categories = []
        
        for failure in failures:
            if isinstance(failure, str):
                if "overwhelmed" in failure or "outnumbered" in failure:
                    categories.append("overwhelmed_by_numbers")
                elif "coordination" in failure or "scattered" in failure:
                    categories.append("poor_coordination")
                elif "predictable" in failure or "pattern" in failure:
                    categories.append("predictable_behavior")
                else:
                    categories.append("unknown_failure")
        
        return list(set(categories))
    
    def _get_fallback_defensive_strategy(self, complexity: float) -> Dict[str, Any]:
        """Get fallback strategy when generation fails"""
        return {
            "strategy_type": "fallback_defense",
            "generation": 1,
            "swarm_coordination": {
                "enabled": True,
                "coordination_level": 0.3,
                "swarm_size": {"minimum": 3, "optimal": 8, "maximum": 15},
                "tactics": ["simple_coordination"]
            },
            "retreat_strategies": {
                "retreat_thresholds": {"health_percentage": 0.3, "overwhelming_force": 3.0},
                "retreat_patterns": ["scattered"],
                "repositioning": {"enabled": False}
            },
            "counter_attack": {"enabled": False},
            "formation_tactics": {
                "basic_formations": ["defensive_circle"],
                "formation_switching": False
            },
            "adaptive_rules": {"adaptation_speed": "slow", "learning_from_failures": True},
            "threat_assessment": {"threat_detection_range": 60, "assessment_frequency": "periodic"},
            "coordination_protocols": {"communication_system": "basic", "command_structure": "centralized"}
        }


class PredictiveBehaviorGenerator:
    """Generates predictive behavior strategies for advanced generations (Gen 4+)"""
    
    def __init__(self):
        self.prediction_history = []
        self.behavior_models = {}
        self.prediction_accuracy = {}
    
    async def generate(self, player_behavior_model: PlayerPatterns, prediction_horizon: int,
                      confidence_threshold: float, difficulty_modifiers: Dict[str, float] = None) -> Dict[str, Any]:
        """Generate comprehensive predictive behavior strategy for advanced AI"""
        try:
            logger.info(f"Generating predictive behavior with {prediction_horizon}s horizon")
            
            # Analyze player behavior patterns for prediction
            behavior_analysis = self._analyze_player_behavior_patterns(player_behavior_model)
            
            # Create behavioral predictions
            behavioral_predictions = self._create_behavioral_predictions(behavior_analysis, prediction_horizon)
            
            # Generate counter-strategies based on predictions
            counter_strategies = self._create_predictive_counter_strategies(behavioral_predictions, confidence_threshold)
            
            # Create adaptation triggers for prediction failures
            adaptation_triggers = self._create_adaptation_triggers(confidence_threshold)
            
            # Generate meta-learning strategies
            meta_learning = self._create_meta_learning_strategies(player_behavior_model)
            
            # Create psychological manipulation tactics
            psychological_tactics = self._create_psychological_tactics(behavior_analysis)
            
            strategy = {
                "strategy_type": "advanced_predictive_behavior",
                "prediction_horizon": prediction_horizon,
                "confidence_threshold": confidence_threshold,
                "behavioral_predictions": behavioral_predictions,
                "counter_strategies": counter_strategies,
                "adaptation_triggers": adaptation_triggers,
                "meta_learning": meta_learning,
                "psychological_tactics": psychological_tactics,
                "prediction_validation": self._create_prediction_validation_system(),
                "learning_feedback": self._create_learning_feedback_system()
            }
            
            logger.info(f"Predictive behavior strategy generated with {len(behavioral_predictions)} predictions")
            return strategy
            
        except Exception as e:
            logger.error(f"Error generating predictive behavior: {e}")
            return self._get_fallback_predictive_strategy(prediction_horizon, confidence_threshold)
    
    def _analyze_player_behavior_patterns(self, player_model: PlayerPatterns) -> Dict[str, Any]:
        """Analyze player behavior patterns to identify predictable elements"""
        if not player_model:
            return {"predictability": 0.3, "patterns": {}, "confidence": 0.3}
        
        analysis = {
            "player_type": player_model.player_profile.player_type,
            "confidence": player_model.player_profile.confidence,
            "pattern_strength": player_model.pattern_confidence,
            "predictable_behaviors": []
        }
        
        # Analyze mining patterns for predictability
        mining_patterns = player_model.mining_patterns
        if mining_patterns:
            mining_predictability = self._analyze_mining_predictability(mining_patterns)
            analysis["mining_predictability"] = mining_predictability
            if mining_predictability > 0.6:
                analysis["predictable_behaviors"].append("mining_expansion")
        
        # Analyze combat patterns for predictability
        combat_patterns = player_model.combat_patterns
        if combat_patterns:
            combat_predictability = self._analyze_combat_predictability(combat_patterns)
            analysis["combat_predictability"] = combat_predictability
            if combat_predictability > 0.6:
                analysis["predictable_behaviors"].append("assault_timing")
        
        # Analyze energy management patterns
        energy_patterns = player_model.energy_patterns
        if energy_patterns:
            energy_predictability = self._analyze_energy_predictability(energy_patterns)
            analysis["energy_predictability"] = energy_predictability
            if energy_predictability > 0.6:
                analysis["predictable_behaviors"].append("resource_management")
        
        # Calculate overall predictability
        predictability_scores = [
            analysis.get("mining_predictability", 0.3),
            analysis.get("combat_predictability", 0.3),
            analysis.get("energy_predictability", 0.3)
        ]
        analysis["overall_predictability"] = sum(predictability_scores) / len(predictability_scores)
        
        return analysis
    
    def _create_behavioral_predictions(self, behavior_analysis: Dict, horizon: int) -> Dict[str, Any]:
        """Create specific behavioral predictions based on analysis"""
        predictions = {}
        
        overall_predictability = behavior_analysis.get("overall_predictability", 0.3)
        predictable_behaviors = behavior_analysis.get("predictable_behaviors", [])
        
        # Mining expansion predictions
        if "mining_expansion" in predictable_behaviors:
            mining_pred = behavior_analysis.get("mining_predictability", 0.3)
            predictions["next_expansion_timing"] = {
                "predicted_time": self._predict_expansion_timing(behavior_analysis),
                "confidence": mining_pred,
                "prediction_window": horizon,
                "indicators": ["energy_threshold", "current_mining_efficiency", "exploration_pattern"]
            }
            
            predictions["expansion_location"] = {
                "predicted_zones": self._predict_expansion_zones(behavior_analysis),
                "confidence": mining_pred * 0.8,
                "prediction_window": horizon * 1.5
            }
        
        # Combat timing predictions
        if "assault_timing" in predictable_behaviors:
            combat_pred = behavior_analysis.get("combat_predictability", 0.3)
            predictions["assault_preparation_time"] = {
                "predicted_time": self._predict_assault_timing(behavior_analysis),
                "confidence": combat_pred,
                "prediction_window": horizon,
                "indicators": ["unit_buildup", "energy_accumulation", "exploration_completion"]
            }
            
            predictions["assault_strategy"] = {
                "predicted_approach": self._predict_assault_approach(behavior_analysis),
                "confidence": combat_pred * 0.9,
                "prediction_window": horizon * 0.8
            }
        
        # Resource management predictions
        if "resource_management" in predictable_behaviors:
            energy_pred = behavior_analysis.get("energy_predictability", 0.3)
            predictions["energy_spending_pattern"] = {
                "predicted_pattern": self._predict_energy_spending(behavior_analysis),
                "confidence": energy_pred,
                "prediction_window": horizon,
                "spending_priorities": self._predict_spending_priorities(behavior_analysis)
            }
        
        # Meta-predictions based on player type
        player_type = behavior_analysis.get("player_type", "balanced")
        predictions["strategic_phase_transition"] = {
            "next_phase": self._predict_strategic_phase(player_type, behavior_analysis),
            "confidence": overall_predictability * 0.7,
            "prediction_window": horizon * 2
        }
        
        return predictions
    
    def _create_predictive_counter_strategies(self, predictions: Dict, confidence_threshold: float) -> Dict[str, Any]:
        """Create counter-strategies based on behavioral predictions"""
        counter_strategies = {
            "preemptive_actions": [],
            "reactive_preparations": [],
            "contingency_plans": []
        }
        
        # Counter expansion predictions
        if "next_expansion_timing" in predictions:
            expansion_pred = predictions["next_expansion_timing"]
            if expansion_pred["confidence"] > confidence_threshold:
                counter_strategies["preemptive_actions"].append({
                    "action": "preemptive_spawning",
                    "timing": expansion_pred["predicted_time"] - 30,
                    "target": "predicted_expansion_zones",
                    "confidence": expansion_pred["confidence"]
                })
        
        # Counter assault predictions
        if "assault_preparation_time" in predictions:
            assault_pred = predictions["assault_preparation_time"]
            if assault_pred["confidence"] > confidence_threshold:
                counter_strategies["reactive_preparations"].append({
                    "action": "defensive_preparation",
                    "timing": assault_pred["predicted_time"] - 45,
                    "strategy": "counter_assault_formation",
                    "confidence": assault_pred["confidence"]
                })
        
        # Counter resource management predictions
        if "energy_spending_pattern" in predictions:
            energy_pred = predictions["energy_spending_pattern"]
            if energy_pred["confidence"] > confidence_threshold:
                counter_strategies["preemptive_actions"].append({
                    "action": "resource_disruption",
                    "timing": "continuous",
                    "target": "mining_operations",
                    "intensity": energy_pred["confidence"]
                })
        
        # Strategic counter-moves
        if "strategic_phase_transition" in predictions:
            phase_pred = predictions["strategic_phase_transition"]
            if phase_pred["confidence"] > confidence_threshold:
                counter_strategies["contingency_plans"].append({
                    "action": "phase_counter_strategy",
                    "trigger": phase_pred["next_phase"],
                    "strategy": self._create_phase_counter_strategy(phase_pred["next_phase"]),
                    "confidence": phase_pred["confidence"]
                })
        
        return counter_strategies
    
    def _create_adaptation_triggers(self, confidence_threshold: float) -> Dict[str, Any]:
        """Create triggers for adapting when predictions fail"""
        return {
            "prediction_failure_threshold": 1.0 - confidence_threshold,
            "adaptation_speed": "fast",
            "failure_learning": {
                "enabled": True,
                "learning_rate": 0.3,
                "pattern_adjustment": True
            },
            "triggers": {
                "pattern_deviation": {
                    "threshold": 0.4,
                    "response": "recalibrate_predictions",
                    "learning_adjustment": 0.2
                },
                "unexpected_behavior": {
                    "threshold": 0.5,
                    "response": "emergency_adaptation",
                    "learning_adjustment": 0.3
                },
                "strategy_failure": {
                    "threshold": 0.3,
                    "response": "strategy_revision",
                    "learning_adjustment": 0.4
                }
            }
        }
    
    def _create_meta_learning_strategies(self, player_model: PlayerPatterns) -> Dict[str, Any]:
        """Create meta-learning strategies for improving predictions"""
        return {
            "enabled": True,
            "learning_focus": [
                "prediction_accuracy_improvement",
                "pattern_recognition_enhancement",
                "behavioral_model_refinement"
            ],
            "adaptation_mechanisms": {
                "pattern_weight_adjustment": True,
                "confidence_calibration": True,
                "prediction_horizon_optimization": True
            },
            "cross_game_learning": {
                "enabled": True,
                "pattern_generalization": True,
                "player_archetype_learning": True
            },
            "emergent_behavior_detection": {
                "enabled": True,
                "novelty_detection_threshold": 0.6,
                "adaptation_to_novelty": True
            }
        }
    
    def _create_psychological_tactics(self, behavior_analysis: Dict) -> Dict[str, Any]:
        """Create psychological manipulation tactics for advanced AI"""
        tactics = {
            "enabled": True,
            "manipulation_level": "subtle",
            "tactics": []
        }
        
        player_type = behavior_analysis.get("player_type", "balanced")
        predictability = behavior_analysis.get("overall_predictability", 0.3)
        
        # Tactics based on player type
        if player_type == "aggressive":
            tactics["tactics"].extend([
                "false_weakness_display",
                "bait_and_trap",
                "overconfidence_exploitation"
            ])
        elif player_type == "defensive":
            tactics["tactics"].extend([
                "pressure_escalation",
                "patience_testing",
                "false_retreat"
            ])
        elif player_type == "economic":
            tactics["tactics"].extend([
                "resource_pressure",
                "expansion_disruption",
                "efficiency_undermining"
            ])
        
        # Advanced tactics for highly predictable players
        if predictability > 0.7:
            tactics["advanced_tactics"] = [
                "pattern_exploitation",
                "expectation_subversion",
                "behavioral_conditioning"
            ]
            tactics["manipulation_level"] = "advanced"
        
        return tactics
    
    def _create_prediction_validation_system(self) -> Dict[str, Any]:
        """Create system for validating prediction accuracy"""
        return {
            "validation_enabled": True,
            "accuracy_tracking": True,
            "prediction_logging": True,
            "validation_metrics": [
                "timing_accuracy",
                "behavioral_accuracy",
                "strategic_accuracy"
            ],
            "feedback_integration": {
                "real_time_adjustment": True,
                "learning_rate_adaptation": True,
                "confidence_recalibration": True
            }
        }
    
    def _create_learning_feedback_system(self) -> Dict[str, Any]:
        """Create feedback system for improving predictions"""
        return {
            "feedback_enabled": True,
            "learning_mechanisms": [
                "prediction_error_analysis",
                "pattern_strength_adjustment",
                "confidence_calibration"
            ],
            "adaptation_speed": "moderate",
            "feedback_integration": {
                "immediate_adjustment": True,
                "gradual_learning": True,
                "long_term_adaptation": True
            }
        }
    
    # Helper methods for specific predictions
    def _analyze_mining_predictability(self, mining_patterns: dict) -> float:
        """Analyze predictability of mining patterns"""
        if not mining_patterns:
            return 0.3
        
        # Check for consistent patterns
        consistency_score = 0.5
        if "expansion_timing" in mining_patterns:
            consistency_score += 0.2
        if "preferred_locations" in mining_patterns:
            consistency_score += 0.2
        if "resource_focus" in mining_patterns:
            consistency_score += 0.1
        
        return min(1.0, consistency_score)
    
    def _analyze_combat_predictability(self, combat_patterns: dict) -> float:
        """Analyze predictability of combat patterns"""
        if not combat_patterns:
            return 0.3
        
        consistency_score = 0.4
        if "timing_patterns" in combat_patterns:
            consistency_score += 0.3
        if "approach_vectors" in combat_patterns:
            consistency_score += 0.2
        if "unit_composition" in combat_patterns:
            consistency_score += 0.1
        
        return min(1.0, consistency_score)
    
    def _analyze_energy_predictability(self, energy_patterns: dict) -> float:
        """Analyze predictability of energy management patterns"""
        if not energy_patterns:
            return 0.3
        
        consistency_score = 0.4
        if "spending_patterns" in energy_patterns:
            consistency_score += 0.3
        if "conservation_behavior" in energy_patterns:
            consistency_score += 0.2
        if "priority_allocation" in energy_patterns:
            consistency_score += 0.1
        
        return min(1.0, consistency_score)
    
    def _predict_expansion_timing(self, behavior_analysis: Dict) -> int:
        """Predict when player will expand next"""
        # Base prediction on player type and patterns
        player_type = behavior_analysis.get("player_type", "balanced")
        
        if player_type == "aggressive":
            return 90  # 1.5 minutes
        elif player_type == "economic":
            return 60  # 1 minute
        elif player_type == "defensive":
            return 180  # 3 minutes
        else:
            return 120  # 2 minutes
    
    def _predict_expansion_zones(self, behavior_analysis: Dict) -> List[Dict]:
        """Predict where player will expand"""
        # Simplified prediction based on patterns
        return [
            {"zone": "resource_rich_area", "probability": 0.7},
            {"zone": "strategic_position", "probability": 0.5},
            {"zone": "safe_expansion", "probability": 0.6}
        ]
    
    def _predict_assault_timing(self, behavior_analysis: Dict) -> int:
        """Predict when player will assault"""
        player_type = behavior_analysis.get("player_type", "balanced")
        
        if player_type == "aggressive":
            return 150  # 2.5 minutes
        elif player_type == "defensive":
            return 300  # 5 minutes
        else:
            return 210  # 3.5 minutes
    
    def _predict_assault_approach(self, behavior_analysis: Dict) -> str:
        """Predict player's assault approach"""
        player_type = behavior_analysis.get("player_type", "balanced")
        
        if player_type == "aggressive":
            return "direct_assault"
        elif player_type == "defensive":
            return "coordinated_attack"
        else:
            return "flanking_maneuver"
    
    def _predict_energy_spending(self, behavior_analysis: Dict) -> str:
        """Predict player's energy spending pattern"""
        player_type = behavior_analysis.get("player_type", "balanced")
        
        if player_type == "economic":
            return "expansion_focused"
        elif player_type == "aggressive":
            return "unit_production_focused"
        else:
            return "balanced_spending"
    
    def _predict_spending_priorities(self, behavior_analysis: Dict) -> List[str]:
        """Predict player's spending priorities"""
        player_type = behavior_analysis.get("player_type", "balanced")
        
        if player_type == "economic":
            return ["mining_expansion", "worker_production", "efficiency_upgrades"]
        elif player_type == "aggressive":
            return ["unit_production", "combat_upgrades", "quick_expansion"]
        else:
            return ["balanced_expansion", "defensive_units", "strategic_positioning"]
    
    def _predict_strategic_phase(self, player_type: str, behavior_analysis: Dict) -> str:
        """Predict player's next strategic phase"""
        if player_type == "aggressive":
            return "assault_phase"
        elif player_type == "economic":
            return "expansion_phase"
        elif player_type == "defensive":
            return "consolidation_phase"
        else:
            return "adaptive_phase"
    
    def _create_phase_counter_strategy(self, predicted_phase: str) -> Dict[str, Any]:
        """Create counter-strategy for predicted phase"""
        strategies = {
            "assault_phase": {
                "strategy": "defensive_preparation",
                "actions": ["reinforce_defenses", "prepare_counter_attack", "disrupt_preparation"]
            },
            "expansion_phase": {
                "strategy": "expansion_disruption",
                "actions": ["target_expansions", "resource_harassment", "territorial_pressure"]
            },
            "consolidation_phase": {
                "strategy": "pressure_maintenance",
                "actions": ["continuous_harassment", "prevent_consolidation", "force_premature_action"]
            },
            "adaptive_phase": {
                "strategy": "unpredictable_behavior",
                "actions": ["random_tactics", "deceptive_maneuvers", "pattern_breaking"]
            }
        }
        
        return strategies.get(predicted_phase, strategies["adaptive_phase"])
    
    def _get_fallback_predictive_strategy(self, horizon: int, confidence_threshold: float) -> Dict[str, Any]:
        """Get fallback strategy when generation fails"""
        return {
            "strategy_type": "basic_predictive_behavior",
            "prediction_horizon": horizon,
            "confidence_threshold": confidence_threshold,
            "behavioral_predictions": {
                "next_expansion_timing": {"predicted_time": 120, "confidence": 0.4},
                "assault_preparation_time": {"predicted_time": 180, "confidence": 0.4}
            },
            "counter_strategies": {
                "preemptive_actions": [],
                "reactive_preparations": [],
                "contingency_plans": []
            },
            "adaptation_triggers": {
                "prediction_failure_threshold": 0.6,
                "adaptation_speed": "slow"
            },
            "meta_learning": {"enabled": False},
            "psychological_tactics": {"enabled": False},
            "prediction_validation": {"validation_enabled": True},
            "learning_feedback": {"feedback_enabled": True}
        }