"""
Game state module for the simulator.

This module contains the SimulatedGameState dataclass that represents
the complete state of the game simulation at any point in time.
"""

from dataclasses import dataclass, field
from typing import List, TYPE_CHECKING
import math

if TYPE_CHECKING:
    from .config import SimulationConfig

from .entities import Worker, Protector, Parasite


@dataclass
class SimulatedGameState:
    """
    Complete game state for simulation.
    
    This class holds all entities, resources, and game state information
    needed to run the simulation and generate observations.
    
    Requirements satisfied:
    - 1.1: Contains workers, protectors, parasites lists
    - 1.1: Contains queen_energy, queen_chunk
    - 1.1: Contains player_energy, player_minerals
    - 1.2: Contains previous values for rate calculation
    """
    
    # Entities
    workers: List[Worker] = field(default_factory=list)
    protectors: List[Protector] = field(default_factory=list)
    parasites: List[Parasite] = field(default_factory=list)

    # Queen
    queen_energy: float = 50.0
    queen_chunk: int = 136  # Center of 16x16 grid (overridden by config)

    # Resources
    player_energy: float = 100.0
    player_minerals: float = 50.0
    player_energy_prev: float = 100.0  # For rate calculation
    player_minerals_prev: float = 50.0  # For rate calculation

    # Map (defaults overridden by config - all spots must be < 256 for 16x16 grid)
    mining_spots: List[int] = field(default_factory=lambda: [18, 29, 45, 67, 123, 189, 234])

    # Tick counter
    tick: int = 0

    @property
    def player_energy_rate(self) -> float:
        """Calculate energy generation rate per tick."""
        return self.player_energy - self.player_energy_prev

    @property
    def player_mineral_rate(self) -> float:
        """Calculate mineral generation rate per tick."""
        return self.player_minerals - self.player_minerals_prev

    @classmethod
    def create_initial(cls, config: 'SimulationConfig') -> 'SimulatedGameState':
        """
        Create initial game state from configuration.

        Args:
            config: Simulation configuration parameters

        Returns:
            Initial game state with workers and protectors positioned

        Requirements satisfied:
        - 1.1: Create workers at base (they will travel to mining spots)
        - 1.1: Create protectors with patrol paths
        - 1.1: Initialize resources
        """
        # Create workers at base - they will travel to their assigned mining spots
        workers = []
        for i in range(min(config.num_workers, len(config.mining_spots))):
            spot = config.mining_spots[i]
            workers.append(Worker(
                chunk=config.base_chunk,  # Start at base
                target_chunk=spot,
                base_chunk=config.base_chunk
            ))

        # Create protectors with patrol paths
        protectors = []
        for i in range(config.num_protectors):
            patrol_path = cls._generate_patrol_path(i, config)
            protectors.append(Protector(
                chunk=config.queen_chunk,
                patrol_path=patrol_path
            ))

        return cls(
            workers=workers,
            protectors=protectors,
            parasites=[],
            queen_energy=config.queen_start_energy,
            queen_chunk=config.queen_chunk,
            player_energy=config.player_start_energy,
            player_minerals=config.player_start_minerals,
            player_energy_prev=config.player_start_energy,
            player_minerals_prev=config.player_start_minerals,
            mining_spots=config.mining_spots.copy(),
            tick=0
        )

    @staticmethod
    def _generate_patrol_path(protector_index: int, config: 'SimulationConfig') -> List[int]:
        """
        Generate patrol path for a protector.
        
        Args:
            protector_index: Index of the protector (0, 1, 2, ...)
            config: Simulation configuration
            
        Returns:
            List of chunk positions forming a patrol route
            
        Requirements satisfied:
        - 3.1: Helper method for protector patrol routes
        - 3.1: Spread across territory
        """
        grid_size = config.grid_size
        queen_chunk = config.queen_chunk
        
        # Convert queen chunk to x,y coordinates
        queen_x = queen_chunk % grid_size
        queen_y = queen_chunk // grid_size
        
        # Define patrol radius based on grid size
        patrol_radius = min(6, grid_size // 3)
        
        # Create different patrol patterns for each protector
        if protector_index == 0:
            # Circular patrol around queen
            return SimulatedGameState._generate_circular_patrol(queen_x, queen_y, patrol_radius, grid_size)
        elif protector_index == 1:
            # Square patrol around queen
            return SimulatedGameState._generate_square_patrol(queen_x, queen_y, patrol_radius, grid_size)
        else:
            # Figure-8 or extended patrol for additional protectors
            return SimulatedGameState._generate_figure8_patrol(queen_x, queen_y, patrol_radius, grid_size, protector_index)

    @staticmethod
    def _generate_circular_patrol(center_x: int, center_y: int, radius: int, grid_size: int) -> List[int]:
        """Generate a circular patrol path around a center point."""
        path = []
        num_points = 8  # 8 points around the circle
        
        for i in range(num_points):
            angle = (2 * math.pi * i) / num_points
            x = center_x + int(radius * math.cos(angle))
            y = center_y + int(radius * math.sin(angle))
            
            # Clamp to grid bounds
            x = max(0, min(grid_size - 1, x))
            y = max(0, min(grid_size - 1, y))
            
            chunk = y * grid_size + x
            if chunk not in path:  # Avoid duplicates
                path.append(chunk)
        
        return path if path else [center_y * grid_size + center_x]

    @staticmethod
    def _generate_square_patrol(center_x: int, center_y: int, radius: int, grid_size: int) -> List[int]:
        """Generate a square patrol path around a center point."""
        path = []
        
        # Define square corners
        corners = [
            (center_x - radius, center_y - radius),  # Top-left
            (center_x + radius, center_y - radius),  # Top-right
            (center_x + radius, center_y + radius),  # Bottom-right
            (center_x - radius, center_y + radius),  # Bottom-left
        ]
        
        for x, y in corners:
            # Clamp to grid bounds
            x = max(0, min(grid_size - 1, x))
            y = max(0, min(grid_size - 1, y))
            
            chunk = y * grid_size + x
            if chunk not in path:  # Avoid duplicates
                path.append(chunk)
        
        return path if path else [center_y * grid_size + center_x]

    @staticmethod
    def _generate_figure8_patrol(center_x: int, center_y: int, radius: int, grid_size: int, index: int) -> List[int]:
        """Generate a figure-8 or extended patrol path."""
        path = []
        
        # Offset the patrol based on protector index to spread them out
        offset_angle = (2 * math.pi * index) / 8
        
        # Create an elongated patrol pattern
        for i in range(6):
            angle = (2 * math.pi * i) / 6 + offset_angle
            # Create figure-8 by varying the radius
            r = radius * (0.7 + 0.3 * math.sin(2 * angle))
            
            x = center_x + int(r * math.cos(angle))
            y = center_y + int(r * math.sin(angle))
            
            # Clamp to grid bounds
            x = max(0, min(grid_size - 1, x))
            y = max(0, min(grid_size - 1, y))
            
            chunk = y * grid_size + x
            if chunk not in path:  # Avoid duplicates
                path.append(chunk)
        
        return path if path else [center_y * grid_size + center_x]

    def to_dict(self) -> dict:
        """
        Convert state to dictionary for serialization/debugging.
        
        Returns:
            Dictionary representation of the game state
        """
        return {
            'tick': self.tick,
            'queen_energy': self.queen_energy,
            'queen_chunk': self.queen_chunk,
            'player_energy': self.player_energy,
            'player_minerals': self.player_minerals,
            'player_energy_rate': self.player_energy_rate,
            'player_mineral_rate': self.player_mineral_rate,
            'num_workers': len(self.workers),
            'num_protectors': len(self.protectors),
            'num_parasites': len(self.parasites),
            'mining_spots': self.mining_spots,
            'workers': [
                {
                    'chunk': w.chunk,
                    'target_chunk': w.target_chunk,
                    'base_chunk': w.base_chunk,
                    'state': w.state.value,
                    'flee_timer': w.flee_timer,
                    'mining_timer': w.mining_timer,
                    'carried_resources': w.carried_resources
                }
                for w in self.workers
            ],
            'protectors': [
                {
                    'chunk': p.chunk,
                    'patrol_path': p.patrol_path,
                    'patrol_index': p.patrol_index,
                    'state': p.state.value,
                    'chase_target_chunk': p.chase_target.chunk if p.chase_target else None
                }
                for p in self.protectors
            ],
            'parasites': [
                {
                    'chunk': par.chunk,
                    'type': par.type,
                    'spawn_time': par.spawn_time
                }
                for par in self.parasites
            ]
        }

    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"SimulatedGameState("
            f"tick={self.tick}, "
            f"workers={len(self.workers)}, "
            f"protectors={len(self.protectors)}, "
            f"parasites={len(self.parasites)}, "
            f"queen_energy={self.queen_energy:.1f}, "
            f"player_energy={self.player_energy:.1f})"
        )