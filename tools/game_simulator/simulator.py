"""
Simulator module for the game simulator.

This module contains the main Simulator class that orchestrates the game
simulation by managing state updates and entity interactions.
"""

from typing import TYPE_CHECKING, Optional
import logging

if TYPE_CHECKING:
    from .config import SimulationConfig

from .state import SimulatedGameState
from .entities import Parasite, Worker, Protector
from .curriculum import CurriculumManager, CurriculumPhase

logger = logging.getLogger(__name__)


class Simulator:
    """
    Main simulation logic controller.
    
    The Simulator class holds the game state and configuration, and provides
    methods to advance the simulation through tick() and spawn parasites
    based on neural network decisions.
    
    Requirements satisfied:
    - 6.1: Holds state and config
    - 11.2: Track ticks per phase, transition when duration reached
    - 11.2: Apply phase config by updating entity counts
    """
    
    def __init__(self, config: 'SimulationConfig', curriculum_manager: Optional[CurriculumManager] = None):
        """
        Initialize the simulator with configuration and optional curriculum.
        
        Args:
            config: Simulation configuration parameters
            curriculum_manager: Optional curriculum manager for progressive difficulty
        """
        self.config = config
        self.state = SimulatedGameState.create_initial(config)
        self.curriculum_manager = curriculum_manager
        
        # Apply initial curriculum phase if available
        if self.curriculum_manager:
            initial_phase = self.curriculum_manager.get_current_phase()
            self._apply_phase_config(initial_phase)
            logger.info(f"Initialized with curriculum phase: {initial_phase.name}")
    
    def _apply_phase_config(self, phase: CurriculumPhase) -> None:
        """
        Apply curriculum phase configuration to the simulation state.
        
        Args:
            phase: Curriculum phase to apply
            
        Requirements satisfied:
        - 11.2: Apply phase config by updating entity counts
        """
        # Adjust worker count
        current_workers = len(self.state.workers)
        if phase.num_workers > current_workers:
            # Add workers at base - they will travel to their assigned mining spots
            workers_to_add = phase.num_workers - current_workers
            available_spots = [spot for spot in self.state.mining_spots
                             if not any(w.target_chunk == spot for w in self.state.workers)]

            for i in range(min(workers_to_add, len(available_spots))):
                spot = available_spots[i]
                new_worker = Worker(
                    chunk=self.config.base_chunk,
                    target_chunk=spot,
                    base_chunk=self.config.base_chunk
                )
                self.state.workers.append(new_worker)
                logger.debug(f"Added worker at base, assigned to mine at chunk {spot}")
                
        elif phase.num_workers < current_workers:
            # Remove workers
            workers_to_remove = current_workers - phase.num_workers
            for _ in range(workers_to_remove):
                if self.state.workers:
                    removed_worker = self.state.workers.pop()
                    logger.debug(f"Removed worker from chunk {removed_worker.chunk}")
        
        # Adjust protector count
        current_protectors = len(self.state.protectors)
        if phase.num_protectors > current_protectors:
            # Add protectors
            protectors_to_add = phase.num_protectors - current_protectors
            for i in range(protectors_to_add):
                protector_index = current_protectors + i
                patrol_path = self.state._generate_patrol_path(protector_index, self.config)
                new_protector = Protector(
                    chunk=self.config.queen_chunk,
                    patrol_path=patrol_path
                )
                self.state.protectors.append(new_protector)
                logger.debug(f"Added protector with patrol path: {patrol_path}")
                
        elif phase.num_protectors < current_protectors:
            # Remove protectors
            protectors_to_remove = current_protectors - phase.num_protectors
            for _ in range(protectors_to_remove):
                if self.state.protectors:
                    removed_protector = self.state.protectors.pop()
                    logger.debug(f"Removed protector from chunk {removed_protector.chunk}")

        # Apply behavioral parameters (if specified in phase)
        behavioral_changes = []

        if phase.protector_speed is not None:
            old_val = self.config.protector_speed
            self.config.protector_speed = phase.protector_speed
            behavioral_changes.append(f"protector_speed: {old_val} -> {phase.protector_speed}")

        if phase.detection_radius is not None:
            old_val = self.config.detection_radius
            self.config.detection_radius = phase.detection_radius
            behavioral_changes.append(f"detection_radius: {old_val} -> {phase.detection_radius}")

        if phase.kill_radius is not None:
            old_val = self.config.kill_radius
            self.config.kill_radius = phase.kill_radius
            behavioral_changes.append(f"kill_radius: {old_val} -> {phase.kill_radius}")

        if phase.flee_radius is not None:
            old_val = self.config.flee_radius
            self.config.flee_radius = phase.flee_radius
            behavioral_changes.append(f"flee_radius: {old_val} -> {phase.flee_radius}")

        if phase.flee_duration is not None:
            old_val = self.config.flee_duration
            self.config.flee_duration = phase.flee_duration
            behavioral_changes.append(f"flee_duration: {old_val} -> {phase.flee_duration}")

        if phase.worker_speed is not None:
            old_val = self.config.worker_speed
            self.config.worker_speed = phase.worker_speed
            behavioral_changes.append(f"worker_speed: {old_val} -> {phase.worker_speed}")

        logger.info(f"Applied phase config: {len(self.state.workers)} workers, "
                   f"{len(self.state.protectors)} protectors")

        if behavioral_changes:
            logger.info(f"Behavioral parameter changes: {', '.join(behavioral_changes)}")
    
    def tick(self) -> Optional[CurriculumPhase]:
        """
        Execute one simulation tick.
        
        Updates all entities, processes interactions, updates resources,
        regenerates queen energy, and handles curriculum phase transitions.
        
        Returns:
            New curriculum phase if transition occurred, None otherwise
        
        Requirements satisfied:
        - 6.1: Update workers, protectors, remove killed parasites, update resources
        - 6.2: Regenerate queen energy, increment tick counter
        - 11.2: Track ticks per phase, transition when duration reached
        - 11.3: Tick progress, entity counts, spawn events logging
        
        Tick order:
        1. Update workers (flee or toward mining)
        2. Update protectors (patrol or chase)
        3. Check parasite kills
        4. Update resource generation
        5. Regenerate queen energy
        6. Calculate rates (energy_rate, mineral_rate)
        7. Handle curriculum phase transitions
        """
        # Save previous values for rate calculation
        self.state.player_energy_prev = self.state.player_energy
        self.state.player_minerals_prev = self.state.player_minerals

        # Log tick start for detailed debugging
        if self.state.tick % 1000 == 0:
            logger.debug(f"Starting tick {self.state.tick + 1}")

        # 1. Update workers
        total_deposited = 0.0
        workers_mining = 0
        workers_fleeing = 0
        workers_moving_to_mine = 0
        workers_returning = 0

        for worker in self.state.workers:
            deposited = worker.update(self.state.parasites, self.config)
            total_deposited += deposited

            # Count worker states for logging
            if worker.state.value == "mining":
                workers_mining += 1
            elif worker.state.value == "fleeing":
                workers_fleeing += 1
            elif worker.state.value == "moving_to_mine":
                workers_moving_to_mine += 1
            elif worker.state.value == "returning":
                workers_returning += 1

        # 2. Update protectors and check kills
        killed_parasites = []
        protectors_patrolling = 0
        protectors_chasing = 0
        
        for protector in self.state.protectors:
            killed = protector.update(self.state.parasites, self.config)
            if killed:
                killed_parasites.append(killed)
                logger.info(f"Tick {self.state.tick + 1}: Protector killed {killed.type} parasite at chunk {killed.chunk}")
            
            # Count protector states for logging
            if protector.state.value == "patrolling":
                protectors_patrolling += 1
            elif protector.state.value == "chasing":
                protectors_chasing += 1

        # 3. Remove killed parasites
        for parasite in killed_parasites:
            if parasite in self.state.parasites:
                self.state.parasites.remove(parasite)

        # 4. Update resources (workers deposit when returning to base)
        prev_energy = self.state.player_energy
        prev_minerals = self.state.player_minerals

        self.state.player_energy += total_deposited * self.config.energy_per_mining
        self.state.player_minerals += total_deposited * self.config.minerals_per_mining

        # 5. Regenerate queen energy
        prev_queen_energy = self.state.queen_energy
        self.state.queen_energy = min(
            self.config.queen_max_energy,
            self.state.queen_energy + self.config.queen_energy_regen
        )

        # 6. Increment tick
        self.state.tick += 1

        # Log detailed tick information every 100 ticks
        if self.state.tick % 100 == 0:
            energy_parasites = sum(1 for p in self.state.parasites if p.type == "energy")
            combat_parasites = sum(1 for p in self.state.parasites if p.type == "combat")

            logger.info(f"Tick {self.state.tick} - Entity counts: "
                       f"Workers={len(self.state.workers)} (mining={workers_mining}, "
                       f"to_mine={workers_moving_to_mine}, returning={workers_returning}, "
                       f"fleeing={workers_fleeing}), "
                       f"Protectors={len(self.state.protectors)} (patrolling={protectors_patrolling}, "
                       f"chasing={protectors_chasing}), "
                       f"Parasites={len(self.state.parasites)} (energy={energy_parasites}, "
                       f"combat={combat_parasites})")
            
            logger.info(f"Tick {self.state.tick} - Resources: "
                       f"Player energy={self.state.player_energy:.1f} "
                       f"(+{self.state.player_energy - prev_energy:.1f}), "
                       f"Player minerals={self.state.player_minerals:.1f} "
                       f"(+{self.state.player_minerals - prev_minerals:.1f}), "
                       f"Queen energy={self.state.queen_energy:.1f} "
                       f"(+{self.state.queen_energy - prev_queen_energy:.1f})")

        # Log kills if any occurred
        if killed_parasites:
            logger.info(f"Tick {self.state.tick} - Killed {len(killed_parasites)} parasites: "
                       f"{[f'{p.type}@{p.chunk}' for p in killed_parasites]}")

        # 7. Handle curriculum phase transitions
        new_phase = None
        if self.curriculum_manager:
            new_phase = self.curriculum_manager.tick()
            if new_phase:
                self._apply_phase_config(new_phase)
                logger.info(f"Curriculum phase transition to: {new_phase.name}")
        
        return new_phase

    def spawn_parasite(self, chunk: int, parasite_type: str) -> bool:
        """
        Spawn a parasite at the given chunk.
        
        Args:
            chunk: Chunk position where parasite should be spawned (0-399)
            parasite_type: Type of parasite ('energy' or 'combat')
            
        Returns:
            True if successful, False if insufficient energy
            
        Requirements satisfied:
        - 5.2: Check queen energy
        - 5.3: Deduct cost, create parasite entity
        - 11.3: Spawn events logging
        """
        # Determine cost based on parasite type
        cost = (
            self.config.energy_parasite_cost
            if parasite_type == 'energy'
            else self.config.combat_parasite_cost
        )

        # Check if queen has sufficient energy
        if self.state.queen_energy < cost:
            logger.debug(f"Tick {self.state.tick}: Failed to spawn {parasite_type} parasite at chunk {chunk} - "
                        f"insufficient energy (need {cost}, have {self.state.queen_energy:.1f})")
            return False

        # Deduct energy cost
        self.state.queen_energy -= cost
        
        # Create and add parasite entity
        parasite = Parasite(
            chunk=chunk,
            type=parasite_type,
            spawn_time=self.state.tick
        )
        self.state.parasites.append(parasite)
        
        # Log spawn event
        logger.info(f"Tick {self.state.tick}: Spawned {parasite_type} parasite at chunk {chunk} "
                   f"(cost={cost}, remaining energy={self.state.queen_energy:.1f})")
        
        return True

    def get_curriculum_progress(self) -> Optional[dict]:
        """
        Get curriculum learning progress information.
        
        Returns:
            Dictionary with curriculum progress or None if no curriculum
        """
        if self.curriculum_manager:
            return self.curriculum_manager.get_phase_progress()
        return None

    def __repr__(self) -> str:
        """String representation for debugging."""
        curriculum_info = ""
        if self.curriculum_manager:
            phase = self.curriculum_manager.get_current_phase()
            curriculum_info = f", curriculum={phase.name}"
        
        return (
            f"Simulator("
            f"tick={self.state.tick}, "
            f"config={self.config}"
            f"{curriculum_info})"
        )