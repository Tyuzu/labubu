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

  function registerVideoHandlers() {
    window.imigiToolHandlers = window.imigiToolHandlers || {};

    window.imigiToolHandlers['video-enhancer'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a video before enhancing it.'));
      }

      return window.processVideoEnhancement(file, form, {
        action: form.querySelector('#video-enhance-action')?.value || 'enhance',
        subtitle: form.querySelector('#video-subtitle-text')?.value || 'Imigi',
        fadeIn: Number(form.querySelector('#video-fade-in')?.value || 1.5),
        fadeOut: Number(form.querySelector('#video-fade-out')?.value || 1.5),
        trimStart: Number(form.querySelector('#video-trim-start')?.value || 0),
        trimEnd: Number(form.querySelector('#video-trim-end')?.value || 10),
        speed: Number(form.querySelector('#video-speed-rate')?.value || 1),
        format: form.querySelector('#video-enhance-output-format')?.value || 'mp4'
      });
    };

    window.imigiToolHandlers['video-cropper'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a video before cropping it.'));
      }

      return window.processVideoTool(file, form, 'crop', {
        x: window.getNumber ? window.getNumber(form, 'video-crop-x', 0) : 0,
        y: window.getNumber ? window.getNumber(form, 'video-crop-y', 0) : 0,
        width: window.getNumber ? window.getNumber(form, 'video-crop-width', 1280) : 1280,
        height: window.getNumber ? window.getNumber(form, 'video-crop-height', 720) : 720
      });
    };

    window.imigiToolHandlers['video-trimmer'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a video before trimming it.'));
      }

      return window.processVideoTool(file, form, 'trim', {
        start: window.getNumber ? window.getNumber(form, 'video-trim-start', 0) : 0,
        end: window.getNumber ? window.getNumber(form, 'video-trim-end', 10) : 10
      });
    };

    window.imigiToolHandlers['video-filters'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a video before applying a filter.'));
      }

      return window.processVideoTool(file, form, 'filter', {
        filter: form.querySelector('#video-filter-style')?.value || 'cinematic'
      });
    };
  }

  function getVideoProcessingMode(form) {
    const mode = form.querySelector('[id$="-mode"]')?.value || 'cdn';
    return mode === 'self-hosted' ? 'self-hosted' : 'cdn';
  }

  function getVideoOutputFormat(form) {
    const format = form.querySelector('#video-output-format')?.value || 'mp4';
    return String(format).toLowerCase();
  }

  async function processVideoTool(file, form, action, params) {
    const mode = getVideoProcessingMode(form);
    const format = getVideoOutputFormat(form);
    const nextParams = { ...params, format };

    if (mode === 'self-hosted') {
      return processVideoOnServer(file, action, nextParams);
    }

    try {
      switch (action) {
        case 'crop':
          return cropVideo(file, nextParams);
        case 'trim':
          return trimVideo(file, nextParams);
        case 'filter':
          return applyVideoFilter(file, nextParams.filter || 'cinematic', nextParams.format || 'mp4');
        default:
          throw new Error('Unknown video action.');
      }
    } catch (error) {
      console.warn('[video] CDN processing failed, falling back to self-hosted backend:', error);
      return processVideoOnServer(file, action, nextParams);
    }
  }

  async function processVideoEnhancement(file, form, params) {
    if (!file) throw new Error('Please upload a video before enhancing it.');
    const action = String(params.action || 'enhance');
    const outputFormat = String(params.format || 'mp4').toLowerCase();

    switch (action) {
      case 'burn-subtitles':
        return burnSubtitle(file, { subtitle: params.subtitle || 'Imigi', format: outputFormat });
      case 'trim-audio':
        return trimAudio(file, { start: Number(params.trimStart || 0), end: Number(params.trimEnd || 10), format: outputFormat });
      case 'audio-fade':
        return fadeAudio(file, { fadeIn: Number(params.fadeIn || 1.5), fadeOut: Number(params.fadeOut || 1.5), format: outputFormat });
      case 'speed-control':
        return changeVideoSpeed(file, { rate: Number(params.speed || 1), format: outputFormat });
      case 'convert-format':
        return convertVideoFormat(file, outputFormat);
      case 'enhance':
      default:
        return enhanceVideo(file, {
          format: outputFormat,
          contrast: Number(form.querySelector('#video-enhance-contrast')?.value || 1.2),
          brightness: Number(form.querySelector('#video-enhance-brightness')?.value || 0.05),
          saturation: Number(form.querySelector('#video-enhance-saturation')?.value || 1.25)
        });
    }
  }

  async function processVideoOnServer(file, action, params) {
    throw new Error('Server-side video processing is not included in the static site. Please use the browser/CDN processing mode.');
  }

  let ffmpegInstance = null;
  let ffmpegUtil = null;

  async function getFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    const [{ FFmpeg }, utilModule] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js'),
      import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.10/dist/esm/index.js')
    ]);
    ffmpegUtil = utilModule;
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      if (message && typeof console !== 'undefined') console.debug('[ffmpeg]', message);
    });

    await ffmpeg.load({
      coreURL: await ffmpegUtil.toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await ffmpegUtil.toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm', 'application/wasm')
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  }

  async function runVideoFFmpeg(file, args, outputName, outputFormat) {
    if (!file) throw new Error('Please upload a video before processing.');
    const ffmpeg = await getFFmpeg();
    const extension = getFileExtension(file.name);
    const inputName = `input.${extension}`;
    await ffmpeg.writeFile(inputName, await ffmpegUtil.fetchFile(file));
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);
    return new Blob([data.buffer], { type: resolveVideoMimeType(outputFormat) });
  }

  function resolveVideoOutputExtension(format) {
    const value = String(format || 'mp4').toLowerCase();
    if (value === 'webm') return 'webm';
    if (value === 'mov') return 'mov';
    return 'mp4';
  }

  function resolveVideoMimeType(format) {
    const value = String(format || 'mp4').toLowerCase();
    if (value === 'webm') return 'video/webm';
    if (value === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }

  async function enhanceVideo(file, options = {}) {
    const contrast = Number(options.contrast) || 1.2;
    const brightness = Number(options.brightness) || 0.05;
    const saturation = Number(options.saturation) || 1.25;
    const format = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `enhanced-${Date.now()}.${format}`;
    const filter = `eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation},unsharp=5:5:1.2:5:5:0.8`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-vf', filter, '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', format === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, format);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-enhanced.${format}`);
  }

  async function burnSubtitle(file, options = {}) {
    const subtitle = String(options.subtitle || 'Imigi').replace(/'/g, "\\'");
    const format = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `subtitled-${Date.now()}.${format}`;
    const filter = `drawtext=text='${subtitle}':fontcolor=white@0.9:fontsize=28:box=1:boxcolor=black@0.45:boxborderw=8:x=(w-text_w)/2:y=h-text_h-20`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-vf', filter, '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', format === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, format);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-subtitles.${format}`);
  }

  async function trimAudio(file, options = {}) {
    const start = Math.max(0, Number(options.start) || 0);
    const end = Math.max(start + 0.1, Number(options.end) || 10);
    const format = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `audio-trim-${Date.now()}.${format}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-ss', String(start), '-to', String(end), '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', format === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, format);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-trimmed-audio.${format}`);
  }

  async function fadeAudio(file, options = {}) {
    const fadeIn = Math.max(0, Number(options.fadeIn) || 1.5);
    const fadeOut = Math.max(0, Number(options.fadeOut) || 1.5);
    const format = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `audio-fade-${Date.now()}.${format}`;
    const length = Math.max(1, Number(options.duration) || 10);
    const filter = `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${Math.max(0, length - fadeOut)}:d=${fadeOut}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-af', filter, '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', format === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, format);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-fade.${format}`);
  }

  async function changeVideoSpeed(file, options = {}) {
    const rate = Number(options.rate) || 1;
    const format = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `speed-${Date.now()}.${format}`;
    const adjustedRate = Math.max(0.25, Math.min(2.5, rate));
    const filter = `setpts=PTS/${adjustedRate}`;
    const audioFilter = `atempo=${adjustedRate}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-vf', filter, '-af', audioFilter, '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', format === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, format);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-speed${adjustedRate.toFixed(2)}.${format}`);
  }

  async function convertVideoFormat(file, format) {
    const outputFormat = resolveVideoOutputExtension(format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `converted-${Date.now()}.${outputFormat}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, outputFormat);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-converted.${outputFormat}`);
  }

  async function cropVideo(file, options) {
    const width = Math.max(1, Number(options.width) || 1280);
    const height = Math.max(1, Number(options.height) || 720);
    const x = Math.max(0, Number(options.x) || 0);
    const y = Math.max(0, Number(options.y) || 0);
    const outputFormat = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `cropped-${Date.now()}.${outputFormat}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-vf', `crop=${width}:${height}:${x}:${y}`, '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, outputFormat);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-cropped.${outputFormat}`);
  }

  async function trimVideo(file, options) {
    const start = Math.max(0, Number(options.start) || 0);
    const end = Math.max(start + 0.1, Number(options.end) || 10);
    const outputFormat = resolveVideoOutputExtension(options.format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `trimmed-${Date.now()}.${outputFormat}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-ss', String(start), '-to', String(end), '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, outputFormat);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-trimmed.${outputFormat}`);
  }

  async function applyVideoFilter(file, preset, format) {
    const presetMap = {
      cinematic: 'eq=contrast=1.15:saturation=1.35:brightness=0.04',
      warm: 'eq=contrast=1.1:saturation=1.4:brightness=0.08',
      cool: 'eq=contrast=1.2:saturation=0.95:brightness=-0.03',
      vintage: 'eq=contrast=1.35:saturation=0.8:brightness=0.06',
      contrast: 'eq=contrast=1.6:saturation=1.2:brightness=0.02',
      grayscale: 'eq=contrast=1.12:saturation=0.1:brightness=0.02',
      sepia: 'eq=contrast=1.18:saturation=0.8:brightness=0.05, colorchannelmixer=rr=1.2:gg=0.8:bb=0.6',
      noir: 'format=gray,eq=contrast=1.7:brightness=-0.04',
      sharp: 'unsharp=5:5:1.2:5:5:0.8',
      sunset: 'eq=contrast=1.25:saturation=1.5:brightness=0.09',
      dreamy: 'eq=contrast=1.08:saturation=1.1:brightness=0.08'
    };
    const filter = presetMap[preset] || preset || presetMap.cinematic;
    const outputFormat = resolveVideoOutputExtension(format);
    const inputName = `input.${getFileExtension(file.name)}`;
    const outputName = `filtered-${Date.now()}.${outputFormat}`;
    const blob = await runVideoFFmpeg(file, ['-i', inputName, '-vf', filter, '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264', '-preset', 'veryfast', '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac', '-movflags', '+faststart', outputName], outputName, outputFormat);
    return createDownloadResult(blob, `${file.name.replace(/\.[^/.]+$/, '')}-filtered.${outputFormat}`);
  }

  function getFileExtension(name) {
    if (!name) return 'mp4';
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'mp4';
  }

  function createDownloadResult(blob, fileName) {
    return { type: 'blob', url: URL.createObjectURL(blob), fileName };
  }

  window.getVideoProcessingMode = getVideoProcessingMode;
  window.getVideoOutputFormat = getVideoOutputFormat;
  window.processVideoTool = processVideoTool;
  window.processVideoEnhancement = processVideoEnhancement;
  window.processVideoOnServer = processVideoOnServer;

  function init() {
    registerVideoHandlers();

    const trigger = function() {
      loadScript('/static/js/image-tools.js').then(function() {
        registerVideoHandlers();
      }).catch(function(error) {
        console.warn('[video-tools] shared tool bundle did not load:', error);
      });
    };

    trigger();

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

  function initVideoFilterGallery() {
    const gallery = document.querySelector('.video-filter-gallery');
    if (!gallery) return;

    const hiddenInput = document.querySelector('#video-filter-style');
    const cards = Array.from(gallery.querySelectorAll('.video-filter-card'));
    const loadMore = gallery.querySelector('.video-filter-load-more');
    const count = gallery.querySelector('.video-filter-count');
    const pageSize = Number(gallery.dataset.pageSize || 12);
    let visibleCount = Math.min(cards.length, pageSize);

    cards.forEach((card, index) => {
      card.hidden = index >= visibleCount;
      card.addEventListener('click', function() {
        cards.forEach(item => {
          item.classList.remove('is-selected');
          item.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('is-selected');
        card.setAttribute('aria-pressed', 'true');
        if (hiddenInput) hiddenInput.value = card.dataset.filterValue || card.dataset.filter || 'cinematic';
      });
    });

    const selected = cards.find(card => card.classList.contains('is-selected')) || cards[0];
    if (selected && hiddenInput) hiddenInput.value = selected.dataset.filterValue || selected.dataset.filter || 'cinematic';

    if (count) count.textContent = `Showing ${visibleCount} of ${cards.length} filters`;

    if (loadMore) {
      if (visibleCount >= cards.length) loadMore.hidden = true;
      loadMore.addEventListener('click', function() {
        visibleCount = Math.min(cards.length, visibleCount + pageSize);
        cards.forEach((card, index) => { card.hidden = index >= visibleCount; });
        if (count) count.textContent = `Showing ${visibleCount} of ${cards.length} filters`;
        if (visibleCount >= cards.length) {
          loadMore.hidden = true;
        } else {
          loadMore.textContent = `Show ${cards.length - visibleCount} more filters`;
        }
      });
    }
  }

  initVideoFilterGallery();
})();
