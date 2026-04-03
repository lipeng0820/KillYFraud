// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  const pluginEnabled = document.getElementById('pluginEnabled');
  const batchEnabled = document.getElementById('batchEnabled');
  const totalBans = document.getElementById('totalBans');
  const banLogs = document.getElementById('banLogs');
  const noLogs = document.getElementById('noLogs');
  const clearLogsBtn = document.getElementById('clearLogs');

  // Load settings and stats
  const data = await chrome.storage.local.get(['enabled', 'batchEnabled', 'banCount', 'banLogs']);
  
  // Initialize toggles (default enabled=true, batchEnabled=false)
  pluginEnabled.checked = data.enabled !== false;
  batchEnabled.checked = !!data.batchEnabled;
  
  // Initialize stats
  totalBans.textContent = data.banCount || 0;
  
  // Populate logs
  renderLogs(data.banLogs || []);

  // Event Listeners for toggles
  pluginEnabled.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: pluginEnabled.checked });
  });

  batchEnabled.addEventListener('change', () => {
    chrome.storage.local.set({ batchEnabled: batchEnabled.checked });
  });

  // Clear Logs
  clearLogsBtn.addEventListener('click', async () => {
    if (confirm('是否确定清空斩杀日志？统计数据将保留。')) {
      await chrome.storage.local.set({ banLogs: [] });
      renderLogs([]);
    }
  });

  function renderLogs(logs) {
    banLogs.innerHTML = '';
    if (logs.length === 0) {
      noLogs.classList.remove('no-logs-hidden'); // CSS hidden class just in case we need it, using display style for now
      noLogs.style.display = 'flex';
      return;
    }
    noLogs.style.display = 'none';
    
    // Sort logs by time descending
    const sortedLogs = [...logs].reverse();
    
    sortedLogs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'log-item';
      
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      li.innerHTML = `
        <span class="log-handle">${log.handle}</span>
        <span class="log-time">${dateStr} ${timeStr}</span>
      `;
      banLogs.appendChild(li);
    });
  }
});
