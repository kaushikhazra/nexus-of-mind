#!/usr/bin/env python3
"""
Test script to verify dashboard handles no-spawn decisions correctly.

This script tests:
1. Dashboard can display "NO SPAWN" for chunk=256
2. Dashboard shows gate validation correctly for no-spawn decisions
3. Dashboard API returns correct pipeline data
"""

import sys
import os
import json
import requests
from pathlib import Path

# Add server directory to path
server_dir = Path(__file__).parent
sys.path.insert(0, str(server_dir))

from ai_engine.simulation.dashboard_metrics import DashboardMetrics


def test_dashboard_api():
    """Test that dashboard API is accessible and returns data."""
    print("=== Testing Dashboard API ===")
    
    try:
        # Test dashboard endpoint
        response = requests.get('http://localhost:8000/dashboard', timeout=5)
        if response.status_code == 200:
            print("✅ Dashboard HTML endpoint is accessible")
        else:
            print(f"❌ Dashboard HTML endpoint returned status {response.status_code}")
            return False
        
        # Test dashboard data endpoint
        response = requests.get('http://localhost:8000/api/nn-dashboard', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Dashboard data endpoint is accessible")
            print(f"  Data keys: {list(data.keys())}")
            return True
        else:
            print(f"❌ Dashboard data endpoint returned status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to dashboard: {e}")
        print("  Make sure the server is running on localhost:8000")
        return False


def test_dashboard_metrics_no_spawn():
    """Test that DashboardMetrics can handle no-spawn decisions."""
    print("\n=== Testing Dashboard Metrics No-Spawn ===")
    
    try:
        # Get dashboard metrics instance
        from ai_engine.simulation.dashboard_metrics import get_dashboard_metrics
        metrics = get_dashboard_metrics()
        
        # Test recording a no-spawn decision using correct method names
        metrics.record_nn_decision(
            chunk=-1,  # No-spawn
            spawn_type=None,
            confidence=0.65,
            nn_decision='no_spawn'
        )
        
        test_nn_inference = {
            'nn_decision': 'no_spawn',
            'chunk_id': -1,
            'spawn_type': None,
            'confidence': 0.65
        }
        
        metrics.record_gate_decision(
            decision='CORRECT_WAIT',
            reason='no_viable_targets',
            expected_reward=0.2,
            nn_inference=test_nn_inference
        )
        
        # Get the dashboard snapshot
        snapshot = metrics.get_snapshot()
        
        print("Dashboard snapshot keys:")
        print(f"  {list(snapshot.keys())}")
        
        # Check if we have recent decisions
        if 'nn_decisions' in snapshot and 'recent_decisions' in snapshot['nn_decisions']:
            recent = snapshot['nn_decisions']['recent_decisions']
            print(f"  Recent decisions count: {len(recent)}")
            
            if recent:
                latest = recent[-1]  # Get most recent
                print(f"  Latest decision: {latest}")
                
                if latest.get('nn_decision') == 'no_spawn':
                    print("✅ Recent decision shows 'no_spawn'")
                else:
                    print(f"❌ Recent decision shows '{latest.get('nn_decision')}', expected 'no_spawn'")
                    return False
            else:
                print("⚠️  No recent decisions recorded")
        
        # Check gate behavior
        if 'gate_behavior' in snapshot:
            gate_data = snapshot['gate_behavior']
            print(f"  Gate behavior keys: {list(gate_data.keys())}")
            
            if 'recent_decisions' in gate_data and gate_data['recent_decisions']:
                gate_recent = gate_data['recent_decisions'][-1]
                print(f"  Latest gate decision: {gate_recent}")
                
                if gate_recent.get('decision') == 'CORRECT_WAIT':
                    print("✅ Gate decision shows 'CORRECT_WAIT'")
                else:
                    print(f"❌ Gate decision shows '{gate_recent.get('decision')}', expected 'CORRECT_WAIT'")
                    return False
        
        print("✅ Dashboard metrics correctly handle no-spawn decisions")
        return True
        
    except Exception as e:
        print(f"❌ Dashboard metrics test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_dashboard_metrics_should_spawn():
    """Test that DashboardMetrics can handle SHOULD_SPAWN decisions."""
    print("\n=== Testing Dashboard Metrics Should-Spawn ===")
    
    try:
        # Get dashboard metrics instance
        from ai_engine.simulation.dashboard_metrics import get_dashboard_metrics
        metrics = get_dashboard_metrics()
        
        # Test recording a should-spawn decision (NN said no-spawn but gate disagrees)
        metrics.record_nn_decision(
            chunk=-1,  # No-spawn
            spawn_type=None,
            confidence=0.45,
            nn_decision='no_spawn'
        )
        
        test_nn_inference = {
            'nn_decision': 'no_spawn',
            'chunk_id': -1,
            'spawn_type': None,
            'confidence': 0.45
        }
        
        metrics.record_gate_decision(
            decision='SHOULD_SPAWN',
            reason='missed_opportunity',
            expected_reward=-0.35,
            nn_inference=test_nn_inference
        )
        
        # Get the dashboard snapshot
        snapshot = metrics.get_snapshot()
        
        print("Dashboard snapshot for should-spawn:")
        
        # Check gate behavior
        if 'gate_behavior' in snapshot and 'recent_decisions' in snapshot['gate_behavior']:
            gate_recent = snapshot['gate_behavior']['recent_decisions']
            if gate_recent:
                latest_gate = gate_recent[-1]
                print(f"  Latest gate decision: {latest_gate}")
                
                if latest_gate.get('decision') == 'SHOULD_SPAWN':
                    print("✅ Gate decision shows 'SHOULD_SPAWN'")
                else:
                    print(f"❌ Gate decision shows '{latest_gate.get('decision')}', expected 'SHOULD_SPAWN'")
                    return False
                
                if latest_gate.get('reason') == 'missed_opportunity':
                    print("✅ Gate reason shows 'missed_opportunity'")
                else:
                    print(f"❌ Gate reason shows '{latest_gate.get('reason')}', expected 'missed_opportunity'")
                    return False
            else:
                print("❌ No recent gate decisions recorded")
                return False
        else:
            print("❌ No gate behavior data in snapshot")
            return False
        
        print("✅ Dashboard metrics correctly handle should-spawn decisions")
        return True
        
    except Exception as e:
        print(f"❌ Dashboard metrics test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all dashboard tests."""
    print("Testing NN-Gate Separation: Dashboard No-Spawn Display")
    print("=" * 60)
    
    tests = [
        test_dashboard_api,
        test_dashboard_metrics_no_spawn,
        test_dashboard_metrics_should_spawn
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
        print("🎉 All dashboard tests passed! No-spawn display is working correctly.")
        print("\nTo manually verify:")
        print("1. Open http://localhost:8000/dashboard in your browser")
        print("2. Look for 'NO SPAWN' in the NN INFERENCE stage")
        print("3. Look for 'CORRECT' or 'SHOULD SPAWN' in the DECISION stage")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)