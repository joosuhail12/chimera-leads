// Popup script
let authToken = null;
let apiUrl = 'http://localhost:3000';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  await loadSettings();

  // Check authentication
  await checkAuth();

  // Set up event listeners
  setupEventListeners();

  // Load stats
  await loadStats();

  // Load recent activity
  await loadRecentActivity();
});

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUrl', 'authToken', 'autoEnrich', 'notifications'], (result) => {
      if (result.apiUrl) apiUrl = result.apiUrl;
      if (result.authToken) authToken = result.authToken;

      document.getElementById('apiUrl').value = apiUrl;
      document.getElementById('autoEnrich').checked = result.autoEnrich || false;
      document.getElementById('notifications').checked = result.notifications !== false;

      resolve();
    });
  });
}

// Check authentication status
async function checkAuth() {
  if (authToken) {
    // Verify token is still valid
    try {
      const response = await fetch(`${apiUrl}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        showMainContent();
      } else {
        showAuthSection();
      }
    } catch (error) {
      showAuthSection();
    }
  } else {
    showAuthSection();
  }
}

// Show auth section
function showAuthSection() {
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}

// Show main content
function showMainContent() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
}

// Setup event listeners
function setupEventListeners() {
  // Auth
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Actions
  document.getElementById('enrichCurrentBtn').addEventListener('click', enrichCurrentProfile);
  document.getElementById('bulkImportBtn').addEventListener('click', bulkImportResults);

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', hideSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

  // Toggles
  document.getElementById('autoEnrich').addEventListener('change', (e) => {
    chrome.storage.sync.set({ autoEnrich: e.target.checked });
  });

  document.getElementById('notifications').addEventListener('change', (e) => {
    chrome.storage.sync.set({ notifications: e.target.checked });
  });

  // Links
  document.getElementById('dashboardLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${apiUrl}/dashboard/prospecting` });
  });

  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${apiUrl}/help/chrome-extension` });
  });
}

// Handle login
async function handleLogin() {
  // Open auth window
  chrome.tabs.create({
    url: `${apiUrl}/auth/extension`
  });

  // Listen for auth completion
  chrome.runtime.onMessage.addListener(function listener(request) {
    if (request.action === 'authComplete') {
      authToken = request.token;
      chrome.storage.sync.set({ authToken });
      chrome.runtime.sendMessage({ action: 'setAuth', token: authToken });
      showMainContent();
      loadStats();
      chrome.runtime.onMessage.removeListener(listener);
    }
  });
}

// Handle logout
async function handleLogout() {
  authToken = null;
  chrome.storage.sync.remove(['authToken']);
  chrome.runtime.sendMessage({ action: 'setAuth', token: null });
  showAuthSection();
}

// Enrich current profile
async function enrichCurrentProfile() {
  const btn = document.getElementById('enrichCurrentBtn');
  btn.disabled = true;
  btn.textContent = 'Enriching...';

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url?.includes('linkedin.com')) {
      showNotification('Please navigate to a LinkedIn profile', 'error');
      return;
    }

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { action: 'enrichProfile' }, (response) => {
      if (response?.success) {
        showNotification('Profile enriched successfully!', 'success');
        loadStats();
        loadRecentActivity();
      } else {
        showNotification('Failed to enrich profile', 'error');
      }
    });
  } catch (error) {
    showNotification('Error enriching profile', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Enrich Current Profile
    `;
  }
}

// Bulk import search results
async function bulkImportResults() {
  const btn = document.getElementById('bulkImportBtn');
  btn.disabled = true;
  btn.textContent = 'Importing...';

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url?.includes('linkedin.com/search')) {
      showNotification('Please navigate to LinkedIn search results', 'error');
      return;
    }

    // Send message to content script to collect all visible profiles
    chrome.tabs.sendMessage(tab.id, { action: 'collectSearchResults' }, async (profiles) => {
      if (!profiles || profiles.length === 0) {
        showNotification('No profiles found on page', 'error');
        return;
      }

      // Send to background for bulk import
      chrome.runtime.sendMessage({
        action: 'bulkImport',
        data: profiles
      }, (response) => {
        if (response?.success) {
          showNotification(`Imported ${response.count} profiles!`, 'success');
          loadStats();
          loadRecentActivity();
        } else {
          showNotification('Failed to import profiles', 'error');
        }
      });
    });
  } catch (error) {
    showNotification('Error importing profiles', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>
      Import Search Results
    `;
  }
}

// Load stats
async function loadStats() {
  chrome.storage.local.get(['enrichedCount', 'importCount', 'queuedCount'], (result) => {
    document.getElementById('enrichedCount').textContent = result.enrichedCount || 0;
    document.getElementById('importedCount').textContent = result.importCount || 0;
    document.getElementById('queuedCount').textContent = result.queuedCount || 0;
  });
}

// Load recent activity
async function loadRecentActivity() {
  chrome.storage.local.get(['recentActivity'], (result) => {
    const activityList = document.getElementById('activityList');
    const activities = result.recentActivity || [];

    if (activities.length === 0) {
      activityList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <p>No recent activity</p>
        </div>
      `;
      return;
    }

    activityList.innerHTML = activities.slice(0, 5).map(activity => `
      <div class="activity-item">
        <div>${activity.action}: ${activity.name}</div>
        <div class="time">${formatTime(activity.timestamp)}</div>
      </div>
    `).join('');
  });
}

// Show settings panel
function showSettings() {
  document.getElementById('settingsPanel').style.display = 'flex';
}

// Hide settings panel
function hideSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
}

// Save settings
async function saveSettings() {
  const apiUrl = document.getElementById('apiUrl').value;
  const apiKey = document.getElementById('apiKey').value;

  chrome.storage.sync.set({
    apiUrl,
    apiKey
  }, () => {
    showNotification('Settings saved!', 'success');
    hideSettings();
  });
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
  }
`;
document.head.appendChild(style);