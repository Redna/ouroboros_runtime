#!/bin/bash
mkdir -p models/

# Qwen3.5 27B (Unsloth GGUF)
QWEN_URL="https://huggingface.co/unsloth/Qwen3.5-27B-GGUF/resolve/main/Qwen3.5-27B-Q4_K_M.gguf"

echo "Downloading Qwen3.5 27B..."
wget -c "$QWEN_URL" -O models/Qwen3.5-27B-Q4_K_M.gguf

echo "Done! Models are in the 'models/' directory."
