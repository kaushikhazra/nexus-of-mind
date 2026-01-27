"""
Configuration Loader for Simulation Gate

Loads configuration from YAML files with hot-reload support.
"""

import os
import time
import logging
import threading
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from dataclasses import fields

import yaml

from .config import SimulationGateConfig

logger = logging.getLogger(__name__)

# Default config file path
DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "configs" / "simulation_gate.yaml"


class ConfigLoader:
    """
    Loads and monitors configuration file for changes.

    Supports hot-reload without server restart.
    """

    def __init__(
        self,
        config_path: Optional[Path] = None,
        on_reload: Optional[Callable[[SimulationGateConfig], None]] = None
    ):
        """
        Initialize config loader.

        Args:
            config_path: Path to YAML config file (uses default if None)
            on_reload: Callback when config is reloaded
        """
        self.config_path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
        self.on_reload = on_reload
        self._config: Optional[SimulationGateConfig] = None
        self._last_modified: float = 0
        self._hot_reload_thread: Optional[threading.Thread] = None
        self._stop_hot_reload = threading.Event()

    def load(self) -> SimulationGateConfig:
        """
        Load configuration from YAML file.

        Returns:
            SimulationGateConfig with loaded values

        Falls back to defaults if file is missing or invalid.
        """
        if not self.config_path.exists():
            logger.warning(
                f"Config file not found at {self.config_path}, using defaults"
            )
            self._config = SimulationGateConfig()
            return self._config

        try:
            with open(self.config_path, 'r') as f:
                yaml_data = yaml.safe_load(f)

            if not yaml_data:
                logger.warning("Config file is empty, using defaults")
                self._config = SimulationGateConfig()
                return self._config

            # Map YAML keys to dataclass fields
            config_kwargs = self._yaml_to_config(yaml_data)

            self._config = SimulationGateConfig(**config_kwargs)
            self._last_modified = self.config_path.stat().st_mtime

            # Validate config
            if not self._config.validate():
                logger.error("Config validation failed, using defaults")
                self._config = SimulationGateConfig()

            logger.info(f"Loaded simulation gate config from {self.config_path}")
            return self._config

        except yaml.YAMLError as e:
            logger.error(f"YAML parse error in config file: {e}")
            self._config = SimulationGateConfig()
            return self._config

        except Exception as e:
            logger.error(f"Error loading config: {e}")
            self._config = SimulationGateConfig()
            return self._config

    def _yaml_to_config(self, yaml_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert YAML data to config kwargs.

        Handles field name mapping and type conversion.
        """
        # Get valid field names from dataclass
        valid_fields = {f.name for f in fields(SimulationGateConfig)}

        config_kwargs = {}
        for key, value in yaml_data.items():
            # Skip hot_reload_interval as it's not part of SimulationGateConfig
            if key == 'hot_reload_interval':
                continue

            if key in valid_fields:
                config_kwargs[key] = value
            else:
                logger.warning(f"Unknown config key ignored: {key}")

        return config_kwargs

    def get_config(self) -> SimulationGateConfig:
        """
        Get current configuration.

        Loads from file if not already loaded.
        """
        if self._config is None:
            return self.load()
        return self._config

    def check_for_changes(self) -> bool:
        """
        Check if config file has changed since last load.

        Returns:
            True if file was modified and reloaded
        """
        if not self.config_path.exists():
            return False

        try:
            current_mtime = self.config_path.stat().st_mtime
            if current_mtime > self._last_modified:
                logger.info("Config file changed, reloading...")
                old_config = self._config
                self.load()

                if self.on_reload and self._config != old_config:
                    self.on_reload(self._config)

                return True

        except Exception as e:
            logger.error(f"Error checking config file: {e}")

        return False

    def start_hot_reload(self, interval: float = 5.0) -> None:
        """
        Start background thread for hot-reload.

        Args:
            interval: Seconds between checks
        """
        if self._hot_reload_thread and self._hot_reload_thread.is_alive():
            logger.warning("Hot reload already running")
            return

        self._stop_hot_reload.clear()

        def watch_loop():
            logger.info(f"Hot reload started, checking every {interval}s")
            while not self._stop_hot_reload.is_set():
                self.check_for_changes()
                self._stop_hot_reload.wait(interval)
            logger.info("Hot reload stopped")

        self._hot_reload_thread = threading.Thread(
            target=watch_loop,
            daemon=True,
            name="SimGateConfigWatcher"
        )
        self._hot_reload_thread.start()

    def stop_hot_reload(self) -> None:
        """Stop the hot-reload background thread."""
        self._stop_hot_reload.set()
        if self._hot_reload_thread:
            self._hot_reload_thread.join(timeout=2.0)
            self._hot_reload_thread = None


# Singleton instance
_config_loader: Optional[ConfigLoader] = None


def get_config_loader() -> ConfigLoader:
    """Get or create singleton config loader."""
    global _config_loader
    if _config_loader is None:
        _config_loader = ConfigLoader()
    return _config_loader


def load_simulation_config(
    config_path: Optional[Path] = None,
    enable_hot_reload: bool = True,
    hot_reload_interval: float = 5.0,
    on_reload: Optional[Callable[[SimulationGateConfig], None]] = None
) -> SimulationGateConfig:
    """
    Convenience function to load simulation config.

    Args:
        config_path: Path to config file (None for default)
        enable_hot_reload: Whether to start hot-reload thread
        hot_reload_interval: Seconds between reload checks
        on_reload: Callback when config changes

    Returns:
        Loaded SimulationGateConfig
    """
    loader = ConfigLoader(config_path=config_path, on_reload=on_reload)
    config = loader.load()

    if enable_hot_reload:
        loader.start_hot_reload(interval=hot_reload_interval)

    return config
