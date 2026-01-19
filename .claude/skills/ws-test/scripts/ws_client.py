#!/usr/bin/env python3
"""
WebSocket Testing Client for Claude Code

A simple WebSocket client for testing backend servers.
"""

import argparse
import asyncio
import json
import time
import sys

try:
    import websockets
except ImportError:
    print("Error: websockets package not installed. Run: pip install websockets")
    sys.exit(1)


DEFAULT_URL = "ws://localhost:8000/ws"


def create_test_observation(workers: int = 2, minerals_start: int = 50, minerals_end: int = 80):
    """Create a test observation payload."""
    # Generate worker positions in chunk 47
    mining_workers = []
    workers_present = []
    for i in range(workers):
        worker = {"x": 100 + i * 10, "z": 100 + i * 10, "chunkId": 47}
        mining_workers.append(worker)
        workers_present.append(worker)

    return {
        "type": "observation_data",
        "data": {
            "timestamp": int(time.time() * 1000),
            "miningWorkers": mining_workers,
            "workersPresent": workers_present,
            "protectors": [],
            "parasitesStart": [],
            "parasitesEnd": [],
            "queenEnergy": {"current": 100, "max": 100},
            "playerEnergy": {"start": 400, "end": 420},
            "playerMinerals": {"start": minerals_start, "end": minerals_end},
            "territoryId": "test-territory"
        }
    }


def create_health_check():
    """Create a health check message."""
    return {"type": "health_check"}


async def send_and_receive(url: str, message: dict, timeout: float = 10.0):
    """Send a message and wait for response."""
    print(f"\n[Connecting] {url}")

    try:
        async with websockets.connect(url) as ws:
            print(f"[Connected] Successfully connected")

            # Send message
            msg_str = json.dumps(message)
            print(f"\n[Sending] {msg_str[:200]}{'...' if len(msg_str) > 200 else ''}")
            await ws.send(msg_str)

            # Wait for response
            print(f"\n[Waiting] Listening for response (timeout: {timeout}s)...")
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=timeout)
                print(f"\n[Received] {response}")

                # Try to parse as JSON for pretty print
                try:
                    parsed = json.loads(response)
                    print(f"\n[Parsed Response]")
                    print(json.dumps(parsed, indent=2))
                except json.JSONDecodeError:
                    pass

                return response

            except asyncio.TimeoutError:
                print(f"\n[Timeout] No response received within {timeout}s")
                return None

    except ConnectionRefusedError:
        print(f"\n[Error] Connection refused. Is the server running at {url}?")
        return None
    except Exception as e:
        print(f"\n[Error] {type(e).__name__}: {e}")
        return None


async def send_sequence(url: str, messages: list, delay: float = 2.0, timeout: float = 10.0):
    """Send multiple messages on same connection to test reward calculation."""
    print(f"\n[Connecting] {url}")

    try:
        async with websockets.connect(url) as ws:
            print(f"[Connected] Successfully connected")

            for i, message in enumerate(messages):
                # Send message
                msg_str = json.dumps(message)
                print(f"\n[{i+1}/{len(messages)}] Sending: {msg_str[:100]}...")
                await ws.send(msg_str)

                # Wait for response
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=timeout)
                    parsed = json.loads(response)

                    # Show key info
                    data = parsed.get('data', {})
                    print(f"[{i+1}/{len(messages)}] Response: chunk={data.get('spawnChunk')}, "
                          f"conf={data.get('confidence', 0):.3f}, skip={data.get('skip')}, "
                          f"reward={data.get('lastReward', 'N/A')}")

                except asyncio.TimeoutError:
                    print(f"[{i+1}/{len(messages)}] Timeout")

                # Delay between messages
                if i < len(messages) - 1:
                    print(f"[Waiting {delay}s...]")
                    await asyncio.sleep(delay)

            print(f"\n[Done] Sent {len(messages)} messages")

    except ConnectionRefusedError:
        print(f"\n[Error] Connection refused. Is the server running at {url}?")
    except Exception as e:
        print(f"\n[Error] {type(e).__name__}: {e}")


async def main():
    parser = argparse.ArgumentParser(description="WebSocket Testing Client")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"WebSocket URL (default: {DEFAULT_URL})")
    parser.add_argument("--send", type=str, help="Send custom JSON message")
    parser.add_argument("--health", action="store_true", help="Send health check")
    parser.add_argument("--test-observation", action="store_true", help="Send test observation")
    parser.add_argument("--test-sequence", action="store_true", help="Send sequence of observations (tests reward calc)")
    parser.add_argument("--workers", type=int, default=2, help="Number of workers for test observation")
    parser.add_argument("--minerals", type=int, default=80, help="End minerals for test observation")
    parser.add_argument("--count", type=int, default=3, help="Number of messages for sequence")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between sequence messages")
    parser.add_argument("--timeout", type=float, default=10.0, help="Response timeout in seconds")

    args = parser.parse_args()

    # Sequence mode - send multiple observations on same connection
    if args.test_sequence:
        messages = []
        for i in range(args.count):
            # Simulate mineral accumulation over time
            mineral_end = 50 + (i + 1) * 30  # 80, 110, 140, ...
            messages.append(create_test_observation(
                workers=args.workers,
                minerals_start=50,
                minerals_end=mineral_end
            ))
        await send_sequence(args.url, messages, delay=args.delay, timeout=args.timeout)
        return

    # Single message mode
    message = None

    if args.send:
        try:
            message = json.loads(args.send)
        except json.JSONDecodeError as e:
            print(f"[Error] Invalid JSON: {e}")
            sys.exit(1)
    elif args.health:
        message = create_health_check()
    elif args.test_observation:
        message = create_test_observation(
            workers=args.workers,
            minerals_start=50,
            minerals_end=args.minerals
        )
    else:
        # Default to health check
        print("[Info] No action specified, sending health check")
        message = create_health_check()

    await send_and_receive(args.url, message, timeout=args.timeout)


if __name__ == "__main__":
    asyncio.run(main())
