"""
Curriculum learning system for progressive difficulty in game simulation.

This module implements curriculum learning phases that gradually increase
the complexity of the simulation to help the NN learn incrementally.
"""

from dataclasses import dataclass
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class CurriculumPhase:
    """Configuration for a curriculum learning phase with behavioral parameters."""
    name: str
    duration: int  # Ticks (-1 for infinite)
    num_workers: int
    num_protectors: int

    # Behavioral parameters (None = use base config default)
    protector_speed: Optional[float] = None
    detection_radius: Optional[int] = None
    kill_radius: Optional[int] = None
    flee_radius: Optional[int] = None
    flee_duration: Optional[int] = None
    worker_speed: Optional[float] = None

    def __post_init__(self):
        """Validate phase configuration."""
        if self.duration < -1 or self.duration == 0:
            raise ValueError(f"Invalid duration {self.duration}. Must be positive or -1 for infinite.")
        if self.num_workers < 0:
            raise ValueError(f"Invalid num_workers {self.num_workers}. Must be non-negative.")
        if self.num_protectors < 0:
            raise ValueError(f"Invalid num_protectors {self.num_protectors}. Must be non-negative.")

        # Validate optional behavioral parameters
        if self.protector_speed is not None and self.protector_speed <= 0:
            raise ValueError(f"protector_speed must be positive, got {self.protector_speed}")
        if self.detection_radius is not None and self.detection_radius < 0:
            raise ValueError(f"detection_radius must be non-negative, got {self.detection_radius}")
        if self.kill_radius is not None and self.kill_radius < 0:
            raise ValueError(f"kill_radius must be non-negative, got {self.kill_radius}")
        if self.flee_radius is not None and self.flee_radius < 0:
            raise ValueError(f"flee_radius must be non-negative, got {self.flee_radius}")
        if self.flee_duration is not None and self.flee_duration <= 0:
            raise ValueError(f"flee_duration must be positive, got {self.flee_duration}")
        if self.worker_speed is not None and self.worker_speed <= 0:
            raise ValueError(f"worker_speed must be positive, got {self.worker_speed}")


class CurriculumManager:
    """Manages curriculum learning progression through phases."""
    
    def __init__(self, phases: List[CurriculumPhase]):
        """
        Initialize curriculum manager with phases.
        
        Args:
            phases: List of curriculum phases in order
            
        Raises:
            ValueError: If phases list is empty
        """
        if not phases:
            raise ValueError("Phases list cannot be empty")
            
        self.phases = phases
        self.current_phase_index = 0
        self.ticks_in_phase = 0
        
        logger.info(f"Initialized curriculum with {len(phases)} phases")
        logger.info(f"Starting phase: {self.get_current_phase().name}")
    
    def get_current_phase(self) -> CurriculumPhase:
        """Get the current curriculum phase."""
        return self.phases[self.current_phase_index]
    
    def get_phase_progress(self) -> dict:
        """
        Get progress information for the current phase.
        
        Returns:
            Dictionary with phase progress information
        """
        current = self.get_current_phase()
        return {
            "phase_index": self.current_phase_index,
            "phase_name": current.name,
            "ticks_in_phase": self.ticks_in_phase,
            "phase_duration": current.duration,
            "progress_ratio": (
                self.ticks_in_phase / current.duration 
                if current.duration > 0 
                else None
            ),
            "is_final_phase": self.current_phase_index == len(self.phases) - 1
        }
    
    def tick(self) -> Optional[CurriculumPhase]:
        """
        Advance tick counter and check for phase transitions.
        
        Returns:
            New phase if transition occurred, None otherwise
        """
        self.ticks_in_phase += 1
        current = self.get_current_phase()
        
        # Check if we should transition to next phase
        if current.duration > 0 and self.ticks_in_phase >= current.duration:
            # Only transition if not in final phase
            if self.current_phase_index < len(self.phases) - 1:
                old_phase = current.name
                self.current_phase_index += 1
                self.ticks_in_phase = 0
                new_phase = self.get_current_phase()
                
                logger.info(f"Phase transition: {old_phase} -> {new_phase.name}")
                logger.info(f"New phase config: workers={new_phase.num_workers}, "
                           f"protectors={new_phase.num_protectors}, "
                           f"duration={new_phase.duration}")
                # Log behavioral parameters if set
                behavioral_params = []
                if new_phase.protector_speed is not None:
                    behavioral_params.append(f"protector_speed={new_phase.protector_speed}")
                if new_phase.detection_radius is not None:
                    behavioral_params.append(f"detection_radius={new_phase.detection_radius}")
                if new_phase.kill_radius is not None:
                    behavioral_params.append(f"kill_radius={new_phase.kill_radius}")
                if new_phase.flee_radius is not None:
                    behavioral_params.append(f"flee_radius={new_phase.flee_radius}")
                if new_phase.flee_duration is not None:
                    behavioral_params.append(f"flee_duration={new_phase.flee_duration}")
                if new_phase.worker_speed is not None:
                    behavioral_params.append(f"worker_speed={new_phase.worker_speed}")
                if behavioral_params:
                    logger.info(f"Behavioral params: {', '.join(behavioral_params)}")
                
                return new_phase
        
        return None
    
    def reset(self) -> None:
        """Reset curriculum to first phase."""
        old_phase = self.get_current_phase().name if self.phases else "None"
        self.current_phase_index = 0
        self.ticks_in_phase = 0
        
        if self.phases:
            new_phase = self.get_current_phase().name
            logger.info(f"Curriculum reset: {old_phase} -> {new_phase}")
        else:
            logger.info("Curriculum reset to empty state")
    
    def skip_to_phase(self, phase_index: int) -> CurriculumPhase:
        """
        Skip to a specific phase by index.
        
        Args:
            phase_index: Index of phase to skip to
            
        Returns:
            The new current phase
            
        Raises:
            IndexError: If phase_index is out of range
        """
        if phase_index < 0 or phase_index >= len(self.phases):
            raise IndexError(f"Phase index {phase_index} out of range [0, {len(self.phases)-1}]")
        
        old_phase = self.get_current_phase().name
        self.current_phase_index = phase_index
        self.ticks_in_phase = 0
        new_phase = self.get_current_phase()
        
        logger.info(f"Skipped to phase {phase_index}: {old_phase} -> {new_phase.name}")
        
        return new_phase
    
    def get_all_phases(self) -> List[CurriculumPhase]:
        """Get all phases in the curriculum."""
        return self.phases.copy()
    
    def __str__(self) -> str:
        """String representation of curriculum manager."""
        current = self.get_current_phase()
        return (f"CurriculumManager(phase={self.current_phase_index}/{len(self.phases)-1}, "
                f"name='{current.name}', ticks={self.ticks_in_phase})")
    
    def __repr__(self) -> str:
        """Detailed representation of curriculum manager."""
        return (f"CurriculumManager(phases={len(self.phases)}, "
                f"current_index={self.current_phase_index}, "
                f"ticks_in_phase={self.ticks_in_phase})")


def create_default_curriculum() -> List[CurriculumPhase]:
    """
    Create a comprehensive curriculum with progressive behavioral challenge.

    Phases represent different player skill levels with varying behavioral parameters:
    - Beginner: Easy - slow protectors, small detection, scared workers
    - Novice: Learning - slightly faster, workers less scared
    - Intermediate: Balanced - moderate challenge across all parameters
    - Advanced: Challenging - faster protectors, braver workers
    - Expert: Hard - high speed, large detection, precise placement needed
    - Master: Maximum - fastest protectors, largest detection, bravest workers

    Challenge progression:
    - Protector speed: 1.0 -> 2.0 (faster = less disruption time)
    - Detection radius: 3 -> 7 (larger = harder to hide parasites)
    - Kill radius: 1 -> 3 (larger = faster kills)
    - Flee radius: 5 -> 2 (smaller = braver workers, need precise placement)
    - Flee duration: 8 -> 3 (shorter = workers recover faster)

    Returns:
        List of curriculum phases
    """
    return [
        # Phase 1: Beginner - Easy for NN to learn basics
        CurriculumPhase(
            name="beginner",
            duration=2000,
            num_workers=4,
            num_protectors=0,
            protector_speed=1.0,
            detection_radius=3,
            kill_radius=1,
            flee_radius=5,
            flee_duration=8,
        ),
        # Phase 2: Novice - Introduce light defense
        CurriculumPhase(
            name="novice",
            duration=3000,
            num_workers=6,
            num_protectors=1,
            protector_speed=1.2,
            detection_radius=4,
            kill_radius=1,
            flee_radius=4,
            flee_duration=7,
        ),
        # Phase 3: Intermediate - Balanced challenge
        CurriculumPhase(
            name="intermediate",
            duration=4000,
            num_workers=8,
            num_protectors=2,
            protector_speed=1.5,
            detection_radius=5,
            kill_radius=2,
            flee_radius=3,
            flee_duration=5,
        ),
        # Phase 4: Advanced - Stronger defense
        CurriculumPhase(
            name="advanced",
            duration=5000,
            num_workers=10,
            num_protectors=3,
            protector_speed=1.7,
            detection_radius=5,
            kill_radius=2,
            flee_radius=3,
            flee_duration=4,
        ),
        # Phase 5: Expert - High challenge
        CurriculumPhase(
            name="expert",
            duration=6000,
            num_workers=12,
            num_protectors=4,
            protector_speed=1.8,
            detection_radius=6,
            kill_radius=2,
            flee_radius=2,
            flee_duration=3,
        ),
        # Phase 6: Master - Maximum challenge (runs indefinitely)
        CurriculumPhase(
            name="master",
            duration=-1,
            num_workers=15,
            num_protectors=5,
            protector_speed=2.0,
            detection_radius=7,
            kill_radius=3,
            flee_radius=2,
            flee_duration=3,
        ),
    ]


def create_easy_curriculum() -> List[CurriculumPhase]:
    """
    Create an easy curriculum for initial NN training.

    Slower protectors, more scared workers, longer phase durations.
    Good for letting the NN learn basic patterns without too much pressure.
    """
    return [
        CurriculumPhase(
            name="easy-1",
            duration=5000,
            num_workers=4,
            num_protectors=0,
            protector_speed=0.8,
            detection_radius=2,
            kill_radius=1,
            flee_radius=6,
            flee_duration=10,
        ),
        CurriculumPhase(
            name="easy-2",
            duration=5000,
            num_workers=6,
            num_protectors=1,
            protector_speed=1.0,
            detection_radius=3,
            kill_radius=1,
            flee_radius=5,
            flee_duration=8,
        ),
        CurriculumPhase(
            name="easy-3",
            duration=-1,
            num_workers=8,
            num_protectors=2,
            protector_speed=1.2,
            detection_radius=4,
            kill_radius=1,
            flee_radius=4,
            flee_duration=6,
        ),
    ]


def create_hard_curriculum() -> List[CurriculumPhase]:
    """
    Create a hard curriculum for advanced NN training.

    Faster protectors, braver workers, shorter phase durations.
    Forces the NN to learn precise timing and placement.
    """
    return [
        CurriculumPhase(
            name="hard-1",
            duration=1500,
            num_workers=6,
            num_protectors=1,
            protector_speed=1.5,
            detection_radius=5,
            kill_radius=2,
            flee_radius=3,
            flee_duration=4,
        ),
        CurriculumPhase(
            name="hard-2",
            duration=2000,
            num_workers=10,
            num_protectors=3,
            protector_speed=1.8,
            detection_radius=6,
            kill_radius=2,
            flee_radius=2,
            flee_duration=3,
        ),
        CurriculumPhase(
            name="hard-3",
            duration=-1,
            num_workers=15,
            num_protectors=5,
            protector_speed=2.2,
            detection_radius=8,
            kill_radius=3,
            flee_radius=1,
            flee_duration=2,
        ),
    ]


def create_quick_curriculum() -> List[CurriculumPhase]:
    """
    Create a quick curriculum for fast testing.

    Short phase durations (500 ticks each) to quickly cycle through phases.
    Useful for testing phase transitions and debugging.
    """
    return [
        CurriculumPhase(
            name="quick-beginner",
            duration=500,
            num_workers=4,
            num_protectors=0,
            protector_speed=1.0,
            detection_radius=3,
            kill_radius=1,
            flee_radius=5,
            flee_duration=8,
        ),
        CurriculumPhase(
            name="quick-intermediate",
            duration=500,
            num_workers=8,
            num_protectors=2,
            protector_speed=1.5,
            detection_radius=5,
            kill_radius=2,
            flee_radius=3,
            flee_duration=5,
        ),
        CurriculumPhase(
            name="quick-master",
            duration=-1,
            num_workers=15,
            num_protectors=5,
            protector_speed=2.0,
            detection_radius=7,
            kill_radius=3,
            flee_radius=2,
            flee_duration=3,
        ),
    ]


def create_beginner_only_curriculum() -> List[CurriculumPhase]:
    """
    Create a single-phase beginner curriculum (runs indefinitely).

    Useful for initial NN training with no protectors.
    """
    return [
        CurriculumPhase(
            name="beginner",
            duration=-1,
            num_workers=4,
            num_protectors=0,
            protector_speed=1.0,
            detection_radius=3,
            kill_radius=1,
            flee_radius=5,
            flee_duration=8,
        ),
    ]


def create_master_only_curriculum() -> List[CurriculumPhase]:
    """
    Create a single-phase master curriculum (runs indefinitely).

    Maximum challenge - useful for testing trained NN performance.
    """
    return [
        CurriculumPhase(
            name="master",
            duration=-1,
            num_workers=15,
            num_protectors=5,
            protector_speed=2.0,
            detection_radius=7,
            kill_radius=3,
            flee_radius=2,
            flee_duration=3,
        ),
    ]


# Available curriculum presets
CURRICULUM_PRESETS = {
    'default': create_default_curriculum,
    'easy': create_easy_curriculum,
    'hard': create_hard_curriculum,
    'quick': create_quick_curriculum,
    'beginner-only': create_beginner_only_curriculum,
    'master-only': create_master_only_curriculum,
}


def get_curriculum_preset(name: str) -> List[CurriculumPhase]:
    """
    Get a curriculum preset by name.

    Args:
        name: Name of the preset (default, easy, hard, quick, beginner-only, master-only)

    Returns:
        List of curriculum phases for the preset

    Raises:
        ValueError: If preset name is not recognized
    """
    if name not in CURRICULUM_PRESETS:
        available = ', '.join(CURRICULUM_PRESETS.keys())
        raise ValueError(f"Unknown curriculum preset: '{name}'. Available: {available}")

    return CURRICULUM_PRESETS[name]()