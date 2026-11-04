(function() {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Script failed to load: ' + src)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function() {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = function() {
        reject(new Error('Script failed to load: ' + src));
      };
      script.dataset.lazy = 'true';
      document.head.appendChild(script);
    });
  }

  function init() {
    const trigger = function() {
      Promise.all([
        loadScript('/static/js/image-tools.js')
      ]).catch(function(error) {
        console.warn('[pdf-tools] shared tool bundle did not load:', error);
      });
    };

    const activate = function(event) {
      if (event && event.target && event.target.closest && event.target.closest('form')) {
        trigger();
      } else {
        trigger();
      }
    };

    document.addEventListener('pointerdown', activate, { once: true, passive: true });
    document.addEventListener('keydown', activate, { once: true });
    document.addEventListener('touchstart', activate, { once: true, passive: true });

    if (window.requestIdleCallback) {
      window.requestIdleCallback(trigger, { timeout: 1500 });
    } else {
      window.setTimeout(trigger, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
