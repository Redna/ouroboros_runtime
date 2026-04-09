let lastStartTime = 0;
let currentStreamTaskId = null;
let logEventSource = null;
let followLogs = true;

function toggleFollow() {
    followLogs = !followLogs;
    const btn = document.getElementById('follow-toggle');
    if (btn) {
        if (followLogs) {
            btn.classList.add('active');
            btn.innerText = 'FOLLOWING';
            // Immediate scroll to bottom
            const container = document.getElementById('log-container');
            if (container) container.scrollTop = container.scrollHeight;
        } else {
            btn.classList.remove('active');
            btn.innerText = 'UNFOLLOWED';
        }
    }
}

function showSection(sectionId) {
    console.log(`Showing section: ${sectionId}`);
    
    // Hide all sections
    const sections = document.querySelectorAll('.tab-content');
    sections.forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById(`section-${sectionId}`);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }

    // Update tab buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${sectionId}'`)) {
            btn.classList.add('active');
        }
    });

    // Trigger data updates
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
        
        if (document.getElementById('trunk-turns')) document.getElementById('trunk-turns').innerText = data.trunk_turns || 0;
        if (document.getElementById('restart-count')) document.getElementById('restart-count').innerText = data.restarts || 0;
        if (document.getElementById('git-commits')) document.getElementById('git-commits').innerText = data.git?.commits || 0;
        
        // Update System Stats
        if (data.sys_stats) {
            if (document.getElementById('sys-cpu')) document.getElementById('sys-cpu').innerText = data.sys_stats.cpu.toFixed(1);
            if (document.getElementById('cpu-bar')) document.getElementById('cpu-bar').style.width = data.sys_stats.cpu + '%';
            if (document.getElementById('sys-mem')) document.getElementById('sys-mem').innerText = data.sys_stats.memory.toFixed(1);
            if (document.getElementById('mem-bar')) document.getElementById('mem-bar').style.width = data.sys_stats.memory + '%';
        }

        // Update Cache Hit and Turn Time from latest LLM logs
        try {
            const llmResp = await fetch('/api/llm_logs');
            const llmLogs = await llmResp.json();
            if (llmLogs && llmLogs.length > 0) {
                const latest = llmLogs[0];
                
                // Cache Hit Calculation (Nested under response)
                const timings = latest.response?.timings;
                const usage = latest.response?.usage;
                
                // Prioritize timings for local llama.cpp, fallback to OpenAI usage
                const cached = timings?.cache_n || usage?.prompt_tokens_details?.cached_tokens || 0;
                const completion = timings?.predicted_n || usage?.completion_tokens || 0;
                const totalPrompt = usage?.prompt_tokens || ((timings?.prompt_n || 0) + (timings?.cache_n || 0));
                const hitPct = totalPrompt > 0 ? Math.round((cached / totalPrompt) * 100) : 0;
                
                if (document.getElementById('cache-hit-percent')) document.getElementById('cache-hit-percent').innerText = hitPct + '%';
                if (document.getElementById('cache-hit-bar')) document.getElementById('cache-hit-bar').style.width = hitPct + '%';
                
                // Turn Time Calculation (Nested under response)
                const promptMs = timings?.prompt_ms || 0;
                const predMs = timings?.predicted_ms || 0;
                const totalSeconds = ((promptMs + predMs) / 1000).toFixed(1);
                
                if (document.getElementById('last-turn-time')) document.getElementById('last-turn-time').innerText = totalSeconds + 's';

                // Token Metrics for the last turn
                const newInput = timings?.prompt_n || (totalPrompt - cached);

                if (document.getElementById('turn-cached-tokens')) document.getElementById('turn-cached-tokens').innerText = cached.toLocaleString();
                if (document.getElementById('turn-input-tokens')) document.getElementById('turn-input-tokens').innerText = newInput.toLocaleString();
                if (document.getElementById('turn-output-tokens')) document.getElementById('turn-output-tokens').innerText = completion.toLocaleString();
            }
        } catch (llmErr) {
            console.error("Failed to update LLM metrics:", llmErr);
        }

        // Update Budget
        if (document.getElementById('daily-spend')) document.getElementById('daily-spend').innerText = (data.daily_spend || 0).toFixed(4);
        if (document.getElementById('daily-budget')) document.getElementById('daily-budget').innerText = (data.daily_budget || 0).toFixed(2);
        
        if (document.getElementById('context-size')) document.getElementById('context-size').innerText = (data.last_context_size || 0).toLocaleString();
        
        // Update Token Metrics
        if (document.getElementById('total-tokens')) {
            document.getElementById('total-tokens').innerText = (data.total_tokens || 0).toLocaleString();
        }
        if (document.getElementById('input-tokens')) {
            document.getElementById('input-tokens').innerText = (data.input_tokens || 0).toLocaleString();
        }
        if (document.getElementById('output-tokens')) {
            document.getElementById('output-tokens').innerText = (data.output_tokens || 0).toLocaleString();
        }
        if (document.getElementById('models-used')) {
            let modelsText = data.models && data.models.length > 0 ? data.models.join(', ') : 'None';
            document.getElementById('models-used').innerText = modelsText;
        }

        // Calculate initial percentage if limit is available
        if (data.context_limit && data.last_context_size) {
            const pct = Math.min(100, Math.round((data.last_context_size / data.context_limit) * 100));
            const turns = data.timeline_turns || 0;
            const turnLimit = data.turn_limit || 50;
            // Use turn_limit from API for the progress bar
            const turnsPct = Math.min(100, Math.round((turns / turnLimit) * 100));
            updateHUD(pct, turnsPct, 0); 
        }
        
        lastStartTime = data.last_start_time;

        if (document.getElementById('runtime-indicator')) {
            document.getElementById('runtime-indicator').innerText = 'Online';
            document.getElementById('runtime-indicator').className = 'online';
        }

        // V5: We are always in singular_stream
        if (currentStreamTaskId !== 'singular_stream') {
            startLogStream('singular_stream');
        }

    } catch (err) {
        console.error("Status update failed:", err);
        if (document.getElementById('runtime-indicator')) {
            document.getElementById('runtime-indicator').innerText = 'Offline';
            document.getElementById('runtime-indicator').className = 'offline';
        }
    }
}

function startLogStream(taskId) {
    if (logEventSource) {
        logEventSource.close();
    }
    
    currentStreamTaskId = taskId;
    console.log(`Starting log stream for: ${taskId}`);
    
    // First load the static history
    updateLogs(taskId);
    
    logEventSource = new EventSource(`/api/stream_logs/${taskId}`);
    
    logEventSource.onmessage = (event) => {
        try {
            const entry = JSON.parse(event.data);
            appendLogEntry(entry);
        } catch (e) {
            console.error("Error parsing stream data:", e);
        }
    };
    
    logEventSource.onerror = (err) => {
        console.error("Log stream error:", err);
        logEventSource.close();
        // Retry after a delay
        setTimeout(() => startLogStream(taskId), 5000);
    };
}

function createLogEntryElement(entry) {
    const div = document.createElement('div');
    let roleClass = (entry.role || 'system').toLowerCase();
    
    // Normalize role for CSS
    if (roleClass === 'ouroboros') roleClass = 'assistant';
    
    div.className = `log-entry role-${roleClass}`;
    let content = entry.content || '';

    // 1. HUD Extraction and Visual Rendering
    // Matches: [HUD | Context: 10% | Turns: 5 | Queue: 0]
    const hudRegex = /\[HUD \| Context: (\d+)% \| Turns: (\d+) \| Queue: (\d+)\]/;
    const hudMatch = content.match(hudRegex);
    if (hudMatch) {
        const contextPercent = parseInt(hudMatch[1]);
        const turnsCount = parseInt(hudMatch[2]);
        const queueSize = parseInt(hudMatch[3]);
        
        // Convert turn count to a visual percentage for the progress bar (max 50)
        const turnsPercent = Math.min(100, Math.round((turnsCount / 50) * 100));
        
        updateHUD(contextPercent, turnsPercent, queueSize);
        
        // Create a visual HUD block
        const hudBlock = document.createElement('div');
        hudBlock.className = 'hud-log-block';
        hudBlock.innerHTML = `
            <span class="hud-icon">🧠</span>
            <div class="hud-data">
                <span class="hud-stat">CTX: ${contextPercent}%</span>
                <span class="hud-stat">TRN: ${turnsCount}</span>
                <span class="hud-stat">QUE: ${queueSize}</span>
            </div>
        `;
        
        content = content.replace(hudRegex, '').trim();
        div.appendChild(hudBlock);
    }

    // 2. Stall Detection
    if (content.includes('[WARNING: Cognitive Intent Stall Detected]')) {
        const warning = document.getElementById('stall-warning');
        if (warning) warning.style.display = 'block';
    } else {
        const warning = document.getElementById('stall-warning');
        if (warning) warning.style.display = 'none';
    }

    // 3. Special Styling for milestones/telemetry/overrides
    if (entry.role === 'tool' && entry.name === 'fold_context') {
        div.classList.add('milestone');
    } else if (content.includes('[SYSTEM LOG: Historical Telemetry Archived: HUD |')) {
        // Extract metrics from the archived string for the visual block
        const archivedMatch = content.match(/HUD \| Context: (\d+)% \| Turns: (\d+) \| Queue: (\d+)/);
        if (archivedMatch) {
            const turnsCount = parseInt(archivedMatch[2]);
            const hBlock = document.createElement('div');
            hBlock.className = 'hud-log-block';
            hBlock.style.opacity = '0.6'; // Dimmed for history
            hBlock.innerHTML = `
                <span class="hud-icon">💾</span>
                <div class="hud-data">
                    <span class="hud-stat">CTX: ${archivedMatch[1]}%</span>
                    <span class="hud-stat">TRN: ${turnsCount}</span>
                    <span class="hud-stat">QUE: ${archivedMatch[3]}</span>
                </div>
            `;
            div.className = `log-entry telemetry`;
            div.appendChild(hBlock);
            return div;
        }
        div.classList.add('telemetry');
        div.innerHTML = `<span>Archived Telemetry Heartbeat</span>`;
        return div;
    } else if (content.includes('[SYSTEM OVERRIDE: CREATOR MESSAGE RECEIVED]')) {
        div.classList.add('system-override');
        content = content.replace('[SYSTEM OVERRIDE: CREATOR MESSAGE RECEIVED]', '').trim();
    }

    const label = document.createElement('span');
    label.className = 'role-label';
    label.innerText = (entry.role === 'tool' ? `TOOL [${entry.name}]` : (entry.role || 'SYSTEM').toUpperCase()) + ':';
    div.appendChild(label);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'log-content';

    // Tool Call Handling
    if (entry.tool_calls && entry.tool_calls.length > 0) {
        entry.tool_calls.forEach(tc => {
            const toolDiv = document.createElement('div');
            toolDiv.className = 'tool-call-block';
            
            let args = tc.function.arguments;
            try {
                const parsedArgs = JSON.parse(args);
                args = JSON.stringify(parsedArgs, null, 2);
            } catch (e) {}

            toolDiv.innerHTML = `
                <span class="tool-name">CALL: ${escapeHtml(tc.function.name)}</span>
                <code class="tool-args">${escapeHtml(args)}</code>
            `;
            div.appendChild(toolDiv);
        });
    }

    if (content) {
        const body = document.createElement('div');
        body.className = 'log-content markdown-body';
        body.innerHTML = marked.parse(content);
        div.appendChild(body);
    }

    return div;
}

function appendLogEntry(entry) {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;
    
    const element = createLogEntryElement(entry);
    element.classList.add('new-entry-flash');
    logContainer.appendChild(element);
    
    // Respect Follow Toggle
    if (followLogs) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

function updateHUD(contextPercent, turnsPercent, queueSize) {
    const ctxBar = document.getElementById('context-usage-bar');
    const ctxLabel = document.getElementById('context-usage-percent');
    const turnsBar = document.getElementById('turns-usage-bar');
    const turnsLabel = document.getElementById('turns-usage-percent');
    
    if (ctxBar) ctxBar.style.width = contextPercent + '%';
    if (ctxLabel) ctxLabel.innerText = contextPercent + '%';
    
    if (turnsBar) turnsBar.style.width = turnsPercent + '%';
    if (turnsLabel) turnsLabel.innerText = turnsPercent + '%';
    
    // Change bar color based on usage
    if (ctxBar) {
        if (contextPercent > 90) ctxBar.style.background = '#ff4444';
        else if (contextPercent > 70) ctxBar.style.background = '#ffaa00';
        else ctxBar.style.background = 'linear-gradient(90deg, #00ffcc, #ff00ff)';
    }

    if (turnsBar) {
        if (turnsPercent > 90) turnsBar.style.background = '#ff4444';
        else if (turnsPercent > 70) turnsBar.style.background = '#ffaa00';
        else turnsBar.style.background = 'linear-gradient(90deg, #ff00ff, #00ffcc)';
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
        const responseTasks = await fetch('/api/tasks');
        const tasks = await responseTasks.json();
        
        const taskList = document.getElementById('task-list');
        const taskDesc = document.getElementById('task-description');
        if (!taskList || !taskDesc) return;

        taskList.innerHTML = '';
        
        if (tasks.length > 0) {
            // Top task is the Current Focus
            taskDesc.innerText = tasks[0].description;
            
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                const safeDesc = escapeHtml(task.description);
                li.innerHTML = `<span class="task-priority">P${task.priority}</span> ${safeDesc}`;
                taskList.appendChild(li);
            });
        } else {
            taskDesc.innerText = "Orchestrating primary stream...";
            taskList.innerHTML = '<li class="task-item" style="color: #555; font-style: italic;">No active tasks in queue.</li>';
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

async function updateLogs(taskId = null) {
    try {
        const url = taskId ? `/api/task_log/${taskId}` : '/api/logs';
        const response = await fetch(url);
        const logs = await response.json();
        const logContainer = document.getElementById('log-container');
        if (!logContainer) return;

        logContainer.innerHTML = '';
        logs.forEach(entry => {
            const element = createLogEntryElement(entry);
            logContainer.appendChild(element);
        });
        logContainer.scrollTop = logContainer.scrollHeight;
    } catch (err) {}
}

async function updateIdentity() {
    console.log("Updating identity...");
    try {
        const response = await fetch('/api/identity');
        const data = await response.json();
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
        if (!container) return;
        
        // Pretty print the full state JSON
        container.innerText = JSON.stringify(state, null, 2);
    } catch (err) {
        console.error("Error updating full state:", err);
    }
}

async function updateLLMLogs() {
    try {
        const response = await fetch('/api/llm_logs');
        const logs = await response.json();
        const container = document.getElementById('llm-container');
        if (!container) return;
        container.innerHTML = '';
        
        if (logs.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic; padding: 20px;">No LLM traces found yet.</p>';
            return;
        }

        logs.forEach(call => {
            const traceDetails = document.createElement('details');
            traceDetails.className = 'llm-call-entry';
            
            const totalTokens = call.response?.usage?.total_tokens || 'Unknown';
            
            const summary = document.createElement('summary');
            summary.className = 'llm-call-header';
            summary.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>Trace: ${call.timestamp} | <small style="color: var(--accent-color);">${totalTokens} tokens</small></span>
                    <span style="color: #666; font-size: 0.8rem; margin-right: 10px;">${call.model}</span>
                </div>
            `;
            
            const copyBtn = document.createElement('button');
            copyBtn.innerText = 'Copy JSON';
            copyBtn.className = 'copy-btn';
            copyBtn.style.padding = '2px 8px';
            copyBtn.style.fontSize = '0.7rem';
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyTrace(call);
            };
            summary.querySelector('div').appendChild(copyBtn);
            
            traceDetails.appendChild(summary);

            const body = document.createElement('div');
            body.className = 'llm-call-body';

            // Messages in this trace
            call.messages?.forEach((m, idx) => {
                const msgDetails = document.createElement('details');
                msgDetails.className = 'llm-msg-details';
                // Open first and last message by default
                if (idx === 0 || idx === call.messages.length - 1) msgDetails.open = true;
                
                const msgSummary = document.createElement('summary');
                msgSummary.className = `role-${m.role}-summary`;
                msgSummary.innerText = m.role.toUpperCase();
                msgDetails.appendChild(msgSummary);

                const msgContent = document.createElement('div');
                msgContent.className = `llm-msg-content role-${m.role} markdown-body`;
                
                let text = m.content || '';
                if (m.tool_calls) {
                    text += '\n\n**Tool Calls:**\n' + m.tool_calls.map(tc => `- \`${tc.function.name}\``).join('\n');
                }
                
                msgContent.innerHTML = marked.parse(text || '[Empty]');
                
                msgDetails.appendChild(msgContent);
                body.appendChild(msgDetails);
            });

            // The reasoning content if present
            if (call.response?.reasoning_content) {
                const reasonDetails = document.createElement('details');
                reasonDetails.className = 'llm-msg-details';
                reasonDetails.open = true;
                
                const reasonSummary = document.createElement('summary');
                reasonSummary.className = 'role-reasoning-summary';
                reasonSummary.innerText = 'REASONING (CoT)';
                reasonDetails.appendChild(reasonSummary);

                const reasonContent = document.createElement('div');
                reasonContent.className = 'llm-msg-content role-reasoning markdown-body';
                reasonContent.innerHTML = marked.parse(call.response.reasoning_content);
                
                reasonDetails.appendChild(reasonContent);
                body.appendChild(reasonDetails);
            }

            // The final response content
            if (call.response?.content) {
                const respDetails = document.createElement('details');
                respDetails.className = 'llm-msg-details';
                respDetails.open = true;
                
                const respSummary = document.createElement('summary');
                respSummary.className = 'role-assistant-summary';
                respSummary.innerText = 'FINAL RESPONSE';
                respDetails.appendChild(respSummary);

                const respContent = document.createElement('div');
                respContent.className = 'llm-msg-content role-assistant markdown-body';
                respContent.innerHTML = marked.parse(call.response.content);
                
                respDetails.appendChild(respContent);
                body.appendChild(respDetails);
            }

            traceDetails.appendChild(body);
            container.appendChild(traceDetails);
        });
    } catch (err) {
        console.error("Error updating LLM logs:", err);
    }
}

let selectedTaskId = null;

async function updateTimeline() {
    try {
        const response = await fetch('/api/historical_tasks');
        const tasks = await response.json();
        const container = document.getElementById('timeline-list');
        if (!container) return;
        container.innerHTML = '';
        
        // V5 is linear, so we just list them by time
        tasks.sort((a, b) => b.mtime - a.mtime);

        tasks.forEach(task => {
            const div = document.createElement('div');
            div.className = 'timeline-item';
            if (task.task_id === 'singular_stream') div.classList.add('active-task');
            if (task.task_id === selectedTaskId) div.classList.add('selected-task');
            
            div.onclick = (e) => {
                e.stopPropagation();
                selectedTaskId = task.task_id;
                updateTimeline();
                loadTaskLog(task.task_id);
            };
            
            const isTrunk = task.task_id === 'singular_stream';
            const icon = isTrunk ? '🧠' : '📜';
            const status = isTrunk ? '<span class="online" style="font-size: 0.7rem; margin-left: 8px;">PRIMARY</span>' : '';
            
            div.innerHTML = `
                <div class="timeline-header">
                    <span class="timeline-id">${icon} ${escapeHtml(task.task_id)}${status}</span>
                    <span class="timeline-date">${escapeHtml(task.timestamp)}</span>
                </div>
                <div class="timeline-summary">${escapeHtml(task.summary)}</div>
            `;
            container.appendChild(div);
        });
        
    } catch (err) {
        console.error("Error updating timeline:", err);
    }
}

async function loadTaskLog(taskId) {
    try {
        const titleElem = document.getElementById('timeline-task-title');
        if (titleElem) titleElem.innerText = `Task Log: ${taskId}`;
        
        const logContainer = document.getElementById('timeline-task-log');
        const contextContainer = document.getElementById('trunk-context-container');
        const toggleBtn = document.getElementById('toggle-trunk-context');
        
        if (!logContainer) return;
        
        // Handle visibility for Trunk
        if (taskId === 'singular_stream') {
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
            const element = createLogEntryElement(entry);
            logContainer.appendChild(element);
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
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = '';
        history.forEach(msg => {
            const entry = {
                role: msg.role,
                content: msg.text || msg.content || '',
                tool_calls: msg.tool_calls
            };
            const element = createLogEntryElement(entry);
            container.appendChild(element);
        });
        container.scrollTop = container.scrollHeight;
    } catch (err) {}
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function updateLLMActive() {
    try {
        const response = await fetch('/api/llm_active');
        const data = await response.json();
        
        const pulse = document.getElementById('engine-pulse');
        const monitor = document.getElementById('prefill-monitor');
        const bar = document.getElementById('prefill-bar');
        const status = document.getElementById('prefill-status');

        if (data.is_processing) {
            pulse.classList.add('active');
            monitor.style.display = 'block';
            
            const pct = Math.round((data.progress_tokens / data.total_tokens) * 100);
            bar.style.width = pct + '%';
            status.innerText = `${data.progress_tokens.toLocaleString()} / ${data.total_tokens.toLocaleString()} TKNS`;
        } else {
            pulse.classList.remove('active');
            monitor.style.display = 'none';
        }
    } catch (err) {
        // Silently fail for the pulse
    }
}

function init() {
    updateStatus();
    updateTasks();
    updateScheduledTasks();
    updateLLMActive();

    setInterval(updateStatus, 5000);
    setInterval(updateTasks, 5000);
    setInterval(updateScheduledTasks, 5000);
    setInterval(updateLLMActive, 1000); // High frequency for smooth progress
    setInterval(() => {
        if (document.getElementById('section-timeline').classList.contains('active')) {
            updateTimeline();
        }
    }, 10000);
    setInterval(updateUptime, 1000);
}
document.addEventListener('DOMContentLoaded', init);
