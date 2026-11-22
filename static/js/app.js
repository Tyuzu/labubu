/**
 * Imigi Studio - Core Application Controller
 * Handles navigation state, global tool search, theme toggling, recent tools, and dynamic script loading.
 */
(function() {
    'use strict';

    // --- 1. TOOL CATALOG & ROUTE SCRIPT MAPPINGS ---
    const toolCatalog = [
        { label: 'Image Compressor', href: '/image-compressor', category: 'image', formats: ['jpg', 'png', 'webp'], tags: ['compress', 'optimize', 'resize'] },
        { label: 'Image Resizer', href: '/image-resizer', category: 'image', formats: ['jpg', 'png', 'webp'], tags: ['resize', 'crop', 'dimensions'] },
        { label: 'JPG to PNG', href: '/jpg-to-png', category: 'image', formats: ['jpg', 'png'], tags: ['convert', 'format'] },
        { label: 'PNG to JPG', href: '/png-to-jpg', category: 'image', formats: ['png', 'jpg'], tags: ['convert', 'format'] },
        { label: 'PNG to WebP', href: '/png-to-webp', category: 'image', formats: ['png', 'webp'], tags: ['convert', 'web', 'optimize'] },
        { label: 'JPG to WebP', href: '/jpg-to-webp', category: 'image', formats: ['jpg', 'webp'], tags: ['convert', 'web', 'optimize'] },
        { label: 'Image Cropper', href: '/image-cropper', category: 'image', formats: ['jpg', 'png', 'webp'], tags: ['crop', 'frame', 'trim'] },
        { label: 'Image Rotator', href: '/image-rotator', category: 'image', formats: ['jpg', 'png', 'webp'], tags: ['rotate', 'orientation', 'angle'] },
        { label: 'Passport Photo Maker', href: '/passport-photo-maker', category: 'image', formats: ['jpg', 'png'], tags: ['passport', 'photo', 'headshot'] },
        { label: 'PDF Merge', href: '/merge-pdf', category: 'pdf', formats: ['pdf'], tags: ['merge', 'combine', 'document'] },
        { label: 'PDF Split', href: '/split-pdf', category: 'pdf', formats: ['pdf'], tags: ['split', 'extract', 'pages'] },
        { label: 'PDF Compress', href: '/compress-pdf', category: 'pdf', formats: ['pdf'], tags: ['compress', 'optimize', 'reduce'] },
        { label: 'JPG to PDF', href: '/jpg-to-pdf', category: 'pdf', formats: ['jpg', 'pdf'], tags: ['convert', 'document', 'pages'] },
        { label: 'PDF to Images', href: '/pdf-to-images', category: 'pdf', formats: ['pdf', 'jpg', 'png'], tags: ['export', 'images', 'pages'] },
        { label: 'Rotate PDF', href: '/rotate-pdf', category: 'pdf', formats: ['pdf'], tags: ['rotate', 'orientation'] },
        { label: 'Delete PDF Pages', href: '/delete-pdf-pages', category: 'pdf', formats: ['pdf'], tags: ['delete', 'remove', 'pages'] },
        { label: 'Extract PDF Pages', href: '/extract-pdf-pages', category: 'pdf', formats: ['pdf'], tags: ['copy', 'extract', 'pages'] },
        { label: 'PDF Page Editor', href: '/pdf-page-editor', category: 'pdf', formats: ['pdf'], tags: ['watermark', 'numbers', 'reorder', 'rotate'] },
        { label: 'Video Studio', href: '/videos', category: 'video', formats: ['mp4', 'mov', 'webm'], tags: ['video', 'studio', 'render'] },
        { label: 'Video Enhancer', href: '/video-enhancer', category: 'video', formats: ['mp4', 'mov', 'webm'], tags: ['video', 'enhance', 'subtitle', 'speed'] },
        { label: 'Image Batch Converter', href: '/image-batch-converter', category: 'image', formats: ['jpg', 'png', 'webp'], tags: ['batch', 'convert', 'folder'] },
        { label: 'Video Cropper', href: '/video-cropper', category: 'video', formats: ['mp4', 'mov', 'webm'], tags: ['video', 'crop', 'frame'] },
        { label: 'Video Trimmer', href: '/video-trimmer', category: 'video', formats: ['mp4', 'mov', 'webm'], tags: ['trim', 'cut', 'timeline'] },
        { label: 'Video Filters', href: '/video-filters', category: 'video', formats: ['mp4', 'mov', 'webm'], tags: ['filter', 'effect', 'enhance'] },
        { label: 'Document Scanner', href: '/document-scanner', category: 'scanner', formats: ['jpg', 'png'], tags: ['scan', 'document', 'ocr'] },
        { label: 'Document Enhancer', href: '/document-enhancer', category: 'scanner', formats: ['jpg', 'png'], tags: ['scan', 'clean', 'deskew'] },
        { label: 'OCR Text', href: '/ocr-text', category: 'scanner', formats: ['jpg', 'png', 'pdf'], tags: ['ocr', 'text', 'scan'] },
        { label: 'QR Code Scanner', href: '/qr-code-scanner', category: 'scanner', formats: ['jpg', 'png'], tags: ['qr', 'scan'] },
        { label: 'Image to Base64', href: '/image-to-base64', category: 'utility', formats: ['jpg', 'png', 'webp'], tags: ['base64', 'encode'] },
        { label: 'Base64 to Image', href: '/base64-to-image', category: 'utility', formats: ['base64', 'png'], tags: ['decode', 'base64'] }
    ];

    const pageScriptMap = {
        '/image-tools': ['/static/js/image-tools.js'],
        '/image-compressor': ['/static/js/image-tools.js'],
        '/image-resizer': ['/static/js/image-tools.js'],
        '/jpg-to-png': ['/static/js/image-tools.js'],
        '/png-to-jpg': ['/static/js/image-tools.js'],
        '/webp-converter': ['/static/js/image-tools.js'],
        '/png-to-webp': ['/static/js/image-tools.js'],
        '/jpg-to-webp': ['/static/js/image-tools.js'],
        '/image-cropper': ['/static/js/image-tools.js'],
        '/image-rotator': ['/static/js/image-tools.js'],
        '/base64-to-image': ['/static/js/image-tools.js'],
        '/image-to-base64': ['/static/js/image-tools.js'],
        '/document-scanner': ['/static/js/scanner-tools.js'],
        '/qr-code-scanner': ['/static/js/scanner-tools.js'],
        '/merge-pdf': ['/static/js/image-tools.js', '/static/js/pdf-tools.js'],
        '/split-pdf': ['/static/js/image-tools.js', '/static/js/pdf-tools.js'],
        '/compress-pdf': ['/static/js/image-tools.js', '/static/js/pdf-tools.js'],
        '/videos': ['/static/js/video-tools.js'],
        '/video-cropper': ['/static/js/image-tools.js', '/static/js/video-tools.js'],
        '/video-trimmer': ['/static/js/image-tools.js', '/static/js/video-tools.js'],
        '/video-filters': ['/static/js/image-tools.js', '/static/js/video-tools.js']
    };

    // --- 2. DYNAMIC SCRIPT LOADER ---
    function initDynamicScripts() {
        const path = window.location.pathname || '/';
        const sources = pageScriptMap[path] ? (Array.isArray(pageScriptMap[path]) ? pageScriptMap[path] : [pageScriptMap[path]]) : [];

        sources.forEach(src => {
            if (!document.querySelector(`script[data-page-loader="${src}"]`)) {
                const script = document.createElement('script');
                script.src = src;
                script.defer = true;
                script.dataset.pageLoader = src;
                document.body.appendChild(script);
            }
        });
    }

    // --- 3. THEME TOGGLER ---
    function initTheme() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        const savedTheme = localStorage.getItem('imigi-theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
            document.body.classList.add('light-mode');
        }

        toggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            document.body.classList.toggle('light-mode', !isDark);
            localStorage.setItem('imigi-theme', isDark ? 'dark' : 'light');
        });
    }

    // --- 4. GLOBAL SEARCH & AUTOCOMPLETE ---
    function initSearch() {
        const searchInput = document.getElementById('global-tool-search');
        const searchResults = document.getElementById('global-tool-results');
        const searchBox = document.querySelector('.search-box');

        if (!searchInput || !searchResults) return;

        function normalize(val) {
            return String(val || '').toLowerCase().trim();
        }

        function renderResults(query) {
            const q = normalize(query);
            const matches = !q ? toolCatalog.slice(0, 5) : toolCatalog.filter(item => {
                const haystack = [item.label, item.category, ...(item.formats || []), ...(item.tags || [])].join(' ').toLowerCase();
                return haystack.includes(q);
            }).slice(0, 6);

            if (!matches.length) {
                searchResults.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center">No matching tools or formats found.</div>';
                searchResults.hidden = false;
                return;
            }

            searchResults.innerHTML = matches.map(item => `
                <a class="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-800/80 transition text-xs border-b border-slate-800/60 last:border-0" href="${item.href}">
                    <span class="font-medium text-slate-200">${item.label}</span>
                    <span class="font-mono text-[10px] text-indigo-400 uppercase bg-slate-950 px-2 py-0.5 rounded">${item.category}</span>
                </a>
            `).join('');
            searchResults.hidden = false;
        }

        searchInput.addEventListener('input', e => renderResults(e.target.value));
        searchInput.addEventListener('focus', () => renderResults(searchInput.value));

        // Keyboard shortcut '/' to focus search
        document.addEventListener('keydown', e => {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            if (e.key === 'Escape') {
                searchResults.hidden = true;
                searchInput.blur();
            }
        });

        document.addEventListener('click', e => {
            if (!searchBox.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.hidden = true;
            }
        });
    }

    // --- 5. SIDEBAR RAIL & NAVIGATION STATE ---
    function initNavigation() {
        const serverButtons = Array.from(document.querySelectorAll('.server-button'));
        const sidebarSections = Array.from(document.querySelectorAll('.sidebar-section'));
        const sidebarNav = document.getElementById('sidebarNav');
        const storageKey = 'imigi-nav-state';

        const categoryRoutes = {
            overview: ['/', '/about', '/contact', '/images', '/image-tools', '/pdf-tools', '/video-tools', '/scanner-tools', '/tool-list'],
            images: ['/image-compressor', '/image-resizer', '/jpg-to-png', '/png-to-jpg', '/webp-converter', '/png-to-webp', '/jpg-to-webp', '/image-cropper', '/image-rotator', '/image-batch-converter', '/passport-photo-maker'],
            videos: ['/videos', '/video-cropper', '/video-trimmer', '/video-filters', '/video-enhancer'],
            scanner: ['/document-scanner', '/qr-code-scanner', '/document-enhancer', '/ocr-text'],
            pdfs: ['/merge-pdf', '/split-pdf', '/compress-pdf', '/jpg-to-pdf', '/pdf-to-images', '/rotate-pdf', '/delete-pdf-pages', '/extract-pdf-pages', '/pdf-page-editor'],
            utility: ['/image-to-base64', '/base64-to-image']
        };

        function normalizePath(path) {
            let normalized = String(path || '/').split('?')[0].split('#')[0];
            if (normalized.length > 1) normalized = normalized.replace(/\/+$/, '');
            return normalized || '/';
        }

        function categoryForPath(path) {
            const currentPath = normalizePath(path);
            for (const [category, routes] of Object.entries(categoryRoutes)) {
                if (routes.includes(currentPath)) return category;
            }
            return 'overview';
        }

        function setCategory(category, options = {}) {
            const targetCategory = categoryRoutes[category] ? category : 'overview';

            serverButtons.forEach(button => {
                const active = button.dataset.category === targetCategory;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
                button.tabIndex = active ? 0 : -1;
            });

            sidebarSections.forEach(section => {
                const active = section.dataset.category === targetCategory;
                section.classList.toggle('active', active);
                section.setAttribute('aria-hidden', active ? 'false' : 'true');
            });

            if (sidebarNav && window.matchMedia('(max-width: 760px)').matches) {
                sidebarNav.classList.toggle('is-open', options.openMobile === true);
            }

            if (options.persist !== false) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify({ lastCategory: targetCategory }));
                } catch (err) {}
            }
        }

        serverButtons.forEach(button => {
            button.addEventListener('click', () => {
                setCategory(button.dataset.category || 'overview', { openMobile: true });
            });

            button.addEventListener('keydown', event => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const currentIndex = serverButtons.indexOf(button);
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const next = serverButtons[(currentIndex + direction + serverButtons.length) % serverButtons.length];
                next.focus();
                setCategory(next.dataset.category || 'overview', { openMobile: true });
            });
        });

        document.querySelectorAll('.channel-item').forEach(link => {
            if (normalizePath(link.pathname) === normalizePath(window.location.pathname)) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            }
        });

        setCategory(categoryForPath(window.location.pathname), { persist: false, openMobile: false });

        document.addEventListener('click', event => {
            if (!window.matchMedia('(max-width: 760px)').matches || !sidebarNav) return;
            if (sidebarNav.contains(event.target) || event.target.closest('.server-button')) return;
            sidebarNav.classList.remove('is-open');
        });
    }

    // --- 6. UI HELPERS (Dropzones & Sliders) ---
    function initUIEnhancements() {
        // Range slider live value updates
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            const valDisplay = document.getElementById(`${slider.id}-value`);
            if (valDisplay) {
                slider.addEventListener('input', () => {
                    valDisplay.textContent = slider.value + (valDisplay.dataset.unit || '');
                });
            }
        });

        // Dropzone file name preview
        document.querySelectorAll('.file-dropzone').forEach(dropzone => {
            const inputId = dropzone.dataset.input;
            const fileInput = document.getElementById(inputId);
            const filenameLabel = dropzone.querySelector('.dropzone-filename');

            if (fileInput && filenameLabel) {
                fileInput.addEventListener('change', () => {
                    if (fileInput.files && fileInput.files.length > 0) {
                        const names = Array.from(fileInput.files).map(f => f.name).join(', ');
                        filenameLabel.textContent = names;
                        filenameLabel.classList.add('text-indigo-400');
                    }
                });
            }
        });
    }

    // --- INITIALIZE ON DOM LOAD ---
    document.addEventListener('DOMContentLoaded', () => {
        initDynamicScripts();
        initTheme();
        initSearch();
        initNavigation();
        initUIEnhancements();
    });
})();