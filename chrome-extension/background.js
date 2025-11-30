// Background service worker for Chrome extension
console.log('Chimera Apollo Prospector - Background service worker started');

// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Change to production URL
let authToken = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');

  // Set default settings
  chrome.storage.sync.set({
    apiUrl: API_BASE_URL,
    autoEnrich: false,
    notifications: true
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);

  switch (request.action) {
    case 'enrichProfile':
      handleEnrichProfile(request.data, sendResponse);
      return true; // Keep channel open for async response

    case 'importLead':
      handleImportLead(request.data, sendResponse);
      return true;

    case 'bulkImport':
      handleBulkImport(request.data, sendResponse);
      return true;

    case 'openPopup':
      chrome.action.openPopup();
      break;

    case 'getAuth':
      sendResponse({ token: authToken });
      break;

    case 'setAuth':
      authToken = request.token;
      chrome.storage.sync.set({ authToken });
      sendResponse({ success: true });
      break;

    default:
      console.log('Unknown action:', request.action);
  }
});

// Enrich profile with Apollo
async function handleEnrichProfile(profileData, sendResponse) {
  try {
    // First, try to find the person in Apollo
    const searchResponse = await fetch(`${API_BASE_URL}/api/apollo/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type: 'people',
        q_keywords: profileData.name,
        organization_name: profileData.company,
        per_page: 1
      })
    });

    if (!searchResponse.ok) {
      throw new Error('Search failed');
    }

    const searchData = await searchResponse.json();

    if (searchData.data?.people?.length > 0) {
      const apolloProfile = searchData.data.people[0];

      // Enrich with additional data
      const enrichResponse = await fetch(`${API_BASE_URL}/api/apollo/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          type: 'person',
          identifier: apolloProfile.email || apolloProfile.id
        })
      });

      if (!enrichResponse.ok) {
        throw new Error('Enrichment failed');
      }

      const enrichedData = await enrichResponse.json();

      // Store in local database
      await storeEnrichedProfile({
        ...profileData,
        ...enrichedData.data,
        apolloId: apolloProfile.id,
        enrichedAt: new Date().toISOString()
      });

      // Show notification
      if (await getNotificationSetting()) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Profile Enriched',
          message: `Successfully enriched ${profileData.name}`
        });
      }

      sendResponse({ success: true, data: enrichedData.data });
    } else {
      // No match found, store basic data
      await storeEnrichedProfile({
        ...profileData,
        enrichedAt: new Date().toISOString(),
        status: 'not_found'
      });

      sendResponse({ success: false, message: 'Profile not found in Apollo' });
    }
  } catch (error) {
    console.error('Error enriching profile:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Import lead to CRM
async function handleImportLead(leadData, sendResponse) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: leadData.name,
        title: leadData.title,
        company: leadData.company,
        location: leadData.location,
        linkedin_url: leadData.linkedin,
        source: 'chrome_extension',
        status: 'new'
      })
    });

    if (!response.ok) {
      throw new Error('Import failed');
    }

    const result = await response.json();

    // Queue for enrichment
    await fetch(`${API_BASE_URL}/api/apollo/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type: 'person',
        identifier: leadData.name,
        metadata: {
          leadId: result.data.id,
          source: 'linkedin'
        }
      })
    });

    // Update badge count
    updateImportCount(1);

    sendResponse({ success: true, data: result.data });
  } catch (error) {
    console.error('Error importing lead:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle bulk import
async function handleBulkImport(leads, sendResponse) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        leads: leads.map(lead => ({
          name: lead.name,
          title: lead.title,
          company: lead.company,
          linkedin_url: lead.linkedin,
          source: 'chrome_extension_bulk'
        }))
      })
    });

    if (!response.ok) {
      throw new Error('Bulk import failed');
    }

    const result = await response.json();

    // Queue for bulk enrichment
    await fetch(`${API_BASE_URL}/api/apollo/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type: 'bulk',
        contacts: result.data.map(lead => ({
          id: lead.id,
          email: lead.email || lead.name
        }))
      })
    });

    // Update badge count
    updateImportCount(leads.length);

    // Show notification
    if (await getNotificationSetting()) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Bulk Import Complete',
        message: `Successfully imported ${leads.length} leads`
      });
    }

    sendResponse({ success: true, count: leads.length });
  } catch (error) {
    console.error('Error in bulk import:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Store enriched profile locally
async function storeEnrichedProfile(profile) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['enrichedProfiles'], (result) => {
      const profiles = result.enrichedProfiles || [];
      profiles.push(profile);

      // Keep only last 100 profiles
      if (profiles.length > 100) {
        profiles.shift();
      }

      chrome.storage.local.set({ enrichedProfiles: profiles }, resolve);
    });
  });
}

// Update import count
function updateImportCount(increment) {
  chrome.storage.local.get(['importCount'], (result) => {
    const count = (result.importCount || 0) + increment;
    chrome.storage.local.set({ importCount: count });

    // Update badge
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  });
}

// Get notification setting
async function getNotificationSetting() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['notifications'], (result) => {
      resolve(result.notifications !== false);
    });
  });
}

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com')) {
    chrome.tabs.sendMessage(tabId, { action: 'init' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded, inject it
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
      }
    });
  }
});

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'enrichProfile',
    title: 'Enrich with Apollo',
    contexts: ['page'],
    documentUrlPatterns: ['*://www.linkedin.com/*']
  });

  chrome.contextMenus.create({
    id: 'importLead',
    title: 'Import to Chimera CRM',
    contexts: ['page'],
    documentUrlPatterns: ['*://www.linkedin.com/*']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'enrichProfile' || info.menuItemId === 'importLead') {
    chrome.tabs.sendMessage(tab.id, {
      action: info.menuItemId
    });
  }
});

// Sync auth token on startup
chrome.storage.sync.get(['authToken'], (result) => {
  if (result.authToken) {
    authToken = result.authToken;
  }
});

// Handle alarms for periodic tasks
chrome.alarms.create('syncData', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncData') {
    syncEnrichedProfiles();
  }
});

// Sync enriched profiles with server
async function syncEnrichedProfiles() {
  chrome.storage.local.get(['enrichedProfiles'], async (result) => {
    const profiles = result.enrichedProfiles || [];
    if (profiles.length === 0) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/apollo/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ profiles })
      });

      if (response.ok) {
        // Clear synced profiles
        chrome.storage.local.set({ enrichedProfiles: [] });
      }
    } catch (error) {
      console.error('Error syncing profiles:', error);
    }
  });
}