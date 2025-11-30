/**
 * Background Service Worker
 * Handles communication between extension, LinkedIn tabs, and Chimera API
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api', // Change to production URL when deployed
  SYNC_INTERVAL: 60000, // Sync with API every minute
  BATCH_SIZE: 10, // Process tasks in batches
};

// ============================================
// TASK QUEUE MANAGEMENT
// ============================================

class TaskQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.loadQueue();
  }

  async loadQueue() {
    const stored = await chrome.storage.local.get('taskQueue');
    this.queue = stored.taskQueue || [];
  }

  async saveQueue() {
    await chrome.storage.local.set({ taskQueue: this.queue });
  }

  async addTask(task) {
    this.queue.push({
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    await this.saveQueue();
  }

  async getNextTask() {
    await this.loadQueue();
    return this.queue.find(task => task.status === 'pending');
  }

  async updateTask(taskId, updates) {
    const taskIndex = this.queue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      this.queue[taskIndex] = { ...this.queue[taskIndex], ...updates };
      await this.saveQueue();
    }
  }

  async removeTask(taskId) {
    this.queue = this.queue.filter(t => t.id !== taskId);
    await this.saveQueue();
  }
}

// ============================================
// API COMMUNICATION
// ============================================

class ChimeraAPI {
  constructor() {
    this.apiKey = null;
    this.organizationId = null;
    this.loadCredentials();
  }

  async loadCredentials() {
    const stored = await chrome.storage.sync.get(['apiKey', 'organizationId']);
    this.apiKey = stored.apiKey;
    this.organizationId = stored.organizationId;
  }

  async fetchPendingTasks() {
    if (!this.apiKey) {
      console.error('API key not configured');
      return [];
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/linkedin/tasks`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Organization-Id': this.organizationId,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }

  async reportTaskResult(taskId, result) {
    if (!this.apiKey) return;

    try {
      await fetch(`${CONFIG.API_BASE_URL}/linkedin/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Organization-Id': this.organizationId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });
    } catch (error) {
      console.error('Failed to report task result:', error);
    }
  }

  async trackEvent(event) {
    if (!this.apiKey) return;

    try {
      await fetch(`${CONFIG.API_BASE_URL}/behavioral-events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Organization-Id': this.organizationId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }
}

// ============================================
// AUTOMATION MODES
// ============================================

const AutomationModes = {
  FULL_AUTO: 'full_auto',     // Execute without user intervention
  SEMI_AUTO: 'semi_auto',     // Queue for review
  ASSISTED: 'assisted',       // Draft for user to send
  MANUAL: 'manual',          // Create task only
};

// ============================================
// TASK PROCESSOR
// ============================================

class TaskProcessor {
  constructor() {
    this.queue = new TaskQueue();
    this.api = new ChimeraAPI();
    this.activeTab = null;
  }

  async processNextTask() {
    if (this.processing) return;

    const task = await this.queue.getNextTask();
    if (!task) return;

    this.processing = true;

    try {
      // Update task status
      await this.queue.updateTask(task.id, { status: 'processing' });

      // Get or create LinkedIn tab
      const tab = await this.getLinkedInTab();
      if (!tab) {
        throw new Error('Could not open LinkedIn tab');
      }

      // Execute task based on mode
      let result;
      switch (task.mode) {
        case AutomationModes.FULL_AUTO:
          result = await this.executeAutoTask(tab, task);
          break;

        case AutomationModes.SEMI_AUTO:
          result = await this.queueForReview(task);
          break;

        case AutomationModes.ASSISTED:
          result = await this.createDraft(tab, task);
          break;

        case AutomationModes.MANUAL:
          result = await this.createManualTask(task);
          break;

        default:
          throw new Error(`Unknown automation mode: ${task.mode}`);
      }

      // Report result to API
      await this.api.reportTaskResult(task.id, result);

      // Track behavioral event
      await this.api.trackEvent({
        event_type: `linkedin_${task.action}`,
        event_data: {
          task_id: task.id,
          profile_url: task.profileUrl,
          success: result.success,
        },
        lead_id: task.leadId,
        source: 'linkedin',
      });

      // Update or remove task
      if (result.success) {
        await this.queue.removeTask(task.id);
      } else {
        await this.queue.updateTask(task.id, {
          status: 'failed',
          error: result.error,
        });
      }

    } catch (error) {
      console.error('Task processing failed:', error);
      await this.queue.updateTask(task.id, {
        status: 'error',
        error: error.message,
      });
    } finally {
      this.processing = false;
    }
  }

  async executeAutoTask(tab, task) {
    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_TASK',
      task: task,
    });

    return response;
  }

  async queueForReview(task) {
    // Add to review queue for user approval
    const reviewQueue = await chrome.storage.local.get('reviewQueue');
    const queue = reviewQueue.reviewQueue || [];
    queue.push(task);
    await chrome.storage.local.set({ reviewQueue: queue });

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon-48.png',
      title: 'LinkedIn Task Ready for Review',
      message: `${task.action} for ${task.leadName}`,
      buttons: [
        { title: 'Approve' },
        { title: 'Skip' },
      ],
    });

    return {
      success: true,
      queued_for_review: true,
    };
  }

  async createDraft(tab, task) {
    // Navigate to profile and pre-fill message
    await chrome.tabs.update(tab.id, { url: task.profileUrl });

    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Send draft message to content script
    await chrome.tabs.sendMessage(tab.id, {
      type: 'CREATE_DRAFT',
      task: task,
    });

    return {
      success: true,
      draft_created: true,
    };
  }

  async createManualTask(task) {
    // Just create a reminder/task for manual execution
    const manualTasks = await chrome.storage.local.get('manualTasks');
    const tasks = manualTasks.manualTasks || [];
    tasks.push({
      ...task,
      created_at: new Date().toISOString(),
    });
    await chrome.storage.local.set({ manualTasks: tasks });

    return {
      success: true,
      manual_task_created: true,
    };
  }

  async getLinkedInTab() {
    // Look for existing LinkedIn tab
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });

    if (tabs.length > 0) {
      this.activeTab = tabs[0];
      return tabs[0];
    }

    // Create new tab
    const tab = await chrome.tabs.create({
      url: 'https://www.linkedin.com',
      active: false,
    });

    // Wait for tab to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    this.activeTab = tab;
    return tab;
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'ADD_TASK':
      taskQueue.addTask(request.task).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'GET_QUEUE_STATUS':
      taskQueue.loadQueue().then(() => {
        sendResponse({
          total: taskQueue.queue.length,
          pending: taskQueue.queue.filter(t => t.status === 'pending').length,
          processing: taskQueue.queue.filter(t => t.status === 'processing').length,
          failed: taskQueue.queue.filter(t => t.status === 'failed').length,
        });
      });
      return true;

    case 'SYNC_WITH_API':
      syncWithAPI().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'UPDATE_SETTINGS':
      chrome.storage.sync.set(request.settings).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'TASK_RESULT':
      // Result from content script
      handleTaskResult(request.taskId, request.result);
      sendResponse({ received: true });
      return true;
  }
});

// ============================================
// NOTIFICATION HANDLERS
// ============================================

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  // Handle review queue approval/rejection
  if (buttonIndex === 0) {
    // Approve - execute task
    processApprovedTask(notificationId);
  } else {
    // Skip - mark as skipped
    skipTask(notificationId);
  }
});

// ============================================
// INITIALIZATION
// ============================================

const taskQueue = new TaskQueue();
const api = new ChimeraAPI();
const processor = new TaskProcessor();

// Sync with API periodically
async function syncWithAPI() {
  const tasks = await api.fetchPendingTasks();

  for (const task of tasks) {
    await taskQueue.addTask(task);
  }

  // Process next task
  processor.processNextTask();
}

// Set up periodic sync
chrome.alarms.create('sync', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') {
    syncWithAPI();
  }
});

// Process tasks periodically
chrome.alarms.create('process', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'process') {
    processor.processNextTask();
  }
});

// Initial sync on install
chrome.runtime.onInstalled.addListener(() => {
  syncWithAPI();
});

console.log('Chimera LinkedIn Extension - Background service initialized');