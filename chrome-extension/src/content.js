/**
 * Content Script
 * Runs on LinkedIn pages and handles DOM interactions
 */

// Load the automation library
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/linkedin-automation.js');
script.onload = function() {
  console.log('LinkedIn automation library loaded');
  initializeContentScript();
};
document.head.appendChild(script);

// ============================================
// CONTENT SCRIPT INITIALIZATION
// ============================================

function initializeContentScript() {
  const automation = new window.LinkedInAutomation();

  // ============================================
  // MESSAGE HANDLERS
  // ============================================

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse, automation);
    return true; // Keep message channel open for async response
  });

  async function handleMessage(request, sendResponse, automation) {
    try {
      switch (request.type) {
        case 'EXECUTE_TASK':
          const result = await executeTask(request.task, automation);
          sendResponse(result);
          break;

        case 'CREATE_DRAFT':
          await createDraft(request.task, automation);
          sendResponse({ success: true });
          break;

        case 'EXTRACT_PROFILE':
          const profileInfo = await automation.extractProfileInfo();
          sendResponse({ success: true, data: profileInfo });
          break;

        case 'CHECK_CONNECTION_STATUS':
          const isConnected = checkConnectionStatus();
          sendResponse({ connected: isConnected });
          break;

        case 'GET_PAGE_INFO':
          const pageInfo = getPageInfo();
          sendResponse(pageInfo);
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // ============================================
  // TASK EXECUTION
  // ============================================

  async function executeTask(task, automation) {
    console.log('Executing task:', task);

    try {
      let result;

      switch (task.action) {
        case 'connect':
          result = await automation.sendConnectionRequest(
            task.profileUrl,
            task.message
          );
          break;

        case 'message':
          result = await automation.sendMessage(
            task.profileUrl,
            task.message
          );
          break;

        case 'view_profile':
          result = await automation.viewProfile(task.profileUrl);
          break;

        case 'like_post':
          result = await automation.likePost(task.postUrl);
          break;

        case 'extract_profile':
          const profileData = await automation.extractProfileInfo();
          result = { success: true, data: profileData };
          break;

        default:
          throw new Error(`Unknown action: ${task.action}`);
      }

      // Report result back to background
      chrome.runtime.sendMessage({
        type: 'TASK_RESULT',
        taskId: task.id,
        result: result,
      });

      return result;

    } catch (error) {
      console.error('Task execution failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================
  // DRAFT CREATION
  // ============================================

  async function createDraft(task, automation) {
    console.log('Creating draft:', task);

    try {
      // Find message button
      const messageBtn = document.querySelector(
        'button[aria-label*="Message"], a[href*="/messaging/thread/"]'
      );

      if (!messageBtn) {
        throw new Error('Message button not found - may not be connected');
      }

      // Click to open message window
      messageBtn.click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find message input
      const messageInput = document.querySelector(
        'div[role="textbox"][aria-label*="message"]'
      );

      if (messageInput) {
        // Insert draft message
        messageInput.focus();
        messageInput.innerHTML = task.message;
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Highlight the draft
        messageInput.style.border = '2px solid #0073b1';
        messageInput.style.backgroundColor = '#f3f6f8';

        // Add draft indicator
        const indicator = document.createElement('div');
        indicator.textContent = 'Draft message created by Chimera - Review and send manually';
        indicator.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #0073b1;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        document.body.appendChild(indicator);

        // Remove indicator after 5 seconds
        setTimeout(() => indicator.remove(), 5000);
      }

    } catch (error) {
      console.error('Draft creation failed:', error);
      throw error;
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function checkConnectionStatus() {
    // Check if connected by looking for message button
    const messageBtn = document.querySelector(
      'button[aria-label*="Message"], a[href*="/messaging/thread/"]'
    );

    const connectBtn = document.querySelector(
      'button[aria-label*="Connect"]'
    );

    return !!messageBtn && !connectBtn;
  }

  function getPageInfo() {
    const info = {
      url: window.location.href,
      type: 'unknown',
      profileUrl: null,
      name: null,
    };

    // Determine page type
    if (window.location.pathname.includes('/in/')) {
      info.type = 'profile';
      info.profileUrl = window.location.href.split('?')[0];

      // Extract name
      const nameElement = document.querySelector('h1');
      if (nameElement) {
        info.name = nameElement.textContent.trim();
      }
    } else if (window.location.pathname.includes('/feed')) {
      info.type = 'feed';
    } else if (window.location.pathname.includes('/messaging')) {
      info.type = 'messaging';
    } else if (window.location.pathname.includes('/search')) {
      info.type = 'search';
    }

    return info;
  }

  // ============================================
  // PAGE MONITORING
  // ============================================

  // Monitor for page changes (LinkedIn is a SPA)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      handlePageChange();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  function handlePageChange() {
    const pageInfo = getPageInfo();

    // Notify background of page change
    chrome.runtime.sendMessage({
      type: 'PAGE_CHANGED',
      pageInfo: pageInfo,
    });

    // Track as behavioral event if on a profile
    if (pageInfo.type === 'profile') {
      chrome.runtime.sendMessage({
        type: 'TRACK_EVENT',
        event: {
          event_type: 'linkedin_profile_view',
          event_data: {
            profile_url: pageInfo.profileUrl,
            profile_name: pageInfo.name,
          },
        },
      });
    }
  }

  // ============================================
  // UI ENHANCEMENTS
  // ============================================

  // Add Chimera indicator to show extension is active
  function addChimeraIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'chimera-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <span style="
          width: 8px;
          height: 8px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></span>
        Chimera Active
      </div>
      <style>
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      </style>
    `;

    indicator.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });

    document.body.appendChild(indicator);
  }

  // Add indicator when page loads
  if (document.readyState === 'complete') {
    addChimeraIndicator();
  } else {
    window.addEventListener('load', addChimeraIndicator);
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Shift + C: Quick connect
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      quickConnect();
    }

    // Ctrl/Cmd + Shift + M: Quick message
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      quickMessage();
    }
  });

  async function quickConnect() {
    const pageInfo = getPageInfo();
    if (pageInfo.type !== 'profile') {
      alert('Navigate to a profile page to use quick connect');
      return;
    }

    const message = prompt('Enter connection message (optional):');

    if (message !== null) {
      const result = await automation.sendConnectionRequest(
        pageInfo.profileUrl,
        message
      );

      if (result.success) {
        showNotification('Connection request sent!', 'success');
      } else {
        showNotification(`Failed: ${result.error}`, 'error');
      }
    }
  }

  async function quickMessage() {
    const pageInfo = getPageInfo();
    if (pageInfo.type !== 'profile') {
      alert('Navigate to a profile page to use quick message');
      return;
    }

    const message = prompt('Enter message:');

    if (message) {
      const result = await automation.sendMessage(
        pageInfo.profileUrl,
        message
      );

      if (result.success) {
        showNotification('Message sent!', 'success');
      } else {
        showNotification(`Failed: ${result.error}`, 'error');
      }
    }
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideDown 0.3s ease;
    `;
    notification.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateX(-50%) translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideDown 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  console.log('Chimera LinkedIn Extension - Content script initialized');
}

// ============================================
// ERROR HANDLING
// ============================================

window.addEventListener('error', (event) => {
  console.error('Content script error:', event.error);
  chrome.runtime.sendMessage({
    type: 'ERROR',
    error: {
      message: event.error.message,
      stack: event.error.stack,
    },
  });
});