"""
Feature Extractor for Queen AI Continuous Learning

Extracts 20 normalized features from observation data for neural network input.
All features are normalized to [0, 1] range for stable training.
"""

import logging
import math
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class FeatureConfig:
    """Configuration for feature extraction."""

    # Map dimensions for spatial normalization
    map_width: float = 200.0
    map_height: float = 200.0

    # Maximum values for normalization
    max_energy: float = 1000.0
    max_mining_sites: int = 10
    max_workers: int = 20
    max_protectors: int = 10
    max_parasites: int = 50
    max_distance: float = 200.0
    max_game_time: float = 1800.0  # 30 minutes in seconds

    # Territory control estimation
    territory_radius: float = 50.0  # Radius considered as territory


class FeatureExtractor:
    """
    Extracts and normalizes features from observation data for NN input.

    Features (20 total):
    - Player State (7): energy, mining_sites, workers, protectors, base_health, avg_worker_dist, mining_efficiency
    - Spatial (6): nearest_mine_dist, player_centroid_x/y, mining_centroid_x/y, territory_control
    - Queen State (4): parasite_count, queen_health, time_since_spawn, hive_discovered
    - Temporal (3): game_time, mining_interruption_rate, combat_win_rate
    """

    def __init__(self, config: Optional[FeatureConfig] = None):
        self.config = config or FeatureConfig()
        self._feature_names = self._initialize_feature_names()

    def _initialize_feature_names(self) -> List[str]:
        """Get ordered list of feature names."""
        return [
            # Player State (7)
            'player_energy',
            'mining_site_count',
            'worker_count',
            'protector_count',
            'base_health',
            'avg_worker_distance',
            'mining_efficiency',
            # Spatial (6)
            'nearest_mine_distance',
            'player_centroid_x',
            'player_centroid_y',
            'mining_centroid_x',
            'mining_centroid_y',
            'territory_control',
            # Queen State (4)
            'parasite_count',
            'queen_health',
            'time_since_spawn',
            'hive_discovered',
            # Temporal (3)
            'game_time',
            'mining_interruption_rate',
            'combat_win_rate'
        ]

    @property
    def feature_names(self) -> List[str]:
        """Get list of feature names in order."""
        return self._feature_names

    @property
    def feature_count(self) -> int:
        """Get total number of features."""
        return len(self._feature_names)

    def extract(self, observation: Dict[str, Any]) -> np.ndarray:
        """
        Extract features from observation data.

        Args:
            observation: Observation data dictionary from frontend

        Returns:
            numpy array of 20 normalized features
        """
        features = np.zeros(20, dtype=np.float32)

        try:
            # Extract player state features (indices 0-6)
            self._extract_player_features(observation, features)

            # Extract spatial features (indices 7-12)
            self._extract_spatial_features(observation, features)

            # Extract queen state features (indices 13-16)
            self._extract_queen_features(observation, features)

            # Extract temporal features (indices 17-19)
            self._extract_temporal_features(observation, features)

            # Clip to [0, 1] to handle any edge cases
            features = np.clip(features, 0.0, 1.0)

        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            # Return zero features on error (safe default)

        return features

    def _extract_player_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """Extract player state features (7 features, indices 0-6)."""
        player = obs.get('player', {})

        # 0: Player energy (normalized)
        energy = player.get('energy', 0)
        max_energy = player.get('maxEnergy', self.config.max_energy)
        features[0] = self._normalize(energy, 0, max_energy)

        # 1: Mining site count
        mining_sites = player.get('miningSites', [])
        features[1] = self._normalize(len(mining_sites), 0, self.config.max_mining_sites)

        # 2: Worker count
        workers = player.get('workers', [])
        features[2] = self._normalize(len(workers), 0, self.config.max_workers)

        # 3: Protector count
        protectors = player.get('protectors', [])
        features[3] = self._normalize(len(protectors), 0, self.config.max_protectors)

        # 4: Base health
        features[4] = player.get('baseHealth', 1.0)

        # 5: Average worker distance from base
        base_pos = player.get('basePosition', {'x': 0, 'y': 0})
        avg_dist = self._calculate_avg_distance(workers, base_pos)
        features[5] = self._normalize(avg_dist, 0, self.config.max_distance)

        # 6: Mining efficiency
        efficiency = player.get('miningEfficiency', 0)
        max_efficiency = len(mining_sites) * 2.0 if mining_sites else 1.0  # Estimate max
        features[6] = self._normalize(efficiency, 0, max_efficiency)

    def _extract_spatial_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """Extract spatial features (6 features, indices 7-12)."""
        player = obs.get('player', {})
        queen = obs.get('queen', {})

        mining_sites = player.get('miningSites', [])
        workers = player.get('workers', [])
        hive_pos = queen.get('hivePosition', {'x': 0, 'y': 0})

        # 7: Nearest mining site distance from hive
        nearest_dist = self._find_nearest_distance(mining_sites, hive_pos)
        features[7] = self._normalize(nearest_dist, 0, self.config.max_distance)

        # 8-9: Player unit centroid (relative to map center, normalized)
        all_player_units = workers + player.get('protectors', [])
        player_centroid = self._calculate_centroid(all_player_units)
        features[8] = self._normalize_position(player_centroid['x'], self.config.map_width)
        features[9] = self._normalize_position(player_centroid['y'], self.config.map_height)

        # 10-11: Mining site centroid (relative to map center, normalized)
        mining_centroid = self._calculate_centroid(mining_sites)
        features[10] = self._normalize_position(mining_centroid['x'], self.config.map_width)
        features[11] = self._normalize_position(mining_centroid['y'], self.config.map_height)

        # 12: Territory control (% of map controlled by queen)
        parasites = queen.get('parasites', [])
        features[12] = self._estimate_territory_control(parasites, hive_pos)

    def _extract_queen_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """Extract queen state features (4 features, indices 13-16)."""
        queen = obs.get('queen', {})

        # 13: Parasite count
        parasite_count = queen.get('parasiteCount', 0)
        features[13] = self._normalize(parasite_count, 0, self.config.max_parasites)

        # 14: Queen health (already normalized in observation)
        features[14] = queen.get('health', 1.0)

        # 15: Time since last spawn (normalized, cap at 10 seconds)
        time_since_spawn = queen.get('lastSpawnTime', 0)
        features[15] = self._normalize(time_since_spawn, 0, 10000)  # 10 seconds in ms

        # 16: Hive discovered (binary)
        features[16] = 1.0 if queen.get('hiveDiscovered', False) else 0.0

    def _extract_temporal_features(self, obs: Dict[str, Any], features: np.ndarray) -> None:
        """Extract temporal features (3 features, indices 17-19)."""
        events = obs.get('events', {})

        # 17: Game time (normalized to max game time)
        game_time = obs.get('gameTime', 0)
        features[17] = self._normalize(game_time, 0, self.config.max_game_time)

        # 18: Mining interruption rate (interruptions per window)
        interruption_count = events.get('miningInterruptionCount', 0)
        window_duration = obs.get('windowDuration', 15000) / 1000  # to seconds
        interruption_rate = interruption_count / max(window_duration, 1)
        features[18] = self._normalize(interruption_rate, 0, 1.0)  # Cap at 1 per second

        # 19: Combat win rate
        combat_encounters = events.get('combatEncounters', [])
        if combat_encounters:
            wins = sum(1 for e in combat_encounters if e.get('outcome') == 'queen_win')
            features[19] = wins / len(combat_encounters)
        else:
            features[19] = 0.5  # Neutral default

    def _normalize(self, value: float, min_val: float, max_val: float) -> float:
        """Normalize value to [0, 1] range."""
        if max_val <= min_val:
            return 0.0
        return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))

    def _normalize_position(self, value: float, map_size: float) -> float:
        """Normalize position to [0, 1] relative to map center."""
        # Assume map center is at 0,0 and extends to ±map_size/2
        half_size = map_size / 2
        return self._normalize(value, -half_size, half_size)

    def _calculate_avg_distance(self, positions: List[Dict], reference: Dict) -> float:
        """Calculate average distance from reference point."""
        if not positions:
            return 0.0

        total_dist = 0.0
        for pos in positions:
            dx = pos.get('x', 0) - reference.get('x', 0)
            dy = pos.get('y', 0) - reference.get('y', 0)
            total_dist += math.sqrt(dx * dx + dy * dy)

        return total_dist / len(positions)

    def _calculate_centroid(self, positions: List[Dict]) -> Dict[str, float]:
        """Calculate centroid of positions."""
        if not positions:
            return {'x': 0.0, 'y': 0.0}

        sum_x = sum(pos.get('x', 0) for pos in positions)
        sum_y = sum(pos.get('y', 0) for pos in positions)

        return {
            'x': sum_x / len(positions),
            'y': sum_y / len(positions)
        }

    def _find_nearest_distance(self, positions: List[Dict], reference: Dict) -> float:
        """Find distance to nearest position from reference."""
        if not positions:
            return self.config.max_distance

        min_dist = float('inf')
        ref_x = reference.get('x', 0)
        ref_y = reference.get('y', 0)

        for pos in positions:
            dx = pos.get('x', 0) - ref_x
            dy = pos.get('y', 0) - ref_y
            dist = math.sqrt(dx * dx + dy * dy)
            min_dist = min(min_dist, dist)

        return min_dist if min_dist != float('inf') else self.config.max_distance

    def _estimate_territory_control(self, parasites: List[Dict], hive_pos: Dict) -> float:
        """
        Estimate territory control based on parasite positions.
        Returns value in [0, 1] representing approximate % of map controlled.
        """
        if not parasites:
            return 0.0

        # Calculate spread of parasites
        positions = [(p.get('x', 0), p.get('y', 0)) for p in parasites]

        if len(positions) < 2:
            # Single parasite - minimal control
            return 0.1

        # Calculate convex hull area approximation using spread
        xs = [p[0] for p in positions]
        ys = [p[1] for p in positions]

        spread_x = max(xs) - min(xs)
        spread_y = max(ys) - min(ys)

        # Approximate controlled area
        controlled_area = spread_x * spread_y * 0.5  # Rough estimate

        # Normalize by total map area
        map_area = self.config.map_width * self.config.map_height
        control = controlled_area / map_area

        return min(1.0, control)

    def get_feature_importance(self, weights: np.ndarray) -> Dict[str, float]:
        """
        Map feature importance weights to feature names.

        Args:
            weights: Array of importance weights (same length as features)

        Returns:
            Dictionary mapping feature names to importance values
        """
        if len(weights) != len(self._feature_names):
            logger.warning(f"Weight length {len(weights)} doesn't match feature count {len(self._feature_names)}")
            return {}

        return dict(zip(self._feature_names, weights.tolist()))

    def describe_features(self, features: np.ndarray) -> Dict[str, float]:
        """
        Create a descriptive dictionary of feature values.

        Args:
            features: Feature array

        Returns:
            Dictionary mapping feature names to values
        """
        if len(features) != len(self._feature_names):
            return {}

        return dict(zip(self._feature_names, features.tolist()))
