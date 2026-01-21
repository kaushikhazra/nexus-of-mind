"""
Spawn Capacity Validation

Binary check if Queen can afford to spawn the requested parasite type.
"""

import numpy as np
from typing import Union
import logging

from ..config import SimulationGateConfig

logger = logging.getLogger(__name__)


def validate_spawn_capacity(
    spawn_type: Union[str, int, np.ndarray],
    queen_energy: Union[float, np.ndarray],
    config: SimulationGateConfig
) -> Union[float, np.ndarray]:
    """
    Validate if spawn is affordable.

    Args:
        spawn_type: Parasite type ('energy', 'combat', 0, or 1) or [B] array
        queen_energy: Queen's current energy (scalar or [B] array)
        config: Simulation configuration

    Returns:
        1.0 if affordable, -inf otherwise (scalar or [B] array)
    """
    # Handle string types
    if isinstance(spawn_type, str):
        spawn_type = 0 if spawn_type == 'energy' else 1
    elif isinstance(spawn_type, np.ndarray) and spawn_type.dtype.kind in ['U', 'S', 'O']:
        # String array
        spawn_type = np.where(spawn_type == 'energy', 0, 1)

    # Convert to numpy arrays
    spawn_type = np.atleast_1d(np.asarray(spawn_type, dtype=int))  # [B]
    queen_energy = np.atleast_1d(np.asarray(queen_energy))  # [B]

    batch_size = max(len(spawn_type), len(queen_energy))

    # Broadcast to match batch size
    if len(spawn_type) == 1:
        spawn_type = np.broadcast_to(spawn_type, (batch_size,))
    if len(queen_energy) == 1:
        queen_energy = np.broadcast_to(queen_energy, (batch_size,))

    # Calculate required energy
    spawn_costs = np.array([
        config.energy_parasite_cost,  # type 0 = energy
        config.combat_parasite_cost   # type 1 = combat
    ])

    required_energy = spawn_costs[spawn_type]  # [B]

    # Check affordability
    can_afford = queen_energy >= required_energy  # [B]

    # Return 1.0 if affordable, -inf otherwise
    result = np.where(can_afford, 1.0, float('-inf'))

    # Return scalar if single input
    if batch_size == 1:
        return float(result[0])

    return result


def get_spawn_cost(spawn_type: Union[str, int], config: SimulationGateConfig) -> float:
    """
    Get spawn cost for parasite type.

    Args:
        spawn_type: 'energy', 'combat', 0, or 1
        config: Simulation configuration

    Returns:
        Energy cost
    """
    if isinstance(spawn_type, str):
        spawn_type = 0 if spawn_type == 'energy' else 1

    if spawn_type == 0:
        return config.energy_parasite_cost
    else:
        return config.combat_parasite_cost
