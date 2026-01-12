"""
Data Models for Adaptive Queen Intelligence system
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
import json


@dataclass
class QueenDeathData:
    """Structured data for Queen death events"""
    queen_id: str
    territory_id: str
    generation: int
    death_location: Dict[str, float]  # {x, y, z}
    death_cause: str
    survival_time: float
    parasites_spawned: int
    hive_discovery_time: float
    player_units: Dict[str, List[Dict]]
    assault_pattern: Dict[str, Any]
    game_state: Dict[str, Any]
    timestamp: float = 0.0
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QueenDeathData':
        """Create QueenDeathData from dictionary"""
        return cls(
            queen_id=data.get('queenId', ''),
            territory_id=data.get('territoryId', ''),
            generation=data.get('generation', 1),
            death_location=data.get('deathLocation', {'x': 0, 'y': 0, 'z': 0}),
            death_cause=data.get('deathCause', 'unknown'),
            survival_time=data.get('survivalTime', 0.0),
            parasites_spawned=data.get('parasitesSpawned', 0),
            hive_discovery_time=data.get('hiveDiscoveryTime', 0.0),
            player_units=data.get('playerUnits', {}),
            assault_pattern=data.get('assaultPattern', {}),
            game_state=data.get('gameState', {}),
            timestamp=data.get('timestamp', 0.0)
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class DeathAnalysis:
    """Analysis results from Queen death"""
    queen_id: str
    generation: int
    primary_cause: str
    spatial_insights: Dict[str, Any]
    temporal_insights: Dict[str, Any]
    tactical_insights: Dict[str, Any]
    survival_improvement: float
    failed_strategies: List[int]
    feature_vector: List[float]
    game_state_features: List[float]
    
    def get_failed_locations(self) -> List[Dict[str, float]]:
        """Get failed hive locations"""
        return self.spatial_insights.get('failed_locations', [])
    
    def get_spawn_effectiveness(self) -> float:
        """Get spawning strategy effectiveness"""
        return self.tactical_insights.get('spawn_effectiveness', 0.5)
    
    def get_defensive_failures(self) -> List[str]:
        """Get defensive strategy failures"""
        return self.tactical_insights.get('defensive_failures', [])
    
    def get_parasites_spawned(self) -> int:
        """Get number of parasites spawned"""
        return self.tactical_insights.get('parasites_spawned', 0)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class GameStateSnapshot:
    """Snapshot of game state for analysis"""
    timestamp: float
    energy_level: int
    active_mining: List[Dict[str, Any]]
    protector_positions: List[Dict[str, float]]
    worker_positions: List[Dict[str, float]]
    explored_areas: List[Dict[str, Any]]
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GameStateSnapshot':
        """Create GameStateSnapshot from dictionary"""
        return cls(
            timestamp=data.get('timestamp', 0.0),
            energy_level=data.get('energy_level', 500),
            active_mining=data.get('active_mining', []),
            protector_positions=data.get('protector_positions', []),
            worker_positions=data.get('worker_positions', []),
            explored_areas=data.get('explored_areas', [])
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class PlayerProfile:
    """Player behavior profile classification"""
    player_type: str  # aggressive, defensive, economic, adaptive, balanced
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class PlayerPatterns:
    """Comprehensive player behavior patterns"""
    mining_patterns: Dict[str, Any]
    combat_patterns: Dict[str, Any]
    energy_patterns: Dict[str, Any]
    exploration_patterns: Dict[str, Any]
    player_profile: PlayerProfile
    pattern_confidence: float
    
    def get_approach_vectors(self) -> Dict[str, Any]:
        """Get player approach patterns"""
        return {
            "preferred_angles": self.combat_patterns.get('approach_angles', []),
            "timing_patterns": self.combat_patterns.get('timing_patterns', {}),
            "coordination_level": self.combat_patterns.get('coordination', 0.5)
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class QueenStrategy:
    """Complete Queen strategy for a generation"""
    generation: int
    hive_placement: Dict[str, Any]
    parasite_spawning: Dict[str, Any]
    defensive_coordination: Dict[str, Any]
    predictive_behavior: Optional[Dict[str, Any]]
    complexity_level: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


# Message protocol data classes

@dataclass
class QueenDeathMessage:
    """WebSocket message for Queen death events"""
    type: str = "queen_death"
    timestamp: float = 0.0
    data: QueenDeathData = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "type": self.type,
            "timestamp": self.timestamp,
            "data": self.data.to_dict() if self.data else {}
        }


@dataclass
class QueenStrategyMessage:
    """WebSocket message for Queen strategy responses"""
    type: str = "queen_strategy"
    timestamp: float = 0.0
    data: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "type": self.type,
            "timestamp": self.timestamp,
            "data": self.data or {}
        }


@dataclass
class LearningProgressMessage:
    """WebSocket message for learning progress updates"""
    type: str = "learning_progress"
    timestamp: float = 0.0
    data: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "type": self.type,
            "timestamp": self.timestamp,
            "data": self.data or {}
        }


# Utility functions for data conversion

def serialize_message(message) -> str:
    """Serialize message object to JSON string"""
    if hasattr(message, 'to_dict'):
        return json.dumps(message.to_dict())
    else:
        return json.dumps(message)


def deserialize_message(json_str: str) -> Dict[str, Any]:
    """Deserialize JSON string to message dictionary"""
    return json.loads(json_str)