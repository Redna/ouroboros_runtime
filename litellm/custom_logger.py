from litellm.integrations.custom_logger import CustomLogger
import json
import time
from pathlib import Path

class MemoryLogger(CustomLogger):
    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            # Replicates the exact logging structure previously handled by the agent
            log_dir = Path("/memory/llm_logs")
            log_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp_str = time.strftime("%Y%m%d-%H%M%S")
            log_file = log_dir / f"call-{timestamp_str}-{int(time.time())}.json"
            
            # Safely handle the response object
            response_dict = response_obj
            if hasattr(response_obj, 'model_dump'):
                response_dict = response_obj.model_dump()
            elif hasattr(response_obj, 'dict'):
                response_dict = response_obj.dict()

            log_data = {
                "timestamp": timestamp_str,
                "model": kwargs.get("model", "unknown"),
                "messages": kwargs.get("messages", []),
                "response": response_dict
            }
            log_file.write_text(json.dumps(log_data, indent=2, default=str), encoding="utf-8")
        except Exception as e:
            print(f"[LiteLLM Logger] Error writing to memory: {e}")

# LiteLLM requires an instantiated object to hook into
proxy_handler_instance = MemoryLogger()
