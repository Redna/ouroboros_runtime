async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.error) {
            console.error(data.error);
            document.getElementById('runtime-indicator').innerText = 'Offline';
            document.getElementById('runtime-indicator').className = 'offline';
            return;
        }
        
        document.getElementById('total-tokens').innerText = data.global_tokens_consumed.toLocaleString();
        document.getElementById('context-size').innerText = data.last_context_size.toLocaleString();
        
        const ratio = ((data.global_output_tokens / data.global_input_tokens) * 100).toFixed(1);
        document.getElementById('efficiency').innerText = `${ratio}%`;
        
        document.getElementById('runtime-indicator').innerText = 'Online';
        document.getElementById('runtime-indicator').className = 'online';
    } catch (err) {
        console.error('Failed to fetch status:', err);
        document.getElementById('runtime-indicator').innerText = 'Error';
    }
}

async function updateTasks() {
    try {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = '';
        
        if (tasks.length > 0) {
            const current = tasks[0];
            document.getElementById('task-description').innerText = current.description;
            
            // Priority list
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.innerHTML = `<span class="task-priority">P${task.priority}</span> ${task.description}`;
                taskList.appendChild(li);
            });
        } else {
            document.getElementById('task-description').innerText = 'No active tasks in queue.';
        }
    } catch (err) {
        console.error('Failed to fetch tasks:', err);
    }
}

async function updateLogs() {
    try {
        const response = await fetch('/api/logs');
        const logs = await response.json();
        
        const logContainer = document.getElementById('log-container');
        // Simple diff to avoid re-rendering everything if not needed? 
        // For simplicity, just replace.
        logContainer.innerHTML = '';
        
        logs.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            
            let content = '';
            if (entry.content) {
                content = entry.content;
            } else if (entry.tool_calls) {
                content = `[Tool Calls]: ${JSON.stringify(entry.tool_calls)}`;
            } else if (entry.role === 'tool') {
                content = `[Tool Result]: ${entry.content}`;
            }
            
            div.innerHTML = `
                <span class="role-${entry.role}">${entry.role.toUpperCase()}:</span>
                <span class="log-content">${escapeHtml(content)}</span>
            `;
            logContainer.appendChild(div);
        });
        
        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Update progress bar based on logs length (pseudo-progress)
        const progress = Math.min((logs.length / 100) * 100, 100);
        document.getElementById('task-progress').style.width = `${progress}%`;
        
    } catch (err) {
        console.error('Failed to fetch logs:', err);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function init() {
    updateStatus();
    updateTasks();
    updateLogs();
    
    // Refresh interval: 5 seconds
    setInterval(() => {
        updateStatus();
        updateTasks();
        updateLogs();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', init);
