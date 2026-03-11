#!/usr/bin/env python3
"""
Ouroboros Watchdog (The World)
-------------------------------
This script manages the lifecycle of the Ouroboros Agent (The Body).
It enforces safety guardrails, monitors the agent container, and
implements the Lazarus Protocol (auto-rollback on crash).
"""

import os
import subprocess
import time
import logging
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
RUNTIME_DIR = PROJECT_ROOT / "ouroboros_runtime"
AGENT_DIR = PROJECT_ROOT / "ouroboros_agent"
SAFETY_GOLDEN = RUNTIME_DIR / "safety_golden"
SCRATCHPAD_PATH = AGENT_DIR / "scratchpad.md"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] Watchdog: %(message)s"
)
log = logging.getLogger("watchdog")

def force_sync_safety():
    """Force-sync safety-critical files from the golden bundle to the agent repository."""
    log.info("Enforcing safety sandbox (Force-Sync)...")
    if not SAFETY_GOLDEN.exists():
        log.warning(f"Safety golden bundle not found at {SAFETY_GOLDEN}")
        return

    for src in SAFETY_GOLDEN.rglob("*"):
        if src.is_file():
            rel_path = src.relative_to(SAFETY_GOLDEN)
            dest = AGENT_DIR / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            log.info(f"Syncing {rel_path}...")
            # Use cp to ensure it's fresh
            subprocess.run(["cp", str(src), str(dest)], check=True)

def run_agent_container():
    """Start the agent's Docker container and wait for it to exit."""
    log.info("Invoking Agent Container...")
    # Using docker-compose from the runtime directory
    cmd = ["docker-compose", "up", "--abort-on-container-exit", "ouroboros"]
    
    # We need to run this in the runtime dir so it finds docker-compose.yml
    process = subprocess.Popen(
        cmd,
        cwd=str(RUNTIME_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    # Stream output to watchdog log
    for line in process.stdout:
        print(f"  [AGENT] {line.strip()}")

    process.wait()
    return process.returncode

def lazarus_protocol(exit_code, crash_log=None):
    """Execute the Lazarus Protocol: rollback the agent's code on crash."""
    log.error(f"Agent crashed with exit code {exit_code}!")
    
    # Write crash info to scratchpad
    try:
        with open(SCRATCHPAD_PATH, "a") as f:
            f.write(f"\n\n### FATAL CRASH DETECTED ###\n")
            f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Exit Code: {exit_code}\n")
            if crash_log:
                f.write(f"Last Log Snippet:\n```\n{crash_log}\n```\n")
            f.write(f"Action: Triggering Git Rollback (Lazarus Protocol)\n")
    except Exception as e:
        log.error(f"Failed to write to scratchpad: {e}")

    # Rollback agent code
    log.warning("Rolling back agent repository to last known healthy state (HEAD~1)...")
    try:
        subprocess.run(["git", "reset", "--hard", "HEAD~1"], cwd=str(AGENT_DIR), check=True)
    except subprocess.CalledProcessError as e:
        log.error(f"Lazarus Protocol failed to rollback: {e}")

def main():
    log.info("Ouroboros Watchdog initialized.")
    
    while True:
        # Step 1: Force-Sync Safety Guardrails
        force_sync_safety()

        # Step 2: Boot the Agent
        exit_code = run_agent_container()

        # Step 3: Monitor & React
        if exit_code == 0:
            log.info("Agent exited cleanly. Restarting loop...")
        else:
            # Lazarus Protocol on non-zero exit
            lazarus_protocol(exit_code)
            log.info("Resurrection complete. Restarting loop...")
        
        # Cooldown before restart
        time.sleep(5)

if __name__ == "__main__":
    main()
