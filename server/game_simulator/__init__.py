"""
Game Simulator Module

A lightweight game simulator that generates training observations for the Queen NN.
The simulator models game entities and sends observations through the existing WebSocket interface.
"""

from .config import SimulationConfig
from .entities import Entity, Worker, Protector, Parasite
from .state import SimulatedGameState
from .simulator import Simulator
from .observation import generate_observation
from .runner import SimulationRunner

__version__ = "1.0.0"

__all__ = [
    'SimulationConfig',
    'Entity', 'Worker', 'Protector', 'Parasite',
    'SimulatedGameState',
    'Simulator',
    'generate_observation',
    'SimulationRunner',
]