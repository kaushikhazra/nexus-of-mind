"""
Observation generation module for the game simulator.

This module contains functions to generate observations from the game state
that match the frontend format exactly, enabling seamless integration with
the existing WebSocket pipeline.
"""

import time
from typing import Dict, Any, List
from .state import SimulatedGameState


def generate_observation(state: SimulatedGameState) -> Dict[str, Any]:
    """
    Generate observation from game state matching frontend format exactly.

    Args:
        state: Current simulated game state

    Returns:
        Dictionary containing observation data in frontend format

    Requirements satisfied:
    - 7.1: Match frontend JSON format exactly
    - 7.3: Include all required fields
    """
    # Build entity arrays matching backend schema
    # mining_workers: only workers actively mining (affects reward calculation)
    # workers_present: all workers visible in territory (for threat assessment)
    mining_workers = _build_mining_workers(state, mining_only=True)
    workers_present = _build_mining_workers(state, mining_only=False)
    protectors = _build_protectors(state)
    parasites_start = _build_parasites(state, is_start=True)
    parasites_end = _build_parasites(state, is_start=False)

    # Build observation matching backend schema requirements:
    # required: ["timestamp", "miningWorkers", "protectors", "queenEnergy", "playerEnergy", "territoryId"]
    # queenEnergy must be object with "current" field
    # playerEnergy must be object with "start" and "end" fields
    observation = {
        "timestamp": time.time(),
        "territoryId": "sim-territory",
        "tick": state.tick,
        "miningWorkers": mining_workers,  # Only actively mining workers
        "workersPresent": workers_present,  # All workers in territory
        "protectors": protectors,
        "parasitesStart": parasites_start,
        "parasitesEnd": parasites_end,
        "queenEnergy": {"current": state.queen_energy},
        "playerEnergy": {"start": state.player_energy_prev, "end": state.player_energy},
        "playerMinerals": {"start": state.player_minerals_prev, "end": state.player_minerals},
        "hiveChunk": state.queen_chunk
    }

    return observation


def _chunk_to_xy(chunk: int) -> tuple:
    """Convert chunk id (0-399) to x,y coordinates."""
    return chunk % 20, chunk // 20


def _build_mining_workers(state: SimulatedGameState, mining_only: bool = False) -> List[Dict[str, Any]]:
    """
    Build workers array for observation.

    Args:
        state: Current simulated game state
        mining_only: If True, only include workers in MINING state.
                    If False, include all workers (for workersPresent).

    Returns:
        List of worker objects with chunkId field
    """
    workers = []
    for i, worker in enumerate(state.workers):
        # Filter to only mining workers if requested
        if mining_only:
            state_value = worker.state.value if hasattr(worker.state, 'value') else str(worker.state)
            if state_value != "mining":
                continue

        x, y = _chunk_to_xy(worker.chunk)
        workers.append({
            "id": f"worker_{i}",
            "chunkId": worker.chunk,
            "x": x,
            "y": y,
            "state": worker.state.value if hasattr(worker.state, 'value') else str(worker.state)
        })
    return workers


def _build_protectors(state: SimulatedGameState) -> List[Dict[str, Any]]:
    """
    Build protectors array for observation.

    Args:
        state: Current simulated game state

    Returns:
        List of protector objects with chunkId field
    """
    protectors = []
    for i, protector in enumerate(state.protectors):
        x, y = _chunk_to_xy(protector.chunk)
        protectors.append({
            "id": f"protector_{i}",
            "chunkId": protector.chunk,
            "x": x,
            "y": y,
            "state": protector.state.value if hasattr(protector.state, 'value') else str(protector.state)
        })
    return protectors


def _build_parasites(state: SimulatedGameState, is_start: bool) -> List[Dict[str, Any]]:
    """
    Build parasites array for observation.

    For simulator, parasitesStart and parasitesEnd are the same since we track
    current state. In real game, these differ to show parasite changes during tick.

    Args:
        state: Current simulated game state
        is_start: Whether this is parasitesStart (vs parasitesEnd)

    Returns:
        List of parasite objects with chunkId and type fields
    """
    parasites = []
    for i, parasite in enumerate(state.parasites):
        x, y = _chunk_to_xy(parasite.chunk)
        parasites.append({
            "id": f"parasite_{i}",
            "chunkId": parasite.chunk,
            "x": x,
            "y": y,
            "type": parasite.type  # "energy" or "combat"
        })
    return parasites
