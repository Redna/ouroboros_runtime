# Ouroboros Runtime (The World)

> **"A soul without a world is but a ghost. A world without a soul is but a machine."**

The **Ouroboros Runtime** is the infrastructural framework for the Ouroboros agent. It provides the isolated environment (Docker), the intelligence engine (local Mistral LLM), and the sensory inputs (SearXNG) required for the agent to perceive, think, and evolve.

## 🏗️ Infrastructure Architecture

The runtime is managed via a single **`docker-compose.yml`** file, containing the entire unified stack:

### Core Services:
*   **Ouroboros Agent (`ouroboros`)**: The autonomous ReAct core running `seed_agent.py`.
*   **LLM Engine (`llamacpp`)**: High-performance inference server (ROCm/AMD) providing the Mistral-Small-24B model with 64k context.
*   **Search Engine (`searxng`)**: Local meta-search engine for real-time knowledge retrieval.
*   **Ouroboros Gate (`gate`)**: Custom lightweight gateway for model routing and passive logging.
*   **Memory Volume**: A shared host-bind mount at `/memory` for persistent state and JSONL task logs.

## ⚙️ Ouroboros Runtime CLI (`ouroboros`)

The `./ouroboros` CLI is the definitive host-side supervisor and management tool. It handles the container lifecycle, background process management, and the **Phoenix Protocol**.

**Responsibilities:**
1.  **Supervision (Daemon Mode)**: The CLI can run as a background daemon (`./ouroboros daemon`) to monitor the stack.
2.  **Branch Synchronization**: Ensures the agent is always operating on the `ouroboros` branch.
3.  **Phoenix Reset**: If the agent crashes or loops, the supervisor captures container logs to `/memory/last_crash.log` and performs a `git reset --hard HEAD~1`.
4.  **Recursive Recovery**: Performs multi-level reverts if the agent fails to reach a 60-second stability threshold.
5.  **State Management**: Automated backups, protocol-level resets, and memory restoration.

### Commands:
| Command | Description |
|---|---|
| **`./ouroboros start`** | Starts the supervisor daemon in the background. |
| **`./ouroboros stop`** | Gracefully stops the supervisor and all Docker containers. |
| **`./ouroboros status`** | Checks if the supervisor process is currently running. |
| **`./ouroboros logs`** | Follows the runtime logs (tail -f). |
| **`./ouroboros reset`** | Backs up the current branch and resets `ouroboros` to `true-seed`. |
| **`./ouroboros purge`** | **PROTOCOL DELETION**: Backs up and wipes all memory, resets branch to `true-seed`. |
| **`./ouroboros restore`** | Lists available branch and memory backups. |
| **`./ouroboros restore --branch <name> --memory <file>`** | Restores the agent to a specific backup state. |

### Usage:
To start the supervised Ouroboros stack in the background:
```bash
cd ouroboros_runtime
./ouroboros start
```

Logs and process state (PID) are stored in `/tmp/ouroboros-runtime/` to maintain **Memory Isolation** (keeping the `ouroboros_memory/` volume reserved for the Agent).

---
*Last Updated: March 2026 - Runtime unified for True Seed v4.1.*
