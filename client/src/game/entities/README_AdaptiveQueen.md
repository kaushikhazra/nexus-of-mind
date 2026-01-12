# Adaptive Queen Intelligence System

The Adaptive Queen Intelligence system extends the base Queen entity with AI learning capabilities, enabling Queens to learn from their deaths and adapt their strategies over generations.

## Overview

The system consists of several key components:

- **AdaptiveQueen**: Enhanced Queen class with learning data collection and strategy application
- **BehaviorAdapter**: Handles strategy application and behavioral adaptation
- **LearningProgressUI**: Visual feedback for AI learning progress
- **AdaptiveQueenIntegration**: Integration helper for easy setup
- **WebSocket Communication**: Real-time communication with Python AI backend

## Key Features

### Learning Data Collection
- Comprehensive death data capture (location, cause, timing, player units)
- Player behavior pattern analysis
- Assault pattern recognition
- Game state snapshots

### Strategy Application
- Hive placement strategy adaptation
- Parasite spawning pattern optimization
- Defensive coordination improvements
- Predictive behavior (advanced generations)

### Visual Feedback
- Learning progress indicators
- Generation comparison
- Strategy insights display
- Real-time learning phase updates

## Usage

### Basic Integration

```typescript
import { AdaptiveQueenIntegration, createAdaptiveQueenIntegration } from '../AdaptiveQueenIntegration';

// Create integration
const integration = await createAdaptiveQueenIntegration({
    gameEngine: gameEngine,
    territoryManager: territoryManager,
    gameState: gameState,
    guiTexture: guiTexture,
    websocketUrl: 'ws://localhost:8000/ws',
    enableLearning: true
});

// Update each frame
integration.update(deltaTime);
```

### Manual Queen Creation

```typescript
import { AdaptiveQueen } from './AdaptiveQueen';

const adaptiveConfig = {
    territory: territory,
    generation: 1,
    health: 60,
    growthDuration: 90,
    websocketClient: websocketClient,
    gameState: gameState,
    enableLearning: true
};

const queen = new AdaptiveQueen(adaptiveConfig);
```

### Monitoring Learning Progress

```typescript
// Subscribe to learning progress updates
queen.onLearningProgress((progress) => {
    console.log(`Learning Phase: ${progress.currentPhase}`);
    console.log(`Progress: ${progress.progress * 100}%`);
    console.log(`Time Remaining: ${progress.estimatedTimeRemaining}s`);
});

// Get current learning data
const learningData = queen.getLearningData();
const currentStrategy = queen.getCurrentStrategy();
```

## Requirements Validation

The AdaptiveQueen system addresses the following requirements:

### Requirement 2.1-2.6: Death Analysis System
- ✅ Records death location, cause, and timing
- ✅ Captures player unit composition and positioning
- ✅ Measures survival time and parasites spawned
- ✅ Identifies assault patterns
- ✅ Records hive discovery time and approach methods
- ✅ Transmits death data to Python backend

### Strategy Application
- ✅ Applies learned hive placement strategies
- ✅ Implements adaptive parasite spawning
- ✅ Coordinates defensive behaviors
- ✅ Executes predictive strategies (Gen 4+)

### Learning Progress Tracking
- ✅ Displays generation number and progress
- ✅ Shows learning phases with time estimates
- ✅ Provides generation comparisons
- ✅ Highlights improvements and insights

## Architecture

### Data Flow
1. **Death Event** → Comprehensive data collection
2. **Data Transmission** → WebSocket to Python backend
3. **AI Processing** → Neural network training and strategy generation
4. **Strategy Application** → BehaviorAdapter applies learned behaviors
5. **Visual Feedback** → LearningProgressUI shows progress

### Integration Points
- **TerritoryManager**: Creates AdaptiveQueens when AI learning is enabled
- **WebSocketClient**: Handles communication with AI backend
- **GameState**: Provides game context for learning
- **UI System**: Displays learning progress and insights

## Configuration

### WebSocket Connection
```typescript
const websocketClient = new WebSocketClient({
    url: 'ws://localhost:8000/ws',
    clientId: 'game_client',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    messageTimeout: 30000
});
```

### Learning Parameters
```typescript
const learningConfig = {
    enableLearning: true,
    behaviorUpdateInterval: 1000, // 1 second
    observationHistoryLimit: 1000,
    adaptationThreshold: 0.3
};
```

## Testing

### Example Usage
See `AdaptiveQueenExample.ts` for a complete integration example with:
- AI backend connection testing
- Queen creation and monitoring
- Learning simulation
- UI interaction
- Keyboard controls for testing

### Key Test Scenarios
1. **Queen Death Learning**: Simulate Queen death and verify data transmission
2. **Strategy Application**: Test strategy adaptation across generations
3. **UI Feedback**: Verify learning progress display
4. **Fallback Behavior**: Test graceful degradation when AI backend unavailable

## Performance Considerations

### Memory Management
- Learning data history is limited to prevent memory bloat
- Observation data is capped at 1000 entries
- Strategic decisions history is limited to 100 entries

### Network Optimization
- Message queuing for offline scenarios
- Automatic reconnection with exponential backoff
- Heartbeat monitoring for connection health

### UI Performance
- Smooth progress bar animations
- Efficient text updates
- Collapsible detailed views

## Error Handling

### Backend Unavailable
- Graceful fallback to standard Queen behavior
- Connection retry with exponential backoff
- User notification of learning status

### Data Validation
- Comprehensive death data validation
- Sanitization of player behavior data
- Error recovery for corrupted learning data

### UI Resilience
- Safe handling of missing data
- Graceful degradation of visual elements
- Error boundaries for UI components

## Future Enhancements

### Planned Features
- Multi-Queen knowledge sharing
- Advanced predictive behaviors
- Player skill assessment
- Dynamic difficulty scaling
- Performance analytics dashboard

### Integration Opportunities
- Integration with existing combat system
- Enhanced parasite coordination
- Territory-wide strategic planning
- Cross-session learning persistence

## Dependencies

### Required
- `@babylonjs/core`: 3D engine and math utilities
- `@babylonjs/gui`: UI components
- WebSocket support for backend communication

### Optional
- Python AI backend for neural network training
- Redis for session management (future)
- Analytics service for performance monitoring (future)

## Troubleshooting

### Common Issues
1. **WebSocket Connection Failed**: Check AI backend is running on correct port
2. **Learning Progress Not Updating**: Verify Queen is AdaptiveQueen instance
3. **UI Not Visible**: Check guiTexture is properly initialized
4. **Strategy Not Applied**: Ensure WebSocket connection is established

### Debug Information
```typescript
// Get AI statistics
const stats = integration.getAIStatistics();
console.log('AI Stats:', stats);

// Get connection status
const status = integration.getConnectionStatus();
console.log('Connection:', status);

// Get current Queen info
const queenInfo = integration.getCurrentQueen()?.getLearningData();
console.log('Queen Learning Data:', queenInfo);
```