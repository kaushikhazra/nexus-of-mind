#!/usr/bin/env python3
"""
Validation script for Python backend setup
"""

import os
import sys
from pathlib import Path

def validate_structure():
    """Validate that all required files and directories exist"""
    required_files = [
        "main.py",
        "start_server.py",
        "requirements.txt",
        "README.md",
        ".env.example",
        "ai_engine/__init__.py",
        "ai_engine/ai_engine.py",
        "ai_engine/neural_network.py",
        "ai_engine/death_analyzer.py",
        "ai_engine/player_behavior.py",
        "ai_engine/strategy_generator.py",
        "ai_engine/memory_manager.py",
        "ai_engine/data_models.py",
        "websocket/__init__.py",
        "websocket/connection_manager.py",
        "websocket/message_handler.py"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("❌ Missing files:")
        for file_path in missing_files:
            print(f"  - {file_path}")
        return False
    else:
        print("✅ All required files present")
        return True

def validate_imports():
    """Validate that Python files can be imported (syntax check)"""
    python_files = [
        "ai_engine/data_models.py",
        "ai_engine/death_analyzer.py",
        "ai_engine/player_behavior.py",
        "ai_engine/strategy_generator.py",
        "ai_engine/memory_manager.py",
        "websocket/connection_manager.py",
        "websocket/message_handler.py"
    ]
    
    syntax_errors = []
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                compile(f.read(), file_path, 'exec')
        except SyntaxError as e:
            syntax_errors.append(f"{file_path}: {e}")
    
    if syntax_errors:
        print("❌ Syntax errors found:")
        for error in syntax_errors:
            print(f"  - {error}")
        return False
    else:
        print("✅ All Python files have valid syntax")
        return True

def main():
    """Main validation function"""
    print("Validating Python AI Backend Setup...")
    print("=" * 50)
    
    structure_valid = validate_structure()
    syntax_valid = validate_imports()
    
    print("=" * 50)
    if structure_valid and syntax_valid:
        print("✅ Python AI Backend setup validation PASSED")
        print("\nNext steps:")
        print("1. Install Python 3.9+ if not already installed")
        print("2. Create virtual environment: python -m venv venv")
        print("3. Activate virtual environment: source venv/bin/activate")
        print("4. Install dependencies: pip install -r requirements.txt")
        print("5. Start server: python start_server.py")
        return True
    else:
        print("❌ Python AI Backend setup validation FAILED")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)