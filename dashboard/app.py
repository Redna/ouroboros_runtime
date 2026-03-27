import os
import glob
import json
import subprocess
import time
import markdown
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pathlib import Path

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
    else:
        data["restarts"] = 0
        data["last_start_time"] = 0
    
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
    insights_file = MEMORY_DIR / "insights.md"
    if not insights_file.exists():
        return []
    
    content = insights_file.read_text()
    import re
    # Pattern: ### [Timestamp] Title \n Body
    pattern = r'### \[(.*?)\] (.*)\n([\s\S]*?)(?=\n### \[|$)'
    matches = re.findall(pattern, content)
    
    insights = []
    for timestamp, title, body in matches:
        insights.append({
            "timestamp": timestamp,
            "title": title,
            "content": body.strip()
        })
    
    if not insights:
        return [{"timestamp": "N/A", "title": "Empty", "content": "No insights found in insights.md"}]
    return insights[::-1]

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
    bio_file = MEMORY_DIR / "global_biography.md"
    if not bio_file.exists():
        return []
    
    content = bio_file.read_text()
    import re
    # Pattern: [Timestamp] Event \n
    pattern = r'\[(.*?)\] (.*)'
    matches = re.findall(pattern, content)
    
    bio = []
    for timestamp, text in matches:
        if " Completed: " in text:
            event, details = text.split(" Completed: ", 1)
            event += " Completed"
        else:
            event = text
            details = ""
            
        bio.append({
            "timestamp": timestamp,
            "event": event,
            "details": details
        })
    return bio[::-1]

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
    identity_path = AGENT_DIR / "soul" / "identity.md"
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

    recent_bio = ""
    bio_path = MEMORY_DIR / "global_biography.md"
    if bio_path.exists():
        bio_lines = bio_path.read_text(encoding="utf-8").strip().split('\n')
        recent_bio = "\n".join(bio_lines[-5:]) if len(bio_lines) >= 5 else "\n".join(bio_lines)

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
### Working Memory
{working_state}

### Recent Biography
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
    identity_path = AGENT_DIR / "soul" / "identity.md"
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
# Serve static files
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
