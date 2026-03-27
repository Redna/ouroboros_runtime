let lastStartTime = 0;

function showSection(sectionId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        // Extract section from onclick attribute or data-section if we had one
        // For now, let's just match against a lowercase version of the text as a fallback,
        // but prefer an explicit mapping if the button corresponds to the sectionId.
        if (btn.getAttribute('onclick').includes(`'${sectionId}'`)) {
            btn.classList.add('active');
        }
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
    if (sectionId === 'timeline') updateTimeline();
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
        
        // Update Budget
        if (document.getElementById('daily-spend')) document.getElementById('daily-spend').innerText = (data.daily_spend || 0).toFixed(4);
        if (document.getElementById('daily-budget')) document.getElementById('daily-budget').innerText = (data.daily_budget || 0).toFixed(2);
        
        // Add binding for pre-flight failures
        if (document.getElementById('preflight-failures')) {
            document.getElementById('preflight-failures').innerText = data.preflight_failures || 0;
        }

        if (document.getElementById('context-size')) document.getElementById('context-size').innerText = (data.last_context_size || 0).toLocaleString();        if (document.getElementById('input-tokens')) document.getElementById('input-tokens').innerText = data.last_input_tokens || 0;
        if (document.getElementById('output-tokens')) document.getElementById('output-tokens').innerText = data.last_output_tokens || 0;
        
        lastStartTime = data.last_start_time;

        if (document.getElementById('runtime-indicator')) {
            document.getElementById('runtime-indicator').innerText = 'Online';
            document.getElementById('runtime-indicator').className = 'online';
        }

        // Update Cognitive Context UI
        const contextBadge = document.getElementById('context-badge');
        const taskDesc = document.getElementById('task-description');

        if (data.active_branch) {
            contextBadge.innerText = 'BRANCH: ' + data.active_branch.task_id;
            contextBadge.className = 'status-badge context-branch';
            taskDesc.innerText = 'OBJECTIVE: ' + data.active_branch.objective;
        } else {
            contextBadge.innerText = 'GLOBAL TRUNK';
            contextBadge.className = 'status-badge context-trunk';
            // We'll let updateTasks() handle the description if we are in the Trunk
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
        const responseStatus = await fetch('/api/status');
        const statusData = await responseStatus.json();
        
        const responseTasks = await fetch('/api/tasks');
        const tasks = await responseTasks.json();
        
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = '';
        
        if (tasks.length > 0) {
            // Only update the main description from the queue if we are in the Trunk
            if (!statusData.active_branch) {
                document.getElementById('task-description').innerText = tasks[0].description;
            }
            
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                // Using a basic escape for safety if escapeHtml isn't defined, or assume it's safe if it's internal
                const safeDesc = task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                li.innerHTML = `<span class="task-priority">P${task.priority}</span> ${safeDesc}`;
                taskList.appendChild(li);
            });
        } else if (!statusData.active_branch) {
            document.getElementById('task-description').innerText = "Queue empty. Orchestrating or reflecting.";
        }
    } catch (err) {}
}

async function updateScheduledTasks() {
    try {
        const response = await fetch('/api/scheduled');
        const tasks = await response.json();
        
        const taskList = document.getElementById('scheduled-list');
        if (!taskList) return;
        
        taskList.innerHTML = '';
        
        if (tasks.length > 0) {
            // Sort tasks by soonest execution time
            tasks.sort((a, b) => a.run_after - b.run_after);
            
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                
                // Convert UNIX timestamp to a readable local string
                const runDate = new Date(task.run_after * 1000);
                const timeString = runDate.toLocaleString(undefined, { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                });
                
                // Escape description for safety
                const safeDesc = task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                // Styling to separate the time from the description
                li.innerHTML = `<span class="task-priority" style="background: #333; color: #aaa;">[${timeString}]</span> ${safeDesc}`;
                taskList.appendChild(li);
            });
        } else {
            taskList.innerHTML = '<li class="task-item" style="color: #555; font-style: italic;">No future tasks scheduled.</li>';
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
                <div class="insight-content markdown-body">${marked.parse(entry.details || '')}</div>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error updating biography:", err);
    }
}

async function updateFullState() {
    try {
        const response = await fetch('/api/state');
        const state = await response.json();
        const container = document.getElementById('state-container');
        
        let html = '<div class="state-grid">';
        for (const [key, value] of Object.entries(state)) {
            html += `
                <div class="state-item">
                    <div class="state-key">${escapeHtml(key)}</div>
                    <div class="state-value">${escapeHtml(String(value))}</div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error("Error updating full state:", err);
    }
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
            
            const copyBtn = document.createElement('button');
            copyBtn.innerText = 'Copy Trace';
            copyBtn.className = 'copy-btn';
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyTrace(call);
            };
            summary.appendChild(copyBtn);
            
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

async function updateTimeline() {
    console.log("Updating hierarchical timeline...");
    try {
        const response = await fetch('/api/historical_tasks');
        const tasks = await response.json();
        const container = document.getElementById('timeline-list');
        if (!container) return;
        container.innerHTML = '';
        
        // Group tasks by parent_task_id
        const taskMap = {};
        const roots = [];
        
        tasks.forEach(task => {
            task.children = [];
            taskMap[task.task_id] = task;
        });
        
        tasks.forEach(task => {
            if (task.parent_task_id && taskMap[task.parent_task_id]) {
                taskMap[task.parent_task_id].children.push(task);
            } else {
                roots.push(task);
            }
        });

        // Ensure global_trunk is always a root if it exists
        const trunkIdx = roots.findIndex(t => t.task_id === 'global_trunk');
        if (trunkIdx > -1) {
            const trunk = roots.splice(trunkIdx, 1)[0];
            roots.unshift(trunk);
        }

        const renderTask = (task, level = 0) => {
            const div = document.createElement('div');
            div.className = 'timeline-item';
            div.style.marginLeft = `${level * 20}px`;
            if (level > 0) div.style.borderLeft = '1px solid #444';
            
            div.onclick = (e) => {
                e.stopPropagation();
                loadTaskLog(task.task_id);
            };
            
            const isTrunk = task.task_id === 'global_trunk';
            const icon = isTrunk ? '🧠' : '🌿';
            
            div.innerHTML = `
                <div class="timeline-header">
                    <span class="timeline-id">${icon} ${escapeHtml(task.task_id)}</span>
                    <span class="timeline-date">${escapeHtml(task.timestamp)}</span>
                </div>
                <div class="timeline-summary">${escapeHtml(task.summary)}</div>
            `;
            container.appendChild(div);
            
            // Sort children by time ascending
            task.children.sort((a, b) => a.mtime - b.mtime);
            task.children.forEach(child => renderTask(child, level + 1));
        };

        roots.forEach(root => renderTask(root));
        
    } catch (err) {
        console.error("Error updating timeline:", err);
    }
}

async function loadTaskLog(taskId) {
    console.log(`Loading task log: ${taskId}`);
    try {
        const titleElem = document.getElementById('timeline-task-title');
        if (titleElem) titleElem.innerText = `Task Log: ${taskId}`;
        
        const logContainer = document.getElementById('timeline-task-log');
        const contextContainer = document.getElementById('trunk-context-container');
        const toggleBtn = document.getElementById('toggle-trunk-context');
        
        if (!logContainer) return;
        
        // Handle visibility for Trunk
        if (taskId === 'global_trunk') {
            toggleBtn.style.display = 'block';
            toggleBtn.innerText = 'View Mental State';
            logContainer.style.display = 'block';
            contextContainer.style.display = 'none';
        } else {
            toggleBtn.style.display = 'none';
            logContainer.style.display = 'block';
            contextContainer.style.display = 'none';
        }

        logContainer.innerHTML = 'Loading log...';
        
        const response = await fetch(`/api/task_log/${taskId}`);
        const logs = await response.json();
        
        logContainer.innerHTML = '';
        logs.forEach(entry => {
            const div = document.createElement('div');
            const roleClass = (entry.role || 'system').toLowerCase();
            div.className = `log-entry role-${roleClass}`;
            const content = entry.content || (entry.tool_calls ? `[Tool Call] ${entry.tool_calls[0].function.name}` : '[Empty]');
            div.innerHTML = `<span class="role-label">${(entry.role || 'SYSTEM').toUpperCase()}:</span> <span>${escapeHtml(content)}</span>`;
            logContainer.appendChild(div);
        });
        logContainer.scrollTop = 0;
    } catch (err) {
        console.error("Error loading task log:", err);
    }
}

function toggleMentalState() {
    const logContainer = document.getElementById('timeline-task-log');
    const contextContainer = document.getElementById('trunk-context-container');
    const toggleBtn = document.getElementById('toggle-trunk-context');
    
    if (logContainer.style.display === 'none') {
        logContainer.style.display = 'block';
        contextContainer.style.display = 'none';
        toggleBtn.innerText = 'View Mental State';
    } else {
        logContainer.style.display = 'none';
        contextContainer.style.display = 'block';
        toggleBtn.innerText = 'View Raw Log';
        updateTrunkContext();
    }
}

async function updateTrunkContext() {
    const container = document.getElementById('trunk-context-container');
    if (!container) return;
    container.innerHTML = 'Rendering mental state...';
    
    try {
        const response = await fetch('/api/trunk_context');
        const data = await response.json();
        
        let raw = escapeHtml(data.raw);
        raw = raw.replace(/^(# .*)$/gm, '<span class="context-h1">$1</span>');
        raw = raw.replace(/^(## .*)$/gm, '<span class="context-h2">$1</span>');
        raw = raw.replace(/^(=== .* ===)$/gm, '<span class="context-h3">$1</span>');
        
        container.innerHTML = raw;
    } catch (err) {
        console.error("Error updating trunk context:", err);
    }
}

function copyTrace(call) {
    const text = JSON.stringify(call, null, 2);
    navigator.clipboard.writeText(text).then(() => {
        alert('Trace copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
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
    updateScheduledTasks();
    updateLogs();

    setInterval(updateStatus, 5000);
    setInterval(updateTasks, 5000);
    setInterval(updateScheduledTasks, 5000);
    setInterval(updateLogs, 5000);
    setInterval(updateUptime, 1000);
}
document.addEventListener('DOMContentLoaded', init);
