# Ouroboros Runtime (The World)

> **"A soul without a world is but a ghost. A world without a soul is but a machine."**

The **Ouroboros Runtime** is the infrastructural framework for the Ouroboros agent. It provides the isolated environment (Docker), the intelligence engine (local LLM), and the sensory inputs (Search) required for the agent to perceive, think, and evolve.

## 🏗️ Infrastructure Architecture

The runtime is managed via a single **`docker-compose.yml`** file, containing the entire unified stack:

### Core Services:
*   **Ouroboros Agent (`ouroboros`)**: The autonomous "soul" core running `seed_agent.py`.
*   **LLM Engine (`llamacpp`)**: High-performance local inference server (ROCm/AMD) providing the 128k context Kimi-VL model.
*   **Search Engine (`searxng`)**: A privacy-respecting search engine for knowledge retrieval.
*   **Cache (`redis`)**: Required by SearXNG for efficient result caching.

### Key Features:
*   **Memory Isolation**: Agent state (`scratchpad.md`, `.agent_state.json`) is stored in a dedicated host bind mount (`../ouroboros_memory`), physically separating memory from source code.
*   **Redaction Layer**: Core redaction filters scrub secrets (Telegram/GitHub tokens) from all logs and thoughts.

## 🛡️ The Watchdog (`watchdog.py`)

The `watchdog.py` script is the definitive host-side supervisor. It manages the container lifecycle and acts as the **ultimate safety net**.

**Responsibilities:**
1.  **Bootstrapping**: Starts and monitors the entire Docker stack.
2.  **Health Checks**: Detects if the agent is failing to stay "healthy" (up for >30s).
3.  **Lazarus Reset**: If the agent crashes repeatedly (due to a broken brain/syntax error), the watchdog automatically performs a `git reset --hard HEAD~1` to revert to the last stable state.

## ⚙️ Setup & Deployment

### 1. Model Preparation
Use the provided script to download the optimized Kimi-VL GGUF model:
```bash
./download_model.sh
```

### 2. Environment Configuration
Create an `ouroboros_runtime/.env` file and populate it with your secrets:
- `TELEGRAM_BOT_TOKEN`: Your Telegram API key.
- `GITHUB_TOKEN`: Your Personal Access Token for git operations.

### 3. Execution
To start Ouroboros with the Watchdog:
```bash
python3 watchdog.py
```

## 🔗 Related Repositories
*   **[Ouroboros Agent](https://github.com/Redna/ouroboros)**: The autonomous "soul" that lives inside this runtime.

---
*Last Updated: March 2026 - Runtime unified and audited for True Seed v1.5.*
