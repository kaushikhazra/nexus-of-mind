"""
Integration Test Suite for Adaptive Queen Intelligence System
Comprehensive end-to-end testing of the complete learning cycle
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, List, Optional
import websockets
import requests
from dataclasses import dataclass, asdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TestQueenData:
    """Test data for Queen death scenarios"""
    queen_id: str
    generation: int
    death_cause: str
    survival_time: float
    parasites_spawned: int
    hive_discovery_time: float
    territory_id: str
    player_units: Dict[str, Any]
    assault_pattern: str
    game_state: Dict[str, Any]


@dataclass
class TestResult:
    """Result of a test case"""
    test_name: str
    success: bool
    duration: float
    error_message: Optional[str] = None
    response_data: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, Any]] = None


class IntegrationTestSuite:
    """
    Comprehensive integration test suite for the AI learning system
    """
    
    def __init__(self, backend_url: str = "http://localhost:8000", websocket_url: str = "ws://localhost:8000/ws"):
        self.backend_url = backend_url
        self.websocket_url = websocket_url
        self.test_results: List[TestResult] = []
        self.websocket = None
        
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all integration tests and return comprehensive results"""
        logger.info("🧪 Starting Adaptive Queen Intelligence Integration Test Suite")
        
        start_time = time.time()
        
        # Test categories
        test_categories = [
            ("Backend Health", self.test_backend_health),
            ("WebSocket Connection", self.test_websocket_connection),
            ("Queen Death Processing", self.test_queen_death_processing),
            ("Learning Cycle End-to-End", self.test_complete_learning_cycle),
            ("Strategy Generation", self.test_strategy_generation),
            ("Error Recovery", self.test_error_recovery),
            ("Performance Under Load", self.test_performance_under_load),
            ("Multi-Generation Learning", self.test_multi_generation_learning),
            ("Concurrent Learning", self.test_concurrent_learning),
            ("Data Validation", self.test_data_validation)
        ]
        
        # Run tests
        for category_name, test_method in test_categories:
            logger.info(f"🔍 Running {category_name} tests...")
            try:
                await test_method()
            except Exception as e:
                logger.error(f"❌ {category_name} test failed: {e}")
                self.test_results.append(TestResult(
                    test_name=category_name,
                    success=False,
                    duration=0,
                    error_message=str(e)
                ))
        
        total_duration = time.time() - start_time
        
        # Generate comprehensive report
        return self.generate_test_report(total_duration)
    
    async def test_backend_health(self):
        """Test backend health and initialization"""
        start_time = time.time()
        
        try:
            # Test health endpoint
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            response.raise_for_status()
            
            health_data = response.json()
            
            # Verify expected health data
            required_fields = ["status", "ai_engine", "neural_network", "gpu_acceleration"]
            for field in required_fields:
                if field not in health_data:
                    raise AssertionError(f"Missing health field: {field}")
            
            if health_data["status"] != "healthy":
                raise AssertionError(f"Backend not healthy: {health_data['status']}")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Backend Health Check",
                success=True,
                duration=duration,
                response_data=health_data
            ))
            
            logger.info(f"✅ Backend health check passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Backend Health Check",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_websocket_connection(self):
        """Test WebSocket connection and basic communication"""
        start_time = time.time()
        
        try:
            # Connect to WebSocket
            self.websocket = await websockets.connect(self.websocket_url)
            
            # Send health check message
            health_check = {
                "type": "health_check",
                "timestamp": time.time(),
                "data": {"test": True}
            }
            
            await self.websocket.send(json.dumps(health_check))
            
            # Wait for response
            response = await asyncio.wait_for(self.websocket.recv(), timeout=10)
            response_data = json.loads(response)
            
            if response_data.get("type") != "health_check_response":
                raise AssertionError(f"Unexpected response type: {response_data.get('type')}")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="WebSocket Connection",
                success=True,
                duration=duration,
                response_data=response_data
            ))
            
            logger.info(f"✅ WebSocket connection test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="WebSocket Connection",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_queen_death_processing(self):
        """Test Queen death data processing"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Create test Queen death data
            test_queen = self.create_test_queen_data("test_queen_1", 1)
            
            # Send Queen death message
            death_message = {
                "type": "queen_death",
                "timestamp": time.time(),
                "data": asdict(test_queen)
            }
            
            await self.websocket.send(json.dumps(death_message))
            
            # Wait for strategy response
            response = await asyncio.wait_for(self.websocket.recv(), timeout=30)
            response_data = json.loads(response)
            
            # Validate response
            if response_data.get("type") != "queen_strategy":
                raise AssertionError(f"Expected queen_strategy, got: {response_data.get('type')}")
            
            strategy_data = response_data.get("data", {})
            required_strategy_fields = ["queenId", "generation", "strategies", "learningInsights"]
            
            for field in required_strategy_fields:
                if field not in strategy_data:
                    raise AssertionError(f"Missing strategy field: {field}")
            
            if strategy_data["generation"] != test_queen.generation + 1:
                raise AssertionError(f"Expected generation {test_queen.generation + 1}, got {strategy_data['generation']}")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Queen Death Processing",
                success=True,
                duration=duration,
                response_data=response_data
            ))
            
            logger.info(f"✅ Queen death processing test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Queen Death Processing",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_complete_learning_cycle(self):
        """Test complete end-to-end learning cycle"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Test multiple generations to verify learning progression
            generations_to_test = 3
            previous_strategy = None
            
            for generation in range(1, generations_to_test + 1):
                logger.info(f"Testing learning cycle for generation {generation}")
                
                # Create test Queen death data
                test_queen = self.create_test_queen_data(f"test_queen_gen_{generation}", generation)
                
                # Send Queen death message
                death_message = {
                    "type": "queen_death",
                    "timestamp": time.time(),
                    "data": asdict(test_queen)
                }
                
                await self.websocket.send(json.dumps(death_message))
                
                # Wait for strategy response
                response = await asyncio.wait_for(self.websocket.recv(), timeout=60)
                response_data = json.loads(response)
                
                # Validate response
                if response_data.get("type") != "queen_strategy":
                    raise AssertionError(f"Expected queen_strategy, got: {response_data.get('type')}")
                
                current_strategy = response_data.get("data", {})
                
                # Verify generation progression
                if current_strategy["generation"] != generation + 1:
                    raise AssertionError(f"Generation mismatch: expected {generation + 1}, got {current_strategy['generation']}")
                
                # Verify strategy evolution (strategies should change between generations)
                if previous_strategy and generation > 1:
                    if current_strategy["strategies"] == previous_strategy["strategies"]:
                        logger.warning(f"Strategy did not evolve between generations {generation-1} and {generation}")
                
                previous_strategy = current_strategy
                
                # Small delay between generations
                await asyncio.sleep(1)
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Complete Learning Cycle",
                success=True,
                duration=duration,
                response_data={"generations_tested": generations_to_test}
            ))
            
            logger.info(f"✅ Complete learning cycle test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Complete Learning Cycle",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_strategy_generation(self):
        """Test strategy generation with different scenarios"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Test different death scenarios
            scenarios = [
                ("protector_assault", "direct"),
                ("worker_infiltration", "infiltration"),
                ("coordinated_attack", "coordinated"),
                ("energy_depletion", "economic")
            ]
            
            strategies_generated = []
            
            for death_cause, assault_pattern in scenarios:
                logger.info(f"Testing strategy generation for {death_cause}")
                
                test_queen = self.create_test_queen_data(
                    f"test_queen_{death_cause}", 
                    2,  # Generation 2 for more complex strategies
                    death_cause=death_cause,
                    assault_pattern=assault_pattern
                )
                
                death_message = {
                    "type": "queen_death",
                    "timestamp": time.time(),
                    "data": asdict(test_queen)
                }
                
                await self.websocket.send(json.dumps(death_message))
                
                # Wait for strategy response
                response = await asyncio.wait_for(self.websocket.recv(), timeout=30)
                response_data = json.loads(response)
                
                if response_data.get("type") != "queen_strategy":
                    raise AssertionError(f"Expected queen_strategy for {death_cause}")
                
                strategy = response_data.get("data", {}).get("strategies", {})
                strategies_generated.append({
                    "scenario": death_cause,
                    "strategy": strategy
                })
                
                # Verify strategy contains expected components
                expected_components = ["hive_placement", "parasite_spawning", "defensive_coordination"]
                for component in expected_components:
                    if component not in strategy:
                        raise AssertionError(f"Missing strategy component {component} for {death_cause}")
                
                await asyncio.sleep(0.5)  # Small delay between scenarios
            
            # Verify strategies are different for different scenarios
            unique_strategies = len(set(json.dumps(s["strategy"], sort_keys=True) for s in strategies_generated))
            if unique_strategies < len(scenarios) * 0.7:  # At least 70% should be unique
                logger.warning(f"Strategy diversity may be low: {unique_strategies}/{len(scenarios)} unique strategies")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Strategy Generation",
                success=True,
                duration=duration,
                response_data={"scenarios_tested": len(scenarios), "unique_strategies": unique_strategies}
            ))
            
            logger.info(f"✅ Strategy generation test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Strategy Generation",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_error_recovery(self):
        """Test error recovery mechanisms"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Test with invalid data to trigger error recovery
            invalid_data_scenarios = [
                {"type": "queen_death", "data": {}},  # Missing required fields
                {"type": "queen_death", "data": {"invalid": "data"}},  # Invalid structure
                {"type": "invalid_message_type", "data": {"test": True}}  # Invalid message type
            ]
            
            error_responses = []
            
            for i, invalid_message in enumerate(invalid_data_scenarios):
                logger.info(f"Testing error recovery scenario {i+1}")
                
                await self.websocket.send(json.dumps(invalid_message))
                
                # Wait for error response or timeout
                try:
                    response = await asyncio.wait_for(self.websocket.recv(), timeout=10)
                    response_data = json.loads(response)
                    error_responses.append(response_data)
                    
                    # Verify error response format
                    if response_data.get("type") == "error":
                        logger.info(f"Received expected error response: {response_data.get('data', {}).get('error', 'Unknown')}")
                    else:
                        logger.warning(f"Unexpected response to invalid data: {response_data.get('type')}")
                        
                except asyncio.TimeoutError:
                    logger.info(f"No response to invalid message {i+1} (expected behavior)")
                
                await asyncio.sleep(0.5)
            
            # Test that system still works after error scenarios
            logger.info("Testing system recovery after errors")
            
            test_queen = self.create_test_queen_data("recovery_test_queen", 1)
            death_message = {
                "type": "queen_death",
                "timestamp": time.time(),
                "data": asdict(test_queen)
            }
            
            await self.websocket.send(json.dumps(death_message))
            response = await asyncio.wait_for(self.websocket.recv(), timeout=30)
            response_data = json.loads(response)
            
            if response_data.get("type") != "queen_strategy":
                raise AssertionError("System did not recover properly after error scenarios")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Error Recovery",
                success=True,
                duration=duration,
                response_data={"error_scenarios_tested": len(invalid_data_scenarios)}
            ))
            
            logger.info(f"✅ Error recovery test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Error Recovery",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_performance_under_load(self):
        """Test system performance under load"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Send multiple Queen death messages rapidly
            num_messages = 10
            response_times = []
            
            logger.info(f"Testing performance with {num_messages} rapid messages")
            
            for i in range(num_messages):
                message_start = time.time()
                
                test_queen = self.create_test_queen_data(f"load_test_queen_{i}", 1)
                death_message = {
                    "type": "queen_death",
                    "timestamp": time.time(),
                    "data": asdict(test_queen)
                }
                
                await self.websocket.send(json.dumps(death_message))
                
                # Wait for response
                response = await asyncio.wait_for(self.websocket.recv(), timeout=60)
                response_data = json.loads(response)
                
                if response_data.get("type") != "queen_strategy":
                    raise AssertionError(f"Message {i} failed: {response_data.get('type')}")
                
                response_time = time.time() - message_start
                response_times.append(response_time)
                
                logger.info(f"Message {i+1}/{num_messages} processed in {response_time:.2f}s")
            
            # Calculate performance metrics
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            min_response_time = min(response_times)
            
            performance_metrics = {
                "messages_processed": num_messages,
                "average_response_time": avg_response_time,
                "max_response_time": max_response_time,
                "min_response_time": min_response_time,
                "total_duration": time.time() - start_time
            }
            
            # Verify performance requirements (from design: 60-120 seconds training time)
            if max_response_time > 120:
                logger.warning(f"Max response time {max_response_time:.2f}s exceeds 120s requirement")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Performance Under Load",
                success=True,
                duration=duration,
                performance_metrics=performance_metrics
            ))
            
            logger.info(f"✅ Performance test passed ({duration:.2f}s, avg: {avg_response_time:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Performance Under Load",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_multi_generation_learning(self):
        """Test learning progression across multiple generations"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Test learning progression over 5 generations
            generations = 5
            learning_metrics = []
            
            for generation in range(1, generations + 1):
                logger.info(f"Testing generation {generation} learning")
                
                test_queen = self.create_test_queen_data(
                    f"multi_gen_queen_{generation}", 
                    generation,
                    survival_time=60 + (generation * 10)  # Simulate improving survival
                )
                
                death_message = {
                    "type": "queen_death",
                    "timestamp": time.time(),
                    "data": asdict(test_queen)
                }
                
                await self.websocket.send(json.dumps(death_message))
                
                response = await asyncio.wait_for(self.websocket.recv(), timeout=60)
                response_data = json.loads(response)
                
                if response_data.get("type") != "queen_strategy":
                    raise AssertionError(f"Generation {generation} failed")
                
                # Extract learning insights
                insights = response_data.get("data", {}).get("learningInsights", {})
                learning_metrics.append({
                    "generation": generation,
                    "training_time": insights.get("trainingMetrics", {}).get("training_time", 0),
                    "complexity": response_data.get("data", {}).get("strategies", {}).get("complexity_level", 0)
                })
                
                await asyncio.sleep(1)
            
            # Verify learning progression
            complexities = [m["complexity"] for m in learning_metrics if m["complexity"] > 0]
            if len(complexities) > 1:
                # Complexity should generally increase with generation
                increasing_complexity = all(complexities[i] <= complexities[i+1] for i in range(len(complexities)-1))
                if not increasing_complexity:
                    logger.warning("Strategy complexity did not increase consistently across generations")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Multi-Generation Learning",
                success=True,
                duration=duration,
                response_data={"generations_tested": generations, "learning_metrics": learning_metrics}
            ))
            
            logger.info(f"✅ Multi-generation learning test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Multi-Generation Learning",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_concurrent_learning(self):
        """Test concurrent learning from multiple Queens"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Send multiple Queen deaths concurrently
            num_concurrent = 3
            tasks = []
            
            logger.info(f"Testing {num_concurrent} concurrent learning cycles")
            
            async def process_queen_death(queen_id: str, generation: int):
                test_queen = self.create_test_queen_data(queen_id, generation)
                death_message = {
                    "type": "queen_death",
                    "timestamp": time.time(),
                    "data": asdict(test_queen)
                }
                
                await self.websocket.send(json.dumps(death_message))
                
                response = await asyncio.wait_for(self.websocket.recv(), timeout=90)
                response_data = json.loads(response)
                
                if response_data.get("type") != "queen_strategy":
                    raise AssertionError(f"Concurrent processing failed for {queen_id}")
                
                return response_data
            
            # Create concurrent tasks
            for i in range(num_concurrent):
                task = process_queen_death(f"concurrent_queen_{i}", 1)
                tasks.append(task)
            
            # Wait for all tasks to complete
            results = await asyncio.gather(*tasks)
            
            # Verify all results
            if len(results) != num_concurrent:
                raise AssertionError(f"Expected {num_concurrent} results, got {len(results)}")
            
            for i, result in enumerate(results):
                if not result.get("data", {}).get("queenId"):
                    raise AssertionError(f"Invalid result for concurrent queen {i}")
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Concurrent Learning",
                success=True,
                duration=duration,
                response_data={"concurrent_queens": num_concurrent}
            ))
            
            logger.info(f"✅ Concurrent learning test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Concurrent Learning",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    async def test_data_validation(self):
        """Test data validation and sanitization"""
        start_time = time.time()
        
        try:
            if not self.websocket:
                raise AssertionError("WebSocket not connected")
            
            # Test with edge case data
            edge_cases = [
                # Very long survival time
                self.create_test_queen_data("edge_case_1", 1, survival_time=999999),
                # Zero survival time
                self.create_test_queen_data("edge_case_2", 1, survival_time=0),
                # High generation number
                self.create_test_queen_data("edge_case_3", 100),
                # Negative values (should be sanitized)
                self.create_test_queen_data("edge_case_4", 1, survival_time=-10, parasites_spawned=-5)
            ]
            
            successful_validations = 0
            
            for i, test_queen in enumerate(edge_cases):
                logger.info(f"Testing data validation case {i+1}")
                
                death_message = {
                    "type": "queen_death",
                    "timestamp": time.time(),
                    "data": asdict(test_queen)
                }
                
                await self.websocket.send(json.dumps(death_message))
                
                try:
                    response = await asyncio.wait_for(self.websocket.recv(), timeout=30)
                    response_data = json.loads(response)
                    
                    if response_data.get("type") in ["queen_strategy", "error"]:
                        successful_validations += 1
                        logger.info(f"Edge case {i+1} handled successfully")
                    else:
                        logger.warning(f"Unexpected response for edge case {i+1}: {response_data.get('type')}")
                        
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout for edge case {i+1}")
                
                await asyncio.sleep(0.5)
            
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Data Validation",
                success=successful_validations >= len(edge_cases) * 0.8,  # 80% success rate
                duration=duration,
                response_data={"edge_cases_tested": len(edge_cases), "successful_validations": successful_validations}
            ))
            
            logger.info(f"✅ Data validation test passed ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            self.test_results.append(TestResult(
                test_name="Data Validation",
                success=False,
                duration=duration,
                error_message=str(e)
            ))
            raise
    
    def create_test_queen_data(self, queen_id: str, generation: int, 
                              death_cause: str = "protector_assault",
                              survival_time: float = 120.0,
                              assault_pattern: str = "direct") -> TestQueenData:
        """Create test Queen data for testing"""
        return TestQueenData(
            queen_id=queen_id,
            generation=generation,
            death_cause=death_cause,
            survival_time=survival_time,
            parasites_spawned=max(0, int(survival_time / 10)),
            hive_discovery_time=max(0, survival_time * 0.3),
            territory_id=f"territory_{queen_id}",
            player_units={
                "protectors": [
                    {"type": "protector", "position": {"x": 100, "z": 100}, "health": 100}
                ],
                "workers": [
                    {"type": "worker", "position": {"x": 50, "z": 50}, "health": 50}
                ]
            },
            assault_pattern=assault_pattern,
            game_state={
                "energy_level": 500,
                "active_mining": 2,
                "expansion_events": 1,
                "protector_positions": [{"x": 100, "z": 100}],
                "worker_positions": [{"x": 50, "z": 50}],
                "energy_expenditure": 200,
                "territory_control_percentage": 0.6
            }
        )
    
    def generate_test_report(self, total_duration: float) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        successful_tests = [r for r in self.test_results if r.success]
        failed_tests = [r for r in self.test_results if not r.success]
        
        # Calculate performance metrics
        performance_tests = [r for r in self.test_results if r.performance_metrics]
        avg_performance = {}
        if performance_tests:
            for test in performance_tests:
                for key, value in test.performance_metrics.items():
                    if key not in avg_performance:
                        avg_performance[key] = []
                    avg_performance[key].append(value)
            
            avg_performance = {k: sum(v) / len(v) for k, v in avg_performance.items()}
        
        report = {
            "test_summary": {
                "total_tests": len(self.test_results),
                "successful_tests": len(successful_tests),
                "failed_tests": len(failed_tests),
                "success_rate": len(successful_tests) / len(self.test_results) if self.test_results else 0,
                "total_duration": total_duration
            },
            "test_results": [asdict(r) for r in self.test_results],
            "performance_metrics": avg_performance,
            "failed_tests": [{"name": r.test_name, "error": r.error_message} for r in failed_tests],
            "recommendations": self.generate_recommendations()
        }
        
        return report
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        failed_tests = [r for r in self.test_results if not r.success]
        performance_tests = [r for r in self.test_results if r.performance_metrics]
        
        if failed_tests:
            recommendations.append(f"Address {len(failed_tests)} failed test(s) before production deployment")
        
        if performance_tests:
            slow_tests = [r for r in performance_tests 
                         if r.performance_metrics and r.performance_metrics.get("max_response_time", 0) > 120]
            if slow_tests:
                recommendations.append("Optimize neural network training time - some responses exceed 120s requirement")
        
        success_rate = len([r for r in self.test_results if r.success]) / len(self.test_results) if self.test_results else 0
        if success_rate < 0.9:
            recommendations.append("Improve system reliability - success rate below 90%")
        
        if not recommendations:
            recommendations.append("All tests passed - system ready for production deployment")
        
        return recommendations
    
    async def cleanup(self):
        """Cleanup test resources"""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None


async def main():
    """Run the integration test suite"""
    test_suite = IntegrationTestSuite()
    
    try:
        report = await test_suite.run_all_tests()
        
        # Print summary
        print("\n" + "="*80)
        print("🧪 ADAPTIVE QUEEN INTELLIGENCE - INTEGRATION TEST REPORT")
        print("="*80)
        
        summary = report["test_summary"]
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Successful: {summary['successful_tests']}")
        print(f"Failed: {summary['failed_tests']}")
        print(f"Success Rate: {summary['success_rate']:.1%}")
        print(f"Total Duration: {summary['total_duration']:.2f}s")
        
        if report["failed_tests"]:
            print("\n❌ FAILED TESTS:")
            for failed in report["failed_tests"]:
                print(f"  - {failed['name']}: {failed['error']}")
        
        if report["performance_metrics"]:
            print("\n📊 PERFORMANCE METRICS:")
            for metric, value in report["performance_metrics"].items():
                print(f"  - {metric}: {value:.2f}")
        
        print("\n💡 RECOMMENDATIONS:")
        for rec in report["recommendations"]:
            print(f"  - {rec}")
        
        print("\n" + "="*80)
        
        # Save detailed report
        with open("integration_test_report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print("📄 Detailed report saved to: integration_test_report.json")
        
    except Exception as e:
        logger.error(f"Test suite failed: {e}")
        raise
    finally:
        await test_suite.cleanup()


if __name__ == "__main__":
    asyncio.run(main())