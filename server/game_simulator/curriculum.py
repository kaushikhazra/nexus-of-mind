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
    """Configuration for a curriculum learning phase."""
    name: str
    duration: int  # Ticks (-1 for infinite)
    num_workers: int
    num_protectors: int
    
    def __post_init__(self):
        """Validate phase configuration."""
        if self.duration < -1 or self.duration == 0:
            raise ValueError(f"Invalid duration {self.duration}. Must be positive or -1 for infinite.")
        if self.num_workers < 0:
            raise ValueError(f"Invalid num_workers {self.num_workers}. Must be non-negative.")
        if self.num_protectors < 0:
            raise ValueError(f"Invalid num_protectors {self.num_protectors}. Must be non-negative.")


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
    Create a comprehensive curriculum simulating player skill progression.

    Phases represent different player skill levels:
    - Beginner: New players, no defenses
    - Novice: Learning to build defenses
    - Intermediate: Typical casual player
    - Advanced: Experienced player with good economy
    - Expert: Skilled player with strong defenses
    - Master: Pro-level play with maximum pressure

    Returns:
        List of curriculum phases
    """
    return [
        # Phase 1: Beginner - Learn to disrupt undefended workers
        CurriculumPhase(
            name="beginner",
            duration=2000,  # ~3 min turbo
            num_workers=4,
            num_protectors=0
        ),
        # Phase 2: Novice - Handle light defense
        CurriculumPhase(
            name="novice",
            duration=3000,  # ~5 min turbo
            num_workers=6,
            num_protectors=1
        ),
        # Phase 3: Intermediate - Typical player
        CurriculumPhase(
            name="intermediate",
            duration=4000,  # ~7 min turbo
            num_workers=8,
            num_protectors=2
        ),
        # Phase 4: Advanced - Strong economy
        CurriculumPhase(
            name="advanced",
            duration=5000,  # ~8 min turbo
            num_workers=10,
            num_protectors=3
        ),
        # Phase 5: Expert - Heavy defenses
        CurriculumPhase(
            name="expert",
            duration=6000,  # ~10 min turbo
            num_workers=12,
            num_protectors=4
        ),
        # Phase 6: Master - Maximum difficulty (runs indefinitely)
        CurriculumPhase(
            name="master",
            duration=-1,  # Run indefinitely
            num_workers=15,
            num_protectors=5
        )
    ]