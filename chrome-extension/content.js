// Content script for LinkedIn pages
console.log('Chimera Apollo Prospector - Content script loaded');

// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Change in production

// Track enriched profiles
let enrichedProfiles = new Set();

// Create floating action button
function createFloatingButton() {
  const button = document.createElement('div');
  button.id = 'chimera-fab';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="chimera-badge" style="display: none;">0</span>
  `;

  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    transition: transform 0.3s ease;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });

  button.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });

  document.body.appendChild(button);
}

// Extract profile data from LinkedIn profile page
function extractProfileData() {
  const data = {
    name: '',
    title: '',
    company: '',
    location: '',
    email: '',
    linkedin: window.location.href,
    about: '',
    experience: [],
    skills: []
  };

  // Extract name
  const nameElement = document.querySelector('h1.text-heading-xlarge');
  if (nameElement) data.name = nameElement.textContent.trim();

  // Extract title
  const titleElement = document.querySelector('.text-body-medium.break-words');
  if (titleElement) data.title = titleElement.textContent.trim();

  // Extract company from experience
  const experienceSection = document.querySelector('#experience');
  if (experienceSection) {
    const companyElements = experienceSection.querySelectorAll('.display-flex.align-items-center');
    if (companyElements.length > 0) {
      const firstCompany = companyElements[0].querySelector('.t-bold span');
      if (firstCompany) data.company = firstCompany.textContent.trim();
    }
  }

  // Extract location
  const locationElement = document.querySelector('.text-body-small.inline.t-black--light');
  if (locationElement) data.location = locationElement.textContent.trim();

  // Extract about
  const aboutSection = document.querySelector('#about');
  if (aboutSection) {
    const aboutText = aboutSection.querySelector('.inline-show-more-text');
    if (aboutText) data.about = aboutText.textContent.trim();
  }

  return data;
}

// Add enrichment button to profile pages
function addEnrichButton() {
  // Check if we're on a profile page
  if (!window.location.pathname.includes('/in/')) return;

  // Check if button already exists
  if (document.querySelector('.chimera-enrich-btn')) return;

  // Find the action buttons container
  const actionsContainer = document.querySelector('.pvs-profile-actions');
  if (!actionsContainer) return;

  const enrichBtn = document.createElement('button');
  enrichBtn.className = 'chimera-enrich-btn artdeco-button artdeco-button--2 artdeco-button--secondary ember-view';
  enrichBtn.innerHTML = `
    <span class="artdeco-button__text">
      🚀 Enrich with Apollo
    </span>
  `;

  enrichBtn.addEventListener('click', async () => {
    enrichBtn.disabled = true;
    enrichBtn.innerHTML = '<span class="artdeco-button__text">Enriching...</span>';

    const profileData = extractProfileData();

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'enrichProfile',
        data: profileData
      });

      if (response.success) {
        enrichBtn.innerHTML = '<span class="artdeco-button__text">✅ Enriched</span>';
        enrichedProfiles.add(window.location.href);
        updateBadge();

        // Show success notification
        showNotification('Profile enriched successfully!', 'success');
      } else {
        enrichBtn.innerHTML = '<span class="artdeco-button__text">❌ Failed</span>';
        showNotification('Failed to enrich profile', 'error');
      }
    } catch (error) {
      enrichBtn.innerHTML = '<span class="artdeco-button__text">❌ Error</span>';
      showNotification('Error enriching profile', 'error');
    }

    setTimeout(() => {
      enrichBtn.disabled = false;
      enrichBtn.innerHTML = '<span class="artdeco-button__text">🚀 Enrich with Apollo</span>';
    }, 3000);
  });

  actionsContainer.appendChild(enrichBtn);
}

// Add import buttons to search results
function addImportButtons() {
  const searchResults = document.querySelectorAll('.entity-result__item');

  searchResults.forEach(result => {
    // Check if button already exists
    if (result.querySelector('.chimera-import-btn')) return;

    const actionsContainer = result.querySelector('.entity-result__actions');
    if (!actionsContainer) return;

    const importBtn = document.createElement('button');
    importBtn.className = 'chimera-import-btn';
    importBtn.style.cssText = `
      background: #667eea;
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      margin-left: 8px;
    `;
    importBtn.textContent = 'Import';

    importBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nameElement = result.querySelector('.entity-result__title-text a span span');
      const titleElement = result.querySelector('.entity-result__primary-subtitle');
      const locationElement = result.querySelector('.entity-result__secondary-subtitle');
      const linkElement = result.querySelector('.entity-result__title-text a');

      const profileData = {
        name: nameElement?.textContent.trim() || '',
        title: titleElement?.textContent.trim() || '',
        location: locationElement?.textContent.trim() || '',
        linkedin: linkElement?.href || '',
      };

      importBtn.textContent = 'Importing...';
      importBtn.disabled = true;

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'importLead',
          data: profileData
        });

        if (response.success) {
          importBtn.textContent = '✅ Imported';
          enrichedProfiles.add(profileData.linkedin);
          updateBadge();
        } else {
          importBtn.textContent = '❌ Failed';
        }
      } catch (error) {
        importBtn.textContent = '❌ Error';
      }

      setTimeout(() => {
        importBtn.textContent = 'Import';
        importBtn.disabled = false;
      }, 3000);
    });

    actionsContainer.appendChild(importBtn);
  });
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = 'chimera-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Update badge count
function updateBadge() {
  const badge = document.querySelector('.chimera-badge');
  if (badge) {
    badge.textContent = enrichedProfiles.size;
    badge.style.display = enrichedProfiles.size > 0 ? 'flex' : 'none';
  }
}

// Observe DOM changes to add buttons dynamically
const observer = new MutationObserver(() => {
  addEnrichButton();
  addImportButtons();
});

// Initialize
function init() {
  createFloatingButton();

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial button additions
  setTimeout(() => {
    addEnrichButton();
    addImportButtons();
  }, 2000);
}

// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .chimera-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }

  .chimera-import-btn:hover {
    background: #5a67d8 !important;
  }
`;
document.head.appendChild(style);