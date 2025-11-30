/**
 * LinkedIn Automation Core
 * Handles all LinkedIn DOM interactions and automation tasks
 */

// ============================================
// RATE LIMITING & SAFETY
// ============================================

class RateLimiter {
  constructor() {
    this.limits = {
      connections_per_day: 20,
      messages_per_day: 50,
      profile_views_per_day: 100,
      likes_per_day: 50,
      min_delay_between_actions: 3000, // 3 seconds
      random_delay_variance: 2000, // 0-2 seconds random
    };

    this.counters = {
      connections: 0,
      messages: 0,
      profile_views: 0,
      likes: 0,
    };

    this.lastActionTime = 0;
    this.loadDailyCounters();
  }

  async loadDailyCounters() {
    const stored = await chrome.storage.local.get(['dailyCounters', 'counterDate']);
    const today = new Date().toDateString();

    if (stored.counterDate === today) {
      this.counters = stored.dailyCounters || this.counters;
    } else {
      // Reset counters for new day
      await this.resetDailyCounters();
    }
  }

  async resetDailyCounters() {
    this.counters = {
      connections: 0,
      messages: 0,
      profile_views: 0,
      likes: 0,
    };

    await chrome.storage.local.set({
      dailyCounters: this.counters,
      counterDate: new Date().toDateString(),
    });
  }

  async canPerformAction(actionType) {
    await this.loadDailyCounters();

    switch (actionType) {
      case 'connection':
        return this.counters.connections < this.limits.connections_per_day;
      case 'message':
        return this.counters.messages < this.limits.messages_per_day;
      case 'profile_view':
        return this.counters.profile_views < this.limits.profile_views_per_day;
      case 'like':
        return this.counters.likes < this.limits.likes_per_day;
      default:
        return true;
    }
  }

  async incrementCounter(actionType) {
    switch (actionType) {
      case 'connection':
        this.counters.connections++;
        break;
      case 'message':
        this.counters.messages++;
        break;
      case 'profile_view':
        this.counters.profile_views++;
        break;
      case 'like':
        this.counters.likes++;
        break;
    }

    await chrome.storage.local.set({
      dailyCounters: this.counters,
      counterDate: new Date().toDateString(),
    });
  }

  async waitForNextAction() {
    const now = Date.now();
    const timeSinceLastAction = now - this.lastActionTime;
    const minDelay = this.limits.min_delay_between_actions;
    const randomDelay = Math.random() * this.limits.random_delay_variance;
    const totalDelay = minDelay + randomDelay;

    if (timeSinceLastAction < totalDelay) {
      await this.sleep(totalDelay - timeSinceLastAction);
    }

    this.lastActionTime = Date.now();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// DOM SELECTORS & UTILITIES
// ============================================

const LinkedInSelectors = {
  // Profile page
  connectButton: 'button[aria-label*="Connect"], button:contains("Connect")',
  moreButton: 'button[aria-label="More actions"]',
  messageButton: 'button[aria-label*="Message"], a[href*="/messaging/thread/"]',
  followButton: 'button[aria-label*="Follow"]',

  // Messaging
  messageInput: 'div[role="textbox"][aria-label*="message"]',
  sendButton: 'button[type="submit"]:contains("Send")',

  // Connection request
  addNoteButton: 'button[aria-label="Add a note"]',
  noteTextarea: 'textarea[name="message"]',
  sendInviteButton: 'button[aria-label="Send invitation"]',

  // Feed
  likeButton: 'button[aria-label*="Like"]',
  commentButton: 'button[aria-label*="Comment"]',
  shareButton: 'button[aria-label*="Share"]',

  // Search results
  searchResultItem: 'li.reusable-search__result-container',
  profileLink: 'a[href*="/in/"]',
};

// ============================================
// LINKEDIN ACTIONS
// ============================================

class LinkedInAutomation {
  constructor() {
    this.rateLimiter = new RateLimiter();
    this.automationMode = 'semi_auto'; // full_auto, semi_auto, manual
  }

  /**
   * Send connection request
   */
  async sendConnectionRequest(profileUrl, message = null) {
    try {
      // Check rate limit
      if (!await this.rateLimiter.canPerformAction('connection')) {
        return {
          success: false,
          error: 'Daily connection limit reached',
        };
      }

      // Navigate to profile if needed
      if (window.location.href !== profileUrl) {
        window.location.href = profileUrl;
        await this.waitForPageLoad();
      }

      // Wait for rate limiter
      await this.rateLimiter.waitForNextAction();

      // Find connect button
      const connectBtn = this.findElement(LinkedInSelectors.connectButton);
      if (!connectBtn) {
        return {
          success: false,
          error: 'Connect button not found',
        };
      }

      // Click connect
      connectBtn.click();
      await this.rateLimiter.sleep(1500);

      // Add note if provided
      if (message) {
        const addNoteBtn = this.findElement(LinkedInSelectors.addNoteButton);
        if (addNoteBtn) {
          addNoteBtn.click();
          await this.rateLimiter.sleep(1000);

          const noteField = this.findElement(LinkedInSelectors.noteTextarea);
          if (noteField) {
            this.typeText(noteField, message);
            await this.rateLimiter.sleep(500);
          }
        }
      }

      // Send invitation
      const sendBtn = this.findElement(LinkedInSelectors.sendInviteButton);
      if (sendBtn) {
        sendBtn.click();
        await this.rateLimiter.incrementCounter('connection');

        return {
          success: true,
          profileUrl,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        error: 'Could not send invitation',
      };

    } catch (error) {
      console.error('Connection request failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send direct message
   */
  async sendMessage(profileUrl, message) {
    try {
      // Check rate limit
      if (!await this.rateLimiter.canPerformAction('message')) {
        return {
          success: false,
          error: 'Daily message limit reached',
        };
      }

      // Navigate to profile if needed
      if (window.location.href !== profileUrl) {
        window.location.href = profileUrl;
        await this.waitForPageLoad();
      }

      // Wait for rate limiter
      await this.rateLimiter.waitForNextAction();

      // Find message button
      const messageBtn = this.findElement(LinkedInSelectors.messageButton);
      if (!messageBtn) {
        return {
          success: false,
          error: 'Message button not found - may not be connected',
        };
      }

      // Click message button
      messageBtn.click();
      await this.rateLimiter.sleep(2000);

      // Find message input
      const messageInput = this.findElement(LinkedInSelectors.messageInput);
      if (!messageInput) {
        return {
          success: false,
          error: 'Message input not found',
        };
      }

      // Type message
      this.typeText(messageInput, message);
      await this.rateLimiter.sleep(1000);

      // Send message
      const sendBtn = this.findElement(LinkedInSelectors.sendButton);
      if (sendBtn) {
        sendBtn.click();
        await this.rateLimiter.incrementCounter('message');

        return {
          success: true,
          profileUrl,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        error: 'Could not send message',
      };

    } catch (error) {
      console.error('Message send failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * View profile (triggers "who viewed you" notification)
   */
  async viewProfile(profileUrl) {
    try {
      // Check rate limit
      if (!await this.rateLimiter.canPerformAction('profile_view')) {
        return {
          success: false,
          error: 'Daily profile view limit reached',
        };
      }

      // Navigate to profile
      window.location.href = profileUrl;
      await this.waitForPageLoad();

      // Wait for rate limiter
      await this.rateLimiter.waitForNextAction();

      // Scroll to simulate viewing
      await this.simulateProfileView();

      await this.rateLimiter.incrementCounter('profile_view');

      return {
        success: true,
        profileUrl,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Profile view failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Like a post
   */
  async likePost(postUrl) {
    try {
      // Check rate limit
      if (!await this.rateLimiter.canPerformAction('like')) {
        return {
          success: false,
          error: 'Daily like limit reached',
        };
      }

      // Navigate to post if needed
      if (!window.location.href.includes(postUrl)) {
        window.location.href = postUrl;
        await this.waitForPageLoad();
      }

      // Wait for rate limiter
      await this.rateLimiter.waitForNextAction();

      // Find like button
      const likeBtn = this.findElement(LinkedInSelectors.likeButton);
      if (!likeBtn) {
        return {
          success: false,
          error: 'Like button not found',
        };
      }

      // Check if already liked
      if (likeBtn.getAttribute('aria-pressed') === 'true') {
        return {
          success: false,
          error: 'Post already liked',
        };
      }

      // Click like
      likeBtn.click();
      await this.rateLimiter.incrementCounter('like');

      return {
        success: true,
        postUrl,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Like post failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract profile information
   */
  async extractProfileInfo() {
    try {
      const info = {
        name: this.getTextContent('h1'),
        headline: this.getTextContent('.text-body-medium'),
        location: this.getTextContent('.text-body-small.inline.t-black--light'),
        about: this.getTextContent('section.pv-about-section div.inline-show-more-text'),
        experience: [],
        skills: [],
      };

      // Extract experience
      const experienceItems = document.querySelectorAll('section.experience-section li');
      experienceItems.forEach(item => {
        info.experience.push({
          title: this.getTextContent('.t-16.t-black.t-bold', item),
          company: this.getTextContent('.t-14.t-black.t-normal', item),
          duration: this.getTextContent('.pv-entity__date-range span:nth-child(2)', item),
        });
      });

      // Extract skills
      const skillItems = document.querySelectorAll('section.pv-skill-categories-section li');
      skillItems.forEach(item => {
        info.skills.push(this.getTextContent('.pv-skill-category-entity__name', item));
      });

      return info;

    } catch (error) {
      console.error('Profile extraction failed:', error);
      return null;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  findElement(selector, parent = document) {
    // Try standard selector
    let element = parent.querySelector(selector);
    if (element) return element;

    // Try contains selector for button text
    if (selector.includes(':contains')) {
      const text = selector.match(/:contains\("(.+?)"\)/)?.[1];
      if (text) {
        const elements = parent.querySelectorAll('button, a');
        for (const el of elements) {
          if (el.textContent.includes(text)) {
            return el;
          }
        }
      }
    }

    return null;
  }

  getTextContent(selector, parent = document) {
    const element = parent.querySelector(selector);
    return element ? element.textContent.trim() : '';
  }

  typeText(element, text) {
    // Simulate human typing
    element.focus();
    element.value = '';

    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      // Small random delay between keystrokes
    }
  }

  async waitForPageLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 2000); // Extra wait for dynamic content
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 2000));
      }
    });
  }

  async simulateProfileView() {
    // Scroll through profile to simulate viewing
    const scrollSteps = 3;
    const scrollDelay = 1500;

    for (let i = 0; i < scrollSteps; i++) {
      window.scrollBy(0, window.innerHeight / 2);
      await this.rateLimiter.sleep(scrollDelay);
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  }
}

// ============================================
// EXPORT FOR USE IN OTHER SCRIPTS
// ============================================

window.LinkedInAutomation = LinkedInAutomation;
window.RateLimiter = RateLimiter;