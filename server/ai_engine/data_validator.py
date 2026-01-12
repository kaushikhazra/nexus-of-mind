"""
Data Validation and Corruption Recovery System
Handles data integrity, validation, and recovery for AI Engine
"""

import json
import logging
import hashlib
import time
import os
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime, timedelta
import jsonschema
from jsonschema import validate, ValidationError
import pickle
import gzip

logger = logging.getLogger(__name__)


class DataCorruptionError(Exception):
    """Raised when data corruption is detected"""
    pass


class ValidationRecoveryError(Exception):
    """Raised when validation recovery fails"""
    pass


class DataValidator:
    """
    Comprehensive data validation and corruption recovery system
    """
    
    def __init__(self, backup_directory: str = "data_backups"):
        self.backup_directory = backup_directory
        self.validation_schemas = {}
        self.data_checksums = {}
        self.backup_retention_days = 7
        self.max_recovery_attempts = 3
        
        # Initialize backup directory
        os.makedirs(self.backup_directory, exist_ok=True)
        
        # Initialize validation schemas
        self._initialize_schemas()
        
        # Load existing checksums
        self._load_checksums()
    
    def _initialize_schemas(self):
        """Initialize JSON schemas for data validation"""
        
        # Queen Death Data Schema
        self.validation_schemas['queen_death'] = {
            "type": "object",
            "required": ["queen_id", "generation", "death_location", "death_cause", "survival_time"],
            "properties": {
                "queen_id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                },
                "territory_id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                },
                "generation": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 1000
                },
                "death_location": {
                    "type": "object",
                    "required": ["x", "y", "z"],
                    "properties": {
                        "x": {"type": "number", "minimum": -1000, "maximum": 1000},
                        "y": {"type": "number", "minimum": -1000, "maximum": 1000},
                        "z": {"type": "number", "minimum": -1000, "maximum": 1000}
                    }
                },
                "death_cause": {
                    "type": "string",
                    "enum": ["protector_assault", "worker_infiltration", "coordinated_attack", "energy_depletion", "unknown"]
                },
                "survival_time": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 7200  # 2 hours max
                },
                "parasites_spawned": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 10000
                },
                "hive_discovery_time": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 7200
                },
                "player_units": {
                    "type": "object",
                    "properties": {
                        "protectors": {"type": "array"},
                        "workers": {"type": "array"}
                    }
                },
                "assault_pattern": {"type": "object"},
                "game_state": {"type": "object"}
            }
        }
        
        # Neural Network Training Data Schema
        self.validation_schemas['training_data'] = {
            "type": "object",
            "required": ["generation", "reward_signal"],
            "properties": {
                "generation": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 1000
                },
                "reward_signal": {
                    "type": "number",
                    "minimum": -1.0,
                    "maximum": 1.0
                },
                "game_state_features": {
                    "type": "array",
                    "minItems": 0,
                    "maxItems": 50,
                    "items": {"type": "number"}
                },
                "player_pattern_features": {
                    "type": "array",
                    "minItems": 0,
                    "maxItems": 50,
                    "items": {"type": "number"}
                },
                "death_analysis_features": {
                    "type": "array",
                    "minItems": 0,
                    "maxItems": 50,
                    "items": {"type": "number"}
                },
                "generation_features": {
                    "type": "array",
                    "minItems": 0,
                    "maxItems": 50,
                    "items": {"type": "number"}
                },
                "strategy_labels": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 19}
                },
                # Allow additional fields for flexibility
                "game_state": {"type": "object"},
                "player_patterns": {"type": "object"},
                "death_cause": {"type": "string"},
                "survival_time": {"type": "number", "minimum": 0},
                "parasites_spawned": {"type": "integer", "minimum": 0},
                "hive_discovery_time": {"type": "number", "minimum": 0},
                "assault_pattern": {"type": "object"}
            },
            "additionalProperties": True  # Allow additional properties
        }
        
        # Strategy Data Schema
        self.validation_schemas['strategy'] = {
            "type": "object",
            "required": ["generation"],
            "properties": {
                "generation": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 1000
                },
                "hive_placement": {
                    "type": "object",
                    "properties": {
                        "strategy": {"type": "string", "minLength": 1},
                        "parameters": {"type": "object"}
                    }
                },
                "parasite_spawning": {
                    "type": "object",
                    "properties": {
                        "strategy": {"type": "string", "minLength": 1},
                        "parameters": {"type": "object"}
                    }
                },
                "defensive_coordination": {
                    "type": "object",
                    "properties": {
                        "strategy": {"type": "string", "minLength": 1},
                        "parameters": {"type": "object"}
                    }
                },
                "predictive_behavior": {
                    "type": "object",
                    "properties": {
                        "enabled": {"type": "boolean"},
                        "strategy": {"type": "string"},
                        "parameters": {"type": "object"}
                    }
                },
                "complexity_level": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0
                }
            },
            "additionalProperties": True  # Allow additional properties
        }
        
        # Memory Data Schema
        self.validation_schemas['memory_data'] = {
            "type": "object",
            "required": ["generation", "timestamp", "data_type"],
            "properties": {
                "generation": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 1000
                },
                "timestamp": {
                    "type": "number",
                    "minimum": 0
                },
                "data_type": {
                    "type": "string",
                    "enum": ["death_analysis", "strategy", "player_patterns", "training_result"]
                },
                "territory_id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                },
                "data": {"type": "object"},
                "checksum": {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"  # SHA-256 hash
                }
            }
        }
    
    def validate_data(self, data: Dict[str, Any], data_type: str) -> Tuple[bool, Optional[str]]:
        """
        Validate data against schema
        
        Args:
            data: Data to validate
            data_type: Type of data (schema key)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            schema = self.validation_schemas.get(data_type)
            if not schema:
                return False, f"No validation schema found for data type: {data_type}"
            
            validate(instance=data, schema=schema)
            return True, None
            
        except ValidationError as e:
            logger.error(f"Data validation failed for {data_type}: {e.message}")
            return False, f"Validation error: {e.message}"
        except Exception as e:
            logger.error(f"Unexpected validation error for {data_type}: {e}")
            return False, f"Validation error: {str(e)}"
    
    def sanitize_data(self, data: Dict[str, Any], data_type: str) -> Dict[str, Any]:
        """
        Sanitize data to fix common validation issues
        
        Args:
            data: Data to sanitize
            data_type: Type of data
            
        Returns:
            Sanitized data
        """
        try:
            sanitized = data.copy()
            
            if data_type == 'queen_death':
                sanitized = self._sanitize_queen_death_data(sanitized)
            elif data_type == 'training_data':
                sanitized = self._sanitize_training_data(sanitized)
            elif data_type == 'strategy':
                sanitized = self._sanitize_strategy_data(sanitized)
            elif data_type == 'memory_data':
                sanitized = self._sanitize_memory_data(sanitized)
            
            return sanitized
            
        except Exception as e:
            logger.error(f"Data sanitization failed for {data_type}: {e}")
            return data  # Return original data if sanitization fails
    
    def _sanitize_queen_death_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize Queen death data"""
        sanitized = data.copy()
        
        # Ensure required fields exist
        if 'queen_id' not in sanitized or not sanitized['queen_id']:
            sanitized['queen_id'] = f"recovered_queen_{int(time.time())}"
        
        if 'generation' not in sanitized or not isinstance(sanitized['generation'], int) or sanitized['generation'] < 1:
            sanitized['generation'] = 1
        
        if 'death_cause' not in sanitized or sanitized['death_cause'] not in ['protector_assault', 'worker_infiltration', 'coordinated_attack', 'energy_depletion', 'unknown']:
            sanitized['death_cause'] = 'unknown'
        
        if 'survival_time' not in sanitized or not isinstance(sanitized['survival_time'], (int, float)) or sanitized['survival_time'] < 0:
            sanitized['survival_time'] = 0
        
        # Sanitize death location
        if 'death_location' not in sanitized or not isinstance(sanitized['death_location'], dict):
            sanitized['death_location'] = {'x': 0, 'y': 0, 'z': 0}
        else:
            location = sanitized['death_location']
            for coord in ['x', 'y', 'z']:
                if coord not in location or not isinstance(location[coord], (int, float)):
                    location[coord] = 0
                else:
                    location[coord] = max(-1000, min(1000, location[coord]))
        
        # Sanitize numeric fields
        if 'parasites_spawned' in sanitized:
            if not isinstance(sanitized['parasites_spawned'], int) or sanitized['parasites_spawned'] < 0:
                sanitized['parasites_spawned'] = 0
            else:
                sanitized['parasites_spawned'] = min(10000, sanitized['parasites_spawned'])
        
        if 'hive_discovery_time' in sanitized:
            if not isinstance(sanitized['hive_discovery_time'], (int, float)) or sanitized['hive_discovery_time'] < 0:
                sanitized['hive_discovery_time'] = 0
            else:
                sanitized['hive_discovery_time'] = min(7200, sanitized['hive_discovery_time'])
        
        # Ensure object fields exist
        if 'player_units' not in sanitized:
            sanitized['player_units'] = {'protectors': [], 'workers': []}
        
        if 'assault_pattern' not in sanitized:
            sanitized['assault_pattern'] = {}
        
        if 'game_state' not in sanitized:
            sanitized['game_state'] = {}
        
        return sanitized
    
    def _sanitize_training_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize training data"""
        sanitized = data.copy()
        
        # Ensure generation is valid
        if 'generation' not in sanitized or not isinstance(sanitized['generation'], int) or sanitized['generation'] < 1:
            sanitized['generation'] = 1
        else:
            sanitized['generation'] = min(1000, sanitized['generation'])
        
        # Ensure reward signal is valid
        if 'reward_signal' not in sanitized or not isinstance(sanitized['reward_signal'], (int, float)):
            sanitized['reward_signal'] = -1.0
        else:
            sanitized['reward_signal'] = max(-1.0, min(1.0, sanitized['reward_signal']))
        
        # Sanitize feature arrays
        feature_configs = [
            ('game_state_features', 20),
            ('player_pattern_features', 15),
            ('death_analysis_features', 10),
            ('generation_features', 5)
        ]
        
        for feature_name, expected_length in feature_configs:
            if feature_name not in sanitized or not isinstance(sanitized[feature_name], list):
                sanitized[feature_name] = [0.0] * expected_length
            else:
                features = sanitized[feature_name]
                # Ensure correct length
                if len(features) < expected_length:
                    features.extend([0.0] * (expected_length - len(features)))
                elif len(features) > expected_length:
                    features = features[:expected_length]
                
                # Ensure all values are valid floats in [0, 1]
                sanitized[feature_name] = [
                    max(0.0, min(1.0, float(f))) if isinstance(f, (int, float)) else 0.0
                    for f in features
                ]
        
        # Sanitize strategy labels
        if 'strategy_labels' not in sanitized or not isinstance(sanitized['strategy_labels'], list):
            sanitized['strategy_labels'] = []
        else:
            sanitized['strategy_labels'] = [
                int(label) for label in sanitized['strategy_labels']
                if isinstance(label, (int, float)) and 0 <= label <= 19
            ]
        
        return sanitized
    
    def _sanitize_strategy_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize strategy data"""
        sanitized = data.copy()
        
        # Ensure generation is valid
        if 'generation' not in sanitized or not isinstance(sanitized['generation'], int) or sanitized['generation'] < 1:
            sanitized['generation'] = 1
        else:
            sanitized['generation'] = min(1000, sanitized['generation'])
        
        # Sanitize strategy components
        strategy_components = ['hive_placement', 'parasite_spawning', 'defensive_coordination']
        
        for component in strategy_components:
            if component not in sanitized or not isinstance(sanitized[component], dict):
                sanitized[component] = {'strategy': 'default', 'parameters': {}}
            else:
                comp_data = sanitized[component]
                if 'strategy' not in comp_data or not isinstance(comp_data['strategy'], str):
                    comp_data['strategy'] = 'default'
                if 'parameters' not in comp_data or not isinstance(comp_data['parameters'], dict):
                    comp_data['parameters'] = {}
        
        # Sanitize optional predictive behavior
        if 'predictive_behavior' in sanitized:
            if not isinstance(sanitized['predictive_behavior'], dict):
                sanitized['predictive_behavior'] = {'enabled': False}
            else:
                pred_behavior = sanitized['predictive_behavior']
                if 'enabled' not in pred_behavior or not isinstance(pred_behavior['enabled'], bool):
                    pred_behavior['enabled'] = False
        
        # Sanitize complexity level
        if 'complexity_level' in sanitized:
            if not isinstance(sanitized['complexity_level'], (int, float)):
                sanitized['complexity_level'] = 0.5
            else:
                sanitized['complexity_level'] = max(0.0, min(1.0, sanitized['complexity_level']))
        
        return sanitized
    
    def _sanitize_memory_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize memory data"""
        sanitized = data.copy()
        
        # Ensure required fields
        if 'generation' not in sanitized or not isinstance(sanitized['generation'], int) or sanitized['generation'] < 1:
            sanitized['generation'] = 1
        
        if 'timestamp' not in sanitized or not isinstance(sanitized['timestamp'], (int, float)):
            sanitized['timestamp'] = time.time()
        
        if 'data_type' not in sanitized or sanitized['data_type'] not in ['death_analysis', 'strategy', 'player_patterns', 'training_result']:
            sanitized['data_type'] = 'death_analysis'
        
        if 'data' not in sanitized or not isinstance(sanitized['data'], dict):
            sanitized['data'] = {}
        
        # Generate checksum if missing
        if 'checksum' not in sanitized:
            sanitized['checksum'] = self._calculate_checksum(sanitized['data'])
        
        return sanitized
    
    def detect_corruption(self, data: Dict[str, Any], data_type: str) -> Tuple[bool, List[str]]:
        """
        Detect data corruption
        
        Args:
            data: Data to check
            data_type: Type of data
            
        Returns:
            Tuple of (is_corrupted, list_of_issues)
        """
        issues = []
        
        try:
            # Check for basic structure corruption
            if not isinstance(data, dict):
                issues.append("Data is not a dictionary")
                return True, issues
            
            # Check for empty data
            if not data:
                issues.append("Data is empty")
                return True, issues
            
            # Check for checksum mismatch (if checksum exists)
            if 'checksum' in data and 'data' in data:
                expected_checksum = self._calculate_checksum(data['data'])
                if data['checksum'] != expected_checksum:
                    issues.append(f"Checksum mismatch: expected {expected_checksum}, got {data['checksum']}")
            
            # Type-specific corruption checks
            if data_type == 'queen_death':
                issues.extend(self._check_queen_death_corruption(data))
            elif data_type == 'training_data':
                issues.extend(self._check_training_data_corruption(data))
            elif data_type == 'strategy':
                issues.extend(self._check_strategy_corruption(data))
            elif data_type == 'memory_data':
                issues.extend(self._check_memory_data_corruption(data))
            
            return len(issues) > 0, issues
            
        except Exception as e:
            logger.error(f"Corruption detection failed: {e}")
            issues.append(f"Corruption detection error: {str(e)}")
            return True, issues
    
    def _check_queen_death_corruption(self, data: Dict[str, Any]) -> List[str]:
        """Check for Queen death data corruption"""
        issues = []
        
        # Check for impossible values
        if 'survival_time' in data and isinstance(data['survival_time'], (int, float)):
            if data['survival_time'] < 0 or data['survival_time'] > 7200:
                issues.append(f"Impossible survival time: {data['survival_time']}")
        
        if 'generation' in data and isinstance(data['generation'], int):
            if data['generation'] < 1 or data['generation'] > 1000:
                issues.append(f"Impossible generation: {data['generation']}")
        
        if 'parasites_spawned' in data and isinstance(data['parasites_spawned'], int):
            if data['parasites_spawned'] < 0 or data['parasites_spawned'] > 10000:
                issues.append(f"Impossible parasites spawned: {data['parasites_spawned']}")
        
        # Check for logical inconsistencies
        if ('hive_discovery_time' in data and 'survival_time' in data and
            isinstance(data['hive_discovery_time'], (int, float)) and
            isinstance(data['survival_time'], (int, float))):
            if data['hive_discovery_time'] > data['survival_time']:
                issues.append("Hive discovery time exceeds survival time")
        
        return issues
    
    def _check_training_data_corruption(self, data: Dict[str, Any]) -> List[str]:
        """Check for training data corruption"""
        issues = []
        
        # Check feature array lengths and values
        feature_configs = [
            ('game_state_features', 20),
            ('player_pattern_features', 15),
            ('death_analysis_features', 10),
            ('generation_features', 5)
        ]
        
        for feature_name, expected_length in feature_configs:
            if feature_name in data:
                features = data[feature_name]
                if not isinstance(features, list):
                    issues.append(f"{feature_name} is not a list")
                elif len(features) != expected_length:
                    issues.append(f"{feature_name} has wrong length: {len(features)} (expected {expected_length})")
                else:
                    # Check for invalid values
                    for i, value in enumerate(features):
                        if not isinstance(value, (int, float)) or not (0.0 <= value <= 1.0):
                            issues.append(f"{feature_name}[{i}] has invalid value: {value}")
        
        # Check reward signal
        if 'reward_signal' in data:
            reward = data['reward_signal']
            if not isinstance(reward, (int, float)) or not (-1.0 <= reward <= 1.0):
                issues.append(f"Invalid reward signal: {reward}")
        
        return issues
    
    def _check_strategy_corruption(self, data: Dict[str, Any]) -> List[str]:
        """Check for strategy data corruption"""
        issues = []
        
        # Check required strategy components
        required_components = ['hive_placement', 'parasite_spawning', 'defensive_coordination']
        
        for component in required_components:
            if component not in data:
                issues.append(f"Missing strategy component: {component}")
            elif not isinstance(data[component], dict):
                issues.append(f"Strategy component {component} is not a dictionary")
            elif 'strategy' not in data[component]:
                issues.append(f"Strategy component {component} missing 'strategy' field")
        
        # Check complexity level
        if 'complexity_level' in data:
            complexity = data['complexity_level']
            if not isinstance(complexity, (int, float)) or not (0.0 <= complexity <= 1.0):
                issues.append(f"Invalid complexity level: {complexity}")
        
        return issues
    
    def _check_memory_data_corruption(self, data: Dict[str, Any]) -> List[str]:
        """Check for memory data corruption"""
        issues = []
        
        # Check timestamp
        if 'timestamp' in data:
            timestamp = data['timestamp']
            if not isinstance(timestamp, (int, float)) or timestamp < 0:
                issues.append(f"Invalid timestamp: {timestamp}")
            elif timestamp > time.time() + 86400:  # More than 1 day in future
                issues.append(f"Timestamp too far in future: {timestamp}")
        
        # Check data type
        if 'data_type' in data:
            data_type = data['data_type']
            valid_types = ['death_analysis', 'strategy', 'player_patterns', 'training_result']
            if data_type not in valid_types:
                issues.append(f"Invalid data type: {data_type}")
        
        return issues
    
    def recover_corrupted_data(self, corrupted_data: Dict[str, Any], data_type: str) -> Dict[str, Any]:
        """
        Attempt to recover corrupted data
        
        Args:
            corrupted_data: Corrupted data to recover
            data_type: Type of data
            
        Returns:
            Recovered data
        """
        try:
            logger.info(f"Attempting to recover corrupted {data_type} data")
            
            # First, try to sanitize the data
            recovered = self.sanitize_data(corrupted_data, data_type)
            
            # Check if sanitization fixed the issues
            is_valid, error_message = self.validate_data(recovered, data_type)
            if is_valid:
                logger.info(f"Data recovery successful through sanitization")
                return recovered
            
            # Try backup recovery
            backup_data = self._recover_from_backup(corrupted_data, data_type)
            if backup_data:
                logger.info(f"Data recovery successful from backup")
                return backup_data
            
            # Try partial reconstruction
            reconstructed_data = self._reconstruct_partial_data(corrupted_data, data_type)
            if reconstructed_data:
                logger.info(f"Data recovery successful through reconstruction")
                return reconstructed_data
            
            # Generate default data as last resort
            default_data = self._generate_default_data(data_type)
            logger.warning(f"Using default data for recovery")
            return default_data
            
        except Exception as e:
            logger.error(f"Data recovery failed: {e}")
            return self._generate_default_data(data_type)
    
    def _recover_from_backup(self, corrupted_data: Dict[str, Any], data_type: str) -> Optional[Dict[str, Any]]:
        """Try to recover data from backup"""
        try:
            # Look for backup files
            backup_pattern = f"{data_type}_backup_*.json.gz"
            backup_files = [f for f in os.listdir(self.backup_directory) if f.startswith(f"{data_type}_backup_")]
            
            if not backup_files:
                return None
            
            # Sort by timestamp (newest first)
            backup_files.sort(reverse=True)
            
            for backup_file in backup_files[:3]:  # Try last 3 backups
                try:
                    backup_path = os.path.join(self.backup_directory, backup_file)
                    with gzip.open(backup_path, 'rt') as f:
                        backup_data = json.load(f)
                    
                    # Validate backup data
                    is_valid, _ = self.validate_data(backup_data, data_type)
                    if is_valid:
                        return backup_data
                        
                except Exception as e:
                    logger.warning(f"Failed to load backup {backup_file}: {e}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Backup recovery failed: {e}")
            return None
    
    def _reconstruct_partial_data(self, corrupted_data: Dict[str, Any], data_type: str) -> Optional[Dict[str, Any]]:
        """Try to reconstruct data from partial information"""
        try:
            if data_type == 'queen_death':
                return self._reconstruct_queen_death_data(corrupted_data)
            elif data_type == 'training_data':
                return self._reconstruct_training_data(corrupted_data)
            elif data_type == 'strategy':
                return self._reconstruct_strategy_data(corrupted_data)
            elif data_type == 'memory_data':
                return self._reconstruct_memory_data(corrupted_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Partial reconstruction failed: {e}")
            return None
    
    def _reconstruct_queen_death_data(self, corrupted_data: Dict[str, Any]) -> Dict[str, Any]:
        """Reconstruct Queen death data from partial information"""
        reconstructed = {
            'queen_id': corrupted_data.get('queen_id', f"reconstructed_queen_{int(time.time())}"),
            'generation': max(1, corrupted_data.get('generation', 1)),
            'death_cause': corrupted_data.get('death_cause', 'unknown'),
            'survival_time': max(0, corrupted_data.get('survival_time', 60)),
            'parasites_spawned': max(0, corrupted_data.get('parasites_spawned', 0)),
            'death_location': corrupted_data.get('death_location', {'x': 0, 'y': 0, 'z': 0}),
            'player_units': corrupted_data.get('player_units', {'protectors': [], 'workers': []}),
            'assault_pattern': corrupted_data.get('assault_pattern', {}),
            'game_state': corrupted_data.get('game_state', {})
        }
        
        # Infer missing values from available data
        if 'hive_discovery_time' not in corrupted_data:
            # Estimate based on survival time
            reconstructed['hive_discovery_time'] = min(reconstructed['survival_time'] * 0.3, 300)
        
        return reconstructed
    
    def _reconstruct_training_data(self, corrupted_data: Dict[str, Any]) -> Dict[str, Any]:
        """Reconstruct training data from partial information"""
        reconstructed = {
            'generation': max(1, corrupted_data.get('generation', 1)),
            'reward_signal': corrupted_data.get('reward_signal', -1.0),
            'game_state_features': corrupted_data.get('game_state_features', [0.5] * 20),
            'player_pattern_features': corrupted_data.get('player_pattern_features', [0.5] * 15),
            'death_analysis_features': corrupted_data.get('death_analysis_features', [0.5] * 10),
            'generation_features': corrupted_data.get('generation_features', [0.1, 0.1, 1.0, 0.0, 0.0]),
            'strategy_labels': corrupted_data.get('strategy_labels', [])
        }
        
        return reconstructed
    
    def _reconstruct_strategy_data(self, corrupted_data: Dict[str, Any]) -> Dict[str, Any]:
        """Reconstruct strategy data from partial information"""
        reconstructed = {
            'generation': max(1, corrupted_data.get('generation', 1)),
            'hive_placement': corrupted_data.get('hive_placement', {'strategy': 'balanced', 'parameters': {}}),
            'parasite_spawning': corrupted_data.get('parasite_spawning', {'strategy': 'standard', 'parameters': {}}),
            'defensive_coordination': corrupted_data.get('defensive_coordination', {'strategy': 'basic', 'parameters': {}}),
            'complexity_level': corrupted_data.get('complexity_level', 0.5)
        }
        
        return reconstructed
    
    def _reconstruct_memory_data(self, corrupted_data: Dict[str, Any]) -> Dict[str, Any]:
        """Reconstruct memory data from partial information"""
        data_content = corrupted_data.get('data', {})
        
        reconstructed = {
            'generation': max(1, corrupted_data.get('generation', 1)),
            'timestamp': corrupted_data.get('timestamp', time.time()),
            'data_type': corrupted_data.get('data_type', 'death_analysis'),
            'data': data_content,
            'checksum': self._calculate_checksum(data_content)
        }
        
        if 'territory_id' in corrupted_data:
            reconstructed['territory_id'] = corrupted_data['territory_id']
        
        return reconstructed
    
    def _generate_default_data(self, data_type: str) -> Dict[str, Any]:
        """Generate default data for a given type"""
        if data_type == 'queen_death':
            return {
                'queen_id': f"default_queen_{int(time.time())}",
                'generation': 1,
                'death_cause': 'unknown',
                'survival_time': 60,
                'parasites_spawned': 0,
                'hive_discovery_time': 30,
                'death_location': {'x': 0, 'y': 0, 'z': 0},
                'player_units': {'protectors': [], 'workers': []},
                'assault_pattern': {},
                'game_state': {}
            }
        elif data_type == 'training_data':
            return {
                'generation': 1,
                'reward_signal': -1.0,
                'game_state_features': [0.5] * 20,
                'player_pattern_features': [0.5] * 15,
                'death_analysis_features': [0.5] * 10,
                'generation_features': [0.1, 0.1, 1.0, 0.0, 0.0],
                'strategy_labels': []
            }
        elif data_type == 'strategy':
            return {
                'generation': 1,
                'hive_placement': {'strategy': 'balanced', 'parameters': {}},
                'parasite_spawning': {'strategy': 'standard', 'parameters': {}},
                'defensive_coordination': {'strategy': 'basic', 'parameters': {}},
                'complexity_level': 0.1
            }
        elif data_type == 'memory_data':
            default_data = {}
            return {
                'generation': 1,
                'timestamp': time.time(),
                'data_type': 'death_analysis',
                'data': default_data,
                'checksum': self._calculate_checksum(default_data)
            }
        else:
            return {}
    
    def backup_data(self, data: Dict[str, Any], data_type: str, identifier: str = None) -> bool:
        """
        Create backup of data
        
        Args:
            data: Data to backup
            data_type: Type of data
            identifier: Optional identifier for the backup
            
        Returns:
            True if backup successful, False otherwise
        """
        try:
            timestamp = int(time.time())
            identifier_str = f"_{identifier}" if identifier else ""
            backup_filename = f"{data_type}_backup_{timestamp}{identifier_str}.json.gz"
            backup_path = os.path.join(self.backup_directory, backup_filename)
            
            # Add checksum to data
            data_with_checksum = data.copy()
            data_with_checksum['backup_checksum'] = self._calculate_checksum(data)
            data_with_checksum['backup_timestamp'] = timestamp
            
            # Compress and save
            with gzip.open(backup_path, 'wt') as f:
                json.dump(data_with_checksum, f, indent=2, default=str)
            
            logger.info(f"Data backup created: {backup_filename}")
            
            # Clean up old backups
            self._cleanup_old_backups(data_type)
            
            return True
            
        except Exception as e:
            logger.error(f"Data backup failed: {e}")
            return False
    
    def _cleanup_old_backups(self, data_type: str):
        """Clean up old backup files"""
        try:
            cutoff_time = time.time() - (self.backup_retention_days * 24 * 3600)
            
            for filename in os.listdir(self.backup_directory):
                if filename.startswith(f"{data_type}_backup_"):
                    file_path = os.path.join(self.backup_directory, filename)
                    if os.path.getctime(file_path) < cutoff_time:
                        os.remove(file_path)
                        logger.debug(f"Removed old backup: {filename}")
                        
        except Exception as e:
            logger.error(f"Backup cleanup failed: {e}")
    
    def _calculate_checksum(self, data: Any) -> str:
        """Calculate SHA-256 checksum of data"""
        try:
            # Convert data to JSON string for consistent hashing
            json_str = json.dumps(data, sort_keys=True, default=str)
            return hashlib.sha256(json_str.encode()).hexdigest()
        except Exception as e:
            logger.error(f"Checksum calculation failed: {e}")
            return "0" * 64  # Return invalid checksum on error
    
    def _load_checksums(self):
        """Load existing checksums from file"""
        try:
            checksum_file = os.path.join(self.backup_directory, "checksums.json")
            if os.path.exists(checksum_file):
                with open(checksum_file, 'r') as f:
                    self.data_checksums = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load checksums: {e}")
            self.data_checksums = {}
    
    def _save_checksums(self):
        """Save checksums to file"""
        try:
            checksum_file = os.path.join(self.backup_directory, "checksums.json")
            with open(checksum_file, 'w') as f:
                json.dump(self.data_checksums, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save checksums: {e}")
    
    def get_validation_statistics(self) -> Dict[str, Any]:
        """Get validation and recovery statistics"""
        return {
            "schemas_loaded": len(self.validation_schemas),
            "backup_directory": self.backup_directory,
            "backup_retention_days": self.backup_retention_days,
            "max_recovery_attempts": self.max_recovery_attempts,
            "available_schemas": list(self.validation_schemas.keys()),
            "checksums_tracked": len(self.data_checksums)
        }
    
    async def cleanup(self):
        """Cleanup data validator resources"""
        logger.info("Cleaning up data validator...")
        
        # Save checksums
        self._save_checksums()
        
        # Clear resources
        self.validation_schemas.clear()
        self.data_checksums.clear()
        
        logger.info("Data validator cleanup completed")