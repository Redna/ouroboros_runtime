#!/bin/bash

# Ensure HF CLI tools are installed
pip install -q -U huggingface_hub hf_transfer
export HF_HUB_ENABLE_HF_TRANSFER=1

mkdir -p ./models

echo "Starting resilient download for Gemma-4-31B weights..."
until hf download unsloth/gemma-4-31B-it-GGUF gemma-4-31B-it-UD-Q4_K_XL.gguf --local-dir ./models; do
    echo "Model download interrupted. Retrying in 5 seconds..."
    sleep 5
done

echo "Starting resilient download for Vision Projector..."
until hf download unsloth/gemma-4-31B-it-GGUF mmproj-BF16.gguf --local-dir ./models; do
    echo "Projector download interrupted. Retrying in 5 seconds..."
    sleep 5
done

echo "Pulling latest ROCm llama.cpp image..."
until docker pull ghcr.io/ggml-org/llama.cpp:server-rocm; do
    echo "Docker pull interrupted. Retrying in 5 seconds..."
    sleep 5
done

echo "Pre-fetch complete. The new configuration is staged. Your running application was not interrupted."