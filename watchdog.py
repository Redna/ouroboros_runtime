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
import json
from pathlib import Path

# --- Configuration ---
ROOT = Path(__file__).parent.parent.resolve()
AGENT_DIR = ROOT / "ouroboros"
RUNTIME_DIR = ROOT / "ouroboros_runtime"
MEMORY_DIR = ROOT / "ouroboros_memory"
SCRATCHPAD_PATH = MEMORY_DIR / "scratchpad.md"
CRASH_LOG_PATH = MEMORY_DIR / "last_crash.log"
STATS_FILE = MEMORY_DIR / ".runtime_stats.json"

# Thresholds
UPTIME_STABILITY_THRESHOLD = 60  # Increased to 60s for Phoenix Protocol
MAX_STARTUP_FAILURES = 2         # Fewer attempts before reverting to speed up recovery

def get_compose_args():
    """Auto-detects GPU hardware to select the correct compose overrides."""
    base_compose = "-f docker-compose.yml"
    if Path("/dev/kfd").exists():
        print("\033[96m[WATCHDOG] Hardware Detect: AMD GPU found. Loading ROCm backend.\033[0m")
        return f"{base_compose} -f docker-compose.rocm.yml"
    else:
        print("\033[92m[WATCHDOG] Hardware Detect: Defaulting to NVIDIA CUDA backend.\033[0m")
        return f"{base_compose} -f docker-compose.cuda.yml"

def run_cmd(cmd, cwd=None):
    """Executes a shell command."""
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    return result.returncode

def capture_crash_log():
    """Captures the last 50 lines of logs from the agent container."""
    print("[WATCHDOG] Capturing crash log for Ouroboros...")
    compose_args = get_compose_args()
    result = subprocess.run(
        f"docker compose {compose_args} logs --tail=50 ouroboros", 
        shell=True, cwd=RUNTIME_DIR, capture_output=True, text=True
    )
    if result.stdout:
        if not MEMORY_DIR.exists(): MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        CRASH_LOG_PATH.write_text(result.stdout, encoding="utf-8")
        print(f"[WATCHDOG] Log saved to {CRASH_LOG_PATH}")

def trigger_lazarus_reset(reason="Startup failure"):
    """Performs a host-side git rollback to recover from a broken agent state."""
    print(f"\033[91m[WATCHDOG] PHOENIX PROTOCOL: {reason.upper()}. Executing Reset...\033[0m")
    
    capture_crash_log()
    
    # First ensure we are on 'ouroboros' branch
    ensure_ouroboros_branch()
    
    # Then revert
    run_cmd("git reset --hard HEAD~1", cwd=AGENT_DIR)
    run_cmd("git clean -fd", cwd=AGENT_DIR)
    
    if not MEMORY_DIR.exists(): MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    with open(SCRATCHPAD_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n\n--- PHOENIX RECOVERY ({time.strftime('%Y-%m-%d %H:%M:%S')}) ---\n")
        f.write(f"Reason: {reason}\n")
    print("[WATCHDOG] Phoenix Reset complete. Restarting stack...")

def update_runtime_stats():
    stats = {"restart_count": 0, "last_start_time": time.time()}
    if STATS_FILE.exists():
        try:
            with open(STATS_FILE, "r") as f:
                stats = json.load(f)
        except:
            pass
    stats["restart_count"] = stats.get("restart_count", 0) + 1
    stats["last_start_time"] = time.time()
    if not MEMORY_DIR.exists(): MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f)

def ensure_ouroboros_branch():
    """Checks if 'ouroboros' branch exists, creates it from 'true-seed' if not."""
    print("[WATCHDOG] Verifying 'ouroboros' branch...")
    
    # Check if 'ouroboros' exists
    result = subprocess.run("git branch --list ouroboros", shell=True, cwd=AGENT_DIR, capture_output=True, text=True)
    
    if not result.stdout.strip():
        print("[WATCHDOG] Branch 'ouroboros' missing! Recreating from 'true-seed'...")
        # Try to create it from true-seed
        rc = run_cmd("git checkout -b ouroboros true-seed", cwd=AGENT_DIR)
        if rc != 0:
            print("[WATCHDOG] FATAL: Could not create 'ouroboros' branch from 'true-seed'.")
            return False
    else:
        # Just switch to it
        rc = run_cmd("git checkout ouroboros", cwd=AGENT_DIR)
        if rc != 0:
            print("[WATCHDOG] FATAL: Could not switch to 'ouroboros' branch.")
            return False
    
    return True

def main():
    print("\033[94m[WATCHDOG] Ouroboros Watchdog v1.2 (Hardware Auto-Detect) Initialized.\033[0m")
    
    failure_count = 0
    compose_args = get_compose_args()
    
    while True:
        update_runtime_stats()
        start_time = time.time()
        print(f"\n[WATCHDOG] Starting Unified Ouroboros Stack (Attempt {failure_count + 1})...")
        
        # Ensure we are on the 'ouroboros' branch before launching
        if not ensure_ouroboros_branch():
            print("[WATCHDOG] Branch error. Waiting 30s before retry...")
            time.sleep(30)
            continue

        # Monitor the entire stack (all services) using the dynamically selected files
        exit_code = run_cmd(f"docker compose {compose_args} up --build --abort-on-container-exit", cwd=RUNTIME_DIR)
        
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

def cleanup(sig, frame):
    """Graceful shutdown: stop all containers."""
    print("\n\033[93m[WATCHDOG] Shutdown signal received. Cleaning up stack...\033[0m")
    compose_args = get_compose_args()
    # Use subprocess.run directly to avoid recursive calls if any
    subprocess.run(f"docker compose {compose_args} down", shell=True, cwd=RUNTIME_DIR)
    print("[WATCHDOG] Cleanup complete. Exiting.")
    os._exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    main()
