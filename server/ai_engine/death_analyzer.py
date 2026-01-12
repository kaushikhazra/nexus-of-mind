"""
Death Analyzer - Analyzes Queen death circumstances for learning insights
"""

import logging
import math
from typing import Dict, Any, List, Tuple, Optional
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
        self.data_validator = DeathDataValidator()
    
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
            
            # Validate and sanitize death data
            validated_data = self.data_validator.validate_and_sanitize(death_data)
            
            # Spatial analysis
            spatial_analysis = await self.spatial_analyzer.analyze(validated_data)
            
            # Temporal analysis
            temporal_analysis = await self.timing_analyzer.analyze(validated_data)
            
            # Tactical analysis
            tactical_analysis = await self.pattern_recognizer.analyze(validated_data)
            
            # Create comprehensive death analysis
            analysis = DeathAnalysis(
                queen_id=validated_data.queen_id,
                generation=validated_data.generation,
                primary_cause=validated_data.death_cause,
                spatial_insights=spatial_analysis,
                temporal_insights=temporal_analysis,
                tactical_insights=tactical_analysis,
                survival_improvement=self._calculate_survival_improvement(validated_data),
                failed_strategies=self._identify_failed_strategies(validated_data, spatial_analysis, temporal_analysis, tactical_analysis),
                feature_vector=self._create_feature_vector(spatial_analysis, temporal_analysis, tactical_analysis),
                game_state_features=self._extract_game_state_features(validated_data)
            )
            
            logger.info(f"Death analysis completed for Queen {validated_data.queen_id}")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing death: {e}")
            raise
    
    def _calculate_survival_improvement(self, death_data: QueenDeathData) -> float:
        """Calculate potential survival time improvement based on death circumstances"""
        base_survival = 300.0  # 5 minutes baseline
        actual_survival = death_data.survival_time
        
        # Calculate improvement potential based on death cause
        improvement_multiplier = 1.0
        if death_data.death_cause == 'protector_assault':
            improvement_multiplier = 1.5  # More room for improvement against direct assault
        elif death_data.death_cause == 'worker_infiltration':
            improvement_multiplier = 1.2  # Moderate improvement potential
        elif death_data.death_cause == 'coordinated_attack':
            improvement_multiplier = 2.0  # High improvement potential for complex attacks
        
        # Factor in discovery time - faster discovery means more improvement potential
        discovery_factor = max(0.5, 1.0 - (death_data.hive_discovery_time / 300.0))
        
        improvement = ((actual_survival - base_survival) / base_survival) * improvement_multiplier * discovery_factor
        return max(0.0, min(2.0, improvement))  # Cap between 0 and 2
    
    def _identify_failed_strategies(self, death_data: QueenDeathData, spatial: Dict, temporal: Dict, tactical: Dict) -> List[int]:
        """Identify which strategies failed leading to death"""
        failed_strategies = []
        
        # Strategy 0: Hive placement - failed if discovered too quickly or poor placement score
        if (death_data.hive_discovery_time < 60 or 
            spatial.get('placement_score', 0.5) < 0.3):
            failed_strategies.append(0)
        
        # Strategy 1: Spawning strategy - failed if too few parasites or poor timing
        if (death_data.parasites_spawned < 5 or 
            temporal.get('spawn_timing_score', 0.5) < 0.3):
            failed_strategies.append(1)
        
        # Strategy 2: Defensive coordination - failed if poor defense effectiveness
        if tactical.get('defense_effectiveness', 0.5) < 0.3:
            failed_strategies.append(2)
        
        # Strategy 3: Resource management - failed if survived too short despite good placement
        if (death_data.survival_time < 180 and 
            spatial.get('placement_score', 0.5) > 0.7):
            failed_strategies.append(3)
        
        # Strategy 4: Adaptive behavior - failed if repeated similar death pattern
        if tactical.get('pattern_repetition', 0.0) > 0.7:
            failed_strategies.append(4)
        
        return failed_strategies
    
    def _create_feature_vector(self, spatial: Dict, temporal: Dict, tactical: Dict) -> List[float]:
        """Create comprehensive feature vector for neural network training"""
        return [
            # Spatial features (0-3)
            spatial.get('placement_score', 0.5),
            spatial.get('discovery_risk', 0.5),
            spatial.get('territorial_advantage', 0.5),
            spatial.get('escape_routes', 0.5),
            
            # Temporal features (4-6)
            temporal.get('survival_ratio', 0.5),
            temporal.get('spawn_timing_score', 0.5),
            temporal.get('discovery_speed_ratio', 0.5),
            
            # Tactical features (7-9)
            tactical.get('defense_effectiveness', 0.5),
            tactical.get('assault_resistance', 0.5),
            tactical.get('coordination_counter', 0.5)
        ]
    
    def _extract_game_state_features(self, death_data: QueenDeathData) -> List[float]:
        """Extract comprehensive game state features for neural network"""
        features = [0.5] * 20  # Default neutral values
        
        if death_data.game_state:
            game_state = death_data.game_state
            
            # Energy and resource features (0-3)
            features[0] = min(1.0, game_state.get('energy_level', 500) / 1000.0)
            features[1] = min(1.0, len(game_state.get('active_mining', [])) / 10.0)
            features[2] = min(1.0, game_state.get('territory_control', 0.5))
            features[3] = min(1.0, game_state.get('resource_efficiency', 0.5))
            
            # Unit composition features (4-7)
            player_units = death_data.player_units
            protectors = player_units.get('protectors', [])
            workers = player_units.get('workers', [])
            
            features[4] = min(1.0, len(protectors) / 20.0)
            features[5] = min(1.0, len(workers) / 30.0)
            features[6] = len(protectors) / max(1, len(protectors) + len(workers))  # Unit ratio
            features[7] = min(1.0, game_state.get('unit_coordination', 0.5))
            
            # Exploration and positioning features (8-11)
            features[8] = min(1.0, len(game_state.get('explored_areas', [])) / 50.0)
            features[9] = min(1.0, game_state.get('map_control', 0.5))
            features[10] = min(1.0, game_state.get('strategic_positions', 0.5))
            features[11] = min(1.0, game_state.get('expansion_rate', 0.5))
            
            # Combat and pressure features (12-15)
            features[12] = min(1.0, game_state.get('combat_intensity', 0.5))
            features[13] = min(1.0, game_state.get('territorial_pressure', 0.5))
            features[14] = min(1.0, game_state.get('threat_level', 0.5))
            features[15] = min(1.0, game_state.get('defensive_strength', 0.5))
            
            # Timing and progression features (16-19)
            features[16] = min(1.0, game_state.get('game_phase', 0.5))
            features[17] = min(1.0, death_data.survival_time / 600.0)
            features[18] = min(1.0, death_data.generation / 10.0)
            features[19] = min(1.0, game_state.get('learning_progress', 0.5))
        
        return features


class DeathDataValidator:
    """Validates and sanitizes Queen death data"""
    
    def __init__(self):
        self.validation_rules = {
            'survival_time': {'min': 0.0, 'max': 3600.0},  # 0 to 1 hour
            'hive_discovery_time': {'min': 0.0, 'max': 1800.0},  # 0 to 30 minutes
            'parasites_spawned': {'min': 0, 'max': 100},  # 0 to 100 parasites
            'generation': {'min': 1, 'max': 50}  # 1 to 50 generations
        }
    
    def validate_and_sanitize(self, death_data: QueenDeathData) -> QueenDeathData:
        """
        Validate and sanitize death data to ensure consistency and correctness
        
        Args:
            death_data: Raw Queen death data
            
        Returns:
            Validated and sanitized QueenDeathData
        """
        try:
            logger.info(f"Validating death data for Queen {death_data.queen_id}")
            
            # Create a copy to avoid modifying original
            validated_data = QueenDeathData(
                queen_id=self._validate_string(death_data.queen_id, 'queen_id'),
                territory_id=self._validate_string(death_data.territory_id, 'territory_id'),
                generation=self._validate_numeric(death_data.generation, 'generation'),
                death_location=self._validate_location(death_data.death_location),
                death_cause=self._validate_death_cause(death_data.death_cause),
                survival_time=self._validate_numeric(death_data.survival_time, 'survival_time'),
                parasites_spawned=self._validate_numeric(death_data.parasites_spawned, 'parasites_spawned'),
                hive_discovery_time=self._validate_numeric(death_data.hive_discovery_time, 'hive_discovery_time'),
                player_units=self._validate_player_units(death_data.player_units),
                assault_pattern=self._validate_assault_pattern(death_data.assault_pattern),
                game_state=self._validate_game_state(death_data.game_state),
                timestamp=self._validate_timestamp(death_data.timestamp)
            )
            
            # Perform cross-field validation
            validated_data = self._cross_validate_fields(validated_data)
            
            logger.info(f"Death data validation completed for Queen {validated_data.queen_id}")
            return validated_data
            
        except Exception as e:
            logger.error(f"Error validating death data: {e}")
            # Return sanitized version with defaults
            return self._create_fallback_data(death_data)
    
    def _validate_string(self, value: str, field_name: str) -> str:
        """Validate and sanitize string fields"""
        if not isinstance(value, str):
            logger.warning(f"Invalid {field_name}: {value}, using default")
            return f"unknown_{field_name}"
        
        # Remove potentially harmful characters
        sanitized = ''.join(c for c in value if c.isalnum() or c in '-_')
        
        if not sanitized:
            return f"unknown_{field_name}"
        
        return sanitized[:50]  # Limit length
    
    def _validate_numeric(self, value: float, field_name: str) -> float:
        """Validate and sanitize numeric fields"""
        try:
            numeric_value = float(value)
            
            if field_name in self.validation_rules:
                rules = self.validation_rules[field_name]
                min_val = rules.get('min', float('-inf'))
                max_val = rules.get('max', float('inf'))
                
                if numeric_value < min_val:
                    logger.warning(f"{field_name} below minimum ({numeric_value} < {min_val}), clamping")
                    return min_val
                elif numeric_value > max_val:
                    logger.warning(f"{field_name} above maximum ({numeric_value} > {max_val}), clamping")
                    return max_val
            
            # Check for NaN or infinite values
            if math.isnan(numeric_value) or math.isinf(numeric_value):
                logger.warning(f"Invalid {field_name}: {numeric_value}, using default")
                return self._get_default_numeric(field_name)
            
            return numeric_value
            
        except (ValueError, TypeError):
            logger.warning(f"Invalid {field_name}: {value}, using default")
            return self._get_default_numeric(field_name)
    
    def _validate_location(self, location: Dict[str, float]) -> Dict[str, float]:
        """Validate and sanitize location data"""
        if not isinstance(location, dict):
            logger.warning(f"Invalid location format: {location}, using default")
            return {'x': 0.0, 'y': 0.0, 'z': 0.0}
        
        validated_location = {}
        for coord in ['x', 'y', 'z']:
            value = location.get(coord, 0.0)
            try:
                coord_value = float(value)
                # Clamp coordinates to reasonable bounds
                coord_value = max(-200.0, min(200.0, coord_value))
                validated_location[coord] = coord_value
            except (ValueError, TypeError):
                logger.warning(f"Invalid {coord} coordinate: {value}, using 0.0")
                validated_location[coord] = 0.0
        
        return validated_location
    
    def _validate_death_cause(self, death_cause: str) -> str:
        """Validate death cause"""
        valid_causes = [
            'protector_assault',
            'worker_infiltration',
            'coordinated_attack',
            'resource_depletion',
            'timeout',
            'unknown'
        ]
        
        if death_cause in valid_causes:
            return death_cause
        else:
            logger.warning(f"Invalid death cause: {death_cause}, using 'unknown'")
            return 'unknown'
    
    def _validate_player_units(self, player_units: Dict) -> Dict:
        """Validate and sanitize player units data"""
        if not isinstance(player_units, dict):
            logger.warning("Invalid player_units format, using defaults")
            return {'protectors': [], 'workers': []}
        
        validated_units = {}
        
        for unit_type in ['protectors', 'workers']:
            units = player_units.get(unit_type, [])
            if not isinstance(units, list):
                logger.warning(f"Invalid {unit_type} format, using empty list")
                validated_units[unit_type] = []
                continue
            
            validated_unit_list = []
            for unit in units[:50]:  # Limit to 50 units per type
                if isinstance(unit, dict):
                    validated_unit = self._validate_unit_data(unit)
                    validated_unit_list.append(validated_unit)
            
            validated_units[unit_type] = validated_unit_list
        
        return validated_units
    
    def _validate_unit_data(self, unit: Dict) -> Dict:
        """Validate individual unit data"""
        validated_unit = {}
        
        # Validate unit position
        if 'position' in unit and isinstance(unit['position'], dict):
            validated_unit['position'] = self._validate_location(unit['position'])
        else:
            validated_unit['position'] = {'x': 0.0, 'y': 0.0, 'z': 0.0}
        
        # Validate unit type
        unit_type = unit.get('type', 'unknown')
        if isinstance(unit_type, str):
            validated_unit['type'] = unit_type[:20]  # Limit length
        else:
            validated_unit['type'] = 'unknown'
        
        # Validate unit health
        health = unit.get('health', 100.0)
        validated_unit['health'] = max(0.0, min(1000.0, float(health) if isinstance(health, (int, float)) else 100.0))
        
        return validated_unit
    
    def _validate_assault_pattern(self, assault_pattern: Dict) -> Dict:
        """Validate assault pattern data"""
        if not isinstance(assault_pattern, dict):
            logger.warning("Invalid assault_pattern format, using defaults")
            return self._get_default_assault_pattern()
        
        validated_pattern = {}
        
        # Validate pattern type
        pattern_type = assault_pattern.get('type', 'unknown')
        valid_types = ['direct', 'flanking', 'coordinated', 'infiltration', 'siege', 'hit_and_run', 'unknown']
        if pattern_type in valid_types:
            validated_pattern['type'] = pattern_type
        else:
            validated_pattern['type'] = 'unknown'
        
        # Validate coordination level
        coordination = assault_pattern.get('coordination', 0.5)
        validated_pattern['coordination'] = max(0.0, min(1.0, float(coordination) if isinstance(coordination, (int, float)) else 0.5))
        
        # Validate timing coordination
        timing_coordination = assault_pattern.get('timing_coordination', 0.5)
        validated_pattern['timing_coordination'] = max(0.0, min(1.0, float(timing_coordination) if isinstance(timing_coordination, (int, float)) else 0.5))
        
        return validated_pattern
    
    def _validate_game_state(self, game_state: Dict) -> Dict:
        """Validate game state data"""
        if not isinstance(game_state, dict):
            logger.warning("Invalid game_state format, using defaults")
            return self._get_default_game_state()
        
        validated_state = {}
        
        # Validate energy level
        energy_level = game_state.get('energy_level', 500)
        validated_state['energy_level'] = max(0, min(10000, int(energy_level) if isinstance(energy_level, (int, float)) else 500))
        
        # Validate active mining
        active_mining = game_state.get('active_mining', [])
        if isinstance(active_mining, list):
            validated_mining = []
            for site in active_mining[:20]:  # Limit to 20 mining sites
                if isinstance(site, dict) and 'position' in site:
                    validated_site = {
                        'position': self._validate_location(site['position']),
                        'yield': max(0.0, min(100.0, float(site.get('yield', 10.0)) if isinstance(site.get('yield'), (int, float)) else 10.0))
                    }
                    validated_mining.append(validated_site)
            validated_state['active_mining'] = validated_mining
        else:
            validated_state['active_mining'] = []
        
        # Validate other game state fields with defaults
        numeric_fields = {
            'territory_control': 0.5,
            'resource_efficiency': 0.5,
            'unit_coordination': 0.5,
            'map_control': 0.5,
            'strategic_positions': 0.5,
            'expansion_rate': 0.5,
            'combat_intensity': 0.5,
            'territorial_pressure': 0.5,
            'threat_level': 0.5,
            'defensive_strength': 0.5,
            'game_phase': 0.5,
            'learning_progress': 0.5
        }
        
        for field, default_value in numeric_fields.items():
            value = game_state.get(field, default_value)
            validated_state[field] = max(0.0, min(1.0, float(value) if isinstance(value, (int, float)) else default_value))
        
        # Validate explored areas
        explored_areas = game_state.get('explored_areas', [])
        if isinstance(explored_areas, list):
            validated_state['explored_areas'] = explored_areas[:100]  # Limit to 100 areas
        else:
            validated_state['explored_areas'] = []
        
        return validated_state
    
    def _validate_timestamp(self, timestamp: float) -> float:
        """Validate timestamp"""
        try:
            ts = float(timestamp)
            # Check if timestamp is reasonable (not too far in past or future)
            import time
            current_time = time.time()
            if abs(ts - current_time) > 86400 * 365:  # More than 1 year difference
                logger.warning(f"Suspicious timestamp: {ts}, using current time")
                return current_time
            return ts
        except (ValueError, TypeError):
            import time
            logger.warning(f"Invalid timestamp: {timestamp}, using current time")
            return time.time()
    
    def _cross_validate_fields(self, data: QueenDeathData) -> QueenDeathData:
        """Perform cross-field validation to ensure logical consistency"""
        # Ensure hive discovery time doesn't exceed survival time
        if data.hive_discovery_time > data.survival_time:
            logger.warning(f"Discovery time ({data.hive_discovery_time}) > survival time ({data.survival_time}), adjusting")
            data.hive_discovery_time = min(data.hive_discovery_time, data.survival_time * 0.8)
        
        # Ensure parasites spawned is reasonable for survival time
        max_possible_parasites = int(data.survival_time / 10.0)  # 1 parasite per 10 seconds max
        if data.parasites_spawned > max_possible_parasites:
            logger.warning(f"Too many parasites ({data.parasites_spawned}) for survival time, adjusting")
            data.parasites_spawned = max_possible_parasites
        
        # Ensure generation is positive
        if data.generation < 1:
            logger.warning(f"Invalid generation ({data.generation}), setting to 1")
            data.generation = 1
        
        return data
    
    def _get_default_numeric(self, field_name: str) -> float:
        """Get default value for numeric fields"""
        defaults = {
            'survival_time': 180.0,
            'hive_discovery_time': 90.0,
            'parasites_spawned': 5.0,
            'generation': 1.0,
            'timestamp': 0.0
        }
        return defaults.get(field_name, 0.0)
    
    def _get_default_assault_pattern(self) -> Dict[str, Any]:
        """Get default assault pattern"""
        return {
            'type': 'unknown',
            'coordination': 0.5,
            'timing_coordination': 0.5
        }
    
    def _get_default_game_state(self) -> Dict[str, Any]:
        """Get default game state"""
        return {
            'energy_level': 500,
            'active_mining': [],
            'territory_control': 0.5,
            'resource_efficiency': 0.5,
            'unit_coordination': 0.5,
            'map_control': 0.5,
            'strategic_positions': 0.5,
            'expansion_rate': 0.5,
            'combat_intensity': 0.5,
            'territorial_pressure': 0.5,
            'threat_level': 0.5,
            'defensive_strength': 0.5,
            'game_phase': 0.5,
            'learning_progress': 0.5,
            'explored_areas': []
        }
    
    def _create_fallback_data(self, original_data: QueenDeathData) -> QueenDeathData:
        """Create fallback data when validation fails completely"""
        logger.warning("Creating fallback death data due to validation failure")
        
        return QueenDeathData(
            queen_id=getattr(original_data, 'queen_id', 'unknown_queen'),
            territory_id=getattr(original_data, 'territory_id', 'unknown_territory'),
            generation=max(1, getattr(original_data, 'generation', 1)),
            death_location={'x': 0.0, 'y': 0.0, 'z': 0.0},
            death_cause='unknown',
            survival_time=180.0,
            parasites_spawned=5,
            hive_discovery_time=90.0,
            player_units={'protectors': [], 'workers': []},
            assault_pattern=self._get_default_assault_pattern(),
            game_state=self._get_default_game_state(),
            timestamp=0.0
        )


class AssaultPatternRecognizer:
    """Recognizes and classifies player assault patterns"""
    
    def __init__(self):
        self.pattern_history = []
        self.pattern_weights = {
            'direct': 1.0,
            'flanking': 1.2,
            'coordinated': 1.5,
            'infiltration': 1.3,
            'siege': 1.4,
            'hit_and_run': 1.1
        }
    
    async def analyze(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze assault patterns and player behavior classification"""
        try:
            # Extract assault pattern from death data
            assault_pattern = death_data.assault_pattern
            player_units = death_data.player_units
            
            # Classify assault pattern
            pattern_type = self._classify_assault_pattern(assault_pattern, player_units, death_data)
            
            # Analyze coordination level
            coordination_level = self._analyze_coordination(player_units, assault_pattern)
            
            # Calculate assault effectiveness
            effectiveness = self._calculate_assault_effectiveness(death_data, pattern_type)
            
            # Detect pattern repetition
            pattern_repetition = self._detect_pattern_repetition(pattern_type)
            
            # Analyze unit composition strategy
            unit_strategy = self._analyze_unit_composition(player_units)
            
            # Calculate defense penetration
            defense_penetration = self._calculate_defense_penetration(death_data, pattern_type)
            
            # Store pattern for future analysis
            self.pattern_history.append({
                'pattern_type': pattern_type,
                'timestamp': death_data.timestamp,
                'effectiveness': effectiveness
            })
            
            return {
                'pattern_type': pattern_type,
                'coordination_level': coordination_level,
                'effectiveness': effectiveness,
                'pattern_repetition': pattern_repetition,
                'unit_strategy': unit_strategy,
                'defense_penetration': defense_penetration,
                'assault_resistance': 1.0 - effectiveness,
                'defense_effectiveness': max(0.0, 1.0 - defense_penetration),
                'spawn_effectiveness': min(1.0, death_data.parasites_spawned / 10.0),
                'parasites_spawned': death_data.parasites_spawned,
                'defensive_failures': self._identify_defensive_failures(death_data, pattern_type)
            }
            
        except Exception as e:
            logger.error(f"Error in assault pattern analysis: {e}")
            return self._get_default_tactical_analysis()
    
    def _classify_assault_pattern(self, assault_pattern: Dict, player_units: Dict, death_data: QueenDeathData) -> str:
        """Classify the type of assault pattern used"""
        protectors = player_units.get('protectors', [])
        workers = player_units.get('workers', [])
        
        # Direct assault: High protector count, low coordination
        if len(protectors) > 8 and len(workers) < 3:
            return 'direct'
        
        # Infiltration: High worker count, low protector count
        elif len(workers) > 10 and len(protectors) < 5:
            return 'infiltration'
        
        # Coordinated attack: Balanced units with high coordination
        elif len(protectors) >= 5 and len(workers) >= 5:
            coordination_score = assault_pattern.get('coordination', 0.5)
            if coordination_score > 0.7:
                return 'coordinated'
            else:
                return 'flanking'
        
        # Siege: Slow methodical approach
        elif death_data.hive_discovery_time > 180:
            return 'siege'
        
        # Hit and run: Quick discovery, moderate units
        elif death_data.hive_discovery_time < 60 and death_data.survival_time < 120:
            return 'hit_and_run'
        
        # Default to direct if unclear
        return 'direct'
    
    def _analyze_coordination(self, player_units: Dict, assault_pattern: Dict) -> float:
        """Analyze the coordination level of the assault"""
        protectors = player_units.get('protectors', [])
        workers = player_units.get('workers', [])
        
        # Base coordination from assault pattern
        base_coordination = assault_pattern.get('coordination', 0.5)
        
        # Unit positioning coordination
        position_coordination = self._calculate_position_coordination(protectors, workers)
        
        # Timing coordination
        timing_coordination = assault_pattern.get('timing_coordination', 0.5)
        
        # Combined coordination score
        coordination = (base_coordination * 0.4 + 
                       position_coordination * 0.4 + 
                       timing_coordination * 0.2)
        
        return min(1.0, max(0.0, coordination))
    
    def _calculate_position_coordination(self, protectors: List, workers: List) -> float:
        """Calculate coordination based on unit positioning"""
        if not protectors and not workers:
            return 0.0
        
        # Simple coordination metric based on unit clustering
        total_units = len(protectors) + len(workers)
        if total_units < 2:
            return 0.5
        
        # Calculate average distance between units (simplified)
        avg_distance = 0.5  # Placeholder - would calculate actual distances
        
        # Closer units indicate better coordination
        coordination = max(0.0, 1.0 - (avg_distance / 100.0))
        return coordination
    
    def _calculate_assault_effectiveness(self, death_data: QueenDeathData, pattern_type: str) -> float:
        """Calculate how effective the assault was"""
        # Base effectiveness from pattern type
        base_effectiveness = self.pattern_weights.get(pattern_type, 1.0) / 1.5
        
        # Time efficiency factor
        time_factor = max(0.1, 1.0 - (death_data.survival_time / 600.0))
        
        # Discovery efficiency factor
        discovery_factor = max(0.1, 1.0 - (death_data.hive_discovery_time / 300.0))
        
        # Parasite disruption factor
        parasite_factor = max(0.1, 1.0 - (death_data.parasites_spawned / 20.0))
        
        effectiveness = (base_effectiveness * 0.4 + 
                        time_factor * 0.3 + 
                        discovery_factor * 0.2 + 
                        parasite_factor * 0.1)
        
        return min(1.0, max(0.0, effectiveness))
    
    def _detect_pattern_repetition(self, current_pattern: str) -> float:
        """Detect if player is repeating assault patterns"""
        if len(self.pattern_history) < 3:
            return 0.0
        
        recent_patterns = [p['pattern_type'] for p in self.pattern_history[-3:]]
        repetition_count = recent_patterns.count(current_pattern)
        
        return min(1.0, repetition_count / 3.0)
    
    def _analyze_unit_composition(self, player_units: Dict) -> Dict[str, Any]:
        """Analyze player unit composition strategy"""
        protectors = player_units.get('protectors', [])
        workers = player_units.get('workers', [])
        
        total_units = len(protectors) + len(workers)
        if total_units == 0:
            return {'strategy': 'unknown', 'balance': 0.5}
        
        protector_ratio = len(protectors) / total_units
        
        if protector_ratio > 0.7:
            strategy = 'combat_focused'
        elif protector_ratio < 0.3:
            strategy = 'economic_focused'
        else:
            strategy = 'balanced'
        
        return {
            'strategy': strategy,
            'balance': 1.0 - abs(0.5 - protector_ratio) * 2,
            'total_units': total_units,
            'protector_ratio': protector_ratio
        }
    
    def _calculate_defense_penetration(self, death_data: QueenDeathData, pattern_type: str) -> float:
        """Calculate how well the assault penetrated Queen defenses"""
        # Base penetration based on pattern effectiveness
        base_penetration = self.pattern_weights.get(pattern_type, 1.0) / 1.5
        
        # Adjust based on parasites spawned (more parasites = better defense)
        parasite_defense = min(1.0, death_data.parasites_spawned / 15.0)
        defense_factor = 1.0 - parasite_defense
        
        # Adjust based on survival time (longer survival = better defense)
        survival_factor = min(1.0, death_data.survival_time / 300.0)
        time_factor = 1.0 - survival_factor
        
        penetration = (base_penetration * 0.5 + 
                      defense_factor * 0.3 + 
                      time_factor * 0.2)
        
        return min(1.0, max(0.0, penetration))
    
    def _identify_defensive_failures(self, death_data: QueenDeathData, pattern_type: str) -> List[str]:
        """Identify specific defensive failures"""
        failures = []
        
        # Quick discovery failure
        if death_data.hive_discovery_time < 60:
            failures.append('poor_concealment')
        
        # Insufficient parasite spawning
        if death_data.parasites_spawned < 5:
            failures.append('inadequate_spawning')
        
        # Poor survival against specific patterns
        if pattern_type == 'direct' and death_data.survival_time < 120:
            failures.append('weak_direct_defense')
        elif pattern_type == 'infiltration' and death_data.parasites_spawned < 8:
            failures.append('poor_infiltration_counter')
        elif pattern_type == 'coordinated' and death_data.survival_time < 180:
            failures.append('coordination_vulnerability')
        
        return failures
    
    def _get_default_tactical_analysis(self) -> Dict[str, Any]:
        """Return default tactical analysis in case of errors"""
        return {
            'pattern_type': 'unknown',
            'coordination_level': 0.5,
            'effectiveness': 0.5,
            'pattern_repetition': 0.0,
            'unit_strategy': {'strategy': 'unknown', 'balance': 0.5},
            'defense_penetration': 0.5,
            'assault_resistance': 0.5,
            'defense_effectiveness': 0.5,
            'spawn_effectiveness': 0.5,
            'parasites_spawned': 0,
            'defensive_failures': []
        }


class TimingAnalyzer:
    """Analyzes timing aspects of Queen death and player behavior"""
    
    def __init__(self):
        self.timing_history = []
        self.baseline_metrics = {
            'survival_time': 300.0,  # 5 minutes
            'discovery_time': 120.0,  # 2 minutes
            'spawn_interval': 30.0   # 30 seconds
        }
    
    async def analyze(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze timing patterns and temporal aspects"""
        try:
            # Calculate survival metrics
            survival_analysis = self._analyze_survival_timing(death_data)
            
            # Calculate discovery timing
            discovery_analysis = self._analyze_discovery_timing(death_data)
            
            # Calculate spawning timing effectiveness
            spawn_analysis = self._analyze_spawn_timing(death_data)
            
            # Analyze assault timing patterns
            assault_timing = self._analyze_assault_timing(death_data)
            
            # Calculate temporal pressure metrics
            pressure_analysis = self._analyze_temporal_pressure(death_data)
            
            # Store timing data for trend analysis
            self.timing_history.append({
                'survival_time': death_data.survival_time,
                'discovery_time': death_data.hive_discovery_time,
                'parasites_spawned': death_data.parasites_spawned,
                'timestamp': death_data.timestamp
            })
            
            return {
                'survival_ratio': survival_analysis['ratio'],
                'survival_improvement': survival_analysis['improvement'],
                'discovery_speed_ratio': discovery_analysis['speed_ratio'],
                'discovery_efficiency': discovery_analysis['efficiency'],
                'spawn_timing_score': spawn_analysis['timing_score'],
                'spawn_rate': spawn_analysis['spawn_rate'],
                'assault_timing': assault_timing,
                'temporal_pressure': pressure_analysis,
                'phase_analysis': self._analyze_game_phases(death_data),
                'timing_trends': self._analyze_timing_trends()
            }
            
        except Exception as e:
            logger.error(f"Error in timing analysis: {e}")
            return self._get_default_timing_analysis()
    
    def _analyze_survival_timing(self, death_data: QueenDeathData) -> Dict[str, float]:
        """Analyze Queen survival time metrics"""
        survival_time = death_data.survival_time
        baseline = self.baseline_metrics['survival_time']
        
        # Calculate survival ratio
        survival_ratio = min(1.0, survival_time / baseline)
        
        # Calculate improvement potential
        if len(self.timing_history) > 0:
            recent_avg = sum(h['survival_time'] for h in self.timing_history[-5:]) / min(5, len(self.timing_history))
            improvement = (survival_time - recent_avg) / recent_avg if recent_avg > 0 else 0.0
        else:
            improvement = 0.0
        
        return {
            'ratio': survival_ratio,
            'improvement': max(-1.0, min(1.0, improvement)),
            'absolute_time': survival_time,
            'baseline_comparison': survival_time / baseline
        }
    
    def _analyze_discovery_timing(self, death_data: QueenDeathData) -> Dict[str, float]:
        """Analyze hive discovery timing patterns"""
        discovery_time = death_data.hive_discovery_time
        baseline = self.baseline_metrics['discovery_time']
        
        # Speed ratio (lower is faster discovery)
        speed_ratio = discovery_time / baseline
        
        # Discovery efficiency (how quickly player found hive)
        efficiency = max(0.0, 1.0 - (discovery_time / 300.0))  # 5 minutes max
        
        # Discovery pressure (how much pressure discovery time put on Queen)
        pressure = max(0.0, 1.0 - (discovery_time / 180.0))  # 3 minutes threshold
        
        return {
            'speed_ratio': min(2.0, speed_ratio),
            'efficiency': efficiency,
            'pressure': pressure,
            'absolute_time': discovery_time
        }
    
    def _analyze_spawn_timing(self, death_data: QueenDeathData) -> Dict[str, float]:
        """Analyze parasite spawning timing effectiveness"""
        survival_time = death_data.survival_time
        parasites_spawned = death_data.parasites_spawned
        
        if survival_time <= 0:
            return {'timing_score': 0.0, 'spawn_rate': 0.0}
        
        # Calculate spawn rate (parasites per minute)
        spawn_rate = (parasites_spawned / survival_time) * 60.0
        
        # Optimal spawn rate is around 10-15 parasites per minute
        optimal_rate = 12.0
        rate_efficiency = max(0.0, 1.0 - abs(spawn_rate - optimal_rate) / optimal_rate)
        
        # Timing score based on when spawning occurred relative to discovery
        discovery_time = death_data.hive_discovery_time
        if discovery_time > 0:
            spawn_timing_ratio = min(1.0, parasites_spawned / (discovery_time / 30.0))  # Expected 1 parasite per 30 seconds
        else:
            spawn_timing_ratio = 0.0
        
        timing_score = (rate_efficiency * 0.6 + spawn_timing_ratio * 0.4)
        
        return {
            'timing_score': timing_score,
            'spawn_rate': spawn_rate,
            'rate_efficiency': rate_efficiency,
            'spawn_timing_ratio': spawn_timing_ratio
        }
    
    def _analyze_assault_timing(self, death_data: QueenDeathData) -> Dict[str, float]:
        """Analyze player assault timing patterns"""
        discovery_time = death_data.hive_discovery_time
        survival_time = death_data.survival_time
        
        # Calculate assault duration (time from discovery to death)
        assault_duration = max(0.0, survival_time - discovery_time)
        
        # Assault intensity (how quickly player acted after discovery)
        if discovery_time > 0:
            assault_intensity = max(0.0, 1.0 - (assault_duration / 120.0))  # 2 minutes baseline
        else:
            assault_intensity = 1.0  # Immediate assault
        
        # Assault efficiency (how effectively time was used)
        if assault_duration > 0:
            assault_efficiency = min(1.0, 60.0 / assault_duration)  # 1 minute optimal
        else:
            assault_efficiency = 1.0
        
        return {
            'assault_duration': assault_duration,
            'assault_intensity': assault_intensity,
            'assault_efficiency': assault_efficiency,
            'discovery_to_death_ratio': assault_duration / max(1.0, discovery_time)
        }
    
    def _analyze_temporal_pressure(self, death_data: QueenDeathData) -> Dict[str, float]:
        """Analyze temporal pressure patterns"""
        survival_time = death_data.survival_time
        discovery_time = death_data.hive_discovery_time
        parasites_spawned = death_data.parasites_spawned
        
        # Early pressure (pressure in first 2 minutes)
        early_pressure = max(0.0, 1.0 - (discovery_time / 120.0)) if discovery_time > 0 else 1.0
        
        # Sustained pressure (consistent pressure throughout survival)
        if survival_time > 0:
            spawn_consistency = min(1.0, parasites_spawned / (survival_time / 20.0))  # Expected 1 per 20 seconds
        else:
            spawn_consistency = 0.0
        
        # End game pressure (pressure in final phase)
        final_phase_duration = max(0.0, survival_time - discovery_time)
        if final_phase_duration > 0:
            end_pressure = min(1.0, 60.0 / final_phase_duration)  # High pressure if quick death after discovery
        else:
            end_pressure = 1.0
        
        return {
            'early_pressure': early_pressure,
            'sustained_pressure': spawn_consistency,
            'end_pressure': end_pressure,
            'overall_pressure': (early_pressure * 0.3 + spawn_consistency * 0.4 + end_pressure * 0.3)
        }
    
    def _analyze_game_phases(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze performance in different game phases"""
        survival_time = death_data.survival_time
        discovery_time = death_data.hive_discovery_time
        
        # Define phase boundaries
        early_phase = min(120.0, discovery_time)  # First 2 minutes or until discovery
        mid_phase = max(0.0, min(180.0, survival_time - early_phase))  # Next 3 minutes
        late_phase = max(0.0, survival_time - early_phase - mid_phase)  # Remaining time
        
        return {
            'early_phase_duration': early_phase,
            'mid_phase_duration': mid_phase,
            'late_phase_duration': late_phase,
            'phase_distribution': {
                'early': early_phase / max(1.0, survival_time),
                'mid': mid_phase / max(1.0, survival_time),
                'late': late_phase / max(1.0, survival_time)
            },
            'dominant_phase': self._get_dominant_phase(early_phase, mid_phase, late_phase)
        }
    
    def _get_dominant_phase(self, early: float, mid: float, late: float) -> str:
        """Determine which phase dominated the game"""
        phases = {'early': early, 'mid': mid, 'late': late}
        return max(phases, key=phases.get)
    
    def _analyze_timing_trends(self) -> Dict[str, float]:
        """Analyze trends in timing data over recent games"""
        if len(self.timing_history) < 2:
            return {'trend': 'insufficient_data', 'improvement_rate': 0.0}
        
        recent_data = self.timing_history[-5:]  # Last 5 games
        
        # Calculate survival time trend
        survival_times = [d['survival_time'] for d in recent_data]
        if len(survival_times) > 1:
            survival_trend = (survival_times[-1] - survival_times[0]) / len(survival_times)
        else:
            survival_trend = 0.0
        
        # Calculate discovery time trend
        discovery_times = [d['discovery_time'] for d in recent_data]
        if len(discovery_times) > 1:
            discovery_trend = (discovery_times[-1] - discovery_times[0]) / len(discovery_times)
        else:
            discovery_trend = 0.0
        
        return {
            'survival_trend': survival_trend,
            'discovery_trend': discovery_trend,
            'improvement_rate': max(-1.0, min(1.0, survival_trend / 60.0)),  # Normalize to -1 to 1
            'consistency': self._calculate_timing_consistency(recent_data)
        }
    
    def _calculate_timing_consistency(self, data: List[Dict]) -> float:
        """Calculate consistency in timing performance"""
        if len(data) < 2:
            return 0.5
        
        survival_times = [d['survival_time'] for d in data]
        avg_survival = sum(survival_times) / len(survival_times)
        
        if avg_survival == 0:
            return 0.0
        
        # Calculate coefficient of variation
        variance = sum((t - avg_survival) ** 2 for t in survival_times) / len(survival_times)
        std_dev = math.sqrt(variance)
        cv = std_dev / avg_survival
        
        # Convert to consistency score (lower variation = higher consistency)
        consistency = max(0.0, 1.0 - cv)
        return consistency
    
    def _get_default_timing_analysis(self) -> Dict[str, Any]:
        """Return default timing analysis in case of errors"""
        return {
            'survival_ratio': 0.5,
            'survival_improvement': 0.0,
            'discovery_speed_ratio': 0.5,
            'discovery_efficiency': 0.5,
            'spawn_timing_score': 0.5,
            'spawn_rate': 0.0,
            'assault_timing': {
                'assault_duration': 0.0,
                'assault_intensity': 0.5,
                'assault_efficiency': 0.5,
                'discovery_to_death_ratio': 0.5
            },
            'temporal_pressure': {
                'early_pressure': 0.5,
                'sustained_pressure': 0.5,
                'end_pressure': 0.5,
                'overall_pressure': 0.5
            },
            'phase_analysis': {
                'early_phase_duration': 0.0,
                'mid_phase_duration': 0.0,
                'late_phase_duration': 0.0,
                'phase_distribution': {'early': 0.33, 'mid': 0.33, 'late': 0.34},
                'dominant_phase': 'unknown'
            },
            'timing_trends': {
                'survival_trend': 0.0,
                'discovery_trend': 0.0,
                'improvement_rate': 0.0,
                'consistency': 0.5
            }
        }


class SpatialAnalyzer:
    """Analyzes spatial aspects of Queen death and hive placement"""
    
    def __init__(self):
        self.failed_locations = []
        self.territory_bounds = {'x': [-100, 100], 'y': [-100, 100], 'z': [-100, 100]}
        self.optimal_zones = []
    
    async def analyze(self, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze spatial patterns and hive placement effectiveness"""
        try:
            death_location = death_data.death_location
            player_units = death_data.player_units
            
            # Analyze hive placement effectiveness
            placement_analysis = self._analyze_hive_placement(death_location, death_data)
            
            # Calculate discovery risk factors
            discovery_risk = self._calculate_discovery_risk(death_location, player_units, death_data)
            
            # Analyze territorial advantages
            territorial_analysis = self._analyze_territorial_position(death_location, death_data)
            
            # Calculate escape route availability
            escape_analysis = self._analyze_escape_routes(death_location, player_units)
            
            # Analyze player approach patterns
            approach_analysis = self._analyze_player_approach(death_location, player_units, death_data)
            
            # Update failed locations history
            self._update_failed_locations(death_location, death_data)
            
            return {
                'placement_score': placement_analysis['score'],
                'placement_reasoning': placement_analysis['reasoning'],
                'discovery_risk': discovery_risk['overall_risk'],
                'risk_factors': discovery_risk['risk_factors'],
                'territorial_advantage': territorial_analysis['advantage'],
                'zone_classification': territorial_analysis['zone_type'],
                'escape_routes': escape_analysis['route_count'],
                'escape_quality': escape_analysis['quality_score'],
                'approach_vectors': approach_analysis['vectors'],
                'approach_predictability': approach_analysis['predictability'],
                'failed_locations': self.failed_locations[-10:],  # Last 10 failed locations
                'optimal_zones': self._identify_optimal_zones(),
                'placement_improvement': self._calculate_placement_improvement(death_location)
            }
            
        except Exception as e:
            logger.error(f"Error in spatial analysis: {e}")
            return self._get_default_spatial_analysis()
    
    def _analyze_hive_placement(self, death_location: Dict[str, float], death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze the effectiveness of hive placement"""
        x, y, z = death_location.get('x', 0), death_location.get('y', 0), death_location.get('z', 0)
        
        # Distance from territory center (0,0,0 assumed center)
        center_distance = math.sqrt(x*x + y*y + z*z)
        
        # Placement score factors
        factors = {}
        
        # Distance factor (moderate distance from center is optimal)
        optimal_distance = 50.0
        distance_score = max(0.0, 1.0 - abs(center_distance - optimal_distance) / optimal_distance)
        factors['distance'] = distance_score
        
        # Edge proximity (closer to edges can be better for escape but worse for discovery)
        edge_distance = min(
            abs(x - self.territory_bounds['x'][0]),
            abs(x - self.territory_bounds['x'][1]),
            abs(z - self.territory_bounds['z'][0]),
            abs(z - self.territory_bounds['z'][1])
        )
        edge_score = min(1.0, edge_distance / 30.0)  # Penalty for being too close to edge
        factors['edge_proximity'] = edge_score
        
        # Height advantage (higher positions might be better)
        height_score = min(1.0, max(0.0, (y + 50) / 100.0))  # Normalize height
        factors['height'] = height_score
        
        # Historical failure penalty
        failure_penalty = self._calculate_location_failure_penalty(death_location)
        factors['historical_success'] = 1.0 - failure_penalty
        
        # Discovery time factor (longer discovery time = better placement)
        discovery_factor = min(1.0, death_data.hive_discovery_time / 180.0)  # 3 minutes optimal
        factors['concealment'] = discovery_factor
        
        # Calculate overall placement score
        weights = {
            'distance': 0.2,
            'edge_proximity': 0.15,
            'height': 0.1,
            'historical_success': 0.25,
            'concealment': 0.3
        }
        
        placement_score = sum(factors[key] * weights[key] for key in factors)
        
        # Generate reasoning
        reasoning = self._generate_placement_reasoning(factors, placement_score)
        
        return {
            'score': placement_score,
            'factors': factors,
            'reasoning': reasoning
        }
    
    def _calculate_discovery_risk(self, death_location: Dict[str, float], player_units: Dict, death_data: QueenDeathData) -> Dict[str, Any]:
        """Calculate risk factors for hive discovery"""
        x, z = death_location.get('x', 0), death_location.get('z', 0)
        
        risk_factors = {}
        
        # Proximity to player units
        protectors = player_units.get('protectors', [])
        workers = player_units.get('workers', [])
        
        min_unit_distance = float('inf')
        for unit_list in [protectors, workers]:
            for unit in unit_list:
                if 'position' in unit:
                    unit_pos = unit['position']
                    distance = math.sqrt((x - unit_pos.get('x', 0))**2 + (z - unit_pos.get('z', 0))**2)
                    min_unit_distance = min(min_unit_distance, distance)
        
        if min_unit_distance != float('inf'):
            proximity_risk = max(0.0, 1.0 - (min_unit_distance / 100.0))
        else:
            proximity_risk = 0.5
        
        risk_factors['unit_proximity'] = proximity_risk
        
        # Mining activity risk
        if death_data.game_state and 'active_mining' in death_data.game_state:
            mining_sites = death_data.game_state['active_mining']
            mining_risk = 0.0
            for site in mining_sites:
                if 'position' in site:
                    site_pos = site['position']
                    distance = math.sqrt((x - site_pos.get('x', 0))**2 + (z - site_pos.get('z', 0))**2)
                    mining_risk = max(mining_risk, max(0.0, 1.0 - (distance / 80.0)))
            risk_factors['mining_proximity'] = mining_risk
        else:
            risk_factors['mining_proximity'] = 0.3
        
        # Exploration pattern risk
        exploration_risk = self._calculate_exploration_risk(death_location, death_data)
        risk_factors['exploration_pattern'] = exploration_risk
        
        # Visibility risk (open areas vs covered areas)
        visibility_risk = self._calculate_visibility_risk(death_location)
        risk_factors['visibility'] = visibility_risk
        
        # Calculate overall risk
        overall_risk = (
            risk_factors['unit_proximity'] * 0.3 +
            risk_factors['mining_proximity'] * 0.25 +
            risk_factors['exploration_pattern'] * 0.25 +
            risk_factors['visibility'] * 0.2
        )
        
        return {
            'overall_risk': overall_risk,
            'risk_factors': risk_factors
        }
    
    def _analyze_territorial_position(self, death_location: Dict[str, float], death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze territorial advantages of the hive position"""
        x, y, z = death_location.get('x', 0), death_location.get('y', 0), death_location.get('z', 0)
        
        # Zone classification
        center_distance = math.sqrt(x*x + z*z)
        if center_distance < 30:
            zone_type = 'center'
            base_advantage = 0.4  # Central positions are risky but have good spawn coverage
        elif center_distance < 60:
            zone_type = 'mid'
            base_advantage = 0.7  # Mid-range positions are often optimal
        else:
            zone_type = 'edge'
            base_advantage = 0.5  # Edge positions have escape advantages but limited coverage
        
        # Strategic value modifiers
        strategic_modifiers = {}
        
        # Resource control advantage
        if death_data.game_state and 'active_mining' in death_data.game_state:
            mining_sites = death_data.game_state['active_mining']
            resource_control = 0.0
            for site in mining_sites:
                if 'position' in site:
                    site_pos = site['position']
                    distance = math.sqrt((x - site_pos.get('x', 0))**2 + (z - site_pos.get('z', 0))**2)
                    if distance < 50:  # Within influence range
                        resource_control += 0.2
            strategic_modifiers['resource_control'] = min(1.0, resource_control)
        else:
            strategic_modifiers['resource_control'] = 0.3
        
        # Chokepoint control
        chokepoint_value = self._calculate_chokepoint_value(death_location)
        strategic_modifiers['chokepoint_control'] = chokepoint_value
        
        # Height advantage
        height_advantage = min(1.0, max(0.0, (y + 20) / 40.0))
        strategic_modifiers['height_advantage'] = height_advantage
        
        # Calculate final territorial advantage
        advantage = base_advantage
        for modifier_value in strategic_modifiers.values():
            advantage += (modifier_value - 0.5) * 0.1  # Small adjustments
        
        advantage = max(0.0, min(1.0, advantage))
        
        return {
            'advantage': advantage,
            'zone_type': zone_type,
            'strategic_modifiers': strategic_modifiers
        }
    
    def _analyze_escape_routes(self, death_location: Dict[str, float], player_units: Dict) -> Dict[str, Any]:
        """Analyze available escape routes from hive position"""
        x, z = death_location.get('x', 0), death_location.get('z', 0)
        
        # Define potential escape directions (8 cardinal and diagonal directions)
        directions = [
            (1, 0), (-1, 0), (0, 1), (0, -1),  # Cardinal
            (1, 1), (-1, -1), (1, -1), (-1, 1)  # Diagonal
        ]
        
        available_routes = 0
        route_quality_sum = 0.0
        
        for dx, dz in directions:
            # Check if route is blocked by player units
            route_blocked = False
            route_quality = 1.0
            
            # Check for unit blocking in this direction
            protectors = player_units.get('protectors', [])
            workers = player_units.get('workers', [])
            
            for unit_list in [protectors, workers]:
                for unit in unit_list:
                    if 'position' in unit:
                        unit_pos = unit['position']
                        unit_x, unit_z = unit_pos.get('x', 0), unit_pos.get('z', 0)
                        
                        # Check if unit is in the escape direction
                        to_unit_x, to_unit_z = unit_x - x, unit_z - z
                        unit_distance = math.sqrt(to_unit_x*to_unit_x + to_unit_z*to_unit_z)
                        
                        if unit_distance > 0:
                            # Normalize vectors
                            to_unit_x /= unit_distance
                            to_unit_z /= unit_distance
                            
                            # Calculate dot product to see if unit is in escape direction
                            dot_product = to_unit_x * dx + to_unit_z * dz
                            
                            if dot_product > 0.7 and unit_distance < 40:  # Unit is blocking this route
                                route_quality *= max(0.0, 1.0 - (1.0 - unit_distance / 40.0))
            
            if route_quality > 0.3:  # Route is viable
                available_routes += 1
                route_quality_sum += route_quality
        
        average_quality = route_quality_sum / max(1, available_routes)
        
        return {
            'route_count': available_routes,
            'quality_score': average_quality,
            'total_directions': len(directions)
        }
    
    def _analyze_player_approach(self, death_location: Dict[str, float], player_units: Dict, death_data: QueenDeathData) -> Dict[str, Any]:
        """Analyze player approach patterns and vectors"""
        x, z = death_location.get('x', 0), death_location.get('z', 0)
        
        approach_vectors = []
        protectors = player_units.get('protectors', [])
        workers = player_units.get('workers', [])
        
        # Calculate approach vectors from player units
        for unit_list in [protectors, workers]:
            for unit in unit_list:
                if 'position' in unit:
                    unit_pos = unit['position']
                    unit_x, unit_z = unit_pos.get('x', 0), unit_pos.get('z', 0)
                    
                    # Vector from unit to hive
                    vector_x, vector_z = x - unit_x, z - unit_z
                    distance = math.sqrt(vector_x*vector_x + vector_z*vector_z)
                    
                    if distance > 0:
                        # Normalize vector
                        vector_x /= distance
                        vector_z /= distance
                        
                        # Convert to angle
                        angle = math.atan2(vector_z, vector_x)
                        approach_vectors.append({
                            'angle': angle,
                            'distance': distance,
                            'unit_type': 'protector' if unit in protectors else 'worker'
                        })
        
        # Analyze approach predictability
        if len(approach_vectors) > 1:
            angles = [v['angle'] for v in approach_vectors]
            angle_variance = self._calculate_angle_variance(angles)
            predictability = max(0.0, 1.0 - (angle_variance / math.pi))  # Higher variance = less predictable
        else:
            predictability = 0.5
        
        return {
            'vectors': approach_vectors,
            'predictability': predictability,
            'primary_direction': self._get_primary_approach_direction(approach_vectors),
            'approach_spread': self._calculate_approach_spread(approach_vectors)
        }
    
    def _update_failed_locations(self, death_location: Dict[str, float], death_data: QueenDeathData):
        """Update the history of failed hive locations"""
        failure_data = {
            'location': death_location,
            'generation': death_data.generation,
            'survival_time': death_data.survival_time,
            'discovery_time': death_data.hive_discovery_time,
            'timestamp': death_data.timestamp
        }
        
        self.failed_locations.append(failure_data)
        
        # Keep only last 20 failed locations
        if len(self.failed_locations) > 20:
            self.failed_locations = self.failed_locations[-20:]
    
    def _identify_optimal_zones(self) -> List[Dict[str, Any]]:
        """Identify optimal zones based on failed location analysis"""
        if len(self.failed_locations) < 3:
            return []
        
        # Simple clustering of failed locations to identify areas to avoid
        avoided_zones = []
        for failure in self.failed_locations[-10:]:  # Recent failures
            if failure['survival_time'] < 120:  # Quick failures
                avoided_zones.append({
                    'center': failure['location'],
                    'radius': 25.0,
                    'reason': 'quick_failure'
                })
        
        # Identify potential optimal zones (areas far from failed locations)
        optimal_zones = []
        test_positions = [
            {'x': 40, 'y': 0, 'z': 40},
            {'x': -40, 'y': 0, 'z': 40},
            {'x': 40, 'y': 0, 'z': -40},
            {'x': -40, 'y': 0, 'z': -40},
            {'x': 60, 'y': 10, 'z': 0},
            {'x': -60, 'y': 10, 'z': 0},
            {'x': 0, 'y': 10, 'z': 60},
            {'x': 0, 'y': 10, 'z': -60}
        ]
        
        for pos in test_positions:
            min_failure_distance = float('inf')
            for failure in self.failed_locations[-5:]:  # Recent failures
                failure_pos = failure['location']
                distance = math.sqrt(
                    (pos['x'] - failure_pos.get('x', 0))**2 +
                    (pos['z'] - failure_pos.get('z', 0))**2
                )
                min_failure_distance = min(min_failure_distance, distance)
            
            if min_failure_distance > 30:  # Far enough from failures
                optimal_zones.append({
                    'position': pos,
                    'confidence': min(1.0, min_failure_distance / 50.0),
                    'reason': 'distance_from_failures'
                })
        
        return optimal_zones[:5]  # Return top 5 optimal zones
    
    def _calculate_placement_improvement(self, death_location: Dict[str, float]) -> float:
        """Calculate potential improvement for hive placement"""
        if len(self.failed_locations) < 2:
            return 0.0
        
        current_x, current_z = death_location.get('x', 0), death_location.get('z', 0)
        
        # Compare with recent failed locations
        recent_failures = self.failed_locations[-3:]
        improvement_potential = 0.0
        
        for failure in recent_failures:
            failure_pos = failure['location']
            failure_x, failure_z = failure_pos.get('x', 0), failure_pos.get('z', 0)
            
            # Distance from previous failure
            distance = math.sqrt((current_x - failure_x)**2 + (current_z - failure_z)**2)
            
            # Survival time comparison
            survival_improvement = failure['survival_time'] / max(1.0, failure['survival_time'])
            
            # Calculate improvement based on distance and survival
            location_improvement = min(1.0, distance / 50.0) * survival_improvement
            improvement_potential = max(improvement_potential, location_improvement)
        
        return improvement_potential
    
    # Helper methods
    
    def _calculate_location_failure_penalty(self, location: Dict[str, float]) -> float:
        """Calculate penalty based on proximity to previous failures"""
        if not self.failed_locations:
            return 0.0
        
        x, z = location.get('x', 0), location.get('z', 0)
        penalty = 0.0
        
        for failure in self.failed_locations[-5:]:  # Recent failures
            failure_pos = failure['location']
            distance = math.sqrt(
                (x - failure_pos.get('x', 0))**2 +
                (z - failure_pos.get('z', 0))**2
            )
            
            if distance < 30:  # Close to previous failure
                failure_penalty = max(0.0, 1.0 - (distance / 30.0))
                penalty = max(penalty, failure_penalty)
        
        return penalty
    
    def _generate_placement_reasoning(self, factors: Dict[str, float], score: float) -> str:
        """Generate human-readable reasoning for placement score"""
        if score > 0.7:
            return "Good placement with strong concealment and strategic position"
        elif score > 0.5:
            return "Moderate placement with some advantages but room for improvement"
        elif score > 0.3:
            return "Poor placement with significant vulnerabilities"
        else:
            return "Very poor placement in high-risk area"
    
    def _calculate_exploration_risk(self, location: Dict[str, float], death_data: QueenDeathData) -> float:
        """Calculate risk based on player exploration patterns"""
        # Simplified exploration risk calculation
        if death_data.game_state and 'explored_areas' in death_data.game_state:
            explored_areas = death_data.game_state['explored_areas']
            if len(explored_areas) > 10:  # High exploration
                return 0.7
            elif len(explored_areas) > 5:  # Moderate exploration
                return 0.5
            else:  # Low exploration
                return 0.3
        return 0.5
    
    def _calculate_visibility_risk(self, location: Dict[str, float]) -> float:
        """Calculate visibility risk based on terrain features"""
        # Simplified visibility calculation
        y = location.get('y', 0)
        if y > 20:  # High ground - more visible
            return 0.7
        elif y < -10:  # Low ground - less visible
            return 0.3
        else:  # Ground level
            return 0.5
    
    def _calculate_chokepoint_value(self, location: Dict[str, float]) -> float:
        """Calculate strategic value of controlling chokepoints"""
        x, z = location.get('x', 0), location.get('z', 0)
        
        # Simplified chokepoint calculation based on position
        center_distance = math.sqrt(x*x + z*z)
        if 40 < center_distance < 70:  # Mid-range positions often control chokepoints
            return 0.7
        else:
            return 0.4
    
    def _calculate_angle_variance(self, angles: List[float]) -> float:
        """Calculate variance in approach angles"""
        if len(angles) < 2:
            return 0.0
        
        # Convert angles to unit vectors and calculate variance
        x_sum = sum(math.cos(angle) for angle in angles)
        y_sum = sum(math.sin(angle) for angle in angles)
        
        mean_x = x_sum / len(angles)
        mean_y = y_sum / len(angles)
        
        # Calculate circular variance
        mean_resultant_length = math.sqrt(mean_x*mean_x + mean_y*mean_y)
        circular_variance = 1.0 - mean_resultant_length
        
        return circular_variance * math.pi  # Scale to 0-π range
    
    def _get_primary_approach_direction(self, vectors: List[Dict]) -> Optional[float]:
        """Get the primary approach direction"""
        if not vectors:
            return None
        
        # Calculate average angle
        x_sum = sum(math.cos(v['angle']) for v in vectors)
        y_sum = sum(math.sin(v['angle']) for v in vectors)
        
        return math.atan2(y_sum, x_sum)
    
    def _calculate_approach_spread(self, vectors: List[Dict]) -> float:
        """Calculate how spread out the approach vectors are"""
        if len(vectors) < 2:
            return 0.0
        
        angles = [v['angle'] for v in vectors]
        return self._calculate_angle_variance(angles) / math.pi  # Normalize to 0-1
    
    def _get_default_spatial_analysis(self) -> Dict[str, Any]:
        """Return default spatial analysis in case of errors"""
        return {
            'placement_score': 0.5,
            'placement_reasoning': 'Analysis unavailable',
            'discovery_risk': 0.5,
            'risk_factors': {
                'unit_proximity': 0.5,
                'mining_proximity': 0.5,
                'exploration_pattern': 0.5,
                'visibility': 0.5
            },
            'territorial_advantage': 0.5,
            'zone_classification': 'unknown',
            'escape_routes': 4,
            'escape_quality': 0.5,
            'approach_vectors': [],
            'approach_predictability': 0.5,
            'failed_locations': [],
            'optimal_zones': [],
            'placement_improvement': 0.0
        }