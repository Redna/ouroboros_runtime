# Ouroboros Runtime (The World)

> **"A soul without a world is but a ghost. A world without a soul is but a machine."**

The **Ouroboros Runtime** is the "physical" infrastructure and guardrail system for the Ouroboros agent. It provides the isolated environment (Docker), the intelligence engine (local LLM), and the sensory inputs (Search, UI) required for the agent to perceive, think, and evolve.

## 🏗️ Infrastructure Stack

The runtime is managed via `docker-compose.yml` and includes the following services:

*   **Agent Core (`ouroboros_agent`)**: The isolated container where the "True Seed" script runs.
*   **LLM Engine (`llamacpp`)**: High-performance local inference server (Mistral/llama.cpp) providing an OpenAI-compatible API.
*   **Search Engine (`searxng`)**: A privacy-respecting, distributed search engine for knowledge retrieval.
*   **Web UI (`open-webui`)**: A user-friendly interface for manual interaction and monitoring.
*   **Routing & SSL (`nginx-proxy-manager`)**: Manages external access, SSL certificates, and service dashboards.
*   **Dashboard (`heimdall`)**: A central portal for all Ouroboros-related services.

## 🛡️ The Watchdog (`launcher.py`)

The `launcher.py` is the immutable supervisor of the agent's lifecycle. It acts as the interface between the host system and the Docker environment.

### Key Responsibilities:
1.  **Bootstrapping**: Sets up the Docker environment and builds the agent container.
2.  **Lifecycle Management**: Starts the agent and monitors its execution loop.
3.  **Lazarus Protocol (External)**: If the agent crashes (non-zero exit code), the watchdog captures the crash logs and restarts the container, ensuring continuity.
4.  **Health Monitoring**: Streams agent logs to the host console for real-time observability.

## ⚙️ Setup & Configuration

### 1. Model Management
Use the provided script to download the optimized Mistral models:
```bash
./download_model.sh
```

### 2. Environment Secrets
All sensitive configuration (Tokens, Keys) must be placed in `ouroboros_runtime/.env`. The runtime passes these to the agent as environment variables, keeping them out of the agent's local filesystem and git history.

### 3. GPU Acceleration
If you are running on hardware with a GPU, use the helper script to update your Docker configuration:
```bash
python3 update_docker_gpu.py
```

## 🛠️ Management Commands

A `Makefile` is provided for common maintenance tasks:

| Command | Description |
|---|---|
| `make test` | Run minimalist smoke tests |
| `make health` | Compute complexity metrics of the codebase |
| `make clean` | Purge Python cache and temporary files |

## 🔗 Related Repositories
*   **[Ouroboros Agent](https://github.com/Redna/ouroboros)**: The autonomous "soul" that lives inside this runtime.

---
*Last Updated: March 2026 - Runtime finalized for True Seed v1.0.*
