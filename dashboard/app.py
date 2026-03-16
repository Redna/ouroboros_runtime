import os
import glob
import json
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path

app = FastAPI()

# Configuration
MEMORY_DIR = Path("/memory")
DASHBOARD_DIR = Path(__file__).parent
STATIC_DIR = DASHBOARD_DIR / "static"

def get_latest_log_file():
    log_files = glob.glob(str(MEMORY_DIR / "task_log_*.jsonl"))
    if not log_files:
        return None
    # Sort by modification time to get the most recent
    return max(log_files, key=os.path.getmtime)

@app.get("/api/status")
async def get_status():
    status_file = MEMORY_DIR / ".agent_state.json"
    if status_file.exists():
        try:
            with open(status_file, "r") as f:
                return json.load(f)
        except Exception as e:
            return {"error": f"Failed to read state: {str(e)}"}
    return {"error": "Status file not found"}

@app.get("/api/tasks")
async def get_tasks():
    tasks_file = MEMORY_DIR / "task_queue.json"
    if tasks_file.exists():
        try:
            with open(tasks_file, "r") as f:
                return json.load(f)
        except Exception as e:
            return {"error": f"Failed to read tasks: {str(e)}"}
    return []

@app.get("/api/logs")
async def get_logs(limit: int = 50):
    latest_log = get_latest_log_file()
    if not latest_log:
        return []
    
    logs = []
    try:
        with open(latest_log, "r") as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                try:
                    logs.append(json.loads(line))
                except:
                    continue
    except Exception as e:
        return {"error": f"Failed to read logs: {str(e)}"}
    return logs

# Serve static files
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
