# Ouroboros Runtime (The World)

> **"A soul without a world is but a ghost. A world without a soul is but a machine."**

The **Ouroboros Runtime** is the infrastructural framework for the Ouroboros agent. It provides the isolated environment (Docker), the intelligence engine (local Mistral LLM), and the sensory inputs (SearXNG) required for the agent to perceive, think, and evolve.

## 🏗️ Infrastructure Architecture

The runtime is managed via a single **`docker-compose.yml`** file, containing the entire unified stack:

### Core Services:
*   **Ouroboros Agent (`ouroboros`)**: The autonomous ReAct core running `seed_agent.py`.
*   **LLM Engine (`llamacpp`)**: High-performance inference server (ROCm/AMD) providing the Mistral-Small-24B model with 64k context.
*   **Search Engine (`searxng`)**: Local meta-search engine for real-time knowledge retrieval.
*   **Memory Volume**: A shared host-bind mount at `/memory` for persistent state and JSONL task logs.

## 🛡️ The Watchdog (`watchdog.py`)

The `watchdog.py` script is the definitive host-side supervisor. It manages the container lifecycle and executes the **Phoenix Protocol**.

**Responsibilities:**
1.  **Branch Synchronization**: Ensures the agent is always operating on the `ouroboros` branch.
2.  **Phoenix Reset**: If the agent crashes or loops, the watchdog captures container stderr to `/memory/last_crash.log` and performs a `git reset --hard HEAD~1`.
3.  **Recursive Recovery**: Performs multi-level reverts if the agent fails to reach a 60-second stability threshold.

## ⚙️ Setup & Deployment

### 1. Environment Configuration
Create an `ouroboros_runtime/.env` file:
- `TELEGRAM_BOT_TOKEN`: Your bot API key.
- `GITHUB_TOKEN`: Your PAT for git synchronization.

### 2. Execution
To start the supervised Ouroboros stack:
```bash
cd ouroboros_runtime
python3 watchdog.py
```

## 🛡️ Identity Integrity
The runtime enforces volume isolation. Source code lives in `/app`, while ephemeral state lives in `/memory`. This ensures that even a total code reset preserves the agent's identity and conversational history.

---
*Last Updated: March 2026 - Runtime unified for True Seed v3.5.*
