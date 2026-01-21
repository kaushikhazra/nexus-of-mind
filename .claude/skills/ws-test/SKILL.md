---
name: ws-test
description: Test WebSocket connections to backend servers. Use when testing WebSocket APIs, debugging backend communication, sending test messages to ws:// endpoints, or verifying NN backend responses.
---

# WebSocket Testing Skill

Test WebSocket server connections by sending messages and receiving responses.

## Instructions

Use the `ws_client.py` script to interact with WebSocket servers:

```bash
python .claude/skills/ws-test/scripts/ws_client.py [options]
```

### Available Commands

**Health check:**
```bash
python .claude/skills/ws-test/scripts/ws_client.py --url ws://localhost:8000/ws --health
```

**Send custom JSON message:**
```bash
python .claude/skills/ws-test/scripts/ws_client.py --url ws://localhost:8000/ws --send '{"type": "your_message"}'
```

**Send test observation to Queen NN:**
```bash
python .claude/skills/ws-test/scripts/ws_client.py --url ws://localhost:8000/ws --test-observation
```

**Send observation with custom worker count:**
```bash
python .claude/skills/ws-test/scripts/ws_client.py --url ws://localhost:8000/ws --test-observation --workers 5 --minerals 100
```

## Test Observation Template

The `--test-observation` flag sends this structure:

```json
{
  "type": "observation_data",
  "data": {
    "timestamp": <current_time>,
    "miningWorkers": [{"x": 100, "z": 100, "chunkId": 47}, ...],
    "workersPresent": [{"x": 100, "z": 100, "chunkId": 47}, ...],
    "protectors": [],
    "parasitesStart": [],
    "parasitesEnd": [],
    "queenEnergy": {"current": 100, "max": 100},
    "playerEnergy": {"start": 400, "end": 420},
    "playerMinerals": {"start": 50, "end": 80},
    "territoryId": "test-territory"
  }
}
```

## Expected Responses

| Response Type | Description |
|--------------|-------------|
| `spawn_decision` | NN decision with `spawnChunk`, `spawnType`, `confidence`, `skip` |
| `health_check_response` | Server status |
| `error` | Error message |

## Default URL

If no `--url` is specified, defaults to `ws://localhost:8000/ws`
