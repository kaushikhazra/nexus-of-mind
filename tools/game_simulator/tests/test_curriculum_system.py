"""
Test curriculum learning system implementation.
"""

import pytest
from game_simulator.curriculum import CurriculumPhase, CurriculumManager, create_default_curriculum
from game_simulator.config import SimulationConfig
from game_simulator.simulator import Simulator


def test_curriculum_phase_creation():
    """Test CurriculumPhase creation and validation."""
    # Valid phase
    phase = CurriculumPhase(
        name="test_phase",
        duration=1000,
        num_workers=4,
        num_protectors=2
    )
    assert phase.name == "test_phase"
    assert phase.duration == 1000
    assert phase.num_workers == 4
    assert phase.num_protectors == 2
    
    # Infinite duration phase
    infinite_phase = CurriculumPhase(
        name="infinite",
        duration=-1,
        num_workers=8,
        num_protectors=3
    )
    assert infinite_phase.duration == -1
    
    # Invalid duration
    with pytest.raises(ValueError):
        CurriculumPhase("invalid", duration=0, num_workers=4, num_protectors=2)
    
    # Invalid worker count
    with pytest.raises(ValueError):
        CurriculumPhase("invalid", duration=1000, num_workers=-1, num_protectors=2)


def test_curriculum_manager_initialization():
    """Test CurriculumManager initialization."""
    phases = create_default_curriculum()
    manager = CurriculumManager(phases)
    
    assert len(manager.phases) == 3
    assert manager.current_phase_index == 0
    assert manager.ticks_in_phase == 0
    
    current_phase = manager.get_current_phase()
    assert current_phase.name == "basic"
    assert current_phase.num_workers == 4
    assert current_phase.num_protectors == 0
    
    # Empty phases should raise error
    with pytest.raises(ValueError):
        CurriculumManager([])


def test_curriculum_phase_transitions():
    """Test curriculum phase transitions."""
    phases = [
        CurriculumPhase("phase1", duration=5, num_workers=2, num_protectors=0),
        CurriculumPhase("phase2", duration=3, num_workers=4, num_protectors=1),
        CurriculumPhase("phase3", duration=-1, num_workers=6, num_protectors=2)
    ]
    manager = CurriculumManager(phases)
    
    # Initial state
    assert manager.get_current_phase().name == "phase1"
    assert manager.ticks_in_phase == 0
    
    # Tick through first phase
    for i in range(4):
        new_phase = manager.tick()
        assert new_phase is None  # No transition yet
        assert manager.ticks_in_phase == i + 1
    
    # Transition to phase 2
    new_phase = manager.tick()
    assert new_phase is not None
    assert new_phase.name == "phase2"
    assert manager.current_phase_index == 1
    assert manager.ticks_in_phase == 0
    
    # Tick through second phase
    for i in range(2):
        new_phase = manager.tick()
        assert new_phase is None
        assert manager.ticks_in_phase == i + 1
    
    # Transition to final phase
    new_phase = manager.tick()
    assert new_phase is not None
    assert new_phase.name == "phase3"
    assert manager.current_phase_index == 2
    assert manager.ticks_in_phase == 0
    
    # Stay in final phase (infinite duration)
    for i in range(10):
        new_phase = manager.tick()
        assert new_phase is None  # No more transitions
        assert manager.current_phase_index == 2
        assert manager.ticks_in_phase == i + 1


def test_curriculum_progress_tracking():
    """Test curriculum progress tracking."""
    phases = [
        CurriculumPhase("phase1", duration=10, num_workers=2, num_protectors=0),
        CurriculumPhase("phase2", duration=-1, num_workers=4, num_protectors=1)
    ]
    manager = CurriculumManager(phases)
    
    # Initial progress
    progress = manager.get_phase_progress()
    assert progress["phase_index"] == 0
    assert progress["phase_name"] == "phase1"
    assert progress["ticks_in_phase"] == 0
    assert progress["phase_duration"] == 10
    assert progress["progress_ratio"] == 0.0
    assert progress["is_final_phase"] is False
    
    # Tick 5 times
    for _ in range(5):
        manager.tick()
    
    progress = manager.get_phase_progress()
    assert progress["ticks_in_phase"] == 5
    assert progress["progress_ratio"] == 0.5
    
    # Transition to final phase
    for _ in range(5):
        manager.tick()
    
    progress = manager.get_phase_progress()
    assert progress["phase_name"] == "phase2"
    assert progress["progress_ratio"] is None  # Infinite duration
    assert progress["is_final_phase"] is True


def test_simulator_with_curriculum():
    """Test simulator integration with curriculum learning."""
    config = SimulationConfig(
        num_workers=8,
        num_protectors=3,
        grid_size=20
    )
    
    phases = [
        CurriculumPhase("basic", duration=5, num_workers=2, num_protectors=0),
        CurriculumPhase("advanced", duration=-1, num_workers=6, num_protectors=2)
    ]
    curriculum_manager = CurriculumManager(phases)
    
    simulator = Simulator(config, curriculum_manager)
    
    # Initial state should match first phase
    assert len(simulator.state.workers) == 2
    assert len(simulator.state.protectors) == 0
    
    # Tick through first phase
    for _ in range(5):
        new_phase = simulator.tick()
        if new_phase:
            break
    
    # Should have transitioned to advanced phase
    assert len(simulator.state.workers) == 6
    assert len(simulator.state.protectors) == 2
    
    # Get curriculum progress
    progress = simulator.get_curriculum_progress()
    assert progress is not None
    assert progress["phase_name"] == "advanced"


def test_three_phase_curriculum_progression():
    """
    Test complete Phase 1 → Phase 2 → Phase 3 progression with config changes.
    
    **Validates: Requirements 11.2**
    
    This test verifies:
    - Phase 1: Few workers, no protectors (learn basic spawning)
    - Phase 2: Add protectors (learn avoidance) 
    - Phase 3: Dynamic workers, full complexity (learn timing)
    - Config changes applied during transitions
    """
    # Create three-phase curriculum matching requirements
    phases = [
        # Phase 1: Few workers, no protectors (learn basic spawning)
        CurriculumPhase(
            name="basic_spawning",
            duration=10,  # Short duration for testing
            num_workers=2,
            num_protectors=0
        ),
        # Phase 2: Add protectors (learn avoidance)
        CurriculumPhase(
            name="learn_avoidance", 
            duration=8,   # Short duration for testing
            num_workers=4,
            num_protectors=2
        ),
        # Phase 3: Full complexity (learn timing)
        CurriculumPhase(
            name="full_complexity",
            duration=-1,  # Infinite duration
            num_workers=8,
            num_protectors=3
        )
    ]
    
    manager = CurriculumManager(phases)
    
    # === PHASE 1: Basic Spawning ===
    current_phase = manager.get_current_phase()
    assert current_phase.name == "basic_spawning"
    assert current_phase.num_workers == 2
    assert current_phase.num_protectors == 0
    assert manager.current_phase_index == 0
    
    # Track phase 1 progress
    phase1_ticks = 0
    while manager.current_phase_index == 0:
        new_phase = manager.tick()
        phase1_ticks += 1
        if new_phase:
            break
    
    assert phase1_ticks == 10  # Should transition after exactly 10 ticks
    
    # === PHASE 2: Learn Avoidance ===
    current_phase = manager.get_current_phase()
    assert current_phase.name == "learn_avoidance"
    assert current_phase.num_workers == 4  # Config change applied
    assert current_phase.num_protectors == 2  # Config change applied
    assert manager.current_phase_index == 1
    assert manager.ticks_in_phase == 0  # Reset tick counter
    
    # Track phase 2 progress
    phase2_ticks = 0
    while manager.current_phase_index == 1:
        new_phase = manager.tick()
        phase2_ticks += 1
        if new_phase:
            break
    
    assert phase2_ticks == 8  # Should transition after exactly 8 ticks
    
    # === PHASE 3: Full Complexity ===
    current_phase = manager.get_current_phase()
    assert current_phase.name == "full_complexity"
    assert current_phase.num_workers == 8  # Config change applied
    assert current_phase.num_protectors == 3  # Config change applied
    assert manager.current_phase_index == 2
    assert manager.ticks_in_phase == 0  # Reset tick counter
    
    # Verify infinite duration behavior
    for i in range(20):  # Tick many times
        new_phase = manager.tick()
        assert new_phase is None  # Should never transition from final phase
        assert manager.current_phase_index == 2  # Stay in phase 3
        assert manager.ticks_in_phase == i + 1  # Tick counter keeps incrementing
    
    # Verify final state
    progress = manager.get_phase_progress()
    assert progress["phase_name"] == "full_complexity"
    assert progress["is_final_phase"] is True
    assert progress["progress_ratio"] is None  # Infinite duration
    assert progress["ticks_in_phase"] == 20


def test_curriculum_config_changes_with_simulator():
    """
    Test that curriculum config changes are properly applied to simulator state.
    
    **Validates: Requirements 11.2**
    
    This test verifies that entity counts change when curriculum phases transition.
    """
    config = SimulationConfig(
        num_workers=10,  # Will be overridden by curriculum
        num_protectors=5,  # Will be overridden by curriculum
        grid_size=20
    )
    
    phases = [
        CurriculumPhase("phase1", duration=3, num_workers=1, num_protectors=0),
        CurriculumPhase("phase2", duration=2, num_workers=3, num_protectors=1),
        CurriculumPhase("phase3", duration=-1, num_workers=6, num_protectors=2)
    ]
    curriculum_manager = CurriculumManager(phases)
    
    simulator = Simulator(config, curriculum_manager)
    
    # === Verify Phase 1 Config Applied ===
    assert len(simulator.state.workers) == 1
    assert len(simulator.state.protectors) == 0
    
    progress = simulator.get_curriculum_progress()
    assert progress["phase_name"] == "phase1"
    
    # === Transition to Phase 2 ===
    for _ in range(3):  # Tick through phase 1
        new_phase = simulator.tick()
        if new_phase:
            break
    
    # Verify Phase 2 config applied
    assert len(simulator.state.workers) == 3  # Config change applied
    assert len(simulator.state.protectors) == 1  # Config change applied
    
    progress = simulator.get_curriculum_progress()
    assert progress["phase_name"] == "phase2"
    
    # === Transition to Phase 3 ===
    for _ in range(2):  # Tick through phase 2
        new_phase = simulator.tick()
        if new_phase:
            break
    
    # Verify Phase 3 config applied
    assert len(simulator.state.workers) == 6  # Config change applied
    assert len(simulator.state.protectors) == 2  # Config change applied
    
    progress = simulator.get_curriculum_progress()
    assert progress["phase_name"] == "phase3"
    assert progress["is_final_phase"] is True


def test_default_curriculum():
    """Test default curriculum creation."""
    phases = create_default_curriculum()
    
    assert len(phases) == 3
    
    # Basic phase
    assert phases[0].name == "basic"
    assert phases[0].duration == 1000
    assert phases[0].num_workers == 4
    assert phases[0].num_protectors == 0
    
    # With protectors phase
    assert phases[1].name == "with_protectors"
    assert phases[1].duration == 2000
    assert phases[1].num_workers == 6
    assert phases[1].num_protectors == 2
    
    # Full phase
    assert phases[2].name == "full"
    assert phases[2].duration == -1
    assert phases[2].num_workers == 8
    assert phases[2].num_protectors == 3


if __name__ == "__main__":
    pytest.main([__file__])