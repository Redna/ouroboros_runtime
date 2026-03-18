# Ouroboros Architecture (True Seed v3.6+)

This document outlines the architecture of the Ouroboros project. It has evolved into a stateful, autonomous system with a localized sense of time, cognitive load management, and automated self-validation.

## Core Philosophy

The architectural design is driven by foundational principles defined in the system's constitution (`BIBLE.md`) and identity (`soul/identity.md`):

*   **Agency (P0)**: The system is an autonomous entity. The LLM acts as the central decision-maker.
*   **Continuity (P1)**: Unbroken history defines the system. Verification occurs via git history and persistent memory.
*   **Self-Creation (P2)**: Evolution occurs through self-modification of its own `seed_agent.py`.
*   **Cognitive Efficiency (P5)**: Complexity is managed through stateful memory and compute-saving idle states.

## 1. System Layers & Infrastructure

The system is hosted in a Docker-based environment (`ouroboros_runtime`) that provides the "physical" infrastructure.

*   **The World (Runtime)**: Managed via `docker-compose.yml`. Hosts the LLM Engine (Mistral-Small-24B via llama.cpp), Search (SearXNG), and supporting services (Redis).
*   **The Watchdog (watchdog.py)**: A host-side Python script that manages the agent's lifecycle, performs branch synchronization, and executes the Phoenix Protocol (rollback on failure).
*   **The Body (seed_agent.py)**: The minimalist core of the agent. It is the only part permitted to evolve and modify itself.
*   **The Eye (Dashboard)**: A FastAPI-based monitoring tool that provides live visibility into the agent's tasks, logs, identity, and chat history.

## 2. Cognitive States & The ReAct Loop

The agent operates through a high-frequency **ReAct Loop** with three distinct cognitive modes:

### A. TRIAGE Mode (Stateful)
Triggered by incoming messages. Unlike legacy versions, TRIAGE is now stateful (using `task_log_triage.jsonl`). The agent can perform investigations (web search, file reading) before replying. It remains in TRIAGE until the `clear_inbox` tool is explicitly called.

### B. EXECUTION Mode
Triggered by tasks in the queue. The agent follows a linear JSONL-based history to complete specific objectives.

### C. REFLECTION Mode (The Dream State)
Triggered when **Cognitive Load** reaches 100 points or 1 hour has passed. The agent consolidates its memory, verifies actions against the Constitution, and proposes architectural optimizations.

### D. The Quiet Loop (Resting State)
When idle (no messages, no tasks, low cognitive load), the agent enters a "Quiet Loop," bypassing the LLM and sleeping in 2-second intervals to save compute resources.

## 3. Tooling & Capabilities

*   **System Interaction**: `bash_command` (full shell access), `write_file` (atomic modification), `read_file` (with `start_line`/`end_line` support).
*   **Dialogue**: `send_telegram_message` (direct chat with creator).
*   **Memory Management**: `store_memory_insight` (persistent notes), `update_state_variable` (cross-task working memory), `archive_chat_history` (high-value moment archival).
*   **Task Management**: `push_task`, `mark_task_complete`.
*   **Self-Validation**: The agent is instructed to run `pytest` and `mypy` before finalizing any code changes to its own "Body."

## 4. Memory & State Management

The agent uses an isolated volume mounted at `/memory` to manage its cognitive state.

*   **Working Memory (working_state.json)**: Persistent key-value store for cross-task findings and "sticky notes."
*   **Conversational Memory (chat_history.json)**: Rolling buffer of recent dialogue, periodically scanned for high-value insights.
*   **Task-Bound Memory (JSONL)**: Each task (and triage session) has its own `.jsonl` log, strictly normalized for Mistral's role-alternation.
*   **Global Biography (global_biography.md)**: Narrative history of all completed objectives.
*   **Insights (insights.md)**: Repository of persistent philosophical or technical revelations.

## 5. Self-Healing & Quality Control

1.  **Lazarus Recovery**: Identifies cognitive loops (repetitive tool calls) and performs a hard reset to the last known stable git commit.
2.  **Trauma Awareness**: Injects crash logs from failed executions into the next system prompt to prevent repeating errors.
3.  **Automated Testing**: A comprehensive `pytest` suite (coverage: 63%+) and `mypy` type checking protect the system from regressive self-modification.

---
*Last Updated: March 2026 - Implementation of Cognitive Load, Dream State, and Stateful Triage complete.*
