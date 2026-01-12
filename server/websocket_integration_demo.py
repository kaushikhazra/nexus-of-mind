"""
WebSocket Integration Demo
Demonstrates the enhanced WebSocket communication protocol
"""

import asyncio
import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WebSocketProtocolDemo:
    """Demonstrates WebSocket protocol features"""
    
    def __init__(self):
        self.demo_messages = []
        self.responses = []
    
    def log_demo(self, message: str):
        """Log demo message"""
        print(f"🔹 {message}")
        self.demo_messages.append(message)
    
    def demonstrate_message_validation(self):
        """Demonstrate message validation features"""
        print("\n" + "="*60)
        print("📋 MESSAGE VALIDATION DEMONSTRATION")
        print("="*60)
        
        # Valid message example
        valid_message = {
            "type": "queen_death",
            "timestamp": 1234567890.0,
            "data": {
                "queenId": "queen_demo_001",
                "territoryId": "territory_alpha",
                "generation": 3,
                "deathLocation": {"x": 125.5, "y": 10.0, "z": 87.3},
                "deathCause": "protector_assault",
                "survivalTime": 245.7,
                "parasitesSpawned": 12,
                "hiveDiscoveryTime": 89.2,
                "playerUnits": {
                    "protectors": [
                        {"id": "prot_001", "position": {"x": 120.0, "z": 85.0}},
                        {"id": "prot_002", "position": {"x": 130.0, "z": 90.0}}
                    ],
                    "workers": [
                        {"id": "work_001", "position": {"x": 115.0, "z": 80.0}}
                    ]
                },
                "assaultPattern": {
                    "type": "coordinated_flanking",
                    "approach_vectors": [{"angle": 45, "units": 2}],
                    "timing": "synchronized"
                },
                "gameState": {
                    "energy_level": 750,
                    "active_mining": [{"location": {"x": 100.0, "z": 100.0}}],
                    "territory_control": 0.65
                }
            }
        }
        
        self.log_demo("✅ Valid Queen Death Message Structure:")
        print(json.dumps(valid_message, indent=2))
        
        # Invalid message examples
        invalid_messages = [
            {
                "description": "Missing required 'generation' field",
                "message": {
                    "type": "queen_death",
                    "data": {
                        "queenId": "queen_demo_002",
                        "deathLocation": {"x": 100.0, "y": 5.0, "z": 100.0},
                        "deathCause": "worker_infiltration"
                        # Missing generation field
                    }
                }
            },
            {
                "description": "Invalid death cause enum value",
                "message": {
                    "type": "queen_death",
                    "data": {
                        "queenId": "queen_demo_003",
                        "generation": 1,
                        "deathLocation": {"x": 100.0, "y": 5.0, "z": 100.0},
                        "deathCause": "invalid_cause_type"  # Not in enum
                    }
                }
            },
            {
                "description": "Business logic violation - negative survival time",
                "message": {
                    "type": "queen_death",
                    "data": {
                        "queenId": "queen_demo_004",
                        "generation": 2,
                        "deathLocation": {"x": 100.0, "y": 5.0, "z": 100.0},
                        "deathCause": "protector_assault",
                        "survivalTime": -50.0,  # Invalid negative time
                        "parasitesSpawned": 5,
                        "hiveDiscoveryTime": 30.0,
                        "playerUnits": {},
                        "assaultPattern": {},
                        "gameState": {}
                    }
                }
            }
        ]
        
        for invalid in invalid_messages:
            self.log_demo(f"❌ {invalid['description']}:")
            print(json.dumps(invalid['message'], indent=2))
            print()
    
    def demonstrate_message_types(self):
        """Demonstrate different message types"""
        print("\n" + "="*60)
        print("📨 MESSAGE TYPES DEMONSTRATION")
        print("="*60)
        
        message_types = [
            {
                "type": "queen_death",
                "description": "Triggers AI learning from Queen death",
                "example": {
                    "type": "queen_death",
                    "data": {
                        "queenId": "queen_001",
                        "generation": 1,
                        "deathLocation": {"x": 50.0, "y": 0.0, "z": 50.0},
                        "deathCause": "protector_assault",
                        "survivalTime": 120.0,
                        "parasitesSpawned": 3,
                        "hiveDiscoveryTime": 45.0,
                        "playerUnits": {},
                        "assaultPattern": {},
                        "gameState": {}
                    }
                }
            },
            {
                "type": "queen_success",
                "description": "Positive reinforcement for successful strategies",
                "example": {
                    "type": "queen_success",
                    "data": {
                        "queenId": "queen_002",
                        "generation": 5,
                        "survivalTime": 600.0,
                        "successful_strategies": ["defensive_swarm", "predictive_spawning"],
                        "effectiveness": 0.85,
                        "game_state": {"energy_disrupted": 400}
                    }
                }
            },
            {
                "type": "learning_progress_request",
                "description": "Request current learning progress",
                "example": {
                    "type": "learning_progress_request",
                    "data": {
                        "queenId": "queen_003"
                    }
                }
            },
            {
                "type": "ping",
                "description": "Connection health check",
                "example": {
                    "type": "ping",
                    "timestamp": 1234567890.0
                }
            },
            {
                "type": "health_check",
                "description": "System health status request",
                "example": {
                    "type": "health_check"
                }
            },
            {
                "type": "reconnect",
                "description": "Client reconnection with message recovery",
                "example": {
                    "type": "reconnect",
                    "data": {
                        "clientId": "client_abc123",
                        "lastMessageId": "msg_1234567890_xyz789"
                    }
                }
            }
        ]
        
        for msg_type in message_types:
            self.log_demo(f"📤 {msg_type['type'].upper()}: {msg_type['description']}")
            print(json.dumps(msg_type['example'], indent=2))
            print()
    
    def demonstrate_response_messages(self):
        """Demonstrate response message formats"""
        print("\n" + "="*60)
        print("📥 RESPONSE MESSAGE FORMATS")
        print("="*60)
        
        responses = [
            {
                "type": "queen_strategy",
                "description": "AI-generated strategy for next generation",
                "example": {
                    "type": "queen_strategy",
                    "timestamp": 1234567890.0,
                    "messageId": "msg_response_001",
                    "clientId": "client_demo",
                    "data": {
                        "queenId": "queen_001",
                        "generation": 2,
                        "strategies": {
                            "hivePlacement": {
                                "strategy": "avoid_death_locations",
                                "parameters": {
                                    "avoidance_radius": 25.0,
                                    "preferred_terrain": "elevated"
                                }
                            },
                            "parasiteSpawning": {
                                "strategy": "adaptive_timing",
                                "parameters": {
                                    "spawn_delay": 15.0,
                                    "burst_size": 4
                                }
                            },
                            "defensiveCoordination": {
                                "strategy": "swarm_defense",
                                "parameters": {
                                    "coordination_radius": 30.0,
                                    "response_time": 2.0
                                }
                            }
                        },
                        "learningInsights": {
                            "deathCause": "protector_assault",
                            "survivalImprovement": 0.25,
                            "playerPatterns": {
                                "type": "aggressive",
                                "confidence": 0.8
                            },
                            "trainingMetrics": {
                                "training_time": 87.3,
                                "loss_improvement": 0.15
                            }
                        },
                        "estimatedTrainingTime": 87.3
                    }
                }
            },
            {
                "type": "learning_progress",
                "description": "Current learning progress information",
                "example": {
                    "type": "learning_progress",
                    "timestamp": 1234567890.0,
                    "data": {
                        "queenId": "queen_003",
                        "currentGeneration": 4,
                        "learningPhase": "analyzing_patterns",
                        "progress": 0.65,
                        "estimatedTimeRemaining": 45.0,
                        "recentImprovements": [
                            "Better hive placement strategy",
                            "Improved spawn timing"
                        ]
                    }
                }
            },
            {
                "type": "pong",
                "description": "Response to ping with connection metrics",
                "example": {
                    "type": "pong",
                    "timestamp": 1234567890.0,
                    "data": {
                        "clientId": "client_demo",
                        "serverStatus": "healthy",
                        "requestTimestamp": 1234567889.5,
                        "responseTime": 0.5,
                        "messageStats": {
                            "total_processed": 156,
                            "successful": 148,
                            "failed": 8,
                            "success_rate": 94.9
                        }
                    }
                }
            },
            {
                "type": "error",
                "description": "Error response with detailed information",
                "example": {
                    "type": "error",
                    "timestamp": 1234567890.0,
                    "data": {
                        "error": "Message validation failed: Missing required field 'generation'",
                        "errorCode": "VALIDATION_ERROR",
                        "status": "error",
                        "retryable": False,
                        "supportedMessageTypes": [
                            "queen_death", "queen_success", "learning_progress_request",
                            "ping", "health_check", "reconnect"
                        ]
                    }
                }
            }
        ]
        
        for response in responses:
            self.log_demo(f"📨 {response['type'].upper()}: {response['description']}")
            print(json.dumps(response['example'], indent=2))
            print()
    
    def demonstrate_error_handling(self):
        """Demonstrate error handling scenarios"""
        print("\n" + "="*60)
        print("⚠️  ERROR HANDLING SCENARIOS")
        print("="*60)
        
        error_scenarios = [
            {
                "scenario": "Validation Error",
                "description": "Client sends message with invalid schema",
                "error_response": {
                    "type": "error",
                    "timestamp": 1234567890.0,
                    "data": {
                        "error": "Schema validation error: 'generation' is a required property",
                        "errorCode": "VALIDATION_ERROR",
                        "status": "error",
                        "retryable": False
                    }
                }
            },
            {
                "scenario": "Processing Timeout",
                "description": "Neural network training takes too long",
                "error_response": {
                    "type": "error",
                    "timestamp": 1234567890.0,
                    "data": {
                        "error": "Processing timeout - neural network training took too long",
                        "errorCode": "PROCESSING_TIMEOUT",
                        "status": "error",
                        "retryable": True
                    }
                }
            },
            {
                "scenario": "Connection Error",
                "description": "WebSocket connection issues",
                "error_response": {
                    "type": "error",
                    "timestamp": 1234567890.0,
                    "data": {
                        "error": "Connection error occurred",
                        "errorCode": "CONNECTION_ERROR",
                        "status": "error",
                        "retryable": True
                    }
                }
            },
            {
                "scenario": "Business Logic Error",
                "description": "Data violates business rules",
                "error_response": {
                    "type": "error",
                    "timestamp": 1234567890.0,
                    "data": {
                        "error": "Business logic validation failed: Survival time cannot be negative",
                        "errorCode": "BUSINESS_VALIDATION_ERROR",
                        "status": "error",
                        "retryable": False
                    }
                }
            }
        ]
        
        for scenario in error_scenarios:
            self.log_demo(f"🚨 {scenario['scenario']}: {scenario['description']}")
            print(json.dumps(scenario['error_response'], indent=2))
            print()
    
    def demonstrate_connection_features(self):
        """Demonstrate connection management features"""
        print("\n" + "="*60)
        print("🔗 CONNECTION MANAGEMENT FEATURES")
        print("="*60)
        
        features = [
            {
                "feature": "Automatic Reconnection",
                "description": "Client automatically reconnects with exponential backoff",
                "details": [
                    "Max reconnection attempts: 10",
                    "Reconnection interval: 5 seconds (exponential backoff)",
                    "Preserves client ID for session continuity"
                ]
            },
            {
                "feature": "Message Queuing",
                "description": "Messages queued when client is offline",
                "details": [
                    "Max queue size: 100 messages per client",
                    "Messages delivered on reconnection",
                    "FIFO queue with overflow protection"
                ]
            },
            {
                "feature": "Heartbeat Monitoring",
                "description": "Regular connection health checks",
                "details": [
                    "Server sends heartbeat every 30 seconds",
                    "Client responds with heartbeat_response",
                    "Automatic cleanup of stale connections"
                ]
            },
            {
                "feature": "Timeout Handling",
                "description": "Configurable timeouts for different operations",
                "details": [
                    "Message processing timeout: 120 seconds",
                    "Connection timeout: 300 seconds",
                    "Heartbeat timeout: 30 seconds"
                ]
            },
            {
                "feature": "Connection Statistics",
                "description": "Detailed connection and message statistics",
                "details": [
                    "Message count and success rate per client",
                    "Connection duration and activity tracking",
                    "Reconnection count and patterns"
                ]
            }
        ]
        
        for feature in features:
            self.log_demo(f"⚡ {feature['feature']}: {feature['description']}")
            for detail in feature['details']:
                print(f"   • {detail}")
            print()
    
    def demonstrate_protocol_flow(self):
        """Demonstrate typical protocol flow"""
        print("\n" + "="*60)
        print("🔄 TYPICAL PROTOCOL FLOW")
        print("="*60)
        
        flow_steps = [
            {
                "step": 1,
                "actor": "Client",
                "action": "Connect to WebSocket endpoint",
                "details": "ws://localhost:8000/ws or ws://localhost:8000/ws/{client_id}"
            },
            {
                "step": 2,
                "actor": "Server",
                "action": "Accept connection and start heartbeat",
                "details": "Connection registered, message queue created"
            },
            {
                "step": 3,
                "actor": "Client",
                "action": "Send Queen death data",
                "details": "Comprehensive death analysis with game state"
            },
            {
                "step": 4,
                "actor": "Server",
                "action": "Validate and process message",
                "details": "Schema validation → Business logic → AI processing"
            },
            {
                "step": 5,
                "actor": "Server",
                "action": "Train neural network",
                "details": "Death analysis → Pattern learning → Strategy generation"
            },
            {
                "step": 6,
                "actor": "Server",
                "action": "Send strategy response",
                "details": "New Queen strategy with learning insights"
            },
            {
                "step": 7,
                "actor": "Client",
                "action": "Apply strategy to next Queen",
                "details": "Implement hive placement, spawning, and defensive strategies"
            },
            {
                "step": 8,
                "actor": "Both",
                "action": "Maintain connection health",
                "details": "Periodic heartbeats and connection monitoring"
            }
        ]
        
        for step in flow_steps:
            self.log_demo(f"Step {step['step']}: {step['actor']} - {step['action']}")
            print(f"   Details: {step['details']}")
            print()
    
    def run_complete_demo(self):
        """Run complete WebSocket protocol demonstration"""
        print("🚀 ADAPTIVE QUEEN INTELLIGENCE - WEBSOCKET PROTOCOL DEMO")
        print("=" * 80)
        print("This demo showcases the enhanced WebSocket communication protocol")
        print("for real-time AI learning between the game client and Python backend.")
        print("=" * 80)
        
        # Run all demonstrations
        self.demonstrate_message_validation()
        self.demonstrate_message_types()
        self.demonstrate_response_messages()
        self.demonstrate_error_handling()
        self.demonstrate_connection_features()
        self.demonstrate_protocol_flow()
        
        # Summary
        print("\n" + "="*80)
        print("✅ WEBSOCKET PROTOCOL IMPLEMENTATION COMPLETE")
        print("="*80)
        print("Key Features Implemented:")
        print("• ✅ Message validation with JSON schemas")
        print("• ✅ Business logic validation")
        print("• ✅ Comprehensive error handling")
        print("• ✅ Automatic reconnection with exponential backoff")
        print("• ✅ Message queuing for offline scenarios")
        print("• ✅ Heartbeat monitoring and timeout handling")
        print("• ✅ Connection statistics and monitoring")
        print("• ✅ Multiple message types for different AI operations")
        print("• ✅ Structured response formats with learning insights")
        print("• ✅ Performance isolation and timeout protection")
        print("\nRequirements Satisfied:")
        print("• ✅ 5.2: WebSocket communication protocol")
        print("• ✅ 5.4: Connection management with reconnection")
        print("• ✅ 2.6: Death data transmission and validation")
        print("="*80)


if __name__ == "__main__":
    demo = WebSocketProtocolDemo()
    demo.run_complete_demo()