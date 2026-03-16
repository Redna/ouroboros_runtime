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
    if (sectionId === 'history') updateHistory();
}

async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        document.getElementById('total-tokens').innerText = (data.global_tokens_consumed || 0).toLocaleString();
        document.getElementById('restart-count').innerText = data.restarts || 0;
        document.getElementById('git-commits').innerText = data.git?.commits || 0;
        document.getElementById('git-changes').innerText = data.git?.changes || 0;
        
        lastStartTime = data.last_start_time;
        
        document.getElementById('runtime-indicator').innerText = 'Online';
        document.getElementById('runtime-indicator').className = 'online';
    } catch (err) {
        document.getElementById('runtime-indicator').innerText = 'Offline';
        document.getElementById('runtime-indicator').className = 'offline';
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
            div.className = 'log-entry';
            const content = entry.content || (entry.tool_calls ? `[Tool Call] ${entry.tool_calls[0].function.name}` : '[Empty]');
            div.innerHTML = `<span class="role-${entry.role}">${entry.role.toUpperCase()}:</span> <span>${escapeHtml(content)}</span>`;
            logContainer.appendChild(div);
        });
        logContainer.scrollTop = logContainer.scrollHeight;
    } catch (err) {}
}

async function updateIdentity() {
    try {
        const response = await fetch('/api/identity');
        const data = await response.json();
        document.getElementById('identity-content').innerHTML = data.html;
    } catch (err) {}
}

async function updateHistory() {
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        const container = document.getElementById('history-container');
        container.innerHTML = '';
        history.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = `<span class="role-${msg.role}">${msg.role.toUpperCase()}:</span> <span>${escapeHtml(msg.content)}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    } catch (err) {}
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
