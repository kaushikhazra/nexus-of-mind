#!/usr/bin/env python3
"""
File size validation script for server code quality refactoring.

Ensures no Python file exceeds the maximum line count threshold.
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple

MAX_LINES = 500
SERVER_DIR = Path(__file__).parent.parent / "server"


def count_lines(file_path: Path) -> int:
    """Count non-empty lines in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return sum(1 for line in f if line.strip())
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0


def find_python_files(directory: Path) -> List[Path]:
    """Find all Python files in directory recursively."""
    return list(directory.rglob("*.py"))


def validate_file_sizes(max_lines: int = MAX_LINES) -> Tuple[List[Tuple[Path, int]], List[Tuple[Path, int]]]:
    """
    Validate all Python files are under the maximum line count.

    Returns:
        Tuple of (violations, compliant_files)
    """
    violations = []
    compliant = []

    python_files = find_python_files(SERVER_DIR)

    for file_path in python_files:
        # Skip test files and __pycache__
        if '__pycache__' in str(file_path) or 'test_' in file_path.name:
            continue

        line_count = count_lines(file_path)

        if line_count > max_lines:
            violations.append((file_path, line_count))
        else:
            compliant.append((file_path, line_count))

    return violations, compliant


def main():
    """Run file size validation."""
    print(f"Validating Python files in {SERVER_DIR}")
    print(f"Maximum allowed lines: {MAX_LINES}\n")

    violations, compliant = validate_file_sizes()

    # Sort by line count descending
    violations.sort(key=lambda x: x[1], reverse=True)
    compliant.sort(key=lambda x: x[1], reverse=True)

    if violations:
        print("=" * 60)
        print("VIOLATIONS (files exceeding limit):")
        print("=" * 60)
        for file_path, lines in violations:
            rel_path = file_path.relative_to(SERVER_DIR.parent)
            print(f"  {lines:4d} lines - {rel_path}")
        print()

    print("=" * 60)
    print(f"SUMMARY:")
    print("=" * 60)
    print(f"  Total files checked: {len(violations) + len(compliant)}")
    print(f"  Compliant files: {len(compliant)}")
    print(f"  Violations: {len(violations)}")

    if violations:
        print(f"\n[FAIL] {len(violations)} file(s) exceed {MAX_LINES} lines")
        sys.exit(1)
    else:
        print(f"\n[PASS] All files under {MAX_LINES} lines")
        sys.exit(0)


if __name__ == "__main__":
    main()
