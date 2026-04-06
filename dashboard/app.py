import os
import glob
import json
import subprocess
import time
import markdown
import psutil
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pathlib import Path
import asyncio

app = FastAPI()

# Git safety
try:
    subprocess.run(["git", "config", "--global", "--add", "safe.directory", "/agent_soul"], check=False)
except:
    pass

# Configuration
MEMORY_DIR = Path("/memory")
RUNTIME_LOG_DIR = Path(os.getenv("RUNTIME_LOG_DIR", "/runtime_logs"))
AGENT_DIR = Path("/agent_soul") # Injected via docker-compose
DASHBOARD_DIR = Path(__file__).parent
STATIC_DIR = DASHBOARD_DIR / "static"

def get_latest_log_file():
    log_files = glob.glob(str(MEMORY_DIR / "task_log_*.jsonl"))
    if not log_files:
        return None
    return max(log_files, key=os.path.getmtime)

def get_git_stats():
    try:
        # Number of commits
        commits = subprocess.check_output(
            ["git", "rev-list", "--count", "HEAD"], 
            cwd=AGENT_DIR, text=True
        ).strip()
        # Number of files changed (unstaged + staged)
        changes = subprocess.check_output(
            ["git", "status", "--short"], 
            cwd=AGENT_DIR, text=True
        ).strip()
        num_changes = len(changes.splitlines()) if changes else 0
        return {"commits": commits, "changes": num_changes}
    except Exception as e:
        return {"commits": "N/A", "changes": "N/A", "error": str(e)}

def get_system_stats():
    try:
        cpu_percent = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # Disk usage of /memory
        disk = psutil.disk_usage(str(MEMORY_DIR))
        disk_percent = disk.percent
        
        return {
            "cpu": cpu_percent,
            "memory": memory_percent,
            "disk": disk_percent
        }
    except Exception:
        return {"cpu": 0, "memory": 0, "disk": 0}

@app.get("/api/status")
async def get_status():
    status_file = MEMORY_DIR / ".agent_state.json"
    stats_file = MEMORY_DIR / ".runtime_stats.json"
    ledger_file = MEMORY_DIR / "financial_ledger.json"
    
    data = {}
    if status_file.exists():
        with open(status_file, "r") as f:
            data = json.load(f)
    
    if stats_file.exists():
        with open(stats_file, "r") as f:
            stats = json.load(f)
            data["restarts"] = stats.get("restart_count", 0)
            data["last_start_time"] = stats.get("last_start_time", 0)
            data["preflight_failures"] = stats.get("preflight_failures", 0)
    
    # Fallback for last_start_time if watchdog is not running
    if data.get("last_start_time", 0) == 0 and status_file.exists():
        data["last_start_time"] = os.path.getmtime(status_file)
    
    # Get daily spend
    today = time.strftime("%Y-%m-%d")
    data["daily_spend"] = 0.0
    if ledger_file.exists():
        try:
            with open(ledger_file, "r") as f:
                ledger = json.load(f)
                data["daily_spend"] = ledger.get(today, 0.0)
        except: pass
    
    # We can't easily get constants.DAILY_BUDGET_LIMIT here without env or import
    # but we can try to read it from env
    data["daily_budget"] = float(os.getenv("DAILY_BUDGET_LIMIT", "5.00"))
        
    git_data = get_git_stats()
    data["git"] = git_data
    
    # Add system stats
    data["sys_stats"] = get_system_stats()
    
    # Add context limit for percentage calculation
    data["context_limit"] = int(os.getenv("OUROBOROS_CONTEXT_WINDOW", "128000"))
    
    return data

@app.get("/api/tasks")
async def get_tasks():
    tasks_file = MEMORY_DIR / "task_queue.json"
    if tasks_file.exists():
        with open(tasks_file, "r") as f:
            return json.load(f)
    return []

@app.get("/api/scheduled")
async def get_scheduled_tasks():
    scheduled_file = MEMORY_DIR / "scheduled_tasks.json"
    if scheduled_file.exists():
        try:
            with open(scheduled_file, "r") as f:
                content = f.read().strip()
                if content:
                    return json.loads(content)
        except Exception:
            pass
    return []

@app.get("/api/history")
async def get_history():
    history_file = MEMORY_DIR / "chat_history.json"
    if history_file.exists():
        with open(history_file, "r") as f:
            return json.load(f)
    return []

@app.get("/api/insights")
async def get_insights():
    memory_file = MEMORY_DIR / "agent_memory.json"
    if not memory_file.exists():
        return []
    
    try:
        data = json.loads(memory_file.read_text())
        entries = data.get("entries", {})
        last_synthesis = data.get("last_synthesis", "N/A")
        
        insights = []
        for key, value in entries.items():
            insights.append({
                "timestamp": last_synthesis,
                "title": key,
                "content": value
            })
        
        if not insights:
            return [{"timestamp": "N/A", "title": "Empty Store", "content": "No memories stored in agent_memory.json"}]
        return insights[::-1] # Show latest entries first
    except Exception as e:
        return [{"timestamp": "Error", "title": "Failed to load", "content": str(e)}]

@app.get("/api/llm_logs")
async def get_llm_logs():
    log_files = glob.glob(str(RUNTIME_LOG_DIR / "call-*.json"))
    log_files.sort(reverse=True) # Latest first
    
    logs = []
    # Only return last 20 for performance
    for file_path in log_files[:20]:
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                logs.append(data)
        except:
            continue
    return logs

@app.get("/api/biography")
async def get_biography():
    archive_file = MEMORY_DIR / "task_archive.jsonl"
    if not archive_file.exists():
        return []
    
    bio = []
    try:
        with open(archive_file, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip(): continue
                data = json.loads(line)
                bio.append({
                    "timestamp": data.get("timestamp", "N/A"),
                    "event": f"Task {data.get('task_id', 'Unknown')} Complete",
                    "details": data.get("summary", "No details")
                })
    except:
        pass
        
    return bio[::-1] # Latest first

@app.get("/api/state")
async def get_full_state():
    state_file = MEMORY_DIR / ".agent_state.json"
    if state_file.exists():
        with open(state_file, "r") as f:
            return json.load(f)
    return {}

@app.get("/api/historical_tasks")
async def get_historical_tasks():
    log_files = glob.glob(str(MEMORY_DIR / "task_log_*.jsonl"))
    tasks = []
    for f_path in log_files:
        f = Path(f_path)
        task_id = f.name.replace("task_log_", "").replace(".jsonl", "")
        
        # Get creation time
        mtime = os.path.getmtime(f_path)
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
        
        # Try to find a summary and parent_task_id in the log
        summary = "No summary available."
        parent_id = None
        if task_id != "global_trunk":
            parent_id = "global_trunk" # Default for forked tasks
            
        try:
            with open(f_path, "r", encoding="utf-8") as lf:
                lines = lf.readlines()
                # Check first line for metadata
                if lines:
                    first_data = json.loads(lines[0])
                    if first_data.get("parent_task_id"):
                        parent_id = first_data["parent_task_id"]
                    elif first_data.get("task_id") == "exploration_001":
                        parent_id = "global_trunk"

                for line in reversed(lines):
                    data = json.loads(line)
                    if data.get("role") == "assistant" and data.get("content"):
                        summary = data["content"][:200] + "..." if len(data["content"]) > 200 else data["content"]
                        break
        except:
            pass
            
        tasks.append({
            "task_id": task_id,
            "parent_task_id": parent_id,
            "timestamp": timestamp,
            "mtime": mtime,
            "summary": summary
        })
    
    # Sort by mtime descending (newest first)
    tasks.sort(key=lambda x: x["mtime"], reverse=True)
    return tasks

@app.get("/api/task_log/{task_id}")
async def get_specific_task_log(task_id: str):
    log_file = MEMORY_DIR / f"task_log_{task_id}.jsonl"
    if not log_file.exists():
        return JSONResponse(status_code=404, content={"error": "Task log not found"})
    
    logs = []
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    logs.append(json.loads(line))
                except:
                    continue
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    return logs

@app.get("/api/trunk_context")
async def get_trunk_context():
    # Replicate seed_agent.py's gather_system_context logic
    identity = ""
    identity_path = AGENT_DIR / "identity.md"
    if identity_path.exists():
        identity = identity_path.read_text(encoding="utf-8")

    constitution = ""
    constitution_path = AGENT_DIR / "CONSTITUTION.md"
    if constitution_path.exists():
        constitution = constitution_path.read_text(encoding="utf-8")

    working_state = ""
    ws_path = MEMORY_DIR / "working_state.json"
    if ws_path.exists():
        working_state = ws_path.read_text(encoding="utf-8")

    # Memory Index
    memory_index = "Empty Memory Store. Use `store_memory` to record insights."
    memory_file = MEMORY_DIR / "agent_memory.json"
    if memory_file.exists():
        try:
            mem_data = json.loads(memory_file.read_text())
            keys = list(mem_data.get("entries", {}).keys())
            if keys:
                memory_index = "\n".join([f"- {k}" for k in keys])
        except: pass

    # Task Archive Snippet
    recent_bio = "No archived history."
    archive_path = MEMORY_DIR / "task_archive.jsonl"
    if archive_path.exists():
        try:
            with open(archive_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                recent_lines = lines[-5:] if len(lines) >= 5 else lines
                recs = [json.loads(l) for l in recent_lines if l.strip()]
                recent_bio = "\n".join([f"[{r.get('timestamp')}] Task {r.get('task_id')}: {r.get('summary')}" for r in recs])
        except: pass

    chat_hist = []
    chat_path = MEMORY_DIR / "chat_history.json"
    if chat_path.exists():
        try:
            chat_hist = json.loads(chat_path.read_text(encoding="utf-8"))
        except: pass
    chat_context = "\n".join([f"[{m.get('timestamp', '??:??:??')}] {m['role']}: {m['text']}" for m in chat_hist[-10:]])

    queue_data = []
    queue_path = MEMORY_DIR / "task_queue.json"
    if queue_path.exists():
        try:
            queue_data = json.loads(queue_path.read_text(encoding="utf-8"))
        except: pass
    formatted_queue = "\n".join([f"- [P{t.get('priority', 1)}] {t.get('task_id')}: {t.get('description')}" for t in queue_data]) or "Queue is empty."

    current_time = time.strftime("%A, %Y-%m-%d %H:%M:%S %Z")
    
    # Placeholder for tools
    tools_text = "[Available: global, memory_access, system_control, search]"

    trunk_prompt = f"""# SYSTEM CONTEXT (GLOBAL TRUNK)
{identity}

## CONSTITUTION
{constitution}

## SYSTEM STATE
- Current Time: {current_time}

=== TASK QUEUE ===
{formatted_queue}

## MEMORY
### Memory Index
{memory_index}

### Task Archive (Archive Snippet)
{recent_bio}

### Recent Conversation
{chat_context}

## AVAILABLE TOOLS
{tools_text}

=== TRUNK DIRECTIVES ===
1. You are in the GLOBAL TRUNK. You orchestrate tasks, reflect, and communicate.
2. Do NOT do heavy file editing here. Use `fork_execution` to spawn a branch for deep work.
3. If the queue is empty, use `push_task` to optimize code/memory, or `hibernate`.
"""
    return {"raw": trunk_prompt}

@app.get("/api/identity")
async def get_identity():
    identity_path = AGENT_DIR / "identity.md"
    constitution_path = AGENT_DIR / "CONSTITUTION.md"
    
    content = ""
    if identity_path.exists():
        content += identity_path.read_text() + "\n\n---\n\n"
    if constitution_path.exists():
        content += constitution_path.read_text()
        
    if not content:
        return {"html": "<p>Identity files not found.</p>"}
        
    html = markdown.markdown(content)
    return {"html": html}

@app.get("/api/logs")
async def get_logs(limit: int = 50):
    # Determine the active cognitive context
    state_file = MEMORY_DIR / ".agent_state.json"
    active_task = "global_trunk"

    if state_file.exists():
        try:
            with open(state_file, "r") as f:
                state = json.load(f)
                if state.get("active_branch"):
                    active_task = state["active_branch"].get("task_id", "global_trunk")
        except Exception:
            pass

    log_file = MEMORY_DIR / f"task_log_{active_task}.jsonl"

    if not log_file.exists():
        return [{"role": "system", "content": f"Waiting for context initialization ({active_task})..."}]

    logs = []
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                try:
                    logs.append(json.loads(line))
                except:
                    continue
    except:
        return []
    return logs

@app.get("/api/stream_logs/{task_id}")
async def stream_logs(task_id: str):
    async def event_generator():
        log_file = MEMORY_DIR / f"task_log_{task_id}.jsonl"
        if not log_file.exists():
            yield "data: " + json.dumps({"role": "system", "content": f"Log file for {task_id} not found."}) + "\n\n"
            return

        # Start from the end of the file
        file_size = os.path.getsize(log_file)
        
        with open(log_file, "r", encoding="utf-8") as f:
            # Seek to end minus a bit to catch the last few lines if needed, 
            # or just start from the end for a clean stream.
            f.seek(file_size)
            
            while True:
                line = f.readline()
                if not line:
                    await asyncio.sleep(0.5) # Wait for new data
                    continue
                
                try:
                    # Validate JSON
                    json.loads(line)
                    yield f"data: {line}\n\n"
                except:
                    continue

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Serve static files
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
