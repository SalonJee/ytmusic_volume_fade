// YouTube Music Fade In
// Soft-attack curve: near-silent → 0.1 → 0.2 → full volume
// Modelled after how Spotify and pro audio software handle track starts.

(function () {
  const DEFAULTS = { fadeDurationMs: 2500 };
  let settings = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (stored) => { settings = stored; });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.fadeDurationMs) settings.fadeDurationMs = changes.fadeDurationMs.newValue;
  });

  let audioCtx = null;
  let gainNode = null;
  let observedVideo = null;

  function setupAudioContext(video) {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(video);
      gainNode = audioCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      gainNode.gain.value = 0.0001; // start silent so first frame is never loud
    } catch (e) {
      console.warn('[YTM Fade In] Web Audio setup failed:', e);
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
    if (!gainNode || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const total = settings.fadeDurationMs / 1000; // e.g. 2.5s

    // Soft-attack curve — same technique Spotify uses:
    //   t=0       →  gain 0.0001 (silent, no pop)
    //   t=15%     →  gain 0.10   (audible but quiet)
    //   t=40%     →  gain 0.20   (clearly audible)
    //   t=100%    →  gain 1.0    (full / actual volume)
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.10, now + total * 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.20, now + total * 0.40);
    gainNode.gain.exponentialRampToValueAtTime(1.0, now + total);
  }

  function attachListeners(video) {
    if (observedVideo === video) return;
    observedVideo = video;

    setupAudioContext(video);

    video.addEventListener('pause', resetGainLow);
    video.addEventListener('ended', resetGainLow);
    video.addEventListener('waiting', resetGainLow);

    video.addEventListener('play', fadeIn);
    video.addEventListener('playing', fadeIn);

    if (!video.paused) fadeIn();
  }

  function findVideo() {
    const video = document.querySelector('video');
    if (video && video !== observedVideo) attachListeners(video);
  }

  findVideo();

  const observer = new MutationObserver(findVideo);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
