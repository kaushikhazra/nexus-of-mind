"""
Handler for simulation gate messages.

Handles gate statistics requests and spawn result feedback.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Callable, TYPE_CHECKING

from websocket.schemas import ParsedMessage
from websocket.handlers.base import create_error_response
from ai_engine.exceptions import GateEvaluationError, ModelNotInitializedError

if TYPE_CHECKING:
    from ai_engine.decision_gate import SimulationGate
    from ai_engine.training import ExperienceReplayBuffer

logger = logging.getLogger(__name__)


class GateHandler:
    """
    Handles simulation gate-related messages.

    Manages:
    - Gate statistics requests
    - Spawn result feedback (for updating experiences)
    """

    def __init__(
        self,
        simulation_gate: Optional["SimulationGate"],
        replay_buffer: Optional["ExperienceReplayBuffer"],
        thinking_stats_getter: Callable[[], Dict[str, Any]]
    ) -> None:
        """
        Initialize the gate handler.

        Args:
            simulation_gate: SimulationGate instance
            replay_buffer: ExperienceReplayBuffer instance
            thinking_stats_getter: Function to get thinking stats from observation handler
        """
        self.simulation_gate: Optional["SimulationGate"] = simulation_gate
        self.replay_buffer: Optional["ExperienceReplayBuffer"] = replay_buffer
        self.get_thinking_stats: Callable[[], Dict[str, Any]] = thinking_stats_getter

    async def handle_gate_stats_request(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """
        Handle request for simulation gate statistics.

        Returns comprehensive metrics about gate behavior.

        Args:
            message: Raw message dictionary
            client_id: Client identifier

        Returns:
            Gate statistics response
        """
        try:
            if not self.simulation_gate:
                raise ModelNotInitializedError("SimulationGate")

            stats = self.simulation_gate.get_statistics()

            # Add thinking loop stats
            if self.get_thinking_stats:
                stats['thinking_loop'] = self.get_thinking_stats()

            return {
                "type": "gate_stats_response",
                "timestamp": asyncio.get_event_loop().time(),
                "data": stats
            }

        except ModelNotInitializedError as e:
            logger.warning(f"Gate not initialized: {e}")
            return create_error_response(str(e), error_code="GATE_NOT_AVAILABLE")

        except GateEvaluationError as e:
            logger.error(f"Gate evaluation error: {e}")
            return create_error_response(str(e), error_code="GATE_ERROR")

        except Exception as e:
            logger.error(f"Error getting gate statistics: {e}")
            return create_error_response(
                f"Failed to get gate statistics: {str(e)}",
                error_code="PROCESSING_ERROR"
            )

    async def handle_spawn_result(
        self,
        message: Dict[str, Any],
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle spawn result from simulator.

        When simulator fails to execute a spawn (e.g., insufficient energy),
        it sends this message so we can update the experience properly.

        Args:
            message: Raw message dictionary with spawn result
            client_id: Client identifier

        Returns:
            None (no response needed)
        """
        success = message.get("success", True)
        spawn_chunk = message.get("spawnChunk")
        spawn_type = message.get("spawnType")
        reason = message.get("reason", "")

        if success:
            # Spawn succeeded - nothing special to do
            logger.debug(f"[SpawnResult] Spawn succeeded: {spawn_type} at chunk {spawn_chunk}")
            return None

        # Spawn failed - update the pending experience
        logger.info(f"[SpawnResult] Spawn FAILED: {spawn_type} at chunk {spawn_chunk}, reason={reason}")

        # Use default territory ID for simulator
        territory_id = "sim-territory"

        # Update pending experience with failure
        if self.replay_buffer is not None:
            # Set actual_reward to negative value for failed spawn
            failed_reward = -0.5  # Penalty for failed spawn attempt
            updated = self.replay_buffer.update_pending_reward(territory_id, failed_reward)
            if updated:
                logger.info(f"[SpawnResult] Updated experience with failure penalty: {failed_reward}")
            else:
                logger.debug(f"[SpawnResult] No pending experience found for territory {territory_id}")

        return None  # No response needed
