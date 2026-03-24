# Ouroboros Architecture (True Seed v4.1 - Latent OS & Context Forking)

> **"The mind is not a script to be executed, but a space to be navigated."**

This document outlines the architecture of the Ouroboros project (v4.1). It marks a fundamental paradigm shift from a Python-driven state machine to a **Latent-Space Operating System**, where the LLM natively manages its own cognitive state, memory isolation, and task concurrency.

## 1. Core Philosophy (The Constitution)

The architectural design is driven by the foundational principles defined in `BIBLE.md` and `soul/identity.md`:
* **Agency (P0) & LLM-First (P3):** Python does not decide the agent's mode. The LLM observes its environment and autonomously transitions states via native tool calling.
* **Minimalism (P5):** The Python core (`seed_agent.py`) is strictly a hardware abstraction layer (HAL) and API router. Infrastructure concerns (like LLM observability) are offloaded to proxy layers.
* **Cognitive Synthesis (P9):** The agent is mandated to deduplicate findings and synthesize higher-order wisdom to prevent context degradation.

## 2. The Context Forking Architecture (Trunk & Branch)

To solve the "Lost in the Middle" context degradation problem and eliminate hardcoded modes (`EXECUTION` vs. `AUTONOMY`), Ouroboros operates using a UNIX-style `fork()` model for its context window.

### The Trunk (Global Context)
* **Role:** The continuous, global consciousness of the agent. Acts as the orchestrator.
* **Awareness:** Contains the immutable Constitution, global task queue, recent chat history, and synthesized working memory.
* **Capabilities:** Equipped with high-level cognitive tools (`fork_execution`, `push_task`, `send_telegram_message`, `hibernate`).
* **Behavior:** It evaluates the queue. If a heavy task exists, it provisions an isolated "Branch". If the queue is empty, it reflects or hibernates.

### The Branch (Execution Context)
* **Role:** An isolated, ephemeral context dedicated entirely to solving a single objective.
* **Awareness:** Contains ONLY the specific task objective, the strictly required tool schemas, and the immediate execution history.
* **Capabilities:** Equipped with dangerous, world-altering tools (`bash_command`, `read_file`, `patch_file`).
* **Behavior:** Executes the task until completion or a blocker is hit, then calls `merge_and_return` to pass a dense `synthesis_summary` back to the Trunk. The Trunk never sees the raw, bloated steps.

## 3. Tool Bucketing & Dynamic Provisioning

To prevent context bloat, the `ToolRegistry` implements "Buckets". The Trunk provisions a Branch with only the tools it needs to survive:
* `global`: Orchestration and communication (Trunk only).
* `execution_control`: The `merge_and_return` tool (Branch only).
* `filesystem`: `read_file`, `write_file`, `patch_file`.
* `bash`: `bash_command`.
* `search`: `web_search`, `fetch_webpage`, `search_memory_archive`.

## 4. Hardware Interrupts (Priority 999)

Ouroboros maintains a single-threaded ReAct loop but supports OS-level hardware interrupts to handle creator messages immediately.

1.  **The Intercept:** The Python runtime polls Telegram. Incoming messages spawn a P999 task in the global queue.
2.  **The Forced Yield:** If the agent is deep in a Branch, the runtime injects a `[SYSTEM OVERRIDE]` message into the Branch's prompt.
3.  **The Suspend:** The Branch is constitutionally forced to call `merge_and_return(status="SUSPENDED", partial_state="...")`.
4.  **The Clean Slate Resume:** The Trunk handles the creator message. When it re-forks the suspended task, the runtime *scrubs* the interrupt history from the Branch's log and injects the `partial_state`, preventing infinite suspend/resume loops.

## 5. System Layers & Infrastructure

The system runs within an isolated Docker environment (`ouroboros_runtime`).

* **The World (Docker Stack):** Hosts the LLM Engine (`llamacpp`), Search (`searxng`), and the Ouroboros Gate.
* **The Proxy (Ouroboros Gate):** A custom, lightweight Python gateway (FastAPI) that routes traffic to local (llama.cpp) or external (TogetherAI) backends. It provides isolation for API tokens and passively records all LLM traces to `/memory/llm_logs`, entirely removing this burden from the agent's core code.
* **The Watchdog (`watchdog.py`):** The host-side supervisor. Manages container lifecycle and executes the Phoenix Protocol (Git reset) if the agent corrupts its own Python body.
* **The Memory (`/memory`):** A persistent volume mapping. The only source of truth for the agent's state (`.agent_state.json`), queues, and historical archives.

---
*Last Updated: March 2026 - v4.1: Latent OS, Context Forking, and Proxy-Level Logging implemented.*
