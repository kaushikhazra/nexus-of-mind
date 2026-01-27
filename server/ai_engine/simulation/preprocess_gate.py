"""
Preprocess Gate

Early-stage gate that runs BEFORE NN inference to skip unnecessary processing
when there's no active mining in the game.

This saves compute by bypassing the entire NN pipeline when spawning is pointless.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


@dataclass
class PreprocessDecision:
    """Result of preprocess gate evaluation."""
    should_skip: bool  # True = skip NN pipeline entirely
    reason: str        # Why we're skipping (or not)
    workers_count: int
    protectors_count: int


class PreprocessGate:
    """
    Early gate that checks if NN inference should be skipped entirely.

    Scenarios where we skip:
    1. No workers actively mining = no mining activity to disrupt

    This runs BEFORE feature extraction and NN inference to save compute.
    """

    def __init__(self):
        """Initialize preprocess gate."""
        self.stats = {
            'total_checks': 0,
            'skipped_no_mining': 0,
            'passed_through': 0,
        }
        logger.info("PreprocessGate initialized")

    def evaluate(self, observation: Dict[str, Any]) -> PreprocessDecision:
        """
        Evaluate observation to decide if NN pipeline should be skipped.

        Args:
            observation: Raw observation data from client/simulator

        Returns:
            PreprocessDecision indicating whether to skip NN pipeline
        """
        self.stats['total_checks'] += 1

        # Extract worker counts (both present and mining)
        workers_present = observation.get('workersPresent', [])
        workers_mining = observation.get('miningWorkers', [])
        total_workers = len(workers_present) + len(workers_mining)

        # Extract protector count
        protectors = observation.get('protectors', [])
        total_protectors = len(protectors)

        # Check for no mining activity condition
        # Skip if no workers are actively mining - parasites exist to disrupt mining operations
        if len(workers_mining) == 0:
            self.stats['skipped_no_mining'] += 1
            logger.debug(f"[PreprocessGate] SKIP: no active mining (mining=0, present={len(workers_present)}, protectors={total_protectors})")
            return PreprocessDecision(
                should_skip=True,
                reason='no_mining',
                workers_count=total_workers,
                protectors_count=total_protectors
            )

        # Activity detected - allow through to NN pipeline
        self.stats['passed_through'] += 1
        return PreprocessDecision(
            should_skip=False,
            reason='activity_detected',
            workers_count=total_workers,
            protectors_count=total_protectors
        )

    def get_statistics(self) -> Dict[str, Any]:
        """Get preprocess gate statistics."""
        total = self.stats['total_checks']
        return {
            'total_checks': total,
            'skipped_no_mining': self.stats['skipped_no_mining'],
            'passed_through': self.stats['passed_through'],
            'skip_rate': self.stats['skipped_no_mining'] / max(1, total),
        }
