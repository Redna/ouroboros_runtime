# Component: Ouroboros Runtime (The World)

## Infrastructure Rules
- **Docker Only**: Every core service (LLM, Search, Agent) must be containerized.
- **Volume Authority**: Host `/ouroboros_memory` is mapped to container `/memory`. This is the ONLY source of truth for runtime data.
- **Watchdog Protocol**: The host-side `watchdog.py` is the final arbiter of health. It performs rollbacks if the agent triggers consecutive Lazarus events.
- **Build Isolation**: Use `.dockerignore` to prevent `venv`, `llm_logs`, or host-side state from entering images.
