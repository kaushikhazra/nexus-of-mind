# Neural Network Architecture for Nexus of Mind

**Project**: Nexus of Mind - AI-Powered RTS Game  
**Research Focus**: Self-Learning AI Opponent Architecture  
**Date**: January 5, 2026  

## 🧠 Recommended Neural Network Architecture

### **Primary Approach: Deep Q-Network (DQN) with Policy Gradient**

This hybrid approach is perfect for RTS games because it combines:
- **Strategic planning** (what to do)
- **Tactical execution** (how to do it)
- **Real-time adaptation** (learning from outcomes)

## 🎯 Multi-Agent Neural Network System

### **1. Strategic AI (High-Level Decisions)**
```python
# Deep Q-Network for strategic decisions
class StrategyDQN(nn.Module):
    def __init__(self, state_size, action_size):
        super(StrategyDQN, self).__init__()
        self.fc1 = nn.Linear(state_size, 512)
        self.fc2 = nn.Linear(512, 256)
        self.fc3 = nn.Linear(256, 128)
        self.fc4 = nn.Linear(128, action_size)
        
    def forward(self, state):
        x = F.relu(self.fc1(state))
        x = F.relu(self.fc2(x))
        x = F.relu(self.fc3(x))
        return self.fc4(x)

# Actions: BUILD_BASE, ATTACK, DEFEND, EXPAND, RESEARCH
```

### **2. Tactical AI (Unit-Level Decisions)**
```python
# Actor-Critic for unit control
class TacticalActorCritic(nn.Module):
    def __init__(self, state_size, action_size):
        super(TacticalActorCritic, self).__init__()
        # Shared layers
        self.shared = nn.Sequential(
            nn.Linear(state_size, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU()
        )
        
        # Actor (policy) network
        self.actor = nn.Linear(128, action_size)
        
        # Critic (value) network
        self.critic = nn.Linear(128, 1)
        
    def forward(self, state):
        shared = self.shared(state)
        policy = F.softmax(self.actor(shared), dim=-1)
        value = self.critic(shared)
        return policy, value

# Actions: MOVE, ATTACK_TARGET, RETREAT, GROUP_UP
```

### **3. Adaptation Network (Player Behavior Learning)**
```python
# LSTM for learning player patterns
class PlayerPatternLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers):
        super(PlayerPatternLSTM, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 64)
        self.output = nn.Linear(64, 10)  # Player behavior categories
        
    def forward(self, sequence):
        lstm_out, _ = self.lstm(sequence)
        x = F.relu(self.fc(lstm_out[:, -1, :]))  # Last timestep
        return F.softmax(self.output(x), dim=-1)

# Learns: AGGRESSIVE, DEFENSIVE, ECONOMIC, RUSH, TURTLE, etc.
```

## 🎮 Game State Representation

### **Input Features for Neural Networks**
```python
class GameStateEncoder:
    def encode_state(self, game_state):
        return {
            # Resource information
            'resources': [gold, wood, food, population],
            
            # Military strength
            'military': [unit_count, army_strength, base_health],
            
            # Map control
            'territory': [controlled_area, strategic_points, expansion_sites],
            
            # Player behavior history
            'player_actions': [recent_moves, strategy_pattern, aggression_level],
            
            # Game phase
            'phase': [early_game, mid_game, late_game, time_elapsed]
        }
```

## 🚀 Implementation Strategy for Hackathon

### **Phase 1: Simple Rule-Based + Learning (Days 1-7)**
```python
class SimpleAI:
    def __init__(self):
        self.strategy_weights = {
            'aggressive': 0.3,
            'defensive': 0.4,
            'economic': 0.3
        }
        self.player_pattern = PlayerPatternLSTM(20, 64, 2)
    
    def adapt_to_player(self, player_history):
        # Learn player behavior
        pattern = self.player_pattern(player_history)
        
        # Adjust strategy weights
        if pattern['aggressive'] > 0.7:
            self.strategy_weights['defensive'] += 0.1
        elif pattern['economic'] > 0.7:
            self.strategy_weights['aggressive'] += 0.1
```

### **Phase 2: Full Neural Network (Days 8-14)**
```python
class AdvancedAI:
    def __init__(self):
        self.strategy_net = StrategyDQN(state_size=50, action_size=5)
        self.tactical_net = TacticalActorCritic(state_size=30, action_size=4)
        self.adaptation_net = PlayerPatternLSTM(20, 64, 2)
        
    def make_decision(self, game_state, player_history):
        # Encode current state
        state = self.encode_state(game_state)
        
        # Get strategic decision
        strategy = self.strategy_net(state)
        
        # Get tactical actions
        tactics, value = self.tactical_net(state)
        
        # Adapt based on player
        adaptation = self.adaptation_net(player_history)
        
        return self.combine_decisions(strategy, tactics, adaptation)
```

## 🎯 Training Approach

### **Self-Play Training**
```python
def train_ai():
    for episode in range(1000):
        # AI vs AI matches
        game = RTSGame()
        ai1 = AdvancedAI()
        ai2 = AdvancedAI()
        
        while not game.is_over():
            # Both AIs make decisions
            action1 = ai1.make_decision(game.state, game.history)
            action2 = ai2.make_decision(game.state, game.history)
            
            # Execute actions and get rewards
            reward1, reward2 = game.step(action1, action2)
            
            # Train networks
            ai1.train_step(reward1)
            ai2.train_step(reward2)
```

## 📊 Real-Time Performance Optimization

### **Lightweight Inference**
```python
class OptimizedAI:
    def __init__(self):
        # Use smaller networks for real-time performance
        self.quick_decision_net = nn.Sequential(
            nn.Linear(20, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 5)
        )
        
    def fast_decision(self, simplified_state):
        # < 10ms inference time
        with torch.no_grad():
            return self.quick_decision_net(simplified_state)
```

## 🎮 Hackathon-Friendly Features

### **Demonstrable Learning**
```python
class LearningVisualizer:
    def __init__(self):
        self.learning_history = []
        
    def track_adaptation(self, before_weights, after_weights):
        adaptation = {
            'timestamp': time.now(),
            'strategy_shift': calculate_shift(before_weights, after_weights),
            'confidence': calculate_confidence(after_weights)
        }
        self.learning_history.append(adaptation)
        
    def generate_learning_graph(self):
        # Create visual proof of AI learning for demo
        return plot_learning_progression(self.learning_history)
```

## 🏆 Why This Approach Wins Hackathons

### **Technical Innovation** (15 points)
- ✅ **Multi-agent architecture** - Shows advanced AI understanding
- ✅ **Real-time learning** - Demonstrates cutting-edge ML
- ✅ **Hybrid approach** - Combines multiple AI techniques

### **Practical Implementation** (40 points)
- ✅ **Incremental complexity** - Start simple, add sophistication
- ✅ **Performance optimized** - Real-time gameplay maintained
- ✅ **Demonstrable results** - Visual proof of AI learning

### **Real-World Value** (15 points)
- ✅ **Adaptive gaming** - Solves real problem in game AI
- ✅ **Scalable architecture** - Can be extended to other games
- ✅ **Commercial potential** - Applicable to game industry

## 🚀 Implementation Timeline

**For hackathon timeline (18 days):**

### **Week 1 (Days 1-7): Foundation**
- **Days 1-4**: Simple rule-based AI with basic adaptation
- **Days 5-7**: Add PlayerPatternLSTM for behavior learning

### **Week 2 (Days 8-14): Intelligence**
- **Days 8-10**: Implement StrategyDQN for decision making
- **Days 11-14**: Add TacticalActorCritic for unit control

### **Week 3 (Days 15-18): Polish**
- **Days 15-16**: Optimize performance and add learning visualizations
- **Days 17-18**: Create demo materials and documentation

## 📚 Technical References

### **Key Papers & Concepts**
- **Deep Q-Networks (DQN)**: Mnih et al., "Human-level control through deep reinforcement learning"
- **Actor-Critic Methods**: Sutton & Barto, "Reinforcement Learning: An Introduction"
- **Multi-Agent Systems**: Tampuu et al., "Multiagent cooperation and competition with deep reinforcement learning"
- **RTS AI**: Ontañón et al., "A Survey of Real-Time Strategy Game AI Research and Competition in StarCraft"

### **Implementation Libraries**
- **PyTorch**: Primary deep learning framework
- **OpenAI Gym**: Environment interface design
- **NumPy**: Numerical computations
- **Matplotlib**: Learning visualization
- **TensorBoard**: Training monitoring

## 🎯 Success Metrics

### **AI Performance Indicators**
- **Adaptation Speed**: Time to adjust to new player strategies
- **Win Rate Progression**: Improvement over multiple games
- **Strategy Diversity**: Variety of tactics employed
- **Real-Time Performance**: Decision making < 100ms

### **Demonstrable Learning Evidence**
- **Strategy Weight Evolution**: Visual changes in AI preferences
- **Player Pattern Recognition**: Accuracy in identifying player types
- **Counter-Strategy Development**: AI developing specific responses
- **Performance Graphs**: Clear learning curves and improvement trends

---

**This architecture provides a solid foundation for building an innovative, hackathon-winning AI system that demonstrates real learning and adaptation in an RTS game environment.**