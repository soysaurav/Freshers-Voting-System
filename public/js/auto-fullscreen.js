/**
 * Non-intrusive Fullscreen Helper
 * Provides clean on-demand fullscreen toggling without annoying prompts.
 */
(function() {
  function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.mozFullScreenElement || 
              document.msFullscreenElement);
  }

  function toggleFullscreen() {
    if (isFullscreen()) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } else {
      const docEl = document.documentElement;
      const fn = docEl.requestFullscreen || 
                 docEl.webkitRequestFullscreen || 
                 docEl.mozRequestFullScreen || 
                 docEl.msRequestFullscreen;
      if (fn) {
        try {
          const p = fn.call(docEl);
          if (p && p.catch) p.catch(() => {});
        } catch (e) {}
      }
    }
  }

  window.toggleFullscreen = toggleFullscreen;
  window.isFullscreen = isFullscreen;
})();
