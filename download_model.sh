#!/bin/bash
mkdir -p models/

# Mistral Small 24B (Text Agent)
MISTRAL_URL="https://huggingface.co/bartowski/mistralai_Mistral-Small-3.2-24B-Instruct-2506-GGUF/resolve/main/mistralai_Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf"
JINJA_URL="https://huggingface.co/bartowski/mistralai_Mistral-Small-3.2-24B-Instruct-2506-GGUF/resolve/main/Mistral-Small-3.2-24B-Instruct-2506.jinja"

# Kimi-VL-A3B (Vision/Fast Agent)
KIMI_URL="https://huggingface.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF/resolve/main/Kimi-VL-A3B-Instruct.Q4_K_M.gguf"

echo "Downloading Mistral Small 24B..."
wget -c "$MISTRAL_URL" -O models/mistralai_Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf
wget -c "$JINJA_URL" -O models/Mistral-Small-3.2-24B-Instruct-2506.jinja

echo "Downloading Kimi-VL-A3B..."
wget -c "$KIMI_URL" -O models/Kimi-VL-A3B-Instruct.Q4_K_M.gguf

echo "Done! Models are in the 'models/' directory."
