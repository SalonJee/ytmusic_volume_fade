const DEFAULTS = { fadeDurationMs: 2500 };

const durationInput = document.getElementById('duration');
const durationValue = document.getElementById('durationValue');
const enabledToggle = document.getElementById('enabledToggle');
const toggleStatus = document.getElementById('toggleStatus');
const siteNameEl = document.getElementById('siteName');
const durationSection = document.getElementById('durationSection');

let storageEnabledKey = null;

function updateLabel() {
  durationValue.textContent = (durationInput.value / 1000).toFixed(1) + 's';
}

function updateToggleUI(checked) {
  enabledToggle.checked = checked;
  toggleStatus.textContent = checked ? 'On' : 'Off';
  toggleStatus.className = 'toggle-status' + (checked ? ' on' : '');
  durationSection.className = 'duration-section' + (checked ? '' : ' disabled-overlay');
}

// Get the active tab's hostname
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  let hostname = '';

  try {
    hostname = new URL(tab.url).hostname;
  } catch (e) {
    hostname = 'this page';
  }

  siteNameEl.textContent = hostname || 'this page';
  storageEnabledKey = 'enabled_' + hostname;

  // Load settings + per-site enabled state
  chrome.storage.sync.get([...Object.keys(DEFAULTS), storageEnabledKey], (stored) => {
    durationInput.value = stored.fadeDurationMs ?? DEFAULTS.fadeDurationMs;
    updateLabel();
    const isEnabled = stored[storageEnabledKey] !== undefined ? stored[storageEnabledKey] : true;
    updateToggleUI(isEnabled);
  });
});

// Toggle enable/disable for this site
enabledToggle.addEventListener('change', () => {
  if (!storageEnabledKey) return;
  const enabled = enabledToggle.checked;
  updateToggleUI(enabled);
  chrome.storage.sync.set({ [storageEnabledKey]: enabled });
});

// Fade duration slider
durationInput.addEventListener('input', () => {
  updateLabel();
  chrome.storage.sync.set({ fadeDurationMs: parseInt(durationInput.value, 10) });
});
