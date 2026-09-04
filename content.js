// Audio Fade In - Universal per-site fade
// Uses Web Audio API for sites that support it (YouTube, YouTube Music, etc.)

(function () {
  const host = location.hostname.toLowerCase();
  const isAllowedHost = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'music.youtube.com' || host.endsWith('.music.youtube.com');

  if (!isAllowedHost) {
    return;
  }

  const DEFAULTS = { fadeDurationMs: 2500 };
  let settings = { ...DEFAULTS };
  let enabled = false;

  const hostname = host;
  const storageEnabledKey = 'enabled_' + hostname;

  // --- Audio context state ---
  let audioCtx = null;
  let gainNode = null;
  let observedMedia = null;

  function setupAudioContext(media) {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(media);
      gainNode = audioCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      // Only suppress audio if the fade effect is actually enabled
      gainNode.gain.value = enabled ? 0.0001 : 1.0;
    } catch (e) {
      console.warn('[Audio Fade In] Web Audio setup failed:', e);
      audioCtx = null;
      gainNode = null;
    }
  }

  function resetGainLow() {
    if (!gainNode || !audioCtx) return;
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    // When disabled, keep gain at 1.0 so audio passes through on resume
    gainNode.gain.setValueAtTime(enabled ? 0.0001 : 1.0, now);
  }

  function doFade() {
    const now = audioCtx.currentTime;
    const total = settings.fadeDurationMs / 1000;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.10, now + total * 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.20, now + total * 0.40);
    gainNode.gain.exponentialRampToValueAtTime(1.0, now + total);
  }

  function fadeIn() {
    if (!enabled) return;
    if (!gainNode || !audioCtx) return;
    // audioCtx.resume() is async — schedule gain AFTER context is running
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(doFade);
    } else {
      doFade();
    }
  }

  function setEnabled(val) {
    enabled = val;
    if (gainNode && audioCtx) {
      const now = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      if (!enabled) {
        // Restore full volume so audio passes through unaffected
        gainNode.gain.setValueAtTime(1.0, now);
      }
    }
  }

  function attachListeners(media) {
    if (observedMedia === media) return;
    observedMedia = media;

    setupAudioContext(media);

    media.addEventListener('pause', resetGainLow);
    media.addEventListener('ended', resetGainLow);
    // Only 'playing' triggers fade — fires exactly once when audio truly starts rendering.
    // Using 'play' too caused double-triggers; with rapid seek/skip events the debounce
    // we had to add then blocked the real fade, locking gain at 0.0001.
    media.addEventListener('playing', fadeIn);

    if (!media.paused && enabled) fadeIn();
  }

  function findMedia() {
    const media = document.querySelector('video, audio');
    if (media && media !== observedMedia) attachListeners(media);
  }

  chrome.storage.sync.get([...Object.keys(DEFAULTS), storageEnabledKey], (stored) => {
    settings = { fadeDurationMs: stored.fadeDurationMs ?? DEFAULTS.fadeDurationMs };
    const isEnabled = stored[storageEnabledKey] !== undefined ? stored[storageEnabledKey] : true;
    setEnabled(isEnabled);

    findMedia();
    const observer = new MutationObserver(findMedia);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.fadeDurationMs) {
      settings.fadeDurationMs = changes.fadeDurationMs.newValue;
    }
    if (changes[storageEnabledKey] !== undefined) {
      setEnabled(!!changes[storageEnabledKey].newValue);
    }
  });
})();
