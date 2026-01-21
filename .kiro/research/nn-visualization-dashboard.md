# NN Visualization Dashboard

## Overview

A separate web dashboard to visualize and understand the behavior of the Neural Network and Simulation Gate system in real-time. The dashboard provides observability into decision-making, gate behavior, and training progress.

## Goals

1. **Understand NN behavior** - See where and why the NN wants to spawn
2. **Monitor gate effectiveness** - Track pass/block rates and component contributions
3. **Observe training progress** - Visualize learning over time
4. **Debug issues** - Identify problems like deadlocks, poor decisions, or training instability

## Architecture

```
┌─────────────────┐     15s poll      ┌──────────────────┐
│   Game Client   │ ──────────────────│   Python Backend │
└─────────────────┘                   └────────┬─────────┘
                                               │
                                               │ /api/nn-dashboard
                                               │ (snapshot data)
                                               ▼
                                      ┌──────────────────┐
                                      │  Dashboard Web   │
                                      │   (separate tab) │
                                      └──────────────────┘
```

## Data Flow

1. Game sends observations every 15 seconds
2. Backend processes through NN → Simulation Gate → Training
3. Backend accumulates metrics in memory (rolling window)
4. Dashboard polls `/api/nn-dashboard` every 15 seconds
5. Dashboard renders snapshot data

## Dashboard Sections

### Section 1: NN Decisions

**Purpose:** Understand what the NN is choosing and why

**Visualizations:**

| Component | Type | Description |
|-----------|------|-------------|
| Chunk Heatmap | 20x20 Grid | Color intensity = selection frequency. Shows spatial preferences |
| Recent Decisions | Table | Last 10 decisions with chunk, type, confidence, outcome |
| Type Distribution | Pie Chart | Energy vs Combat spawn ratio |
| Confidence Histogram | Bar Chart | Distribution of confidence scores (0-1 in 10 bins) |

**Data Structure:**
```json
{
  "nn_decisions": {
    "chunk_frequency": [0, 0, 5, 2, ...],  // 400 values
    "recent_decisions": [
      {"chunk": 145, "type": "energy", "confidence": 0.48, "sent": true, "timestamp": 1234567890}
    ],
    "type_counts": {"energy": 45, "combat": 23},
    "confidence_histogram": [5, 12, 8, 15, 20, 18, 10, 7, 3, 2]  // 10 bins
  }
}
```

### Section 2: Simulation Gate Behavior

**Purpose:** Monitor how the gate filters decisions

**Visualizations:**

| Component | Type | Description |
|-----------|------|-------------|
| Pass Rate Gauge | Circular Gauge | Current pass rate (0-100%) with color coding |
| Decision Reasons | Donut Chart | Distribution: positive_reward, negative_reward, insufficient_energy |
| Component Breakdown | Stacked Bar | Average contribution of survival, disruption, location, exploration |
| Expected Reward History | Line Chart | Expected reward over last N decisions |
| Wait Streak Indicator | Number + Warning | Current consecutive WAITs, red if > 10 |

**Data Structure:**
```json
{
  "gate_behavior": {
    "pass_rate": 0.65,
    "decision_reasons": {
      "positive_reward": 42,
      "negative_reward": 15,
      "insufficient_energy": 35
    },
    "avg_components": {
      "survival": 0.85,
      "disruption": 0.32,
      "location": -0.12,
      "exploration": 0.08
    },
    "reward_history": [0.45, 0.52, -0.1, 0.38, ...],  // Last 50
    "wait_streak": 3,
    "time_since_last_action": 45.2
  }
}
```

### Section 3: Training Progress

**Purpose:** Track learning effectiveness over time

**Visualizations:**

| Component | Type | Description |
|-----------|------|-------------|
| Loss Curve | Line Chart | Training loss over last 100 updates |
| Reward Comparison | Dual Line | Simulation reward vs Real reward over time |
| Training Stats | Stat Cards | Total steps, avg loss, avg reward |
| Reward Distribution | Box Plot | Min/Max/Median/Quartiles of recent rewards |

**Data Structure:**
```json
{
  "training": {
    "loss_history": [5.92, 5.91, 5.89, ...],  // Last 100
    "simulation_rewards": [-0.1, 0.2, -0.3, ...],  // Last 50
    "real_rewards": [-0.18, 0.45, -0.27, ...],  // Last 50
    "total_steps": 1523,
    "avg_loss": 5.87,
    "avg_reward": -0.12
  }
}
```

## API Endpoint

### GET /api/nn-dashboard

Returns complete dashboard snapshot.

**Response:**
```json
{
  "timestamp": 1705712345.678,
  "uptime_seconds": 3600,
  "nn_decisions": { ... },
  "gate_behavior": { ... },
  "training": { ... },
  "game_state": {
    "queen_energy": 45.5,
    "workers_visible": 10,
    "protectors_visible": 2,
    "territory_id": "territory_dev_0_0"
  }
}
```

## Dashboard Tech Stack

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **Static HTML + Chart.js** | Simple, no build step, served by backend | Limited interactivity |
| **React + Recharts** | Rich components, good for complex UI | Build complexity |
| **Streamlit** | Python-native, rapid prototyping | Separate server needed |
| **Grafana + Prometheus** | Industry standard, powerful | Overkill, external deps |

**Recommendation:** Static HTML + Chart.js
- Served directly from FastAPI backend at `/dashboard`
- No additional build process
- Sufficient for our visualization needs
- Single HTML file with embedded JS

## History Window

| Data Type | Window Size | Rationale |
|-----------|-------------|-----------|
| Chunk frequency | Lifetime (reset on server restart) | Understand long-term preferences |
| Recent decisions | Last 20 | Quick reference |
| Loss history | Last 100 | See training trends |
| Reward history | Last 50 | Recent performance |
| Component averages | Last 50 | Rolling average |

## Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NN Visualization Dashboard                          │
│                     Last updated: 12:34:56                              │
├─────────────────────────┬─────────────────────────┬─────────────────────┤
│    NN DECISIONS         │    SIMULATION GATE      │    TRAINING         │
├─────────────────────────┼─────────────────────────┼─────────────────────┤
│                         │                         │                     │
│   ┌─────────────────┐   │   Pass Rate: 65%        │   Loss: 5.87        │
│   │  Chunk Heatmap  │   │   ┌─────────────┐       │   Steps: 1523       │
│   │    20 x 20      │   │   │ Gauge [███] │       │                     │
│   │                 │   │   └─────────────┘       │   ┌─────────────┐   │
│   └─────────────────┘   │                         │   │ Loss Curve  │   │
│                         │   Decision Reasons:     │   │    ~~~~     │   │
│   Recent Decisions:     │   ┌─────────────┐       │   └─────────────┘   │
│   ┌─────────────────┐   │   │  Donut      │       │                     │
│   │ chunk│type│conf │   │   │   Chart     │       │   Reward History:   │
│   │ 145  │ E  │0.48 │   │   └─────────────┘       │   ┌─────────────┐   │
│   │ 232  │ C  │0.52 │   │                         │   │ Sim vs Real │   │
│   └─────────────────┘   │   Components:           │   │  ~~~ ~~~    │   │
│                         │   ┌─────────────┐       │   └─────────────┘   │
│   Type: E:45 C:23       │   │ Stacked Bar │       │                     │
│   ┌─────────────────┐   │   └─────────────┘       │   Avg Reward: -0.12 │
│   │ Confidence Hist │   │                         │                     │
│   │ ▁▂▅▇▆▄▂▁        │   │   Wait Streak: 3       │                     │
│   └─────────────────┘   │   ⚠ Time: 45.2s        │                     │
│                         │                         │                     │
└─────────────────────────┴─────────────────────────┴─────────────────────┘
```

## Implementation Phases

### Phase 1: Backend Data Collection
- Create `DashboardMetrics` class to accumulate data
- Integrate with SimulationGate and message handler
- Add `/api/nn-dashboard` endpoint

### Phase 2: Basic Dashboard
- Create static HTML template
- Add Chart.js for visualizations
- Implement 15-second polling
- Serve from `/dashboard` route

### Phase 3: Visualizations
- Chunk heatmap (canvas-based)
- Pass rate gauge
- Loss curve line chart
- Decision reasons donut chart

### Phase 4: Polish
- Auto-refresh indicator
- Responsive layout
- Color themes
- Export data button

## Open Questions

1. Should dashboard data persist across server restarts? (Currently: No)
2. Should we add WebSocket for real-time updates instead of polling? (Currently: No, polling is simpler)
3. Should there be controls to adjust gate parameters from dashboard? (Currently: No, read-only)
4. Multiple territory support? (Currently: Single territory view)

## Success Criteria

1. Dashboard loads at `/dashboard` without errors
2. All three sections display meaningful data
3. Data refreshes every 15 seconds aligned with game observations
4. Chunk heatmap correctly shows spawn preferences
5. Gate pass rate matches actual behavior
6. Training loss shows decreasing trend during learning
