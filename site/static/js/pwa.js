/**
 * Imigi Studio - PWA & Service Worker Manager
 */
(function() {
    'use strict';

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/sw.js')
                .then(reg => {
                    console.log('Imigi ServiceWorker registered with scope:', reg.scope);
                })
                .catch(err => {
                    console.warn('Imigi ServiceWorker registration failed:', err);
                });
        });
    }

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Optional: Dispatch a custom event or show custom install badge if desired
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) {
            installBanner.hidden = false;
            installBanner.addEventListener('click', async () => {
                installBanner.hidden = true;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User accepted the PWA install prompt');
                }
                deferredPrompt = null;
            });
        }
    });
})();