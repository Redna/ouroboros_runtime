import os
import json
import time
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx
from fastapi import FastAPI, Request, Response, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Ouroboros Gate")

# Configuration
MEMORY_DIR = Path(os.getenv("MEMORY_DIR", "/memory"))
LOG_DIR = MEMORY_DIR / "llm_logs"
BUDGET_FILE = MEMORY_DIR / "budget.json"
TOGETHERAI_API_KEY = os.getenv("TOGETHERAI_API_KEY", "")
MAX_BUDGET = float(os.getenv("TOTAL_BUDGET", "1.0"))

# State
PRICING_CACHE: Dict[str, Dict[str, float]] = {}

# Routing configuration
BACKENDS = {
    "local": "http://llamacpp:8080/v1/chat/completions",
    "together": "https://api.together.xyz/v1/chat/completions"
}

# Explicit model mapping
MODEL_MAP = {
    "Qwen3.5-27B-Q4_K_M.gguf": "local",
    "mistralai_Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf": "local",
}

async def refresh_pricing():
    """Fetches the latest pricing from Together AI."""
    global PRICING_CACHE
    if not TOGETHERAI_API_KEY:
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.together.xyz/v1/models",
                headers={"Authorization": f"Bearer {TOGETHERAI_API_KEY}"}
            )
            if resp.status_code == 200:
                models = resp.json()
                new_cache = {}
                for model in models:
                    pid = model.get("id")
                    pricing = model.get("pricing", {})
                    if pid and pricing:
                        new_cache[pid] = {
                            "input": pricing.get("input", 0.0),
                            "output": pricing.get("output", 0.0)
                        }
                PRICING_CACHE = new_cache
                print(f"[Ouroboros Gate] Refreshed pricing for {len(PRICING_CACHE)} models.")
    except Exception as e:
        print(f"[Ouroboros Gate] Failed to refresh pricing: {e}")

@app.on_event("startup")
async def startup_event():
    await refresh_pricing()

def get_current_spend() -> float:
    if not BUDGET_FILE.exists():
        return 0.0
    try:
        data = json.loads(BUDGET_FILE.read_text())
        return data.get("total_spend", 0.0)
    except:
        return 0.0

def update_spend(cost: float):
    try:
        current = get_current_spend()
        new_total = current + cost
        BUDGET_FILE.write_text(json.dumps({
            "total_spend": new_total,
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S"),
            "limit": MAX_BUDGET
        }, indent=2))
    except Exception as e:
        print(f"[Ouroboros Gate] Error updating budget: {e}")

def calculate_cost(backend_key: str, model_id: str, usage: Dict[str, Any]) -> float:
    if backend_key == "local":
        return 0.0
    
    # Strip our internal prefix if present
    clean_model_id = model_id.replace("together_ai/", "")
    # Default to $1.0 if not found in cache
    pricing = PRICING_CACHE.get(clean_model_id, {"input": 1.0, "output": 1.0})
    
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    
    cost = (input_tokens / 1_000_000 * pricing["input"]) + (output_tokens / 1_000_000 * pricing["output"])
    return cost

def log_completion(request_body: Dict[str, Any], response_body: Any, backend_key: str, is_stream: bool = False):
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        timestamp_str = time.strftime("%Y%m%d-%H%M%S")
        log_file = LOG_DIR / f"call-{timestamp_str}-{int(time.time())}.json"
        
        cost = 0.0
        if not is_stream and isinstance(response_body, dict):
            usage = response_body.get("usage", {})
            model_id = request_body.get("model", "unknown")
            cost = calculate_cost(backend_key, model_id, usage)
            update_spend(cost)

        log_data = {
            "timestamp": timestamp_str,
            "model": request_body.get("model", "unknown"),
            "backend": backend_key,
            "messages": request_body.get("messages", []),
            "response": response_body,
            "cost": cost,
            "is_stream": is_stream
        }
        log_file.write_text(json.dumps(log_data, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        print(f"[Ouroboros Gate] Error logging to memory: {e}")

@app.post("/v1/chat/completions")
async def chat_completions(request: Request, background_tasks: BackgroundTasks):
    if get_current_spend() >= MAX_BUDGET:
        raise HTTPException(status_code=402, detail="Budget Limit Exceeded.")

    body = await request.json()
    model = body.get("model", "")
    is_streaming = body.get("stream", False)
    
    backend_key = "local"
    if "together" in model.lower():
        backend_key = "together"
    else:
        backend_key = MODEL_MAP.get(model, "local")
        
    url = BACKENDS.get(backend_key, BACKENDS["local"])
    headers = {"Content-Type": "application/json"}
    if backend_key == "together" and TOGETHERAI_API_KEY:
        headers["Authorization"] = f"Bearer {TOGETHERAI_API_KEY}"
    
    if backend_key == "together" and model.startswith("together_ai/"):
        body["model"] = model.replace("together_ai/", "")

    if is_streaming:
        async def stream_proxy() -> AsyncGenerator[bytes, None]:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream("POST", url, json=body, headers=headers) as resp:
                    async for chunk in resp.aiter_bytes():
                        yield chunk
            background_tasks.add_task(log_completion, body, {"status": "stream_completed"}, backend_key, True)

        return StreamingResponse(stream_proxy(), media_type="text/event-stream")
    
    else:
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code != 200:
                return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
            
            resp_json = resp.json()
            background_tasks.add_task(log_completion, body, resp_json, backend_key)
            return resp_json

@app.get("/v1/models")
async def list_models():
    """Aggregates models from local llama.cpp and Together AI."""
    unified_models = []

    # 1. Add local llama.cpp models
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("http://llamacpp:8080/v1/models", timeout=5.0)
            if resp.status_code == 200:
                local_models = resp.json().get("data", [])
                for m in local_models:
                    m["id"] = m.get("id", "local-model")
                    m["owned_by"] = "llamacpp"
                    unified_models.append(m)
    except Exception as e:
        print(f"[Ouroboros Gate] Could not fetch local models: {e}")

    # 2. Add Together AI models
    if TOGETHERAI_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.together.xyz/v1/models",
                    headers={"Authorization": f"Bearer {TOGETHERAI_API_KEY}"},
                    timeout=10.0
                )
                if resp.status_code == 200:
                    together_models = resp.json()
                    for m in together_models:
                        # Filter for chat or language models only
                        m_type = m.get("type", "").lower()
                        if m_type in ["chat", "language"]:
                            # Prefix Together models to distinguish them if needed
                            # but keeping the original ID for API compatibility
                            unified_models.append({
                                "id": f"together_ai/{m['id']}",
                                "object": "model",
                                "created": m.get("created", int(time.time())),
                                "owned_by": m.get("organization", "together_ai")
                            })
        except Exception as e:
            print(f"[Ouroboros Gate] Could not fetch Together AI models: {e}")

    return {"object": "list", "data": unified_models}

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "engine": "Ouroboros Gate", 
        "budget": f"{get_current_spend():.4f}/{MAX_BUDGET:.4f}",
        "pricing_cached_models": len(PRICING_CACHE)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)
