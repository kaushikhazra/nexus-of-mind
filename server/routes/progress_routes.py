"""
Progress Routes - REST API endpoints for Energy Lords progression

Endpoints:
- GET /api/progress - Load player progress
- POST /api/progress - Save player progress
- DELETE /api/progress - Reset player progress
"""

import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database.energy_lords import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/progress", tags=["progress"])


class ProgressData(BaseModel):
    """Request/Response model for progress data"""
    currentLevel: int = 0
    highestTitle: str = "Initiate"
    totalUpgradeBonus: float = 0
    completedLevels: List[int] = []


class ProgressResponse(BaseModel):
    """Response model for progress endpoints"""
    success: bool
    data: Optional[ProgressData] = None
    message: Optional[str] = None


@router.get("", response_model=ProgressResponse)
@router.get("/", response_model=ProgressResponse)
async def get_progress(player_id: str = "default"):
    """
    Load player progress from database

    Args:
        player_id: Player identifier (query param, default: "default")

    Returns:
        Player progress data or default values if not found
    """
    try:
        db = get_db()
        progress = db.get_progress(player_id)

        if progress:
            logger.info(f"Loaded progress for player {player_id}: Level {progress['currentLevel']}")
            return ProgressResponse(
                success=True,
                data=ProgressData(**progress)
            )
        else:
            # Return default progress for new players
            logger.info(f"No progress found for player {player_id}, returning defaults")
            return ProgressResponse(
                success=True,
                data=ProgressData(),
                message="New player - default progress"
            )

    except Exception as e:
        logger.error(f"Failed to load progress: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load progress: {str(e)}")


@router.post("", response_model=ProgressResponse)
@router.post("/", response_model=ProgressResponse)
async def save_progress(progress: ProgressData, player_id: str = "default"):
    """
    Save player progress to database

    Args:
        progress: Progress data to save
        player_id: Player identifier (query param, default: "default")

    Returns:
        Success status
    """
    try:
        db = get_db()
        success = db.save_progress(progress.model_dump(), player_id)

        if success:
            logger.info(f"Saved progress for player {player_id}: Level {progress.currentLevel}")
            return ProgressResponse(
                success=True,
                data=progress,
                message="Progress saved successfully"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to save progress")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save progress: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save progress: {str(e)}")


@router.delete("", response_model=ProgressResponse)
@router.delete("/", response_model=ProgressResponse)
async def reset_progress(player_id: str = "default"):
    """
    Reset player progress to initial state

    Args:
        player_id: Player identifier (query param, default: "default")

    Returns:
        Success status
    """
    try:
        db = get_db()
        success = db.reset_progress(player_id)

        if success:
            logger.info(f"Reset progress for player {player_id}")
            return ProgressResponse(
                success=True,
                data=ProgressData(),  # Return default progress
                message="Progress reset successfully"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to reset progress")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset progress: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset progress: {str(e)}")


@router.get("/leaderboard")
async def get_leaderboard():
    """
    Get all players ranked by level (for future multiplayer support)

    Returns:
        List of all players with their progress
    """
    try:
        db = get_db()
        players = db.get_all_players()
        return {
            "success": True,
            "players": players
        }

    except Exception as e:
        logger.error(f"Failed to get leaderboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get leaderboard: {str(e)}")


@router.get("/reset")
async def reset_database():
    """
    Reset the entire database (for testing) - creates table if not exists

    Returns:
        Success status
    """
    try:
        from database.energy_lords import init_db

        # Reinitialize database (creates table if not exists, clears all data)
        db = init_db()
        db.reset_progress('default')

        logger.info("Database reset successfully via API")
        return {
            "success": True,
            "message": "Database reset successfully. Starting fresh at Level 0."
        }

    except Exception as e:
        logger.error(f"Failed to reset database: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")
