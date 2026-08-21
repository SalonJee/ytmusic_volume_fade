const DEFAULTS = { fadeDurationMs: 2500 };

const durationInput = document.getElementById('duration');
const durationValue = document.getElementById('durationValue');

chrome.storage.sync.get(DEFAULTS, (settings) => {
  durationInput.value = settings.fadeDurationMs;
  updateLabel();
});

function updateLabel() {
  durationValue.textContent = (durationInput.value / 1000).toFixed(1) + 's';
}

function save() {
  updateLabel();
  chrome.storage.sync.set({ fadeDurationMs: parseInt(durationInput.value, 10) });
}

durationInput.addEventListener('input', save);
