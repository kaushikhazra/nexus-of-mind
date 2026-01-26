"""
Preprocess Gate

Early-stage gate that runs BEFORE NN inference to skip unnecessary processing
when there's no activity in the game (no workers, no protectors).

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
    1. No workers AND no protectors = no activity, nothing to disrupt

    This runs BEFORE feature extraction and NN inference to save compute.
    """

    def __init__(self):
        """Initialize preprocess gate."""
        self.stats = {
            'total_checks': 0,
            'skipped_no_activity': 0,
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

        # Check for no activity condition
        if total_workers == 0 and total_protectors == 0:
            self.stats['skipped_no_activity'] += 1
            logger.debug(f"[PreprocessGate] SKIP: no activity (workers=0, protectors=0)")
            return PreprocessDecision(
                should_skip=True,
                reason='no_activity',
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
            'skipped_no_activity': self.stats['skipped_no_activity'],
            'passed_through': self.stats['passed_through'],
            'skip_rate': self.stats['skipped_no_activity'] / max(1, total),
        }
