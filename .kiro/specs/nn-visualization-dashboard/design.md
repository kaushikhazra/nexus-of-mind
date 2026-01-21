# NN Visualization Dashboard - Technical Design

## Overview

This document describes the technical implementation of the NN Visualization Dashboard. The dashboard is a lightweight web interface served directly from the FastAPI backend, using Chart.js for visualizations and polling for real-time updates.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python FastAPI)                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      DashboardMetrics (Singleton)                   │    │
│  │                                                                     │    │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐     │    │
│  │   │ NN Decisions│    │ Gate Stats  │    │  Training Stats     │     │    │
│  │   │             │    │             │    │                     │     │    │
│  │   │ chunk_freq  │    │ pass_rate   │    │ loss_history        │     │    │
│  │   │ recent_decs │    │ reasons     │    │ sim_rewards         │     │    │
│  │   │ type_counts │    │ components  │    │ real_rewards        │     │    │
│  │   │ confidence  │    │ wait_streak │    │ total_steps         │     │    │
│  │   └─────────────┘    └─────────────┘    └─────────────────────┘     │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                           │                                                 │
│                           │ Collect data                                    │
│                           ▼                                                 │
│  ┌───────────────┐   ┌─────────────────┐   ┌─────────────────────────┐      │
│  │ SimulationGate│──▶│ Message Handler │──▶│ Continuous Trainer     │      │
│  │               │   │                 │   │                         │      │
│  │ on_decision() │   │ on_observation()│   │ on_train_step()         │      │
│  └───────────────┘   └─────────────────┘   └─────────────────────────┘      │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                              FastAPI Routes                          │   │
│  │                                                                      │   │
│  │  GET /dashboard        → Serve static HTML page                      │   │
│  │  GET /api/nn-dashboard → Return JSON metrics snapshot                │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP Response
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Browser)                                  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         Dashboard HTML Page                             │  │
│  │                                                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    JavaScript Controller                         │   │  │
│  │  │                                                                  │   │  │
│  │  │  setInterval(() => {                                             │   │  │
│  │  │    fetch('/api/nn-dashboard')                                    │   │  │
│  │  │      .then(data => updateCharts(data))                           │   │  │
│  │  │  }, 15000)                                                       │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                         │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │  │
│  │  │  NN Decisions │  │ Gate Behavior │  │   Training    │               │  │
│  │  │               │  │               │  │               │               │  │
│  │  │ - Heatmap     │  │ - Pass Gauge  │  │ - Loss Curve  │               │  │
│  │  │ - Table       │  │ - Reasons     │  │ - Rewards     │               │  │
│  │  │ - Pie Chart   │  │ - Components  │  │ - Stats       │               │  │
│  │  │ - Histogram   │  │ - History     │  │               │               │  │
│  │  └───────────────┘  └───────────────┘  └───────────────┘               │  │
│  │                                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Structures

### DashboardMetrics Class

```python
from dataclasses import dataclass, field
from typing import Dict, List, Deque
from collections import deque
import time
import threading

@dataclass
class NNDecision:
    """Single NN decision record"""
    chunk: int
    spawn_type: str  # 'energy' or 'combat'
    confidence: float
    sent: bool
    expected_reward: float
    timestamp: float

@dataclass
class GateDecisionRecord:
    """Record of gate decision for analytics"""
    decision: str  # 'SEND' or 'WAIT'
    reason: str  # 'positive_reward', 'confidence_override', 'negative_reward', 'insufficient_energy'
    expected_reward: float
    components: Dict[str, float]
    timestamp: float

class DashboardMetrics:
    """
    Singleton class for collecting and aggregating dashboard metrics.
    Thread-safe for concurrent access from message handler and API endpoint.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        # NN Decisions tracking
        self.chunk_frequency: List[int] = [0] * 400  # 20x20 grid
        self.recent_decisions: Deque[NNDecision] = deque(maxlen=20)
        self.type_counts: Dict[str, int] = {'energy': 0, 'combat': 0}
        self.confidence_bins: List[int] = [0] * 10  # 0.0-0.1, 0.1-0.2, ..., 0.9-1.0

        # Gate behavior tracking
        self.gate_decisions: Deque[GateDecisionRecord] = deque(maxlen=100)
        self.wait_streak: int = 0
        self.last_action_time: float = time.time()

        # Training tracking
        self.loss_history: Deque[float] = deque(maxlen=100)
        self.simulation_rewards: Deque[float] = deque(maxlen=50)
        self.real_rewards: Deque[float] = deque(maxlen=50)
        self.total_training_steps: int = 0

        # Server info
        self.start_time: float = time.time()

        # Current game state (updated each observation)
        self.current_game_state: Dict = {}

        self._initialized = True
        self._data_lock = threading.Lock()

    def record_nn_decision(
        self,
        chunk: int,
        spawn_type: str,
        confidence: float,
        sent: bool,
        expected_reward: float
    ):
        """Record an NN inference decision"""
        with self._data_lock:
            # Update chunk frequency
            self.chunk_frequency[chunk] += 1

            # Add to recent decisions
            decision = NNDecision(
                chunk=chunk,
                spawn_type=spawn_type,
                confidence=confidence,
                sent=sent,
                expected_reward=expected_reward,
                timestamp=time.time()
            )
            self.recent_decisions.append(decision)

            # Update type counts
            self.type_counts[spawn_type] += 1

            # Update confidence histogram
            bin_idx = min(int(confidence * 10), 9)
            self.confidence_bins[bin_idx] += 1

    def record_gate_decision(
        self,
        decision: str,
        reason: str,
        expected_reward: float,
        components: Dict[str, float]
    ):
        """Record a simulation gate decision"""
        with self._data_lock:
            record = GateDecisionRecord(
                decision=decision,
                reason=reason,
                expected_reward=expected_reward,
                components=components,
                timestamp=time.time()
            )
            self.gate_decisions.append(record)

            # Update wait streak
            if decision == 'WAIT':
                self.wait_streak += 1
            else:
                self.wait_streak = 0
                self.last_action_time = time.time()

    def record_training_step(self, loss: float, reward: float, is_simulation: bool):
        """Record a training step"""
        with self._data_lock:
            self.loss_history.append(loss)
            if is_simulation:
                self.simulation_rewards.append(reward)
            else:
                self.real_rewards.append(reward)
            self.total_training_steps += 1

    def update_game_state(self, game_state: Dict):
        """Update current game state"""
        with self._data_lock:
            self.current_game_state = game_state

    def get_snapshot(self) -> Dict:
        """Get complete metrics snapshot for API response"""
        with self._data_lock:
            current_time = time.time()

            # Calculate gate statistics
            recent_gate = list(self.gate_decisions)
            total_decisions = len(recent_gate)
            sent_count = sum(1 for d in recent_gate if d.decision == 'SEND')
            pass_rate = sent_count / total_decisions if total_decisions > 0 else 0.0

            # Decision reasons breakdown
            reasons = {'positive_reward': 0, 'confidence_override': 0,
                      'negative_reward': 0, 'insufficient_energy': 0}
            for d in recent_gate:
                if d.reason in reasons:
                    reasons[d.reason] += 1

            # Average components
            avg_components = {'survival': 0.0, 'disruption': 0.0,
                            'location': 0.0, 'exploration': 0.0}
            if recent_gate:
                for comp in avg_components:
                    values = [d.components.get(comp, 0.0) for d in recent_gate]
                    avg_components[comp] = sum(values) / len(values)

            # Reward history from gate decisions
            reward_history = [d.expected_reward for d in recent_gate][-50:]

            # Training statistics
            loss_list = list(self.loss_history)
            sim_rewards = list(self.simulation_rewards)
            real_rewards = list(self.real_rewards)

            return {
                'timestamp': current_time,
                'uptime_seconds': current_time - self.start_time,
                'nn_decisions': {
                    'chunk_frequency': self.chunk_frequency.copy(),
                    'recent_decisions': [
                        {
                            'chunk': d.chunk,
                            'type': d.spawn_type,
                            'confidence': d.confidence,
                            'sent': d.sent,
                            'timestamp': d.timestamp
                        }
                        for d in list(self.recent_decisions)[-10:]
                    ],
                    'type_counts': self.type_counts.copy(),
                    'confidence_histogram': self.confidence_bins.copy()
                },
                'gate_behavior': {
                    'pass_rate': pass_rate,
                    'decision_reasons': reasons,
                    'avg_components': avg_components,
                    'reward_history': reward_history,
                    'wait_streak': self.wait_streak,
                    'time_since_last_action': current_time - self.last_action_time
                },
                'training': {
                    'loss_history': loss_list,
                    'simulation_rewards': sim_rewards,
                    'real_rewards': real_rewards,
                    'total_steps': self.total_training_steps,
                    'avg_loss': sum(loss_list) / len(loss_list) if loss_list else 0.0,
                    'avg_reward': sum(sim_rewards + real_rewards) / len(sim_rewards + real_rewards) if (sim_rewards or real_rewards) else 0.0
                },
                'game_state': self.current_game_state.copy()
            }
```

### API Endpoint

```python
from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse, JSONResponse
import os

router = APIRouter()

@router.get("/api/nn-dashboard")
async def get_dashboard_data():
    """Return complete dashboard metrics snapshot"""
    metrics = DashboardMetrics()
    snapshot = metrics.get_snapshot()
    return JSONResponse(content=snapshot)

@router.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve the dashboard HTML page"""
    dashboard_path = os.path.join(
        os.path.dirname(__file__),
        'static',
        'nn_dashboard.html'
    )
    with open(dashboard_path, 'r') as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)
```

## Frontend Implementation

### HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NN Visualization Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        /* Embedded CSS */
        :root {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --text-primary: #eee;
            --text-secondary: #aaa;
            --accent: #0f3460;
            --success: #00c853;
            --warning: #ffc107;
            --danger: #ff5252;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--accent);
        }

        .header h1 { font-size: 24px; }
        .header-info { display: flex; gap: 20px; font-size: 14px; color: var(--text-secondary); }

        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
        }

        .section {
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 15px;
        }

        .section h2 {
            font-size: 16px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--accent);
        }

        .card {
            background: var(--bg-primary);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .stat-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .stat-card {
            background: var(--bg-primary);
            border-radius: 6px;
            padding: 10px;
            text-align: center;
        }

        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; color: var(--text-secondary); }

        .heatmap-container {
            width: 100%;
            aspect-ratio: 1;
            margin-bottom: 12px;
        }

        #chunkHeatmap { width: 100%; height: 100%; }

        .decisions-table {
            width: 100%;
            font-size: 12px;
            border-collapse: collapse;
        }

        .decisions-table th,
        .decisions-table td {
            padding: 6px;
            text-align: left;
            border-bottom: 1px solid var(--accent);
        }

        .gauge-container {
            display: flex;
            justify-content: center;
            margin-bottom: 15px;
        }

        .gauge {
            width: 150px;
            height: 75px;
            position: relative;
        }

        .wait-streak {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            background: var(--bg-primary);
            border-radius: 6px;
        }

        .wait-streak.warning { background: rgba(255, 82, 82, 0.2); }

        .chart-container { height: 150px; margin-bottom: 12px; }

        .refresh-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .refresh-indicator .countdown {
            font-family: monospace;
            background: var(--accent);
            padding: 2px 8px;
            border-radius: 4px;
        }

        .btn {
            background: var(--accent);
            color: var(--text-primary);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }

        .btn:hover { opacity: 0.8; }

        .loading { opacity: 0.5; }
        .error { color: var(--danger); }
    </style>
</head>
<body>
    <div class="header">
        <h1>NN Visualization Dashboard</h1>
        <div class="header-info">
            <span>Territory: <strong id="territoryId">-</strong></span>
            <span>Uptime: <strong id="uptime">-</strong></span>
            <div class="refresh-indicator">
                <span>Next refresh:</span>
                <span class="countdown" id="countdown">15</span>
                <button class="btn" onclick="refreshNow()">Refresh</button>
                <button class="btn" onclick="exportData()">Export</button>
            </div>
        </div>
    </div>

    <div id="lastUpdated" style="margin-bottom: 10px; font-size: 12px; color: var(--text-secondary);">
        Last updated: Never
    </div>

    <div class="dashboard">
        <!-- NN Decisions Section -->
        <div class="section">
            <h2>NN Decisions</h2>

            <div class="card">
                <div class="heatmap-container">
                    <canvas id="chunkHeatmap"></canvas>
                </div>
            </div>

            <div class="card">
                <h3 style="font-size: 14px; margin-bottom: 8px;">Recent Decisions</h3>
                <table class="decisions-table">
                    <thead>
                        <tr><th>Chunk</th><th>Type</th><th>Conf</th><th>Sent</th></tr>
                    </thead>
                    <tbody id="decisionsTable"></tbody>
                </table>
            </div>

            <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-value" id="energyCount">0</div>
                    <div class="stat-label">Energy Spawns</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="combatCount">0</div>
                    <div class="stat-label">Combat Spawns</div>
                </div>
            </div>

            <div class="card">
                <div class="chart-container">
                    <canvas id="confidenceChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Gate Behavior Section -->
        <div class="section">
            <h2>Simulation Gate</h2>

            <div class="card">
                <div class="gauge-container">
                    <canvas id="passRateGauge" width="150" height="100"></canvas>
                </div>
                <div style="text-align: center;">
                    <span style="font-size: 24px; font-weight: bold;" id="passRateValue">0%</span>
                    <div style="font-size: 12px; color: var(--text-secondary);">Pass Rate</div>
                </div>
            </div>

            <div class="card">
                <div class="chart-container">
                    <canvas id="reasonsChart"></canvas>
                </div>
            </div>

            <div class="card">
                <div class="chart-container">
                    <canvas id="componentsChart"></canvas>
                </div>
            </div>

            <div class="card">
                <div class="chart-container">
                    <canvas id="rewardHistoryChart"></canvas>
                </div>
            </div>

            <div class="wait-streak" id="waitStreak">
                <span>Wait Streak:</span>
                <span id="waitStreakValue">0</span>
            </div>
        </div>

        <!-- Training Section -->
        <div class="section">
            <h2>Training Progress</h2>

            <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-value" id="totalSteps">0</div>
                    <div class="stat-label">Total Steps</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="avgLoss">-</div>
                    <div class="stat-label">Avg Loss</div>
                </div>
            </div>

            <div class="card">
                <div class="chart-container" style="height: 200px;">
                    <canvas id="lossChart"></canvas>
                </div>
            </div>

            <div class="card">
                <div class="chart-container" style="height: 200px;">
                    <canvas id="rewardsChart"></canvas>
                </div>
            </div>

            <div class="stat-card" style="margin-top: 12px;">
                <div class="stat-value" id="avgReward">-</div>
                <div class="stat-label">Average Reward</div>
            </div>
        </div>
    </div>

    <script>
        // JavaScript Controller - embedded for single-file dashboard
        // See JavaScript Controller section below
    </script>
</body>
</html>
```

### JavaScript Controller

```javascript
// Dashboard state
let dashboardData = null;
let refreshInterval = 15000; // 15 seconds
let countdownValue = 15;
let countdownTimer = null;
let charts = {};

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    fetchDashboardData();
    startRefreshCycle();
});

function initializeCharts() {
    // Confidence Histogram
    charts.confidence = new Chart(
        document.getElementById('confidenceChart').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: ['0.0-0.1', '0.1-0.2', '0.2-0.3', '0.3-0.4', '0.4-0.5',
                        '0.5-0.6', '0.6-0.7', '0.7-0.8', '0.8-0.9', '0.9-1.0'],
                datasets: [{
                    label: 'Confidence Distribution',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#aaa' } },
                    x: { ticks: { color: '#aaa', maxRotation: 45 } }
                }
            }
        }
    );

    // Decision Reasons Donut
    charts.reasons = new Chart(
        document.getElementById('reasonsChart').getContext('2d'),
        {
            type: 'doughnut',
            data: {
                labels: ['Positive Reward', 'Confidence Override', 'Negative Reward', 'Insufficient Energy'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#00c853', '#ffc107', '#ff5252', '#9e9e9e']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#aaa', font: { size: 10 } } } }
            }
        }
    );

    // Component Breakdown Stacked Bar
    charts.components = new Chart(
        document.getElementById('componentsChart').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: ['Components'],
                datasets: [
                    { label: 'Survival', data: [0], backgroundColor: '#4caf50' },
                    { label: 'Disruption', data: [0], backgroundColor: '#2196f3' },
                    { label: 'Location', data: [0], backgroundColor: '#ff9800' },
                    { label: 'Exploration', data: [0], backgroundColor: '#9c27b0' }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#aaa', font: { size: 10 } } } },
                scales: {
                    x: { stacked: true, ticks: { color: '#aaa' } },
                    y: { stacked: true, display: false }
                }
            }
        }
    );

    // Reward History Line
    charts.rewardHistory = new Chart(
        document.getElementById('rewardHistoryChart').getContext('2d'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Expected Reward',
                    data: [],
                    borderColor: '#00bcd4',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: '#aaa' } },
                    x: { display: false }
                }
            }
        }
    );

    // Loss Curve
    charts.loss = new Chart(
        document.getElementById('lossChart').getContext('2d'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Training Loss',
                    data: [],
                    borderColor: '#f44336',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: '#aaa' } },
                    x: { display: false }
                }
            }
        }
    );

    // Rewards Comparison (Sim vs Real)
    charts.rewards = new Chart(
        document.getElementById('rewardsChart').getContext('2d'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Simulation',
                        data: [],
                        borderColor: '#2196f3',
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Real',
                        data: [],
                        borderColor: '#4caf50',
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#aaa' } } },
                scales: {
                    y: { ticks: { color: '#aaa' } },
                    x: { display: false }
                }
            }
        }
    );
}

async function fetchDashboardData() {
    const container = document.querySelector('.dashboard');
    container.classList.add('loading');

    try {
        const response = await fetch('/api/nn-dashboard');
        if (!response.ok) throw new Error('API error');

        dashboardData = await response.json();
        updateDashboard(dashboardData);

        document.getElementById('lastUpdated').textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;
        document.getElementById('lastUpdated').classList.remove('error');
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        document.getElementById('lastUpdated').textContent = 'Connection lost - retrying...';
        document.getElementById('lastUpdated').classList.add('error');
    } finally {
        container.classList.remove('loading');
    }
}

function updateDashboard(data) {
    // Header info
    document.getElementById('territoryId').textContent =
        data.game_state?.territory_id || '-';
    document.getElementById('uptime').textContent =
        formatUptime(data.uptime_seconds);

    // NN Decisions
    updateHeatmap(data.nn_decisions.chunk_frequency);
    updateDecisionsTable(data.nn_decisions.recent_decisions);
    document.getElementById('energyCount').textContent = data.nn_decisions.type_counts.energy;
    document.getElementById('combatCount').textContent = data.nn_decisions.type_counts.combat;
    charts.confidence.data.datasets[0].data = data.nn_decisions.confidence_histogram;
    charts.confidence.update('none');

    // Gate Behavior
    updatePassRateGauge(data.gate_behavior.pass_rate);
    const reasons = data.gate_behavior.decision_reasons;
    charts.reasons.data.datasets[0].data = [
        reasons.positive_reward,
        reasons.confidence_override,
        reasons.negative_reward,
        reasons.insufficient_energy
    ];
    charts.reasons.update('none');

    const comp = data.gate_behavior.avg_components;
    charts.components.data.datasets[0].data = [comp.survival];
    charts.components.data.datasets[1].data = [comp.disruption];
    charts.components.data.datasets[2].data = [comp.location];
    charts.components.data.datasets[3].data = [comp.exploration];
    charts.components.update('none');

    charts.rewardHistory.data.labels = data.gate_behavior.reward_history.map((_, i) => i);
    charts.rewardHistory.data.datasets[0].data = data.gate_behavior.reward_history;
    charts.rewardHistory.update('none');

    updateWaitStreak(data.gate_behavior.wait_streak);

    // Training
    document.getElementById('totalSteps').textContent = data.training.total_steps;
    document.getElementById('avgLoss').textContent = data.training.avg_loss.toFixed(3);
    document.getElementById('avgReward').textContent = data.training.avg_reward.toFixed(3);

    charts.loss.data.labels = data.training.loss_history.map((_, i) => i);
    charts.loss.data.datasets[0].data = data.training.loss_history;
    charts.loss.update('none');

    const maxLen = Math.max(data.training.simulation_rewards.length, data.training.real_rewards.length);
    charts.rewards.data.labels = Array.from({ length: maxLen }, (_, i) => i);
    charts.rewards.data.datasets[0].data = data.training.simulation_rewards;
    charts.rewards.data.datasets[1].data = data.training.real_rewards;
    charts.rewards.update('none');
}

function updateHeatmap(frequencies) {
    const canvas = document.getElementById('chunkHeatmap');
    const ctx = canvas.getContext('2d');
    const gridSize = 20;

    // Set canvas size
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const cellWidth = canvas.width / gridSize;
    const cellHeight = canvas.height / gridSize;

    // Find max for color scaling
    const maxFreq = Math.max(...frequencies, 1);

    // Draw grid
    for (let z = 0; z < gridSize; z++) {
        for (let x = 0; x < gridSize; x++) {
            const chunkId = z * gridSize + x;
            const freq = frequencies[chunkId];
            const intensity = freq / maxFreq;

            // Color: dark blue to bright cyan
            const r = Math.floor(intensity * 100);
            const g = Math.floor(intensity * 200 + 50);
            const b = Math.floor(intensity * 155 + 100);

            ctx.fillStyle = freq > 0 ? `rgb(${r}, ${g}, ${b})` : '#1a1a2e';
            ctx.fillRect(x * cellWidth, z * cellHeight, cellWidth - 1, cellHeight - 1);
        }
    }
}

function updateDecisionsTable(decisions) {
    const tbody = document.getElementById('decisionsTable');
    tbody.innerHTML = decisions.map(d => `
        <tr>
            <td>${d.chunk}</td>
            <td>${d.type === 'energy' ? 'E' : 'C'}</td>
            <td>${d.confidence.toFixed(2)}</td>
            <td>${d.sent ? 'Y' : 'N'}</td>
        </tr>
    `).join('');
}

function updatePassRateGauge(rate) {
    const canvas = document.getElementById('passRateGauge');
    const ctx = canvas.getContext('2d');
    const percent = rate * 100;

    ctx.clearRect(0, 0, 150, 100);

    // Background arc
    ctx.beginPath();
    ctx.arc(75, 80, 60, Math.PI, 0, false);
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#333';
    ctx.stroke();

    // Value arc
    const color = percent < 30 ? '#ff5252' : percent < 60 ? '#ffc107' : '#00c853';
    const endAngle = Math.PI + (Math.PI * rate);
    ctx.beginPath();
    ctx.arc(75, 80, 60, Math.PI, endAngle, false);
    ctx.lineWidth = 15;
    ctx.strokeStyle = color;
    ctx.stroke();

    document.getElementById('passRateValue').textContent = `${percent.toFixed(0)}%`;
    document.getElementById('passRateValue').style.color = color;
}

function updateWaitStreak(streak) {
    const el = document.getElementById('waitStreak');
    document.getElementById('waitStreakValue').textContent = streak;

    if (streak > 10) {
        el.classList.add('warning');
    } else {
        el.classList.remove('warning');
    }
}

function startRefreshCycle() {
    countdownValue = refreshInterval / 1000;
    updateCountdown();

    countdownTimer = setInterval(() => {
        countdownValue--;
        updateCountdown();

        if (countdownValue <= 0) {
            fetchDashboardData();
            countdownValue = refreshInterval / 1000;
        }
    }, 1000);
}

function updateCountdown() {
    document.getElementById('countdown').textContent = countdownValue;
}

function refreshNow() {
    countdownValue = refreshInterval / 1000;
    fetchDashboardData();
}

function exportData() {
    if (!dashboardData) {
        alert('No data available to export');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `nn-dashboard-${timestamp}.json`;
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}
```

## Integration Points

### SimulationGate Integration

```python
# In simulation/gate.py - add metrics recording

class SimulationGate:
    def evaluate(self, observation, action, nn_confidence, current_time):
        # ... existing evaluation logic ...

        # Record metrics for dashboard
        from .dashboard_metrics import DashboardMetrics
        metrics = DashboardMetrics()

        metrics.record_nn_decision(
            chunk=action.spawn_chunk,
            spawn_type=action.spawn_type,
            confidence=nn_confidence,
            sent=(decision.decision == 'SEND'),
            expected_reward=decision.expected_reward
        )

        metrics.record_gate_decision(
            decision=decision.decision,
            reason=decision.reason,
            expected_reward=decision.expected_reward,
            components={
                'survival': components.survival,
                'disruption': components.disruption,
                'location': components.location,
                'exploration': components.exploration
            }
        )

        return decision
```

### Trainer Integration

```python
# In continuous learning trainer - add metrics recording

def train_step(self, features, reward, is_simulation=False):
    # ... existing training logic ...

    # Record metrics for dashboard
    from .dashboard_metrics import DashboardMetrics
    metrics = DashboardMetrics()

    metrics.record_training_step(
        loss=loss.item(),
        reward=reward,
        is_simulation=is_simulation
    )
```

### Message Handler Integration

```python
# In message_handler.py - update game state

async def handle_observation(self, observation_data):
    # ... existing logic ...

    # Update dashboard game state
    from ai_engine.simulation.dashboard_metrics import DashboardMetrics
    metrics = DashboardMetrics()

    metrics.update_game_state({
        'queen_energy': observation_data.get('queenEnergy', 0),
        'workers_visible': len(observation_data.get('workers', [])),
        'protectors_visible': len(observation_data.get('protectors', [])),
        'territory_id': observation_data.get('territoryId', 'unknown')
    })
```

## File Structure

```
server/
├── ai_engine/
│   └── simulation/
│       ├── __init__.py
│       ├── dashboard_metrics.py      # DashboardMetrics singleton class
│       └── ...
├── websocket/
│   └── routes/
│       └── dashboard.py              # FastAPI routes for dashboard
└── static/
    └── nn_dashboard.html             # Single-file dashboard
```

## Performance Considerations

1. **Memory Usage**: DashboardMetrics uses bounded deques to limit memory:
   - Chunk frequency: 400 integers (~3.2KB)
   - Recent decisions: 20 records (~4KB)
   - Gate decisions: 100 records (~20KB)
   - Loss/reward history: 200 floats (~1.6KB)
   - Total: < 30KB baseline

2. **API Response Time**: The `get_snapshot()` method:
   - Uses lock for thread safety
   - Copies data to prevent race conditions
   - Target: < 100ms response time

3. **Frontend Performance**:
   - Chart.js with `update('none')` for no animation during refresh
   - Canvas-based heatmap for efficient grid rendering
   - No DOM manipulation except table updates

## Error Handling

1. **Backend**:
   - DashboardMetrics handles missing data gracefully
   - API returns empty/default values if metrics not initialized

2. **Frontend**:
   - Fetch errors display "Connection lost" message
   - Continues retry on next interval
   - Charts handle empty data arrays

## Simulation Gate Pipeline Visualization

### Overview

A horizontal workflow visualization showing real-time data flowing through the 5 stages of the simulation gate decision process.

### Data Structure

The API response needs to include the most recent decision details for the pipeline:

```python
# Added to get_snapshot() response
'pipeline': {
    'observation': {
        'workers_count': 5,
        'protectors_count': 2,
        'parasites_count': 8,
        'queen_energy': 75,
        'player_energy_rate': -0.15,
        'player_mineral_rate': 0.08
    },
    'nn_output': {
        'chunk_id': 145,
        'spawn_type': 'energy',
        'confidence': 0.72
    },
    'gate_components': {
        'survival': 0.85,
        'disruption': 0.45,
        'location': -0.12,
        'exploration': 0.05,
        'weights': {
            'survival': 0.4,
            'disruption': 0.5,
            'location': 0.1
        }
    },
    'combined_reward': {
        'expected_reward': 0.342,
        'formula': 'V × (0.4×S + 0.5×D + 0.1×L) + E'
    },
    'decision': {
        'action': 'SEND',  # or 'WAIT'
        'reason': 'positive_reward',
        'timestamp': 1705123456.789
    }
}
```

### HTML Structure

```html
<!-- Pipeline Section - placed above the 3-column dashboard -->
<div class="pipeline-section">
    <h2>Simulation Gate Pipeline</h2>
    <div class="pipeline-container">
        <!-- Stage 1: Observation -->
        <div class="pipeline-stage" id="stage-observation">
            <div class="stage-header">OBSERVATION</div>
            <div class="stage-content">
                <div class="stage-item">Workers: <span id="pipe-workers">-</span></div>
                <div class="stage-item">Protectors: <span id="pipe-protectors">-</span></div>
                <div class="stage-item">Parasites: <span id="pipe-parasites">-</span></div>
                <div class="stage-item">Q.Energy: <span id="pipe-queen-energy">-</span></div>
                <div class="stage-item">P.Energy Δ: <span id="pipe-energy-rate">-</span></div>
                <div class="stage-item">P.Mineral Δ: <span id="pipe-mineral-rate">-</span></div>
            </div>
        </div>

        <div class="pipeline-arrow">→</div>

        <!-- Stage 2: NN Output -->
        <div class="pipeline-stage" id="stage-nn-output">
            <div class="stage-header">NN OUTPUT</div>
            <div class="stage-content">
                <div class="stage-item">Chunk: <span id="pipe-chunk">-</span></div>
                <div class="stage-item">Type: <span id="pipe-type">-</span></div>
                <div class="stage-item">Confidence: <span id="pipe-confidence">-</span></div>
            </div>
        </div>

        <div class="pipeline-arrow">→</div>

        <!-- Stage 3: Gate Components -->
        <div class="pipeline-stage" id="stage-components">
            <div class="stage-header">GATE COMPONENTS</div>
            <div class="stage-content">
                <div class="stage-item">Survival: <span id="pipe-survival">-</span> <small>(w=0.4)</small></div>
                <div class="stage-item">Disruption: <span id="pipe-disruption">-</span> <small>(w=0.5)</small></div>
                <div class="stage-item">Location: <span id="pipe-location">-</span> <small>(w=0.1)</small></div>
                <div class="stage-item">Exploration: <span id="pipe-exploration">-</span></div>
            </div>
        </div>

        <div class="pipeline-arrow">→</div>

        <!-- Stage 4: Combined Reward -->
        <div class="pipeline-stage" id="stage-combined">
            <div class="stage-header">COMBINED</div>
            <div class="stage-content">
                <div class="stage-formula">R = V×(w₁S + w₂D + w₃L) + E</div>
                <div class="stage-value" id="pipe-expected-reward">-</div>
            </div>
        </div>

        <div class="pipeline-arrow">→</div>

        <!-- Stage 5: Decision -->
        <div class="pipeline-stage" id="stage-decision">
            <div class="stage-header">DECISION</div>
            <div class="stage-content">
                <div class="stage-decision" id="pipe-decision">-</div>
                <div class="stage-reason" id="pipe-reason">-</div>
            </div>
        </div>
    </div>
</div>
```

### CSS Styling

```css
.pipeline-section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
}

.pipeline-section h2 {
    font-size: 16px;
    margin-bottom: 15px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--accent);
}

.pipeline-container {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 8px;
    overflow-x: auto;
}

.pipeline-stage {
    flex: 1;
    min-width: 140px;
    background: var(--bg-primary);
    border-radius: 6px;
    border: 2px solid var(--accent);
    padding: 10px;
    display: flex;
    flex-direction: column;
}

.pipeline-stage.decision-send {
    border-color: var(--success);
    box-shadow: 0 0 10px rgba(0, 200, 83, 0.3);
}

.pipeline-stage.decision-wait {
    border-color: var(--danger);
    box-shadow: 0 0 10px rgba(255, 82, 82, 0.3);
}

.stage-header {
    font-size: 11px;
    font-weight: bold;
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--accent);
}

.stage-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.stage-item {
    font-size: 12px;
    display: flex;
    justify-content: space-between;
}

.stage-item small {
    color: var(--text-secondary);
    font-size: 10px;
}

.stage-formula {
    font-size: 10px;
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: 8px;
}

.stage-value {
    font-size: 24px;
    font-weight: bold;
    text-align: center;
    color: var(--text-primary);
}

.stage-decision {
    font-size: 20px;
    font-weight: bold;
    text-align: center;
}

.stage-decision.send {
    color: var(--success);
}

.stage-decision.wait {
    color: var(--danger);
}

.stage-reason {
    font-size: 11px;
    text-align: center;
    color: var(--text-secondary);
    margin-top: 5px;
}

.pipeline-arrow {
    display: flex;
    align-items: center;
    font-size: 24px;
    color: var(--text-secondary);
    padding: 0 4px;
}
```

### JavaScript Update Function

```javascript
function updatePipeline(data) {
    const pipeline = data.pipeline;
    if (!pipeline) return;

    // Stage 1: Observation
    const obs = pipeline.observation;
    document.getElementById('pipe-workers').textContent = obs.workers_count;
    document.getElementById('pipe-protectors').textContent = obs.protectors_count;
    document.getElementById('pipe-parasites').textContent = obs.parasites_count;
    document.getElementById('pipe-queen-energy').textContent = obs.queen_energy;
    document.getElementById('pipe-energy-rate').textContent = formatRate(obs.player_energy_rate);
    document.getElementById('pipe-mineral-rate').textContent = formatRate(obs.player_mineral_rate);

    // Stage 2: NN Output
    const nn = pipeline.nn_output;
    document.getElementById('pipe-chunk').textContent = nn.chunk_id;
    document.getElementById('pipe-type').textContent = nn.spawn_type;
    document.getElementById('pipe-confidence').textContent = nn.confidence.toFixed(2);

    // Stage 3: Gate Components
    const comp = pipeline.gate_components;
    document.getElementById('pipe-survival').textContent = comp.survival.toFixed(2);
    document.getElementById('pipe-disruption').textContent = comp.disruption.toFixed(2);
    document.getElementById('pipe-location').textContent = comp.location.toFixed(2);
    document.getElementById('pipe-exploration').textContent = comp.exploration.toFixed(2);

    // Stage 4: Combined Reward
    document.getElementById('pipe-expected-reward').textContent =
        pipeline.combined_reward.expected_reward.toFixed(3);

    // Stage 5: Decision
    const decision = pipeline.decision;
    const decisionEl = document.getElementById('pipe-decision');
    const reasonEl = document.getElementById('pipe-reason');
    const stageEl = document.getElementById('stage-decision');

    decisionEl.textContent = decision.action;
    decisionEl.className = 'stage-decision ' + decision.action.toLowerCase();
    reasonEl.textContent = formatReason(decision.reason);

    // Update stage border color
    stageEl.classList.remove('decision-send', 'decision-wait');
    stageEl.classList.add(decision.action === 'SEND' ? 'decision-send' : 'decision-wait');
}

function formatRate(rate) {
    const sign = rate >= 0 ? '+' : '';
    return sign + (rate * 100).toFixed(1) + '%';
}

function formatReason(reason) {
    const labels = {
        'positive_reward': 'Positive Reward',
        'confidence_override': 'High Confidence',
        'negative_reward': 'Negative Reward',
        'insufficient_energy': 'Low Energy'
    };
    return labels[reason] || reason;
}
```

### Backend Updates

Add to `DashboardMetrics.record_gate_decision()`:

```python
def record_gate_decision(
    self,
    decision: str,
    reason: str,
    expected_reward: float,
    components: Dict[str, float],
    observation_summary: Dict[str, Any] = None,
    nn_output: Dict[str, Any] = None
):
    """Record a simulation gate decision with full pipeline data"""
    with self._data_lock:
        # ... existing code ...

        # Store latest pipeline data for visualization
        self.last_pipeline = {
            'observation': observation_summary or {},
            'nn_output': nn_output or {},
            'gate_components': {
                **components,
                'weights': {'survival': 0.4, 'disruption': 0.5, 'location': 0.1}
            },
            'combined_reward': {
                'expected_reward': expected_reward,
                'formula': 'V × (0.4×S + 0.5×D + 0.1×L) + E'
            },
            'decision': {
                'action': decision,
                'reason': reason,
                'timestamp': time.time()
            }
        }
```

Add to `get_snapshot()`:

```python
return {
    # ... existing fields ...
    'pipeline': self.last_pipeline if hasattr(self, 'last_pipeline') else None
}
```
