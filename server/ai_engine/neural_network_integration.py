"""
Neural Network Integration Layer - Integrates optimization system with existing QueenBehaviorNetwork
Provides backward compatibility and seamless optimization integration
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from .optimization_configuration_system import (
    OptimizationConfigurationManager, OptimizationFeature, OptimizationLevel
)
from .advanced_alerting_system import AdvancedAlertingSystem
from .production_deployment_system import ProductionDeploymentSystem

logger = logging.getLogger(__name__)


@dataclass
class IntegrationStatus:
    """Status of optimization system integration"""
    initialized: bool
    active_optimizations: List[str]
    performance_improvements: Dict[str, float]
    compatibility_mode: bool
    last_update: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'initialized': self.initialized,
            'active_optimizations': self.active_optimizations,
            'performance_improvements': self.performance_improvements,
            'compatibility_mode': self.compatibility_mode,
            'last_update': self.last_update
        }


class NeuralNetworkOptimizationIntegrator:
    """
    Integration layer that connects optimization systems with QueenBehaviorNetwork
    Maintains backward compatibility while enabling advanced optimizations
    """
    
    def __init__(self, neural_network):
        self.neural_network = neural_network
        self.config_manager = OptimizationConfigurationManager()
        
        # Integration components
        self.advanced_alerting: Optional[AdvancedAlertingSystem] = None
        self.deployment_system: Optional[ProductionDeploymentSystem] = None
        
        # Integration state
        self.integration_status = IntegrationStatus(
            initialized=False,
            active_optimizations=[],
            performance_improvements={},
            compatibility_mode=True,
            last_update=time.time()
        )
        
        # Performance tracking
        self.baseline_metrics = {}
        self.current_metrics = {}
        
        # Backward compatibility flags
        self.legacy_inference_enabled = True
        self.fallback_mode_active = False
        
    async def initialize_optimizations(self) -> Dict[str, Any]:
        """
        Initialize optimization systems based on active configuration
        
        Returns:
            Initialization result with status and details
        """
        try:
            logger.info("Initializing neural network optimization integration...")
            
            # Get active configuration
            active_profile = self.config_manager.get_active_profile()
            if not active_profile:
                return {
                    'success': False,
                    'error': 'No active optimization profile configured'
                }
            
            # Validate configuration
            validation_result = self.config_manager.validate_configuration()
            if not validation_result['valid']:
                logger.warning(f"Configuration validation warnings: {validation_result['warnings']}")
                if validation_result['errors']:
                    return {
                        'success': False,
                        'error': f"Configuration errors: {validation_result['errors']}"
                    }
            
            # Initialize optimization components based on configuration
            initialization_results = {}
            
            # Initialize advanced alerting if enabled
            if self.config_manager.is_feature_enabled(OptimizationFeature.ADVANCED_ALERTING):
                await self._initialize_advanced_alerting()
                initialization_results['advanced_alerting'] = True
            
            # Initialize production deployment if enabled
            if self.config_manager.is_feature_enabled(OptimizationFeature.PRODUCTION_DEPLOYMENT):
                await self._initialize_production_deployment()
                initialization_results['production_deployment'] = True
            
            # Configure existing optimization components
            await self._configure_existing_optimizations()
            initialization_results['existing_optimizations'] = True
            
            # Set up performance monitoring integration
            await self._setup_performance_monitoring()
            initialization_results['performance_monitoring'] = True
            
            # Update integration status
            self.integration_status.initialized = True
            self.integration_status.active_optimizations = [
                feature.value for feature in OptimizationFeature 
                if self.config_manager.is_feature_enabled(feature)
            ]
            self.integration_status.compatibility_mode = active_profile.global_parameters.get('compatibility_mode', True)
            self.integration_status.last_update = time.time()
            
            logger.info(f"Optimization integration initialized successfully. "
                       f"Active optimizations: {len(self.integration_status.active_optimizations)}")
            
            return {
                'success': True,
                'active_profile': active_profile.profile_name,
                'active_optimizations': self.integration_status.active_optimizations,
                'initialization_results': initialization_results,
                'compatibility_mode': self.integration_status.compatibility_mode
            }
            
        except Exception as e:
            logger.error(f"Failed to initialize optimizations: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _initialize_advanced_alerting(self):
        """Initialize advanced alerting system"""
        if hasattr(self.neural_network, 'performance_profiler'):
            self.advanced_alerting = AdvancedAlertingSystem(self.neural_network.performance_profiler)
            
            # Configure alerting based on profile parameters
            alerting_params = self.config_manager.get_feature_parameters(OptimizationFeature.ADVANCED_ALERTING)
            
            if alerting_params:
                self.advanced_alerting.update_configuration(alerting_params)
            
            logger.info("Advanced alerting system initialized")
        else:
            logger.warning("Performance profiler not available for advanced alerting")
    
    async def _initialize_production_deployment(self):
        """Initialize production deployment system"""
        self.deployment_system = ProductionDeploymentSystem()
        
        # Configure deployment based on profile parameters
        deployment_params = self.config_manager.get_feature_parameters(OptimizationFeature.PRODUCTION_DEPLOYMENT)
        
        if deployment_params.get('auto_scaling', False):
            logger.info("Production deployment with auto-scaling initialized")
        
        logger.info("Production deployment system initialized")
    
    async def _configure_existing_optimizations(self):
        """Configure existing optimization components based on active profile"""
        active_profile = self.config_manager.get_active_profile()
        
        # Configure performance profiling
        if (hasattr(self.neural_network, 'performance_profiler') and 
            self.config_manager.is_feature_enabled(OptimizationFeature.PERFORMANCE_PROFILING)):
            
            profiling_params = self.config_manager.get_feature_parameters(OptimizationFeature.PERFORMANCE_PROFILING)
            
            # Update profiler configuration
            if hasattr(self.neural_network.performance_profiler, 'update_configuration'):
                self.neural_network.performance_profiler.update_configuration(profiling_params)
        
        # Configure model quantization
        if (hasattr(self.neural_network, 'model_quantizer') and 
            self.config_manager.is_feature_enabled(OptimizationFeature.MODEL_QUANTIZATION)):
            
            quantization_params = self.config_manager.get_feature_parameters(OptimizationFeature.MODEL_QUANTIZATION)
            
            # Apply quantization if not already done
            if (self.neural_network.model_quantizer and 
                not hasattr(self.neural_network, 'quantized_model_variant')):
                
                try:
                    await self._apply_model_quantization(quantization_params)
                except Exception as e:
                    logger.error(f"Model quantization failed: {e}")
        
        # Configure GPU acceleration
        if (hasattr(self.neural_network, 'gpu_manager') and 
            self.config_manager.is_feature_enabled(OptimizationFeature.GPU_ACCELERATION)):
            
            gpu_params = self.config_manager.get_feature_parameters(OptimizationFeature.GPU_ACCELERATION)
            
            # Update GPU configuration
            if hasattr(self.neural_network.gpu_manager, 'update_configuration'):
                self.neural_network.gpu_manager.update_configuration(gpu_params)
        
        # Configure memory optimization
        if (hasattr(self.neural_network, 'resource_manager') and 
            self.config_manager.is_feature_enabled(OptimizationFeature.MEMORY_OPTIMIZATION)):
            
            memory_params = self.config_manager.get_feature_parameters(OptimizationFeature.MEMORY_OPTIMIZATION)
            
            # Update memory management settings
            if hasattr(self.neural_network.resource_manager, 'update_memory_limits'):
                memory_limit = memory_params.get('memory_limit_mb', 200)
                self.neural_network.resource_manager.update_memory_limits(memory_limit)
        
        # Configure learning quality monitoring
        if (hasattr(self.neural_network, 'learning_quality_monitor') and 
            self.config_manager.is_feature_enabled(OptimizationFeature.LEARNING_QUALITY_MONITORING)):
            
            quality_params = self.config_manager.get_feature_parameters(OptimizationFeature.LEARNING_QUALITY_MONITORING)
            
            # Update quality monitoring settings
            if hasattr(self.neural_network.learning_quality_monitor, 'update_configuration'):
                self.neural_network.learning_quality_monitor.update_configuration(quality_params)
        
        logger.info("Existing optimization components configured")
    
    async def _apply_model_quantization(self, quantization_params: Dict[str, Any]):
        """Apply model quantization based on configuration"""
        if not self.neural_network.model_quantizer:
            logger.warning("Model quantizer not available")
            return
        
        try:
            # Create quantization configuration
            from .model_quantizer import QuantizationConfig, QuantizationMethod, ModelFormat
            
            method_name = quantization_params.get('quantization_method', 'dynamic_range')
            method = QuantizationMethod.DYNAMIC_RANGE if method_name == 'dynamic_range' else QuantizationMethod.POST_TRAINING
            
            config = QuantizationConfig(
                method=method,
                target_format=ModelFormat.TFLITE,
                quality_threshold=quantization_params.get('quality_threshold', 0.95)
            )
            
            # Apply quantization
            result = await self.neural_network.quantize_model_for_inference(config)
            
            if result['success']:
                logger.info("Model quantization applied successfully")
            else:
                logger.error(f"Model quantization failed: {result.get('error')}")
                
        except Exception as e:
            logger.error(f"Failed to apply model quantization: {e}")
    
    async def _setup_performance_monitoring(self):
        """Set up integrated performance monitoring"""
        if not hasattr(self.neural_network, 'performance_monitor'):
            logger.warning("Performance monitor not available")
            return
        
        # Capture baseline metrics
        try:
            baseline_summary = self.neural_network.performance_monitor.get_performance_summary()
            self.baseline_metrics = {
                'avg_inference_time_ms': baseline_summary.get('avg_inference_time_ms', 0.0),
                'avg_memory_usage_mb': baseline_summary.get('avg_memory_usage_mb', 0.0),
                'throughput_predictions_per_sec': baseline_summary.get('throughput_predictions_per_sec', 0.0)
            }
            
            logger.info(f"Baseline performance metrics captured: {self.baseline_metrics}")
            
        except Exception as e:
            logger.warning(f"Failed to capture baseline metrics: {e}")
    
    async def optimized_predict_strategy(self, features, operation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Optimized strategy prediction with integrated optimization systems
        
        Args:
            features: Input features for prediction
            operation_id: Optional operation identifier
            
        Returns:
            Prediction result with optimization metadata
        """
        start_time = time.time()
        
        try:
            # Check if optimizations are enabled
            if not self.integration_status.initialized:
                # Fall back to legacy prediction
                return await self._legacy_predict_strategy(features, operation_id)
            
            # Use optimized prediction pipeline
            result = await self._optimized_predict_strategy_internal(features, operation_id)
            
            # Track performance improvements
            processing_time = (time.time() - start_time) * 1000
            self._update_performance_metrics(processing_time)
            
            # Add optimization metadata
            result['optimization_metadata'] = {
                'optimizations_used': self.integration_status.active_optimizations,
                'processing_time_ms': processing_time,
                'compatibility_mode': self.integration_status.compatibility_mode
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Optimized prediction failed: {e}")
            
            # Fall back to legacy prediction
            if self.legacy_inference_enabled:
                logger.info("Falling back to legacy prediction")
                return await self._legacy_predict_strategy(features, operation_id)
            else:
                raise
    
    async def _optimized_predict_strategy_internal(self, features, operation_id: Optional[str] = None) -> Dict[str, Any]:
        """Internal optimized prediction implementation"""
        
        # Use existing neural network prediction with optimizations
        if hasattr(self.neural_network, 'predict_strategy_async'):
            # Use async prediction if available
            predictions = await self.neural_network.predict_strategy_async(features, operation_id)
        else:
            # Fall back to sync prediction
            predictions = self.neural_network.predict_strategy(features)
        
        return {
            'success': True,
            'predictions': predictions.tolist() if hasattr(predictions, 'tolist') else predictions,
            'model_version': getattr(self.neural_network, 'model_version', 'unknown'),
            'optimization_applied': True
        }
    
    async def _legacy_predict_strategy(self, features, operation_id: Optional[str] = None) -> Dict[str, Any]:
        """Legacy prediction method for backward compatibility"""
        
        try:
            # Use basic neural network prediction
            predictions = self.neural_network.predict_strategy(features)
            
            return {
                'success': True,
                'predictions': predictions.tolist() if hasattr(predictions, 'tolist') else predictions,
                'model_version': getattr(self.neural_network, 'model_version', 'unknown'),
                'optimization_applied': False,
                'legacy_mode': True
            }
            
        except Exception as e:
            logger.error(f"Legacy prediction failed: {e}")
            raise
    
    def _update_performance_metrics(self, processing_time_ms: float):
        """Update performance metrics and calculate improvements"""
        
        # Update current metrics
        if 'inference_times' not in self.current_metrics:
            self.current_metrics['inference_times'] = []
        
        self.current_metrics['inference_times'].append(processing_time_ms)
        
        # Keep only recent measurements (last 100)
        if len(self.current_metrics['inference_times']) > 100:
            self.current_metrics['inference_times'] = self.current_metrics['inference_times'][-100:]
        
        # Calculate performance improvements
        if self.baseline_metrics and len(self.current_metrics['inference_times']) >= 10:
            current_avg = sum(self.current_metrics['inference_times']) / len(self.current_metrics['inference_times'])
            baseline_avg = self.baseline_metrics.get('avg_inference_time_ms', current_avg)
            
            if baseline_avg > 0:
                improvement_percent = ((baseline_avg - current_avg) / baseline_avg) * 100
                self.integration_status.performance_improvements['inference_time'] = improvement_percent
    
    def enable_optimization_feature(self, feature: OptimizationFeature, 
                                  level: OptimizationLevel = OptimizationLevel.BALANCED) -> Dict[str, Any]:
        """
        Enable a specific optimization feature at runtime
        
        Args:
            feature: Feature to enable
            level: Optimization level
            
        Returns:
            Result of the operation
        """
        try:
            success = self.config_manager.enable_feature(feature, level)
            
            if success:
                # Re-initialize optimizations to apply the new feature
                asyncio.create_task(self._reconfigure_optimizations())
                
                return {
                    'success': True,
                    'feature': feature.value,
                    'level': level.value,
                    'message': f'Feature {feature.value} enabled successfully'
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to enable feature {feature.value}'
                }
                
        except Exception as e:
            logger.error(f"Failed to enable optimization feature {feature.value}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def disable_optimization_feature(self, feature: OptimizationFeature) -> Dict[str, Any]:
        """
        Disable a specific optimization feature at runtime
        
        Args:
            feature: Feature to disable
            
        Returns:
            Result of the operation
        """
        try:
            success = self.config_manager.disable_feature(feature)
            
            if success:
                # Re-initialize optimizations to remove the feature
                asyncio.create_task(self._reconfigure_optimizations())
                
                return {
                    'success': True,
                    'feature': feature.value,
                    'message': f'Feature {feature.value} disabled successfully'
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to disable feature {feature.value}'
                }
                
        except Exception as e:
            logger.error(f"Failed to disable optimization feature {feature.value}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _reconfigure_optimizations(self):
        """Reconfigure optimizations after feature changes"""
        try:
            logger.info("Reconfiguring optimizations after feature changes...")
            
            # Re-configure existing optimizations
            await self._configure_existing_optimizations()
            
            # Update integration status
            self.integration_status.active_optimizations = [
                feature.value for feature in OptimizationFeature 
                if self.config_manager.is_feature_enabled(feature)
            ]
            self.integration_status.last_update = time.time()
            
            logger.info("Optimization reconfiguration completed")
            
        except Exception as e:
            logger.error(f"Failed to reconfigure optimizations: {e}")
    
    def switch_optimization_profile(self, profile_name: str) -> Dict[str, Any]:
        """
        Switch to a different optimization profile
        
        Args:
            profile_name: Name of the profile to switch to
            
        Returns:
            Result of the operation
        """
        try:
            success = self.config_manager.set_active_profile(profile_name)
            
            if success:
                # Re-initialize optimizations with new profile
                asyncio.create_task(self.initialize_optimizations())
                
                return {
                    'success': True,
                    'new_profile': profile_name,
                    'message': f'Switched to optimization profile: {profile_name}'
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to switch to profile: {profile_name}'
                }
                
        except Exception as e:
            logger.error(f"Failed to switch optimization profile: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_integration_status(self) -> Dict[str, Any]:
        """Get comprehensive integration status"""
        
        # Get configuration status
        config_status = self.config_manager.get_optimization_status()
        
        # Get performance improvements
        performance_data = {
            'baseline_metrics': self.baseline_metrics,
            'current_metrics': {
                'avg_inference_time_ms': (
                    sum(self.current_metrics.get('inference_times', [0])) / 
                    max(1, len(self.current_metrics.get('inference_times', [0])))
                )
            },
            'improvements': self.integration_status.performance_improvements
        }
        
        # Get component status
        component_status = {
            'neural_network': {
                'available': self.neural_network is not None,
                'model_loaded': hasattr(self.neural_network, 'model') and self.neural_network.model is not None
            },
            'advanced_alerting': {
                'available': self.advanced_alerting is not None,
                'active': self.advanced_alerting is not None
            },
            'production_deployment': {
                'available': self.deployment_system is not None,
                'active': self.deployment_system is not None
            }
        }
        
        return {
            'integration_status': self.integration_status.to_dict(),
            'configuration_status': config_status,
            'performance_data': performance_data,
            'component_status': component_status,
            'backward_compatibility': {
                'legacy_inference_enabled': self.legacy_inference_enabled,
                'fallback_mode_active': self.fallback_mode_active
            }
        }
    
    def get_optimization_recommendations(self) -> List[str]:
        """Get optimization recommendations based on current performance"""
        recommendations = []
        
        # Get configuration recommendations
        config_recommendations = self.config_manager._generate_configuration_recommendations()
        recommendations.extend(config_recommendations)
        
        # Performance-based recommendations
        if self.current_metrics.get('inference_times'):
            avg_time = sum(self.current_metrics['inference_times']) / len(self.current_metrics['inference_times'])
            
            if avg_time > 20.0:
                recommendations.append("Consider enabling model quantization for faster inference")
            
            if avg_time > 16.0 and not self.config_manager.is_feature_enabled(OptimizationFeature.GPU_ACCELERATION):
                recommendations.append("Enable GPU acceleration to meet 60fps target")
        
        # Feature synergy recommendations
        if (self.config_manager.is_feature_enabled(OptimizationFeature.PERFORMANCE_PROFILING) and
            not self.config_manager.is_feature_enabled(OptimizationFeature.ADVANCED_ALERTING)):
            recommendations.append("Enable advanced alerting to leverage performance profiling data")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup integration resources"""
        try:
            if self.advanced_alerting:
                await self.advanced_alerting.cleanup()
            
            if self.deployment_system:
                await self.deployment_system.cleanup()
            
            self.integration_status.initialized = False
            logger.info("Neural network optimization integration cleanup completed")
            
        except Exception as e:
            logger.error(f"Integration cleanup failed: {e}")


# Backward compatibility wrapper functions
def create_optimization_integrator(neural_network) -> NeuralNetworkOptimizationIntegrator:
    """Create optimization integrator for existing neural network"""
    return NeuralNetworkOptimizationIntegrator(neural_network)


async def initialize_neural_network_optimizations(neural_network) -> Dict[str, Any]:
    """Initialize optimizations for existing neural network (backward compatible)"""
    integrator = create_optimization_integrator(neural_network)
    return await integrator.initialize_optimizations()


def get_neural_network_optimization_status(neural_network) -> Dict[str, Any]:
    """Get optimization status for existing neural network (backward compatible)"""
    if hasattr(neural_network, '_optimization_integrator'):
        return neural_network._optimization_integrator.get_integration_status()
    else:
        return {
            'integration_status': {'initialized': False},
            'message': 'Optimization integration not initialized'
        }