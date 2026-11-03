if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {
      // Ignore registration errors so the page still loads normally.
    });
  });
}
