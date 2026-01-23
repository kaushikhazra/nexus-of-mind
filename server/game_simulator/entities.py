"""
Entity classes for the game simulator.

This module contains the base Entity class and all specific entity types
(Worker, Protector, Parasite) used in the game simulation.
"""

from dataclasses import dataclass
import math
from typing import Optional, List, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from .config import SimulationConfig


# Grid size constant - must match config.grid_size (16x16 = 256 chunks)
GRID_SIZE = 16


@dataclass
class Entity:
    """
    Base class for all game entities.

    Entities exist on a 16x16 grid (256 chunks total) and can move between chunks.
    Chunk positions are numbered 0-255, where:
    - Chunk 0 is at grid position (0, 0) - top-left
    - Chunk 15 is at grid position (15, 0) - top-right
    - Chunk 240 is at grid position (0, 15) - bottom-left
    - Chunk 255 is at grid position (15, 15) - bottom-right
    """
    chunk: int  # Current position (0-255)

    def distance_to(self, other_chunk: int) -> float:
        """
        Calculate Euclidean distance between this entity and another chunk.

        Args:
            other_chunk: Target chunk position (0-255)

        Returns:
            Euclidean distance in chunk units
        """
        x1, y1 = self.chunk % GRID_SIZE, self.chunk // GRID_SIZE
        x2, y2 = other_chunk % GRID_SIZE, other_chunk // GRID_SIZE
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

    def move_toward(self, target_chunk: int, speed: float = 1.0) -> None:
        """
        Move toward target chunk by the specified speed.

        Args:
            target_chunk: Destination chunk (0-255)
            speed: Movement speed in chunks per tick (default: 1.0)
        """
        if self.chunk == target_chunk:
            return  # Already at target

        # Convert chunk positions to x,y coordinates
        x1, y1 = self.chunk % GRID_SIZE, self.chunk // GRID_SIZE
        x2, y2 = target_chunk % GRID_SIZE, target_chunk // GRID_SIZE

        # Calculate direction vector
        dx = x2 - x1
        dy = y2 - y1
        distance = math.sqrt(dx * dx + dy * dy)

        if distance == 0:
            return  # Already at target

        # If we can reach the target in this step, go directly there
        if distance <= speed:
            self.chunk = target_chunk
            return

        # Normalize direction and apply speed
        move_x = (dx / distance) * speed
        move_y = (dy / distance) * speed

        # Calculate new position
        new_x = x1 + move_x
        new_y = y1 + move_y

        # Clamp to grid bounds
        max_coord = GRID_SIZE - 1
        new_x = max(0, min(max_coord, new_x))
        new_y = max(0, min(max_coord, new_y))

        # Convert back to chunk position (round to nearest chunk)
        self.chunk = round(new_y) * GRID_SIZE + round(new_x)

    def move_away_from(self, threat_chunk: int, speed: float = 1.0) -> None:
        """
        Move away from threat chunk by the specified speed.

        Args:
            threat_chunk: Chunk to flee from (0-255)
            speed: Movement speed in chunks per tick (default: 1.0)
        """
        max_coord = GRID_SIZE - 1

        if self.chunk == threat_chunk:
            # If at same position, move to a random adjacent chunk
            x, y = self.chunk % GRID_SIZE, self.chunk // GRID_SIZE
            # Move right if possible, otherwise left
            if x < max_coord:
                self.chunk = y * GRID_SIZE + (x + 1)
            elif x > 0:
                self.chunk = y * GRID_SIZE + (x - 1)
            return

        # Convert chunk positions to x,y coordinates
        x1, y1 = self.chunk % GRID_SIZE, self.chunk // GRID_SIZE
        x2, y2 = threat_chunk % GRID_SIZE, threat_chunk // GRID_SIZE

        # Calculate direction vector (away from threat)
        dx = x1 - x2
        dy = y1 - y2
        distance = math.sqrt(dx * dx + dy * dy)

        if distance == 0:
            return  # Same position handled above

        # Normalize direction and apply speed
        move_x = (dx / distance) * speed
        move_y = (dy / distance) * speed

        # Calculate new position
        new_x = x1 + move_x
        new_y = y1 + move_y

        # Clamp to grid bounds
        new_x = max(0, min(max_coord, new_x))
        new_y = max(0, min(max_coord, new_y))

        # Convert back to chunk position (round to nearest chunk)
        self.chunk = round(new_y) * GRID_SIZE + round(new_x)


class WorkerState(Enum):
    """Worker behavior states."""
    MOVING_TO_MINE = "moving_to_mine"  # Traveling from base to mining spot
    MINING = "mining"                   # Actively mining at spot
    RETURNING_TO_BASE = "returning"     # Carrying resources back to base
    FLEEING = "fleeing"                 # Running from parasites


class ProtectorState(Enum):
    """Protector behavior states."""
    PATROLLING = "patrolling"
    CHASING = "chasing"


@dataclass
class Worker(Entity):
    """
    Worker entity that mines resources and flees from parasites.

    Workers cycle between base and mining spots:
    1. Travel from base to assigned mining spot
    2. Mine for a duration (collecting resources)
    3. Return to base to deposit resources
    4. Repeat

    When parasites are nearby, they flee to safety before resuming their cycle.
    """
    target_chunk: int  # Mining spot destination (0-399)
    base_chunk: int = 210  # Base/depot location
    state: WorkerState = WorkerState.MOVING_TO_MINE
    flee_timer: int = 0  # Ticks remaining in flee state
    mining_timer: int = 0  # Ticks spent mining
    carried_resources: float = 0.0  # Resources being carried back to base
    pre_flee_state: Optional[WorkerState] = None  # State before fleeing (to resume)

    def update(self, parasites: List['Parasite'], config: 'SimulationConfig') -> float:
        """
        Update worker state and position.

        Args:
            parasites: List of active parasites in the simulation
            config: Simulation configuration parameters

        Returns:
            Resource deposit amount (only when reaching base with resources)
        """
        # Check for nearby parasites
        nearest_parasite = self._find_nearest_parasite(parasites)

        if nearest_parasite and self.distance_to(nearest_parasite.chunk) < config.flee_radius:
            # Enter fleeing state
            if self.state != WorkerState.FLEEING:
                self.pre_flee_state = self.state  # Remember what we were doing
            self.state = WorkerState.FLEEING
            self.flee_timer = config.flee_duration
            self.move_away_from(nearest_parasite.chunk, config.worker_speed)
            return 0.0

        if self.flee_timer > 0:
            # Still fleeing - count down timer
            self.flee_timer -= 1
            self.state = WorkerState.FLEEING
            return 0.0

        # Flee timer expired - resume previous activity
        if self.state == WorkerState.FLEEING:
            # Determine what to do next based on what we were doing
            if self.pre_flee_state == WorkerState.RETURNING_TO_BASE or self.carried_resources > 0:
                self.state = WorkerState.RETURNING_TO_BASE
            else:
                self.state = WorkerState.MOVING_TO_MINE
            self.pre_flee_state = None

        # State machine for base-to-mining cycle
        if self.state == WorkerState.MOVING_TO_MINE:
            if self.chunk == self.target_chunk:
                # Arrived at mining spot - start mining
                self.state = WorkerState.MINING
                self.mining_timer = 0
            else:
                self.move_toward(self.target_chunk, config.worker_speed)
            return 0.0

        elif self.state == WorkerState.MINING:
            # Accumulate resources while mining
            self.carried_resources += config.mining_rate
            self.mining_timer += 1

            if self.mining_timer >= config.mining_duration:
                # Done mining - head back to base
                self.state = WorkerState.RETURNING_TO_BASE
            return 0.0

        elif self.state == WorkerState.RETURNING_TO_BASE:
            if self.chunk == self.base_chunk:
                # Arrived at base - deposit resources and start new trip
                deposited = self.carried_resources
                self.carried_resources = 0.0
                self.mining_timer = 0
                self.state = WorkerState.MOVING_TO_MINE
                return deposited  # Return deposited amount for resource tracking
            else:
                self.move_toward(self.base_chunk, config.worker_speed)
            return 0.0

        return 0.0

    def _find_nearest_parasite(self, parasites: List['Parasite']) -> Optional['Parasite']:
        """
        Find the nearest parasite to this worker.

        Args:
            parasites: List of active parasites

        Returns:
            Nearest parasite or None if no parasites exist
        """
        if not parasites:
            return None

        nearest = None
        min_distance = float('inf')

        for parasite in parasites:
            distance = self.distance_to(parasite.chunk)
            if distance < min_distance:
                min_distance = distance
                nearest = parasite

        return nearest


@dataclass
class Protector(Entity):
    """
    Protector entity that patrols and chases parasites.
    
    Protectors follow patrol paths and will chase nearby parasites,
    killing them when they get close enough.
    """
    patrol_path: List[int]  # Chunks to visit (0-399)
    patrol_index: int = 0  # Current position in patrol path
    state: ProtectorState = ProtectorState.PATROLLING
    chase_target: Optional['Parasite'] = None  # Parasite being chased

    def update(self, parasites: List['Parasite'], config: 'SimulationConfig') -> Optional['Parasite']:
        """
        Update protector state and position.
        
        Args:
            parasites: List of active parasites in the simulation
            config: Simulation configuration parameters
            
        Returns:
            Killed parasite if any, None otherwise
        """
        # Look for parasites to chase (only when patrolling)
        if self.state == ProtectorState.PATROLLING:
            for parasite in parasites:
                if self.distance_to(parasite.chunk) < config.detection_radius:
                    self.state = ProtectorState.CHASING
                    self.chase_target = parasite
                    break

        if self.state == ProtectorState.CHASING:
            # NOTE: O(n) list scan - could use set for larger simulations
            if self.chase_target is None or self.chase_target not in parasites:
                # Target gone (killed by another protector or removed), return to patrol
                self.state = ProtectorState.PATROLLING
                self.chase_target = None
            else:
                # Move toward target
                self.move_toward(self.chase_target.chunk, config.protector_speed)

                # Check for kill
                if self.distance_to(self.chase_target.chunk) < config.kill_radius:
                    killed = self.chase_target
                    self.state = ProtectorState.PATROLLING
                    self.chase_target = None
                    return killed

        if self.state == ProtectorState.PATROLLING:
            # Move along patrol path
            if self.patrol_path:  # Ensure patrol path is not empty
                target = self.patrol_path[self.patrol_index]
                if self.chunk == target:
                    # Reached current patrol point, move to next
                    self.patrol_index = (self.patrol_index + 1) % len(self.patrol_path)
                    target = self.patrol_path[self.patrol_index]
                self.move_toward(target, config.protector_speed)

        return None


@dataclass
class Parasite(Entity):
    """
    Parasite entity spawned by queen.
    
    Parasites disrupt worker operations and can be killed by protectors.
    They affect workers within their disruption radius, causing them to flee.
    """
    type: str  # 'energy' or 'combat'
    spawn_time: int  # Tick when spawned

    def get_disruption_chunks(self, config: 'SimulationConfig') -> List[int]:
        """
        Get chunks within disruption radius.

        Args:
            config: Simulation configuration containing disruption_radius

        Returns:
            List of chunk positions (0-255) within disruption radius
        """
        chunks = []
        for dx in range(-config.disruption_radius, config.disruption_radius + 1):
            for dy in range(-config.disruption_radius, config.disruption_radius + 1):
                # Check if the offset is within the circular disruption radius
                if dx * dx + dy * dy <= config.disruption_radius ** 2:
                    # Convert parasite chunk to x,y coordinates
                    x = self.chunk % GRID_SIZE + dx
                    y = self.chunk // GRID_SIZE + dy

                    # Ensure coordinates are within grid bounds (0 to GRID_SIZE-1)
                    if 0 <= x < GRID_SIZE and 0 <= y < GRID_SIZE:
                        # Convert back to chunk position
                        chunks.append(y * GRID_SIZE + x)
        return chunks