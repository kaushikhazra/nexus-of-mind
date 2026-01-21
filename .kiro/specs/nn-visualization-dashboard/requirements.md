# NN Visualization Dashboard - Requirements

## Introduction

This specification defines a web-based dashboard for visualizing and understanding the behavior of the Neural Network and Simulation Gate system in real-time. The dashboard provides observability into decision-making, gate behavior, and training progress.

**Key Features:**
- Real-time visualization of NN spawn decisions and spatial preferences
- Simulation gate monitoring with pass/block rates and component breakdown
- Training progress tracking with loss curves and reward comparison
- Auto-refreshing dashboard aligned with 15-second observation cycle

**Building on Simulation-Gated Inference:**
- Uses metrics accumulated by the SimulationGate and CostFunction
- Extends existing logging infrastructure with dashboard data collection
- Provides visual debugging tools for the thinking loop

## Glossary

- **Chunk Heatmap**: 20x20 grid visualization showing spawn location frequency
- **Pass Rate**: Percentage of NN decisions that pass the simulation gate
- **Wait Streak**: Consecutive observations where gate returned WAIT
- **Decision Reasons**: Categories explaining why gate sent/blocked actions
- **Component Breakdown**: Contribution of survival, disruption, location, exploration to expected reward

## Requirements

### Requirement 1: Dashboard Metrics Collection

**User Story:** As a developer, I need the backend to collect and aggregate dashboard metrics so that the frontend can display meaningful visualizations.

**Problem Statement:**
- Currently, gate decisions are only logged but not aggregated for visualization
- No historical data is maintained for trend analysis
- Metrics are scattered across different modules

#### Acceptance Criteria

1. THE System SHALL create a `DashboardMetrics` class to accumulate data
2. THE System SHALL track chunk selection frequency (400 values for 20x20 grid)
3. THE System SHALL maintain a rolling window of recent decisions (last 20)
4. THE System SHALL track loss history (last 100 training steps)
5. THE System SHALL track reward history for simulation and real rewards (last 50 each)
6. THE System SHALL calculate running statistics:
   - Gate pass rate
   - Average expected reward
   - Confidence override rate
7. THE metrics SHALL persist in memory (reset on server restart)

### Requirement 2: Dashboard API Endpoint

**User Story:** As a frontend dashboard, I need a single API endpoint to fetch all visualization data so that I can render the complete dashboard state.

#### Acceptance Criteria

1. THE System SHALL expose `GET /api/nn-dashboard` endpoint
2. THE response SHALL include timestamp and uptime
3. THE response SHALL include NN decisions data:
   ```json
   {
     "chunk_frequency": [0, 0, 5, 2, ...],
     "recent_decisions": [...],
     "type_counts": {"energy": 45, "combat": 23},
     "confidence_histogram": [5, 12, 8, ...]
   }
   ```
4. THE response SHALL include gate behavior data:
   ```json
   {
     "pass_rate": 0.65,
     "decision_reasons": {...},
     "avg_components": {...},
     "reward_history": [...],
     "wait_streak": 3
   }
   ```
5. THE response SHALL include training data:
   ```json
   {
     "loss_history": [...],
     "simulation_rewards": [...],
     "real_rewards": [...],
     "total_steps": 1523,
     "avg_loss": 5.87,
     "avg_reward": -0.12
   }
   ```
6. THE response SHALL include current game state
7. THE endpoint SHALL return within 100ms

### Requirement 3: Dashboard Web Page

**User Story:** As a developer, I need a web dashboard accessible at `/dashboard` so that I can monitor the NN system in a browser.

#### Acceptance Criteria

1. THE System SHALL serve a static HTML page at `/dashboard`
2. THE page SHALL be a single HTML file with embedded CSS and JS
3. THE page SHALL use Chart.js for visualizations
4. THE page SHALL auto-refresh every 15 seconds using JavaScript polling
5. THE page SHALL display "Last updated" timestamp
6. THE page SHALL have three column layout (NN Decisions | Gate Behavior | Training)
7. THE page SHALL be responsive and work on desktop screens

### Requirement 4: NN Decisions Visualization

**User Story:** As a developer, I need to see where and why the NN wants to spawn so that I can understand its spatial preferences.

#### Acceptance Criteria

1. THE dashboard SHALL display a 20x20 Chunk Heatmap:
   - Canvas-based grid visualization
   - Color intensity represents selection frequency
   - Hover to show chunk ID and count
2. THE dashboard SHALL display Recent Decisions table:
   - Last 10 decisions
   - Columns: Chunk, Type (E/C), Confidence, Sent (Y/N), Time
3. THE dashboard SHALL display Type Distribution pie chart:
   - Energy vs Combat spawn ratio
4. THE dashboard SHALL display Confidence Histogram:
   - 10 bins from 0.0 to 1.0
   - Bar chart showing distribution

### Requirement 5: Simulation Gate Visualization

**User Story:** As a developer, I need to monitor gate effectiveness so that I can tune the simulation parameters.

#### Acceptance Criteria

1. THE dashboard SHALL display Pass Rate gauge:
   - Circular gauge 0-100%
   - Color coding: red (<30%), yellow (30-60%), green (>60%)
2. THE dashboard SHALL display Decision Reasons donut chart:
   - Categories: positive_reward, confidence_override, negative_reward, insufficient_energy
3. THE dashboard SHALL display Component Breakdown stacked bar:
   - Average contribution of survival, disruption, location, exploration
4. THE dashboard SHALL display Expected Reward History line chart:
   - Last 50 expected reward values
5. THE dashboard SHALL display Wait Streak indicator:
   - Current consecutive WAITs
   - Warning color if > 10

### Requirement 6: Training Progress Visualization

**User Story:** As a developer, I need to track learning effectiveness over time so that I can ensure the NN is improving.

#### Acceptance Criteria

1. THE dashboard SHALL display Loss Curve line chart:
   - Last 100 training loss values
   - Trend should be decreasing during learning
2. THE dashboard SHALL display Reward Comparison dual-line chart:
   - Simulation reward (blue) vs Real reward (green)
   - Last 50 values each
3. THE dashboard SHALL display Training Stats cards:
   - Total training steps
   - Average loss (last 100)
   - Average reward (last 50)
4. THE values SHALL update on each auto-refresh

### Requirement 7: Auto-Refresh Mechanism

**User Story:** As a developer, I need the dashboard to auto-update so that I can monitor in real-time without manual refreshing.

#### Acceptance Criteria

1. THE dashboard SHALL poll `/api/nn-dashboard` every 15 seconds
2. THE dashboard SHALL update all charts without full page reload
3. THE dashboard SHALL show loading indicator during fetch
4. THE dashboard SHALL handle API errors gracefully:
   - Display "Connection lost" message
   - Retry on next interval
5. THE dashboard SHALL display countdown to next refresh
6. THE dashboard SHALL have a manual refresh button

### Requirement 8: Performance and Memory

**User Story:** As a developer, I need the dashboard to be lightweight so that it doesn't impact game performance.

#### Acceptance Criteria

1. THE backend metrics collection SHALL use < 10MB memory
2. THE API endpoint SHALL respond within 100ms
3. THE frontend SHALL render smoothly at 60fps
4. THE Chart.js updates SHALL not cause memory leaks
5. THE System SHALL cap history arrays to prevent unbounded growth:
   - Loss history: 100 entries
   - Reward history: 50 entries
   - Recent decisions: 20 entries

### Requirement 9: Data Export

**User Story:** As a developer, I need to export dashboard data so that I can analyze it offline or share it.

#### Acceptance Criteria

1. THE dashboard SHALL have an "Export Data" button
2. THE export SHALL download a JSON file with current metrics
3. THE filename SHALL include timestamp: `nn-dashboard-{timestamp}.json`
4. THE export SHALL include all data displayed on dashboard

### Requirement 10: Configuration and Theming

**User Story:** As a developer, I need the dashboard to be configurable so that I can adjust refresh rate and appearance.

#### Acceptance Criteria

1. THE refresh interval SHALL be configurable (default: 15 seconds)
2. THE dashboard SHALL support light theme (default)
3. THE dashboard SHALL display server uptime
4. THE dashboard SHALL show current territory ID

### Requirement 11: Simulation Gate Pipeline Visualization

**User Story:** As a developer, I need to see the complete data flow through the simulation gate so that I can understand how each stage transforms the data and contributes to the final decision.

**Problem Statement:**
- Currently, gate components are shown as aggregated averages
- No visibility into the actual values used for the most recent decision
- Difficult to trace how observation data flows through NN → Gate → Decision

#### Acceptance Criteria

1. THE dashboard SHALL display a horizontal pipeline workflow showing 5 stages:
   - Stage 1: Observation (input data summary)
   - Stage 2: NN Output (chunk ID, type, confidence)
   - Stage 3: Gate Components (survival, disruption, location, exploration)
   - Stage 4: Combined Reward (R_expected calculation)
   - Stage 5: Decision (SEND/WAIT with reason)
2. THE pipeline SHALL show real-time values from the most recent decision
3. THE stages SHALL be connected with arrow indicators showing data flow
4. THE decision stage SHALL be color-coded:
   - Green border for SEND decisions
   - Red/orange border for WAIT decisions
5. THE pipeline SHALL display the decision reason (positive_reward, confidence_override, negative_reward, insufficient_energy)
6. THE Gate Components stage SHALL show individual component values with their weights
7. THE Combined Reward stage SHALL show the formula result
8. THE pipeline SHALL update on each dashboard refresh (15 seconds)
9. THE pipeline SHALL be positioned prominently (above or below existing sections)
