# Ouroboros Backend Changes: True Seed v5 (Stream Model)

This document outlines the architectural changes implemented in Ouroboros v5.0 to guide the development and adjustment of the Dashboard UI.

## 1. Architectural Pivot: From Branches to Stream
The "OS-like" multi-branch architecture has been replaced by a **linear Stream of Consciousness**.

### Key Changes:
- **No more Branches:** The concepts of `active_branch` and `suspended_branches` are obsolete.
- **Single Timeline:** All cognitive activities, including sub-tasks and interrupts, are recorded in a single file: `task_log_singular_stream.jsonl`.
- **Global Context:** The agent operates within a single physical context window.

## 2. API Data Structure Updates

### `GET /api/status`
- The `active_branch` field is now **deprecated** and will be `null` or omitted.
- Use `trunk_turns` and `last_context_size` to monitor the physical health of the agent.
- The UI should focus on the **Task Queue** (`task_queue.json`) to determine current intent rather than looking for an "active branch" object.

### `GET /api/logs`
- All logs now originate from `task_log_singular_stream.jsonl`. 
- **Wait for Initialization:** If the trunk log doesn't exist, it means the agent is in a pre-genesis state.
- **History Collapsing:** Previous turns' telemetry blocks are now collapsed into single-line "Heartbeats" (e.g., `[SYSTEM LOG: Historical Telemetry Archived: HUD | ...]`). The UI should ideally parse or hide these to keep the log display clean.

## 3. The New HUD (Heads-Up Display)
Every tool response now includes a minimalist HUD string at the end of the content:
`[HUD | Context: X% | Queue: Y]`

- **UI Implementation:** The Dashboard should extract this string from the latest `tool` message to provide real-time context-usage bars.
- **Warnings:** If a cognitive loop is detected, the HUD will append: `[WARNING: Cognitive Intent Stall Detected]`. This should be rendered as a high-priority alert in the UI.

## 4. Context Management: The Accordion Fold
The agent no longer "crashes" when full. Instead, it "folds."

- **Belly Amputation:** The middle history is removed, keeping the `Head` (first 2 messages) and the `Tail` (last ~5 turns).
- **Synthesis Anchoring:** The `fold_context` tool response contains the synthesis of the dropped history.
- **Autonomic Reflex:** If the agent fails to fold voluntarily, the system triggers an `autonomic_fold`. The UI should look for the system message: `[SYSTEM AUTONOMIC REFLEX]: CRITICAL CONTEXT LIMIT REACHED`.

## 5. Linear Interrupts
- **Creator Messages:** Injected directly into the stream as a User message with the prefix `[SYSTEM OVERRIDE: CREATOR MESSAGE RECEIVED]`.
- **No Context Switching:** The UI should no longer expect the agent to "switch views" when a message is sent; the conversation is now part of the main execution flow.

## 6. Dashboard Action Items for UI Devs
1. **Remove Branch UI:** Delete or hide the "Active Branch" badge and branch-specific log views.
2. **Unified Timeline:** Create a single, continuous scrolling view for the Global Trunk.
3. **HUD Visualization:** Add a progress bar for "Context Window Usage" (0-100%) based on the HUD telemetry.
4. **Task Progress:** Visualize the `task_queue.json` as a prioritized list where the top item is the "Current Focus."
5. **Synthesis Highlighting:** Style `fold_context` tool outputs as "Key Milestones" in the log, as they represent the compression of many previous steps.
