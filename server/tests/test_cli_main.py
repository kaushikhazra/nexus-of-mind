"""
Test the CLI main entry point functionality.
"""

import pytest
import sys
import os
from unittest.mock import patch, AsyncMock
from pathlib import Path

# Add the server directory to the path
server_dir = Path(__file__).parent
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from game_simulator.main import parse_arguments, load_config, main
from game_simulator.config import SimulationConfig


class TestCLIArguments:
    """Test CLI argument parsing."""
    
    def test_default_arguments(self):
        """Test parsing with no arguments."""
        with patch('sys.argv', ['main.py']):
            args = parse_arguments()
            
        assert args.ticks == 1000
        assert args.turbo is False
        assert args.url == 'ws://localhost:8000/ws'
        assert args.config is None
        assert args.curriculum is False
        assert args.verbose is False
        assert args.quiet is False
    
    def test_all_arguments(self):
        """Test parsing with all arguments specified."""
        test_args = [
            'main.py',
            '--config', 'test.yaml',
            '--ticks', '5000',
            '--turbo',
            '--url', 'ws://remote:8000/ws',
            '--curriculum',
            '--verbose'
        ]
        
        with patch('sys.argv', test_args):
            args = parse_arguments()
            
        assert args.config == 'test.yaml'
        assert args.ticks == 5000
        assert args.turbo is True
        assert args.url == 'ws://remote:8000/ws'
        assert args.curriculum is True
        assert args.verbose is True
        assert args.quiet is False
    
    def test_short_arguments(self):
        """Test parsing with short argument forms."""
        test_args = [
            'main.py',
            '-c', 'config.yaml',
            '-t', '100',
            '-u', 'ws://test:8000/ws',
            '-v'
        ]
        
        with patch('sys.argv', test_args):
            args = parse_arguments()
            
        assert args.config == 'config.yaml'
        assert args.ticks == 100
        assert args.url == 'ws://test:8000/ws'
        assert args.verbose is True


class TestConfigLoading:
    """Test configuration loading functionality."""
    
    def test_load_default_config(self):
        """Test loading default configuration."""
        config = load_config(None)
        
        assert isinstance(config, SimulationConfig)
        assert config.grid_size == 20
        assert config.num_workers == 8
        assert config.num_protectors == 3
        assert config.turbo_mode is False
    
    def test_load_config_with_turbo_override(self):
        """Test loading config with turbo mode override."""
        config = load_config(None, turbo_override=True)
        
        assert config.turbo_mode is True
        assert config.tick_interval == 0.0
    
    def test_load_nonexistent_config_file(self):
        """Test loading from nonexistent config file."""
        with pytest.raises(FileNotFoundError):
            load_config('nonexistent.yaml')
    
    def test_load_existing_config_file(self):
        """Test loading from existing config file."""
        config_path = 'ai_engine/configs/game_simulator.yaml'
        if os.path.exists(config_path):
            config = load_config(config_path)

            assert isinstance(config, SimulationConfig)
            # Should match the values in game_simulator.yaml
            assert config.grid_size == 16
            assert config.queen_chunk == 136


class TestMainFunction:
    """Test main function behavior."""
    
    @patch('game_simulator.main.asyncio.run')
    @patch('game_simulator.main.load_config')
    def test_main_with_valid_args(self, mock_load_config, mock_asyncio_run):
        """Test main function with valid arguments."""
        mock_config = SimulationConfig()
        mock_load_config.return_value = mock_config
        
        test_args = ['main.py', '--ticks', '100', '--turbo']
        
        with patch('sys.argv', test_args):
            with patch('sys.exit') as mock_exit:
                main()
                
        # Should not exit with error
        mock_exit.assert_not_called()
        mock_asyncio_run.assert_called_once()
    
    @patch('game_simulator.main.load_config')
    def test_main_with_invalid_ticks(self, mock_load_config):
        """Test main function with invalid tick count."""
        mock_config = SimulationConfig()
        mock_load_config.return_value = mock_config
        
        test_args = ['main.py', '--ticks', '0']
        
        with patch('sys.argv', test_args):
            with patch('sys.exit') as mock_exit:
                main()
                
        # Should exit with error code 1
        mock_exit.assert_called_with(1)
    
    @patch('game_simulator.main.load_config')
    def test_main_with_missing_config(self, mock_load_config):
        """Test main function with missing config file."""
        mock_load_config.side_effect = FileNotFoundError("Config not found")
        
        test_args = ['main.py', '--config', 'missing.yaml']
        
        with patch('sys.argv', test_args):
            with patch('sys.exit') as mock_exit:
                main()
                
        # Should exit with error code 1
        mock_exit.assert_called_with(1)


if __name__ == "__main__":
    pytest.main([__file__])