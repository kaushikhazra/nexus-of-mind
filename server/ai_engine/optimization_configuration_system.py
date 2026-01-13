"""
Optimization Configuration System - Centralized configuration for neural network optimizations
Provides backward compatibility and selective optimization enabling/disabling
"""

import logging
import json
import os
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class OptimizationFeature(Enum):
    """Available optimization features"""
    PERFORMANCE_PROFILING = "performance_profiling"
    MODEL_QUANTIZATION = "model_quantization"
    GPU_ACCELERATION = "gpu_acceleration"
    BATCH_PROCESSING = "batch_processing"
    MEMORY_OPTIMIZATION = "memory_optimization"
    LEARNING_QUALITY_MONITORING = "learning_quality_monitoring"
    ERROR_RECOVERY = "error_recovery"
    ADVANCED_ALERTING = "advanced_alerting"
    PRODUCTION_DEPLOYMENT = "production_deployment"
    HARDWARE_OPTIMIZATION = "hardware_optimization"


class OptimizationLevel(Enum):
    """Optimization levels"""
    DISABLED = "disabled"
    CONSERVATIVE = "conservative"
    BALANCED = "balanced"
    AGGRESSIVE = "aggressive"
    MAXIMUM = "maximum"


@dataclass
class FeatureConfiguration:
    """Configuration for a specific optimization feature"""
    enabled: bool
    level: OptimizationLevel
    parameters: Dict[str, Any]
    dependencies: List[str]
    compatibility_mode: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'enabled': self.enabled,
            'level': self.level.value,
            'parameters': self.parameters,
            'dependencies': self.dependencies,
            'compatibility_mode': self.compatibility_mode
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FeatureConfiguration':
        return cls(
            enabled=data.get('enabled', False),
            level=OptimizationLevel(data.get('level', 'balanced')),
            parameters=data.get('parameters', {}),
            dependencies=data.get('dependencies', []),
            compatibility_mode=data.get('compatibility_mode', False)
        )


@dataclass
class OptimizationProfile:
    """Complete optimization profile with all feature configurations"""
    profile_name: str
    description: str
    target_environment: str
    features: Dict[OptimizationFeature, FeatureConfiguration]
    global_parameters: Dict[str, Any]
    created_timestamp: float
    last_modified: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'profile_name': self.profile_name,
            'description': self.description,
            'target_environment': self.target_environment,
            'features': {feature.value: config.to_dict() for feature, config in self.features.items()},
            'global_parameters': self.global_parameters,
            'created_timestamp': self.created_timestamp,
            'last_modified': self.last_modified
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OptimizationProfile':
        features = {}
        for feature_name, config_data in data.get('features', {}).items():
            try:
                feature = OptimizationFeature(feature_name)
                features[feature] = FeatureConfiguration.from_dict(config_data)
            except ValueError:
                logger.warning(f"Unknown optimization feature: {feature_name}")
        
        return cls(
            profile_name=data.get('profile_name', 'default'),
            description=data.get('description', ''),
            target_environment=data.get('target_environment', 'development'),
            features=features,
            global_parameters=data.get('global_parameters', {}),
            created_timestamp=data.get('created_timestamp', 0.0),
            last_modified=data.get('last_modified', 0.0)
        )


class OptimizationConfigurationManager:
    """
    Centralized configuration manager for neural network optimizations
    Provides backward compatibility and selective optimization control
    """
    
    def __init__(self, config_dir: str = "config/optimization"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Current active configuration
        self.active_profile: Optional[OptimizationProfile] = None
        self.available_profiles: Dict[str, OptimizationProfile] = {}
        
        # Feature dependency graph
        self.feature_dependencies = self._build_dependency_graph()
        
        # Compatibility settings
        self.backward_compatibility_enabled = True
        self.legacy_mode = False
        
        # Load existing configurations
        self._load_configurations()
        
        # Create default profiles if none exist
        if not self.available_profiles:
            self._create_default_profiles()
    
    def _build_dependency_graph(self) -> Dict[OptimizationFeature, Set[OptimizationFeature]]:
        """Build feature dependency graph"""
        dependencies = {
            OptimizationFeature.PERFORMANCE_PROFILING: set(),
            OptimizationFeature.MODEL_QUANTIZATION: {OptimizationFeature.PERFORMANCE_PROFILING},
            OptimizationFeature.GPU_ACCELERATION: {OptimizationFeature.HARDWARE_OPTIMIZATION},
            OptimizationFeature.BATCH_PROCESSING: {OptimizationFeature.PERFORMANCE_PROFILING},
            OptimizationFeature.MEMORY_OPTIMIZATION: {OptimizationFeature.PERFORMANCE_PROFILING},
            OptimizationFeature.LEARNING_QUALITY_MONITORING: {OptimizationFeature.PERFORMANCE_PROFILING},
            OptimizationFeature.ERROR_RECOVERY: set(),
            OptimizationFeature.ADVANCED_ALERTING: {OptimizationFeature.PERFORMANCE_PROFILING},
            OptimizationFeature.PRODUCTION_DEPLOYMENT: {
                OptimizationFeature.PERFORMANCE_PROFILING,
                OptimizationFeature.ADVANCED_ALERTING
            },
            OptimizationFeature.HARDWARE_OPTIMIZATION: set()
        }
        return dependencies
    
    def _create_default_profiles(self):
        """Create default optimization profiles"""
        import time
        current_time = time.time()
        
        # Development profile - minimal optimizations
        dev_profile = OptimizationProfile(
            profile_name="development",
            description="Development environment with minimal optimizations for debugging",
            target_environment="development",
            features={
                OptimizationFeature.PERFORMANCE_PROFILING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.CONSERVATIVE,
                    parameters={'detailed_logging': True, 'sampling_rate': 1.0},
                    dependencies=[]
                ),
                OptimizationFeature.MODEL_QUANTIZATION: FeatureConfiguration(
                    enabled=False,
                    level=OptimizationLevel.DISABLED,
                    parameters={},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.GPU_ACCELERATION: FeatureConfiguration(
                    enabled=False,
                    level=OptimizationLevel.DISABLED,
                    parameters={},
                    dependencies=['hardware_optimization']
                ),
                OptimizationFeature.BATCH_PROCESSING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.CONSERVATIVE,
                    parameters={'max_batch_size': 4, 'timeout_ms': 100},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.MEMORY_OPTIMIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.CONSERVATIVE,
                    parameters={'memory_limit_mb': 150, 'gc_frequency': 'normal'},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.LEARNING_QUALITY_MONITORING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'monitoring_interval': 60, 'quality_threshold': 0.9},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.ERROR_RECOVERY: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'max_retries': 3, 'fallback_enabled': True},
                    dependencies=[]
                ),
                OptimizationFeature.ADVANCED_ALERTING: FeatureConfiguration(
                    enabled=False,
                    level=OptimizationLevel.DISABLED,
                    parameters={},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.PRODUCTION_DEPLOYMENT: FeatureConfiguration(
                    enabled=False,
                    level=OptimizationLevel.DISABLED,
                    parameters={},
                    dependencies=['performance_profiling', 'advanced_alerting']
                ),
                OptimizationFeature.HARDWARE_OPTIMIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.CONSERVATIVE,
                    parameters={'auto_detection': True, 'optimization_level': 'safe'},
                    dependencies=[]
                )
            },
            global_parameters={
                'inference_target_ms': 50.0,
                'memory_limit_mb': 200.0,
                'throughput_target': 20.0,
                'compatibility_mode': True
            },
            created_timestamp=current_time,
            last_modified=current_time
        )
        
        # Production profile - full optimizations
        prod_profile = OptimizationProfile(
            profile_name="production",
            description="Production environment with full optimizations for maximum performance",
            target_environment="production",
            features={
                OptimizationFeature.PERFORMANCE_PROFILING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'detailed_logging': False, 'sampling_rate': 0.1},
                    dependencies=[]
                ),
                OptimizationFeature.MODEL_QUANTIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'quantization_method': 'dynamic_range', 'quality_threshold': 0.95},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.GPU_ACCELERATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'mixed_precision': True, 'multi_gpu': True},
                    dependencies=['hardware_optimization']
                ),
                OptimizationFeature.BATCH_PROCESSING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'max_batch_size': 32, 'timeout_ms': 50},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.MEMORY_OPTIMIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'memory_limit_mb': 200, 'gc_frequency': 'aggressive'},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.LEARNING_QUALITY_MONITORING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'monitoring_interval': 300, 'quality_threshold': 0.95},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.ERROR_RECOVERY: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'max_retries': 5, 'fallback_enabled': True},
                    dependencies=[]
                ),
                OptimizationFeature.ADVANCED_ALERTING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'trend_analysis': True, 'proactive_alerts': True},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.PRODUCTION_DEPLOYMENT: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'auto_scaling': True, 'load_balancing': True},
                    dependencies=['performance_profiling', 'advanced_alerting']
                ),
                OptimizationFeature.HARDWARE_OPTIMIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.AGGRESSIVE,
                    parameters={'auto_detection': True, 'optimization_level': 'maximum'},
                    dependencies=[]
                )
            },
            global_parameters={
                'inference_target_ms': 16.0,
                'memory_limit_mb': 200.0,
                'throughput_target': 100.0,
                'compatibility_mode': False
            },
            created_timestamp=current_time,
            last_modified=current_time
        )
        
        # Balanced profile - moderate optimizations
        balanced_profile = OptimizationProfile(
            profile_name="balanced",
            description="Balanced configuration with moderate optimizations",
            target_environment="staging",
            features={
                OptimizationFeature.PERFORMANCE_PROFILING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'detailed_logging': False, 'sampling_rate': 0.5},
                    dependencies=[]
                ),
                OptimizationFeature.MODEL_QUANTIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'quantization_method': 'post_training', 'quality_threshold': 0.92},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.GPU_ACCELERATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'mixed_precision': False, 'multi_gpu': False},
                    dependencies=['hardware_optimization']
                ),
                OptimizationFeature.BATCH_PROCESSING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'max_batch_size': 16, 'timeout_ms': 75},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.MEMORY_OPTIMIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'memory_limit_mb': 200, 'gc_frequency': 'normal'},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.LEARNING_QUALITY_MONITORING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'monitoring_interval': 120, 'quality_threshold': 0.92},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.ERROR_RECOVERY: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'max_retries': 3, 'fallback_enabled': True},
                    dependencies=[]
                ),
                OptimizationFeature.ADVANCED_ALERTING: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'trend_analysis': True, 'proactive_alerts': False},
                    dependencies=['performance_profiling']
                ),
                OptimizationFeature.PRODUCTION_DEPLOYMENT: FeatureConfiguration(
                    enabled=False,
                    level=OptimizationLevel.DISABLED,
                    parameters={},
                    dependencies=['performance_profiling', 'advanced_alerting']
                ),
                OptimizationFeature.HARDWARE_OPTIMIZATION: FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={'auto_detection': True, 'optimization_level': 'balanced'},
                    dependencies=[]
                )
            },
            global_parameters={
                'inference_target_ms': 20.0,
                'memory_limit_mb': 200.0,
                'throughput_target': 60.0,
                'compatibility_mode': False
            },
            created_timestamp=current_time,
            last_modified=current_time
        )
        
        # Store default profiles
        self.available_profiles = {
            'development': dev_profile,
            'production': prod_profile,
            'balanced': balanced_profile
        }
        
        # Set development as default active profile
        self.active_profile = dev_profile
        
        # Save profiles to disk
        self._save_configurations()
        
        logger.info("Created default optimization profiles: development, production, balanced")
    
    def _load_configurations(self):
        """Load optimization configurations from disk"""
        try:
            profiles_file = self.config_dir / "optimization_profiles.json"
            
            if profiles_file.exists():
                with open(profiles_file, 'r') as f:
                    data = json.load(f)
                
                # Load profiles
                for profile_name, profile_data in data.get('profiles', {}).items():
                    try:
                        profile = OptimizationProfile.from_dict(profile_data)
                        self.available_profiles[profile_name] = profile
                    except Exception as e:
                        logger.error(f"Failed to load profile {profile_name}: {e}")
                
                # Load active profile
                active_profile_name = data.get('active_profile', 'development')
                if active_profile_name in self.available_profiles:
                    self.active_profile = self.available_profiles[active_profile_name]
                
                # Load global settings
                self.backward_compatibility_enabled = data.get('backward_compatibility_enabled', True)
                self.legacy_mode = data.get('legacy_mode', False)
                
                logger.info(f"Loaded {len(self.available_profiles)} optimization profiles")
            
        except Exception as e:
            logger.error(f"Failed to load optimization configurations: {e}")
    
    def _save_configurations(self):
        """Save optimization configurations to disk"""
        try:
            profiles_file = self.config_dir / "optimization_profiles.json"
            
            data = {
                'profiles': {name: profile.to_dict() for name, profile in self.available_profiles.items()},
                'active_profile': self.active_profile.profile_name if self.active_profile else 'development',
                'backward_compatibility_enabled': self.backward_compatibility_enabled,
                'legacy_mode': self.legacy_mode,
                'version': '1.0'
            }
            
            with open(profiles_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info("Saved optimization configurations")
            
        except Exception as e:
            logger.error(f"Failed to save optimization configurations: {e}")
    
    def get_active_profile(self) -> Optional[OptimizationProfile]:
        """Get the currently active optimization profile"""
        return self.active_profile
    
    def set_active_profile(self, profile_name: str) -> bool:
        """
        Set the active optimization profile
        
        Args:
            profile_name: Name of the profile to activate
            
        Returns:
            True if successful, False otherwise
        """
        if profile_name not in self.available_profiles:
            logger.error(f"Profile '{profile_name}' not found")
            return False
        
        self.active_profile = self.available_profiles[profile_name]
        self._save_configurations()
        
        logger.info(f"Activated optimization profile: {profile_name}")
        return True
    
    def is_feature_enabled(self, feature: OptimizationFeature) -> bool:
        """Check if a specific optimization feature is enabled"""
        if not self.active_profile:
            return False
        
        if feature not in self.active_profile.features:
            return False
        
        feature_config = self.active_profile.features[feature]
        
        # Check if feature is explicitly enabled
        if not feature_config.enabled:
            return False
        
        # Check dependencies
        if not self._check_dependencies(feature):
            logger.warning(f"Feature {feature.value} disabled due to unmet dependencies")
            return False
        
        return True
    
    def get_feature_configuration(self, feature: OptimizationFeature) -> Optional[FeatureConfiguration]:
        """Get configuration for a specific optimization feature"""
        if not self.active_profile or feature not in self.active_profile.features:
            return None
        
        return self.active_profile.features[feature]
    
    def get_feature_parameters(self, feature: OptimizationFeature) -> Dict[str, Any]:
        """Get parameters for a specific optimization feature"""
        config = self.get_feature_configuration(feature)
        return config.parameters if config else {}
    
    def _check_dependencies(self, feature: OptimizationFeature) -> bool:
        """Check if all dependencies for a feature are satisfied"""
        if feature not in self.feature_dependencies:
            return True
        
        required_features = self.feature_dependencies[feature]
        
        for required_feature in required_features:
            if required_feature not in self.active_profile.features:
                return False
            
            required_config = self.active_profile.features[required_feature]
            if not required_config.enabled:
                return False
        
        return True
    
    def enable_feature(self, feature: OptimizationFeature, 
                      level: OptimizationLevel = OptimizationLevel.BALANCED,
                      parameters: Optional[Dict[str, Any]] = None) -> bool:
        """
        Enable a specific optimization feature
        
        Args:
            feature: Feature to enable
            level: Optimization level
            parameters: Feature-specific parameters
            
        Returns:
            True if successful, False otherwise
        """
        if not self.active_profile:
            logger.error("No active profile to modify")
            return False
        
        # Check and enable dependencies first
        if not self._enable_dependencies(feature):
            logger.error(f"Failed to enable dependencies for {feature.value}")
            return False
        
        # Enable the feature
        if feature in self.active_profile.features:
            config = self.active_profile.features[feature]
            config.enabled = True
            config.level = level
            if parameters:
                config.parameters.update(parameters)
        else:
            # Create new configuration
            self.active_profile.features[feature] = FeatureConfiguration(
                enabled=True,
                level=level,
                parameters=parameters or {},
                dependencies=[dep.value for dep in self.feature_dependencies.get(feature, set())]
            )
        
        # Update modification time
        import time
        self.active_profile.last_modified = time.time()
        
        # Save changes
        self._save_configurations()
        
        logger.info(f"Enabled optimization feature: {feature.value} (level: {level.value})")
        return True
    
    def disable_feature(self, feature: OptimizationFeature) -> bool:
        """
        Disable a specific optimization feature
        
        Args:
            feature: Feature to disable
            
        Returns:
            True if successful, False otherwise
        """
        if not self.active_profile:
            logger.error("No active profile to modify")
            return False
        
        # Check if other features depend on this one
        dependent_features = self._get_dependent_features(feature)
        if dependent_features:
            logger.warning(f"Disabling {feature.value} will also disable: {[f.value for f in dependent_features]}")
            
            # Disable dependent features first
            for dependent_feature in dependent_features:
                if dependent_feature in self.active_profile.features:
                    self.active_profile.features[dependent_feature].enabled = False
        
        # Disable the feature
        if feature in self.active_profile.features:
            self.active_profile.features[feature].enabled = False
        
        # Update modification time
        import time
        self.active_profile.last_modified = time.time()
        
        # Save changes
        self._save_configurations()
        
        logger.info(f"Disabled optimization feature: {feature.value}")
        return True
    
    def _enable_dependencies(self, feature: OptimizationFeature) -> bool:
        """Enable all dependencies for a feature"""
        if feature not in self.feature_dependencies:
            return True
        
        required_features = self.feature_dependencies[feature]
        
        for required_feature in required_features:
            if required_feature not in self.active_profile.features:
                # Create default configuration for dependency
                self.active_profile.features[required_feature] = FeatureConfiguration(
                    enabled=True,
                    level=OptimizationLevel.BALANCED,
                    parameters={},
                    dependencies=[]
                )
            else:
                # Enable existing configuration
                self.active_profile.features[required_feature].enabled = True
        
        return True
    
    def _get_dependent_features(self, feature: OptimizationFeature) -> List[OptimizationFeature]:
        """Get features that depend on the given feature"""
        dependent_features = []
        
        for other_feature, dependencies in self.feature_dependencies.items():
            if feature in dependencies:
                dependent_features.append(other_feature)
        
        return dependent_features
    
    def create_custom_profile(self, profile_name: str, description: str,
                            base_profile: Optional[str] = None) -> bool:
        """
        Create a new custom optimization profile
        
        Args:
            profile_name: Name for the new profile
            description: Description of the profile
            base_profile: Optional base profile to copy from
            
        Returns:
            True if successful, False otherwise
        """
        if profile_name in self.available_profiles:
            logger.error(f"Profile '{profile_name}' already exists")
            return False
        
        import time
        current_time = time.time()
        
        # Create new profile
        if base_profile and base_profile in self.available_profiles:
            # Copy from base profile
            base = self.available_profiles[base_profile]
            new_profile = OptimizationProfile(
                profile_name=profile_name,
                description=description,
                target_environment=base.target_environment,
                features={feature: FeatureConfiguration(
                    enabled=config.enabled,
                    level=config.level,
                    parameters=config.parameters.copy(),
                    dependencies=config.dependencies.copy(),
                    compatibility_mode=config.compatibility_mode
                ) for feature, config in base.features.items()},
                global_parameters=base.global_parameters.copy(),
                created_timestamp=current_time,
                last_modified=current_time
            )
        else:
            # Create minimal profile
            new_profile = OptimizationProfile(
                profile_name=profile_name,
                description=description,
                target_environment="custom",
                features={},
                global_parameters={},
                created_timestamp=current_time,
                last_modified=current_time
            )
        
        self.available_profiles[profile_name] = new_profile
        self._save_configurations()
        
        logger.info(f"Created custom optimization profile: {profile_name}")
        return True
    
    def get_optimization_status(self) -> Dict[str, Any]:
        """Get comprehensive optimization system status"""
        if not self.active_profile:
            return {'status': 'no_active_profile'}
        
        enabled_features = []
        disabled_features = []
        feature_details = {}
        
        for feature in OptimizationFeature:
            is_enabled = self.is_feature_enabled(feature)
            config = self.get_feature_configuration(feature)
            
            if is_enabled:
                enabled_features.append(feature.value)
            else:
                disabled_features.append(feature.value)
            
            feature_details[feature.value] = {
                'enabled': is_enabled,
                'level': config.level.value if config else 'disabled',
                'parameters': config.parameters if config else {},
                'dependencies_met': self._check_dependencies(feature) if config else False
            }
        
        return {
            'active_profile': self.active_profile.profile_name,
            'profile_description': self.active_profile.description,
            'target_environment': self.active_profile.target_environment,
            'enabled_features': enabled_features,
            'disabled_features': disabled_features,
            'feature_details': feature_details,
            'global_parameters': self.active_profile.global_parameters,
            'backward_compatibility_enabled': self.backward_compatibility_enabled,
            'legacy_mode': self.legacy_mode,
            'available_profiles': list(self.available_profiles.keys()),
            'last_modified': self.active_profile.last_modified
        }
    
    def validate_configuration(self) -> Dict[str, Any]:
        """Validate the current optimization configuration"""
        if not self.active_profile:
            return {
                'valid': False,
                'errors': ['No active profile configured'],
                'warnings': []
            }
        
        errors = []
        warnings = []
        
        # Check feature dependencies
        for feature, config in self.active_profile.features.items():
            if config.enabled and not self._check_dependencies(feature):
                errors.append(f"Feature {feature.value} has unmet dependencies")
        
        # Check for conflicting configurations
        gpu_features = [OptimizationFeature.GPU_ACCELERATION, OptimizationFeature.MODEL_QUANTIZATION]
        gpu_enabled = any(self.is_feature_enabled(f) for f in gpu_features)
        
        if gpu_enabled:
            hardware_config = self.get_feature_configuration(OptimizationFeature.HARDWARE_OPTIMIZATION)
            if not hardware_config or not hardware_config.enabled:
                warnings.append("GPU features enabled but hardware optimization disabled")
        
        # Check performance targets
        global_params = self.active_profile.global_parameters
        inference_target = global_params.get('inference_target_ms', 50.0)
        
        if inference_target < 16.0:
            aggressive_features = [
                OptimizationFeature.MODEL_QUANTIZATION,
                OptimizationFeature.GPU_ACCELERATION,
                OptimizationFeature.BATCH_PROCESSING
            ]
            
            if not all(self.is_feature_enabled(f) for f in aggressive_features):
                warnings.append("Aggressive inference target requires quantization, GPU, and batch processing")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'recommendations': self._generate_configuration_recommendations()
        }
    
    def _generate_configuration_recommendations(self) -> List[str]:
        """Generate configuration recommendations"""
        recommendations = []
        
        if not self.active_profile:
            return ["Configure an active optimization profile"]
        
        # Performance recommendations
        if self.active_profile.target_environment == 'production':
            if not self.is_feature_enabled(OptimizationFeature.MODEL_QUANTIZATION):
                recommendations.append("Enable model quantization for production performance")
            
            if not self.is_feature_enabled(OptimizationFeature.ADVANCED_ALERTING):
                recommendations.append("Enable advanced alerting for production monitoring")
        
        # Resource recommendations
        memory_limit = self.active_profile.global_parameters.get('memory_limit_mb', 200)
        if memory_limit > 300:
            recommendations.append("Consider enabling aggressive memory optimization for high memory limits")
        
        # Feature synergy recommendations
        if (self.is_feature_enabled(OptimizationFeature.GPU_ACCELERATION) and 
            not self.is_feature_enabled(OptimizationFeature.BATCH_PROCESSING)):
            recommendations.append("Enable batch processing to maximize GPU utilization")
        
        return recommendations
    
    def export_configuration(self, profile_name: Optional[str] = None) -> str:
        """Export configuration as JSON string"""
        if profile_name:
            if profile_name not in self.available_profiles:
                raise ValueError(f"Profile '{profile_name}' not found")
            profile = self.available_profiles[profile_name]
        else:
            profile = self.active_profile
        
        if not profile:
            raise ValueError("No profile to export")
        
        return json.dumps(profile.to_dict(), indent=2)
    
    def import_configuration(self, config_json: str, profile_name: Optional[str] = None) -> bool:
        """Import configuration from JSON string"""
        try:
            config_data = json.loads(config_json)
            profile = OptimizationProfile.from_dict(config_data)
            
            if profile_name:
                profile.profile_name = profile_name
            
            self.available_profiles[profile.profile_name] = profile
            self._save_configurations()
            
            logger.info(f"Imported optimization profile: {profile.profile_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to import configuration: {e}")
            return False