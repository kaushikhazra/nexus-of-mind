"""
Configuration module for the game simulator.
"""

from dataclasses import dataclass, field, fields
from typing import List, Optional
import yaml
import os


@dataclass
class SimulationConfig:
    """Configuration for the game simulator."""
    
    # Map (16x16 = 256 chunks to match NN output space)
    grid_size: int = 16  # 16x16 = 256 chunks (matches NN's 256 spawn outputs)
    queen_chunk: int = 136  # Center of 16x16 map (row 8, col 8)
    mining_spots: List[int] = field(default_factory=lambda: [18, 29, 45, 67, 123, 189, 234])

    # Workers
    num_workers: int = 8
    worker_speed: float = 1.0
    flee_radius: int = 3
    flee_duration: int = 5
    mining_rate: float = 1.0
    mining_duration: int = 10  # Ticks to mine before returning to base
    base_chunk: int = 137  # Worker depot/base location (near queen at 136)

    # Protectors
    num_protectors: int = 3
    protector_speed: float = 1.5
    detection_radius: int = 5
    kill_radius: int = 2

    # Queen (balanced for active gameplay)
    queen_start_energy: float = 50
    queen_max_energy: float = 100
    queen_energy_regen: float = 3.0  # Faster regen to allow more NN experimentation
    energy_parasite_cost: int = 8   # Cheaper spawns (was 15)
    combat_parasite_cost: int = 15  # Cheaper spawns (was 25)

    # Parasites
    disruption_radius: int = 3

    # Resources
    player_start_energy: float = 100
    player_start_minerals: float = 50
    energy_per_mining: float = 0.5
    minerals_per_mining: float = 0.3

    # Simulation
    tick_interval: float = 0.1
    turbo_mode: bool = False

    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"SimulationConfig("
            f"grid_size={self.grid_size}, "
            f"num_workers={self.num_workers}, "
            f"num_protectors={self.num_protectors}, "
            f"turbo_mode={self.turbo_mode})"
        )

    def validate(self) -> None:
        """Validate configuration parameters."""
        if self.grid_size <= 0:
            raise ValueError("grid_size must be positive")
        
        if self.queen_chunk < 0 or self.queen_chunk >= self.grid_size * self.grid_size:
            raise ValueError(f"queen_chunk must be between 0 and {self.grid_size * self.grid_size - 1}")
        
        if not self.mining_spots:
            raise ValueError("mining_spots cannot be empty")
        
        for spot in self.mining_spots:
            if spot < 0 or spot >= self.grid_size * self.grid_size:
                raise ValueError(f"mining spot {spot} is out of bounds")
        
        if self.num_workers <= 0:
            raise ValueError("num_workers must be positive")
        
        if self.num_protectors < 0:
            raise ValueError("num_protectors cannot be negative")
        
        if self.worker_speed <= 0:
            raise ValueError("worker_speed must be positive")
        
        if self.protector_speed <= 0:
            raise ValueError("protector_speed must be positive")
        
        if self.flee_radius < 0:
            raise ValueError("flee_radius cannot be negative")
        
        if self.flee_duration < 0:
            raise ValueError("flee_duration cannot be negative")

        if self.mining_duration <= 0:
            raise ValueError("mining_duration must be positive")

        if self.base_chunk < 0 or self.base_chunk >= self.grid_size * self.grid_size:
            raise ValueError(f"base_chunk must be between 0 and {self.grid_size * self.grid_size - 1}")
        
        if self.detection_radius < 0:
            raise ValueError("detection_radius cannot be negative")
        
        if self.kill_radius < 0:
            raise ValueError("kill_radius cannot be negative")
        
        if self.queen_start_energy < 0:
            raise ValueError("queen_start_energy cannot be negative")
        
        if self.queen_max_energy <= 0:
            raise ValueError("queen_max_energy must be positive")
        
        if self.queen_energy_regen < 0:
            raise ValueError("queen_energy_regen cannot be negative")
        
        if self.energy_parasite_cost < 0:
            raise ValueError("energy_parasite_cost cannot be negative")
        
        if self.combat_parasite_cost < 0:
            raise ValueError("combat_parasite_cost cannot be negative")
        
        if self.disruption_radius < 0:
            raise ValueError("disruption_radius cannot be negative")
        
        if self.tick_interval < 0:
            raise ValueError("tick_interval cannot be negative")

    @classmethod
    def from_yaml(cls, file_path: str) -> 'SimulationConfig':
        """Load configuration from YAML file."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Configuration file not found: {file_path}")
        
        with open(file_path, 'r') as f:
            data = yaml.safe_load(f)
        
        if data is None:
            data = {}
        
        # Filter unknown keys to prevent TypeError
        valid_fields = {f.name for f in fields(cls)}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        
        config = cls(**filtered_data)
        config.validate()
        return config

    def to_yaml(self, file_path: str) -> None:
        """Save configuration to YAML file."""
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Convert to dict for YAML serialization
        data = {
            'grid_size': self.grid_size,
            'queen_chunk': self.queen_chunk,
            'mining_spots': self.mining_spots,
            'num_workers': self.num_workers,
            'worker_speed': self.worker_speed,
            'flee_radius': self.flee_radius,
            'flee_duration': self.flee_duration,
            'mining_rate': self.mining_rate,
            'mining_duration': self.mining_duration,
            'base_chunk': self.base_chunk,
            'num_protectors': self.num_protectors,
            'protector_speed': self.protector_speed,
            'detection_radius': self.detection_radius,
            'kill_radius': self.kill_radius,
            'queen_start_energy': self.queen_start_energy,
            'queen_max_energy': self.queen_max_energy,
            'queen_energy_regen': self.queen_energy_regen,
            'energy_parasite_cost': self.energy_parasite_cost,
            'combat_parasite_cost': self.combat_parasite_cost,
            'disruption_radius': self.disruption_radius,
            'player_start_energy': self.player_start_energy,
            'player_start_minerals': self.player_start_minerals,
            'energy_per_mining': self.energy_per_mining,
            'minerals_per_mining': self.minerals_per_mining,
            'tick_interval': self.tick_interval,
            'turbo_mode': self.turbo_mode,
        }
        
        with open(file_path, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, indent=2)