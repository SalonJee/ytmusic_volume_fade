// Audio Fade In - Universal per-site fade
// Activates only on sites explicitly enabled by the user.

(function () {
  const DEFAULTS = { fadeDurationMs: 2500 };
  let settings = { ...DEFAULTS };
  let enabled = false;

  const hostname = location.hostname;
  const storageEnabledKey = 'enabled_' + hostname;

  // --- Audio context state ---
  let audioCtx = null;
  let gainNode = null;
  let observedVideo = null;

  // --- Fade logic ---
  function setupAudioContext(video) {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(video);
      gainNode = audioCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      gainNode.gain.value = 0.0001;
    } catch (e) {
      console.warn('[Fade In] Web Audio setup failed:', e);
      audioCtx = null;
      gainNode = null;
    }
  }

  function resetGainLow() {
    if (!gainNode || !audioCtx) return;
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
  }

  function fadeIn() {
    if (!enabled) return;
    if (!gainNode || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const total = settings.fadeDurationMs / 1000;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.10, now + total * 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.20, now + total * 0.40);
    gainNode.gain.exponentialRampToValueAtTime(1.0, now + total);
  }

  function setEnabled(val) {
    enabled = val;
    if (!enabled && gainNode && audioCtx) {
      // Instantly restore full volume when disabled so it doesn't stay silent
      const now = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(1.0, now);
    }
  }

  // --- Video attachment ---
  function attachListeners(video) {
    if (observedVideo === video) return;
    observedVideo = video;

    setupAudioContext(video);

    video.addEventListener('pause', resetGainLow);
    video.addEventListener('ended', resetGainLow);
    video.addEventListener('waiting', resetGainLow);
    video.addEventListener('play', fadeIn);
    video.addEventListener('playing', fadeIn);

    if (!video.paused && enabled) fadeIn();
  }

  function findVideo() {
    const video = document.querySelector('video');
    if (video && video !== observedVideo) attachListeners(video);
  }

  // --- Init: load settings & per-site enabled state ---
  chrome.storage.sync.get([...Object.keys(DEFAULTS), storageEnabledKey], (stored) => {
    settings = { fadeDurationMs: stored.fadeDurationMs ?? DEFAULTS.fadeDurationMs };
    const isEnabled = stored[storageEnabledKey] !== undefined ? stored[storageEnabledKey] : true;
    setEnabled(isEnabled);

    findVideo();
    const observer = new MutationObserver(findVideo);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  // --- Listen for real-time changes from popup ---
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.fadeDurationMs) {
      settings.fadeDurationMs = changes.fadeDurationMs.newValue;
    }
    if (changes[storageEnabledKey] !== undefined) {
      setEnabled(!!changes[storageEnabledKey].newValue);
    }
  });
})();
