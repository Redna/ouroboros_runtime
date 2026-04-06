#!/bin/bash

# Function to format bytes (no 'bc' needed)
format_bytes() {
    local bytes=$1
    if (( bytes < 1024 )); then
        echo "${bytes} B"
    elif (( bytes < 1048576 )); then
        echo "$((bytes / 1024)) KB"
    elif (( bytes < 1073741824 )); then
        echo "$((bytes / 1048576)) MB"
    else
        echo "$((bytes / 1073741824)) GB"
    fi
}

echo "--- [1/3] Finished Files ---"
ls -lh ./models/gemma* 2>/dev/null || echo "None."

echo ""
echo "--- [2/3] Active HF Downloads & Speed ---"
files=$(find ./models/.cache/huggingface/download/ -name "*.incomplete" 2>/dev/null)
if [ -z "$files" ]; then
    echo "No active HF downloads."
else
    # First measurement
    declare -A s_sizes
    for f in $files; do
        if [ -f "$f" ]; then s_sizes["$f"]=$(stat -c%s "$f"); fi
    done
    
    sleep 2
    
    # Second measurement and output
    for f in $files; do
        if [ -f "$f" ]; then
            end_size=$(stat -c%s "$f")
            start_size=${s_sizes["$f"]}
            diff=$(( (end_size - start_size) / 2 )) # per second
            
            speed=$(format_bytes $diff)
            current=$(format_bytes $end_size)
            name=$(basename "$f" | cut -c1-15)
            echo "File: ...$name | Progress: $current | Speed: $speed/s"
        fi
    done
fi

echo ""
echo "--- [3/3] Docker Pull Status ---"
if [ -f "docker_pull.log" ]; then
    # Look for the last few status updates in the log
    # Even if progress bars aren't there, periodic messages usually are.
    grep -E "Downloading|Extracting|Pulling fs layer|Pull complete" docker_pull.log | tail -n 8
else
    echo "No docker_pull.log found."
fi

echo ""
# Show the currently tagged image
if docker image inspect ghcr.io/ggml-org/llama.cpp:server-rocm >/dev/null 2>&1; then
    docker image ls ghcr.io/ggml-org/llama.cpp:server-rocm --format "Current Tagged Image: {{.ID}} | Size: {{.Size}}"
fi
