"""
Pytest configuration for game_simulator tests.
Sets up the path so imports work correctly.
"""

import sys
from pathlib import Path

# Add the tools directory to path so 'from game_simulator.xxx' imports work
tools_dir = Path(__file__).parent.parent.parent
if str(tools_dir) not in sys.path:
    sys.path.insert(0, str(tools_dir))
