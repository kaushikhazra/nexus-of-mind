#!/usr/bin/env python3
"""
Simple test to verify dashboard is accessible and can handle no-spawn display.

This test verifies:
1. Dashboard HTML is accessible
2. Dashboard API endpoint works
3. Dashboard HTML contains the no-spawn handling code
"""

import sys
import requests
import re


def test_dashboard_accessibility():
    """Test that dashboard endpoints are accessible."""
    print("=== Testing Dashboard Accessibility ===")
    
    try:
        # Test dashboard HTML endpoint
        response = requests.get('http://localhost:8000/dashboard', timeout=5)
        if response.status_code == 200:
            print("✅ Dashboard HTML endpoint is accessible")
            html_content = response.text
            
            # Check if HTML contains no-spawn handling code
            if 'no_spawn' in html_content.lower():
                print("✅ Dashboard HTML contains no-spawn handling code")
            else:
                print("❌ Dashboard HTML does not contain no-spawn handling code")
                return False
            
            # Check for specific no-spawn JavaScript code
            if "nnDecision === 'no_spawn'" in html_content:
                print("✅ Dashboard JavaScript has no-spawn decision handling")
            else:
                print("❌ Dashboard JavaScript missing no-spawn decision handling")
                return False
            
            # Check for CORRECT_WAIT and SHOULD_SPAWN handling
            if "CORRECT_WAIT" in html_content and "SHOULD_SPAWN" in html_content:
                print("✅ Dashboard has gate validation handling for no-spawn")
            else:
                print("❌ Dashboard missing gate validation handling for no-spawn")
                return False
                
        else:
            print(f"❌ Dashboard HTML endpoint returned status {response.status_code}")
            return False
        
        # Test dashboard data API endpoint
        response = requests.get('http://localhost:8000/api/nn-dashboard', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Dashboard data API endpoint is accessible")
            print(f"  Data structure keys: {list(data.keys())}")
            
            # Check if pipeline data structure exists
            if 'pipeline' in data:
                print("✅ Dashboard data includes pipeline structure")
            else:
                print("⚠️  Dashboard data does not include pipeline structure (may be empty)")
            
            return True
        else:
            print(f"❌ Dashboard data API endpoint returned status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to dashboard: {e}")
        print("  Make sure the server is running on localhost:8000")
        return False


def test_dashboard_html_structure():
    """Test that dashboard HTML has the correct structure for no-spawn display."""
    print("\n=== Testing Dashboard HTML Structure ===")
    
    try:
        response = requests.get('http://localhost:8000/dashboard', timeout=5)
        html_content = response.text
        
        # Check for NN Inference stage elements
        if 'pipe-nn-decision' in html_content:
            print("✅ Dashboard has NN decision display element")
        else:
            print("❌ Dashboard missing NN decision display element")
            return False
        
        if 'pipe-chunk' in html_content and 'pipe-type' in html_content:
            print("✅ Dashboard has chunk and type display elements")
        else:
            print("❌ Dashboard missing chunk or type display elements")
            return False
        
        # Check for Decision stage elements
        if 'pipe-decision' in html_content:
            print("✅ Dashboard has decision display element")
        else:
            print("❌ Dashboard missing decision display element")
            return False
        
        # Check for the updatePipeline function
        if 'function updatePipeline' in html_content:
            print("✅ Dashboard has updatePipeline function")
        else:
            print("❌ Dashboard missing updatePipeline function")
            return False
        
        # Check for no-spawn specific handling in JavaScript
        no_spawn_patterns = [
            r"nnDecision\s*===\s*['\"]no_spawn['\"]",
            r"textContent\s*=\s*['\"]N/A['\"]",
            r"CORRECT_WAIT",
            r"SHOULD_SPAWN"
        ]
        
        for pattern in no_spawn_patterns:
            if re.search(pattern, html_content):
                print(f"✅ Found no-spawn pattern: {pattern}")
            else:
                print(f"❌ Missing no-spawn pattern: {pattern}")
                return False
        
        print("✅ Dashboard HTML structure is correct for no-spawn display")
        return True
        
    except Exception as e:
        print(f"❌ Error testing dashboard HTML structure: {e}")
        return False


def main():
    """Run dashboard tests."""
    print("Testing NN-Gate Separation: Dashboard No-Spawn Display")
    print("=" * 60)
    
    tests = [
        test_dashboard_accessibility,
        test_dashboard_html_structure
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
        print("🎉 Dashboard tests passed! No-spawn display is ready.")
        print("\nThe dashboard is ready to display no-spawn decisions:")
        print("1. ✅ HTML structure supports no-spawn display")
        print("2. ✅ JavaScript handles 'no_spawn' NN decisions")
        print("3. ✅ Gate validation shows 'CORRECT' or 'SHOULD SPAWN'")
        print("4. ✅ Dashboard API is accessible")
        print("\nTo see it in action:")
        print("- Open http://localhost:8000/dashboard")
        print("- Run the game simulator to generate no-spawn decisions")
        print("- Watch the NN INFERENCE and DECISION stages")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)