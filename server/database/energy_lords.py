"""
Energy Lords Database - SQLite persistence for player progression

Handles saving and loading player progress including:
- Current level
- Highest achieved title
- Total upgrade bonus
- Completed levels history
"""

import sqlite3
import json
import os
import logging
from typing import Optional, Dict, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Database file path - use environment variable or default to data directory
# In Docker: /app/data/energy_lords.db (mounted volume for persistence)
# In local dev: ./server/database/energy_lords.db (same directory as code)
DB_PATH = os.environ.get('ENERGY_LORDS_DB_PATH', os.path.join(os.path.dirname(__file__), 'energy_lords.db'))


class EnergyLordsDB:
    """SQLite database manager for Energy Lords progression"""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """Initialize database schema if not exists"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS player_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT UNIQUE NOT NULL DEFAULT 'default',
                    current_level INTEGER NOT NULL DEFAULT 0,
                    highest_title TEXT NOT NULL DEFAULT 'Initiate',
                    total_upgrade_bonus REAL NOT NULL DEFAULT 0,
                    completed_levels TEXT NOT NULL DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
            logger.info(f"Energy Lords database initialized at {self.db_path}")

    @contextmanager
    def _get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def get_progress(self, player_id: str = 'default') -> Optional[Dict[str, Any]]:
        """
        Load player progress from database

        Args:
            player_id: Player identifier (default for single-player)

        Returns:
            Progress dict or None if not found
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT current_level, highest_title, total_upgrade_bonus, completed_levels
                FROM player_progress
                WHERE player_id = ?
            ''', (player_id,))

            row = cursor.fetchone()
            if row:
                return {
                    'currentLevel': row['current_level'],
                    'highestTitle': row['highest_title'],
                    'totalUpgradeBonus': row['total_upgrade_bonus'],
                    'completedLevels': json.loads(row['completed_levels'])
                }
            return None

    def save_progress(self, progress: Dict[str, Any], player_id: str = 'default') -> bool:
        """
        Save player progress to database

        Args:
            progress: Progress data dict
            player_id: Player identifier

        Returns:
            True if successful
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                # Upsert progress
                cursor.execute('''
                    INSERT INTO player_progress
                        (player_id, current_level, highest_title, total_upgrade_bonus, completed_levels, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(player_id) DO UPDATE SET
                        current_level = excluded.current_level,
                        highest_title = excluded.highest_title,
                        total_upgrade_bonus = excluded.total_upgrade_bonus,
                        completed_levels = excluded.completed_levels,
                        updated_at = CURRENT_TIMESTAMP
                ''', (
                    player_id,
                    progress.get('currentLevel', 0),
                    progress.get('highestTitle', 'Initiate'),
                    progress.get('totalUpgradeBonus', 0),
                    json.dumps(progress.get('completedLevels', []))
                ))

                conn.commit()
                logger.info(f"Progress saved for player {player_id}: Level {progress.get('currentLevel')}")
                return True

        except Exception as e:
            logger.error(f"Failed to save progress: {e}")
            return False

    def reset_progress(self, player_id: str = 'default') -> bool:
        """
        Reset player progress to initial state

        Args:
            player_id: Player identifier

        Returns:
            True if successful
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    DELETE FROM player_progress WHERE player_id = ?
                ''', (player_id,))
                conn.commit()
                logger.info(f"Progress reset for player {player_id}")
                return True

        except Exception as e:
            logger.error(f"Failed to reset progress: {e}")
            return False

    def get_all_players(self) -> list:
        """Get list of all players with progress"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT player_id, current_level, highest_title, total_upgrade_bonus
                FROM player_progress
                ORDER BY current_level DESC
            ''')

            return [dict(row) for row in cursor.fetchall()]


# Global database instance
_db_instance: Optional[EnergyLordsDB] = None


def get_db() -> EnergyLordsDB:
    """Get or create the global database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = EnergyLordsDB()
    return _db_instance


def init_db(db_path: str = DB_PATH) -> EnergyLordsDB:
    """Initialize database with custom path"""
    global _db_instance
    _db_instance = EnergyLordsDB(db_path)
    return _db_instance
