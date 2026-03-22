let lastStartTime = 0;

function showSection(sectionId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === sectionId) btn.classList.add('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`section-${sectionId}`).classList.add('active');
    if (sectionId === 'identity') updateIdentity();
    if (sectionId === 'insights') updateInsights();
    if (sectionId === 'bio') updateBiography();
    if (sectionId === 'state') updateFullState();
    if (sectionId === 'history') updateHistory();
    if (sectionId === 'llm') updateLLMLogs();
}

async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (document.getElementById('total-tokens')) document.getElementById('total-tokens').innerText = (data.global_tokens_consumed || 0).toLocaleString();
        if (document.getElementById('global-input-tokens')) document.getElementById('global-input-tokens').innerText = (data.global_input_tokens || 0).toLocaleString();
        if (document.getElementById('global-output-tokens')) document.getElementById('global-output-tokens').innerText = (data.global_output_tokens || 0).toLocaleString();
        if (document.getElementById('restart-count')) document.getElementById('restart-count').innerText = data.restarts || 0;
        if (document.getElementById('git-commits')) document.getElementById('git-commits').innerText = data.git?.commits || 0;

        if (document.getElementById('context-size')) document.getElementById('context-size').innerText = (data.last_context_size || 0).toLocaleString();        if (document.getElementById('input-tokens')) document.getElementById('input-tokens').innerText = data.last_input_tokens || 0;
        if (document.getElementById('output-tokens')) document.getElementById('output-tokens').innerText = data.last_output_tokens || 0;
        
        lastStartTime = data.last_start_time;
        
        if (document.getElementById('runtime-indicator')) {
            document.getElementById('runtime-indicator').innerText = 'Online';
            document.getElementById('runtime-indicator').className = 'online';
        }
    } catch (err) {
        console.error("Status update failed:", err);
        if (document.getElementById('runtime-indicator')) {
            document.getElementById('runtime-indicator').innerText = 'Offline';
            document.getElementById('runtime-indicator').className = 'offline';
        }
    }
}

function updateUptime() {
    if (lastStartTime === 0) return;
    const now = Math.floor(Date.now() / 1000);
    const diff = now - Math.floor(lastStartTime);
    if (diff < 0) return;
    
    document.getElementById('uptime-display').innerText = formatDuration(diff);
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
}

async function updateTasks() {
    try {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = '';
        if (tasks.length > 0) {
            document.getElementById('task-description').innerText = tasks[0].description;
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.innerHTML = `<span class="task-priority">P${task.priority}</span> ${task.description}`;
                taskList.appendChild(li);
            });
        }
    } catch (err) {}
}

async function updateLogs() {
    try {
        const response = await fetch('/api/logs');
        const logs = await response.json();
        const logContainer = document.getElementById('log-container');
        logContainer.innerHTML = '';
        logs.forEach(entry => {
            const div = document.createElement('div');
            const roleClass = entry.role.toLowerCase();
            div.className = `log-entry role-${roleClass}`;
            const content = entry.content || (entry.tool_calls ? `[Tool Call] ${entry.tool_calls[0].function.name}` : '[Empty]');
            div.innerHTML = `<span class="role-label">${entry.role.toUpperCase()}:</span> <span>${escapeHtml(content)}</span>`;
            logContainer.appendChild(div);
        });
        logContainer.scrollTop = logContainer.scrollHeight;
    } catch (err) {}
}

async function updateIdentity() {
    console.log("Updating identity...");
    try {
        const response = await fetch('/api/identity');
        const data = await response.json();
        console.log("Identity data received:", data);
        document.getElementById('identity-content').innerHTML = data.html;
    } catch (err) {
        console.error("Error updating identity:", err);
    }
}

async function updateInsights() {
    console.log("Updating insights...");
    try {
        const response = await fetch('/api/insights');
        const insights = await response.json();
        const container = document.getElementById('insights-container');
        container.innerHTML = '';
        insights.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'insight-entry';
            div.innerHTML = `
                <div class="insight-header">
                    <span class="insight-title">${escapeHtml(entry.title)}</span>
                    <span class="insight-date">${escapeHtml(entry.timestamp)}</span>
                </div>
                <div class="insight-content">${escapeHtml(entry.content)}</div>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error updating insights:", err);
    }
}

async function updateBiography() {
    try {
        const response = await fetch('/api/biography');
        const bio = await response.json();
        const container = document.getElementById('bio-container');
        container.innerHTML = '';
        bio.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'insight-entry';
            div.innerHTML = `
                <div class="insight-header">
                    <span class="insight-title">${escapeHtml(entry.event)}</span>
                    <span class="insight-date">${escapeHtml(entry.timestamp)}</span>
                </div>
                <div class="insight-content">${escapeHtml(entry.details)}</div>
            `;
            container.appendChild(div);
        });
    } catch (err) {}
}

async function updateFullState() {
    try {
        const response = await fetch('/api/state');
        const state = await response.json();
        document.getElementById('state-container').innerText = JSON.stringify(state, null, 2);
    } catch (err) {}
}

async function updateLLMLogs() {
    try {
        const response = await fetch('/api/llm_logs');
        const logs = await response.json();
        const container = document.getElementById('llm-container');
        container.innerHTML = '';
        
        logs.forEach(call => {
            const traceDetails = document.createElement('details');
            traceDetails.className = 'llm-call-entry';
            
            const summary = document.createElement('summary');
            summary.className = 'llm-call-header';
            summary.innerHTML = `<span>Trace: ${call.timestamp}</span> <span style="color: #666; font-size: 0.8rem;">${call.model}</span>`;
            traceDetails.appendChild(summary);

            const body = document.createElement('div');
            body.className = 'llm-call-body';

            // Messages in this trace
            call.messages?.forEach(m => {
                const msgDetails = document.createElement('details');
                msgDetails.className = 'llm-msg-details';
                
                const msgSummary = document.createElement('summary');
                msgSummary.className = `role-${m.role}-summary`;
                msgSummary.innerText = m.role.toUpperCase();
                msgDetails.appendChild(msgSummary);

                const msgContent = document.createElement('div');
                msgContent.className = `llm-msg-content role-${m.role} markdown-body`;
                
                const text = m.content || (m.tool_calls ? `[Tool Call: ${m.tool_calls[0].function.name}]` : '[Empty]');
                msgContent.innerHTML = marked.parse(text);
                
                msgDetails.appendChild(msgContent);
                body.appendChild(msgDetails);
            });

            // The reasoning content if present
            if (call.response?.reasoning_content) {
                const reasonDetails = document.createElement('details');
                reasonDetails.className = 'llm-msg-details';
                
                const reasonSummary = document.createElement('summary');
                reasonSummary.className = 'role-reasoning-summary';
                reasonSummary.innerText = 'REASONING';
                reasonDetails.appendChild(reasonSummary);

                const reasonContent = document.createElement('div');
                reasonContent.className = 'llm-msg-content role-reasoning markdown-body';
                reasonContent.innerHTML = marked.parse(call.response.reasoning_content);
                
                reasonDetails.appendChild(reasonContent);
                body.appendChild(reasonDetails);
            }

            // The final response
            const respDetails = document.createElement('details');
            respDetails.className = 'llm-msg-details';
            respDetails.open = true; // Keep the actual response open by default
            
            const respSummary = document.createElement('summary');
            respSummary.className = 'role-assistant-summary';
            respSummary.innerText = 'FINAL RESPONSE';
            respDetails.appendChild(respSummary);

            const respContent = document.createElement('div');
            respContent.className = 'llm-msg-content role-assistant markdown-body';
            respContent.innerHTML = marked.parse(call.response?.content || '');
            
            respDetails.appendChild(respContent);
            body.appendChild(respDetails);

            traceDetails.appendChild(body);
            container.appendChild(traceDetails);
        });
    } catch (err) {
        console.error("Error updating LLM logs:", err);
    }
}

async function updateHistory() {
    console.log("Updating history...");
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        console.log("History data received:", history);
        const container = document.getElementById('history-container');
        container.innerHTML = '';
        history.forEach(msg => {
            const div = document.createElement('div');
            // Normalize role to lowercase for CSS class
            let roleClass = msg.role.toLowerCase();
            if (roleClass === 'ouroboros') roleClass = 'assistant';
            
            div.className = `log-entry role-${roleClass}`;
            // Handle both msg.text (chat_history) and msg.content (task logs)
            const textContent = msg.text || msg.content || '';
            div.innerHTML = `<span class="role-label">${msg.role.toUpperCase()}:</span> <span>${escapeHtml(textContent)}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error("Error updating history:", err);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function init() {
    updateStatus();
    updateTasks();
    updateLogs();
    
    setInterval(updateStatus, 5000);
    setInterval(updateTasks, 5000);
    setInterval(updateLogs, 5000);
    setInterval(updateUptime, 1000);
}

document.addEventListener('DOMContentLoaded', init);
