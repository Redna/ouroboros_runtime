#!/usr/bin/env python3
"""
Ouroboros Watchdog (The Final Safety Net)
-----------------------------------------
This script manages the lifecycle of the Ouroboros Agent (The Body/Soul).
It provides host-side health monitoring and the ultimate Lazarus Protocol 
(git rollback) for a "broken brain" (e.g., syntax errors, broken imports).
"""

import subprocess
import time
import os
import signal
from pathlib import Path

# --- Configuration ---
ROOT = Path(__file__).parent.parent.resolve()
AGENT_DIR = ROOT / "ouroboros_agent"
RUNTIME_DIR = ROOT / "ouroboros_runtime"
MEMORY_DIR = ROOT / "ouroboros_memory"
SCRATCHPAD_PATH = MEMORY_DIR / "scratchpad.md"

# Thresholds
UPTIME_STABILITY_THRESHOLD = 30  # Seconds the agent must stay up to be considered "healthy"
MAX_STARTUP_FAILURES = 3         # Failures before triggering a hard git rollback

def run_cmd(cmd, cwd=None):
    """Executes a shell command."""
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    return result.returncode

def trigger_lazarus_reset():
    """Performs a host-side git rollback to recover from a broken agent state."""
    print("\033[91m[WATCHDOG] CRITICAL FAILURE: Startup loop detected. Executing Lazarus Reset...\033[0m")
    run_cmd("git reset --hard HEAD~1", cwd=AGENT_DIR)
    run_cmd("git clean -fd", cwd=AGENT_DIR)
    
    if not MEMORY_DIR.exists(): MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    with open(SCRATCHPAD_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n\n--- HOST-SIDE LAZARUS RECOVERY ({time.strftime('%Y-%m-%d %H:%M:%S')}) ---\n")
        f.write("Reason: Agent failed to stay alive for more than 30s after 3 attempts.\n")
    print("[WATCHDOG] Lazarus Recovery complete.")

def main():
    print("\033[94m[WATCHDOG] Ouroboros Watchdog v1.0 Initialized.\033[0m")
    
    failure_count = 0
    while True:
        start_time = time.time()
        print(f"\n[WATCHDOG] Starting Unified Ouroboros Stack (Attempt {failure_count + 1})...")
        
        # Monitor the 'ouroboros' service specifically
        exit_code = run_cmd("docker compose up --build --abort-on-container-exit ouroboros", cwd=RUNTIME_DIR)
        
        uptime = time.time() - start_time
        print(f"[WATCHDOG] Agent process ended. Uptime: {uptime:.1f}s | Exit Code: {exit_code}")
        
        if uptime < UPTIME_STABILITY_THRESHOLD and exit_code != 0:
            failure_count += 1
            if failure_count >= MAX_STARTUP_FAILURES:
                trigger_lazarus_reset()
                failure_count = 0
        else:
            failure_count = 0
        
        time.sleep(10)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda s, f: os._exit(0))
    main()
