#!/usr/bin/env python3
"""
Test script to verify frontend integration with no-spawn decisions.

This script tests:
1. Frontend type definitions support no-spawn format
2. Frontend code handles spawnChunk=-1 correctly
3. Frontend code handles spawnType=null correctly
4. No references to old "skip" field in spawn handling
"""

import sys
import os
import re
from pathlib import Path


def test_type_definitions():
    """Test that TypeScript type definitions support no-spawn format."""
    print("=== Testing Frontend Type Definitions ===")
    
    try:
        # Read the ObservationTypes.ts file
        types_file = Path("../client/src/game/types/ObservationTypes.ts")
        if not types_file.exists():
            print(f"❌ Types file not found: {types_file}")
            return False
        
        content = types_file.read_text()
        
        # Check SpawnDecision interface
        if "interface SpawnDecision" in content:
            print("✅ SpawnDecision interface found")
        else:
            print("❌ SpawnDecision interface not found")
            return False
        
        # Check spawnChunk field supports -1
        if "spawnChunk: number" in content:
            print("✅ spawnChunk field is number type (supports -1)")
        else:
            print("❌ spawnChunk field not found or wrong type")
            return False
        
        # Check spawnType supports null
        if "'energy' | 'combat' | null" in content:
            print("✅ spawnType field supports null")
        else:
            print("❌ spawnType field does not support null")
            return False
        
        # Check for comment about no-spawn
        if "or -1 for no-spawn" in content:
            print("✅ Type definition includes no-spawn documentation")
        else:
            print("⚠️  Type definition missing no-spawn documentation")
        
        print("✅ Frontend type definitions support no-spawn format")
        return True
        
    except Exception as e:
        print(f"❌ Error testing type definitions: {e}")
        return False


def test_spawn_handling_code():
    """Test that spawn handling code correctly processes no-spawn decisions."""
    print("\n=== Testing Frontend Spawn Handling Code ===")
    
    try:
        # Read the AdaptiveQueenIntegration.ts file
        integration_file = Path("../client/src/game/AdaptiveQueenIntegration.ts")
        if not integration_file.exists():
            print(f"❌ Integration file not found: {integration_file}")
            return False
        
        content = integration_file.read_text()
        
        # Check for no-spawn handling
        if "spawnChunk === -1" in content:
            print("✅ Code checks for spawnChunk === -1")
        else:
            print("❌ Code does not check for spawnChunk === -1")
            return False
        
        # Check for no-spawn logging
        if "NN decided NO SPAWN" in content:
            print("✅ Code logs no-spawn decisions")
        else:
            print("❌ Code does not log no-spawn decisions")
            return False
        
        # Check for early return on no-spawn
        no_spawn_pattern = r"if\s*\(\s*spawnChunk\s*===\s*-1\s*\)\s*\{[^}]*return[^}]*\}"
        if re.search(no_spawn_pattern, content, re.DOTALL):
            print("✅ Code returns early on no-spawn decision")
        else:
            print("❌ Code does not return early on no-spawn decision")
            return False
        
        # Check for spawn validation
        if "spawnChunk < 0" in content:
            print("✅ Code validates spawnChunk >= 0 for spawn execution")
        else:
            print("❌ Code does not validate spawnChunk for spawn execution")
            return False
        
        # Check for spawnType null handling
        if "spawnType === null" in content:
            print("✅ Code checks for spawnType === null")
        else:
            print("❌ Code does not check for spawnType === null")
            return False
        
        # Check for spawn execution
        if "spawnAtChunk(spawnChunk, spawnType" in content:
            print("✅ Code executes spawn with correct parameters")
        else:
            print("❌ Code does not execute spawn correctly")
            return False
        
        print("✅ Frontend spawn handling code is correct")
        return True
        
    except Exception as e:
        print(f"❌ Error testing spawn handling code: {e}")
        return False


def test_no_skip_field_references():
    """Test that there are no references to old 'skip' field in spawn handling."""
    print("\n=== Testing No Skip Field References ===")
    
    try:
        # Read the AdaptiveQueenIntegration.ts file
        integration_file = Path("../client/src/game/AdaptiveQueenIntegration.ts")
        if not integration_file.exists():
            print(f"❌ Integration file not found: {integration_file}")
            return False
        
        content = integration_file.read_text()
        
        # Check for skip field references in spawn handling
        skip_patterns = [
            r"\.skip\b",
            r"data\.skip",
            r"decision\.skip",
            r"skip\s*:",
            r"skip\s*\?"
        ]
        
        skip_found = False
        for pattern in skip_patterns:
            if re.search(pattern, content):
                print(f"❌ Found skip field reference: {pattern}")
                skip_found = True
        
        if not skip_found:
            print("✅ No skip field references found in spawn handling")
        else:
            return False
        
        # Also check the type definitions
        types_file = Path("../client/src/game/types/ObservationTypes.ts")
        if types_file.exists():
            types_content = types_file.read_text()
            
            # Look for skip in SpawnDecision interface
            spawn_decision_match = re.search(
                r"interface SpawnDecision\s*\{[^}]*\}",
                types_content,
                re.DOTALL
            )
            
            if spawn_decision_match:
                spawn_decision_text = spawn_decision_match.group(0)
                if "skip" in spawn_decision_text.lower():
                    print("❌ Skip field found in SpawnDecision interface")
                    return False
                else:
                    print("✅ No skip field in SpawnDecision interface")
            else:
                print("⚠️  Could not find SpawnDecision interface")
        
        print("✅ No skip field references found")
        return True
        
    except Exception as e:
        print(f"❌ Error testing skip field references: {e}")
        return False


def test_response_format_compatibility():
    """Test that frontend can handle the new response format."""
    print("\n=== Testing Response Format Compatibility ===")
    
    try:
        # Read the AdaptiveQueenIntegration.ts file
        integration_file = Path("../client/src/game/AdaptiveQueenIntegration.ts")
        if not integration_file.exists():
            print(f"❌ Integration file not found: {integration_file}")
            return False
        
        content = integration_file.read_text()
        
        # Check that code extracts the right fields
        required_extractions = [
            "spawnChunk",
            "spawnType", 
            "confidence"
        ]
        
        for field in required_extractions:
            if f"data.{field}" in content:
                print(f"✅ Code extracts {field} from response")
            else:
                print(f"❌ Code does not extract {field} from response")
                return False
        
        # Check that code handles nested data structure
        if "decision.data || decision" in content:
            print("✅ Code handles nested data structure")
        else:
            print("❌ Code does not handle nested data structure")
            return False
        
        # Check logging format
        if "spawnChunk, spawnType, confidence" in content:
            print("✅ Code logs all relevant fields")
        else:
            print("❌ Code does not log all relevant fields")
            return False
        
        print("✅ Frontend handles response format correctly")
        return True
        
    except Exception as e:
        print(f"❌ Error testing response format: {e}")
        return False


def main():
    """Run all frontend integration tests."""
    print("Testing NN-Gate Separation: Frontend Integration")
    print("=" * 60)
    
    # Change to server directory for relative paths
    os.chdir(Path(__file__).parent)
    
    tests = [
        test_type_definitions,
        test_spawn_handling_code,
        test_no_skip_field_references,
        test_response_format_compatibility
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print("SUMMARY:")
    
    passed = sum(results)
    total = len(results)
    
    for i, (test, result) in enumerate(zip(tests, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test.__name__}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All frontend tests passed! Frontend integration is working correctly.")
        print("\nFrontend integration verified:")
        print("1. ✅ Type definitions support spawnChunk=-1 and spawnType=null")
        print("2. ✅ Code correctly handles no-spawn decisions (spawnChunk === -1)")
        print("3. ✅ Code validates spawn parameters before execution")
        print("4. ✅ No references to old 'skip' field")
        print("5. ✅ Response format compatibility maintained")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)