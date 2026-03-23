import os
import glob
import json
import subprocess
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
    log_files = glob.glob(str(MEMORY_DIR / "llm_logs" / "call-*.json"))
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

@app.get("/api/identity")
async def get_identity():
    identity_path = AGENT_DIR / "soul" / "identity.md"
    bible_path = AGENT_DIR / "BIBLE.md"
    
    content = ""
    if identity_path.exists():
        content += identity_path.read_text() + "\n\n---\n\n"
    if bible_path.exists():
        content += bible_path.read_text()
        
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
