"""
Simulation-Gated Inference Module

Provides predictive cost function that evaluates NN spawn decisions
before execution using known game dynamics.
"""

from .config import SimulationGateConfig
from .cost_function import SimulationCostFunction
from .gate import SimulationGate, GateDecision

__all__ = [
    'SimulationGateConfig',
    'SimulationCostFunction',
    'SimulationGate',
    'GateDecision'
]
