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

  function registerScannerHandlers() {
    window.imigiToolHandlers = window.imigiToolHandlers || {};

    window.imigiToolHandlers['document-scanner'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a document before scanning.'));
      }

      return window.scanDocument(file, {
        threshold: Number(form.querySelector('#scanner-threshold')?.value || 180),
        padding: Number(form.querySelector('#scanner-padding')?.value || 18),
        contrast: Number(form.querySelector('#scanner-contrast')?.value || 1.6)
      });
    };

    window.imigiToolHandlers['document-enhancer'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a document before enhancing it.'));
      }

      return window.enhanceDocument(file, {
        threshold: Number(form.querySelector('#doc-enhance-threshold')?.value || 180),
        contrast: Number(form.querySelector('#doc-enhance-contrast')?.value || 1.6),
        sharpen: Number(form.querySelector('#doc-enhance-sharpen')?.value || 1.2),
        cleanup: Boolean(form.querySelector('#doc-enhance-cleanup')?.checked ?? true),
        autocrop: Boolean(form.querySelector('#doc-enhance-autocrop')?.checked ?? true)
      });
    };

    window.imigiToolHandlers['ocr-text'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload an image or PDF before running OCR.'));
      }

      return window.ocrText(file, {
        language: form.querySelector('#ocr-language')?.value || 'eng',
        mode: form.querySelector('#ocr-mode')?.value || 'document'
      });
    };

    window.imigiToolHandlers['qr-code-scanner'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      if (!file) {
        return Promise.reject(new Error('Please upload a QR code image or use the camera first.'));
      }

      return window.scanQrCode(file, form);
    };
  }

  async function scanQrCode(file, form) {
    if (!file) {
      throw new Error('Please upload a QR code image or use the camera first.');
    }

    if (!window.jsQR) {
      throw new Error('QR scanning support is not available in this browser yet.');
    }

    const dataUrl = await fileToDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The image could not be loaded.'));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);

    if (!code || !code.data) {
      throw new Error('No QR code was detected. Try a clearer image or a closer shot.');
    }

    const preview = form.parentElement.querySelector('.tool-preview');
    if (preview) {
      preview.src = await fileToDataUrl(file);
      preview.hidden = false;
    }

    return {
      type: 'text',
      value: code.data,
      fileName: 'qr-code-result.txt'
    };
  }

  async function scanDocument(file, options = {}) {
    const dataUrl = await fileToDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The image could not be loaded.'));
      img.src = dataUrl;
    });

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.width;
    sourceCanvas.height = image.height;
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(image, 0, 0);

    const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = sourceData.data;
    const threshold = Number(options.threshold) || 180;
    const padding = Number(options.padding) || 18;

    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sourceCanvas.height; y += 2) {
      for (let x = 0; x < sourceCanvas.width; x += 2) {
        const index = (y * sourceCanvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const brightness = (r + g + b) / 3;

        if (brightness < threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    let cropX = 0;
    let cropY = 0;
    let cropWidth = sourceCanvas.width;
    let cropHeight = sourceCanvas.height;

    if (maxX >= 0 && maxY >= 0) {
      cropX = Math.max(0, minX - padding);
      cropY = Math.max(0, minY - padding);
      cropWidth = Math.min(sourceCanvas.width - cropX, maxX - minX + padding * 2);
      cropHeight = Math.min(sourceCanvas.height - cropY, maxY - minY + padding * 2);
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = Math.max(1, cropWidth);
    outputCanvas.height = Math.max(1, cropHeight);
    const outputCtx = outputCanvas.getContext('2d');
    const cropRect = sourceCtx.getImageData(cropX, cropY, cropWidth, cropHeight);
    const rectData = cropRect.data;

    for (let i = 0; i < rectData.length; i += 4) {
      const r = rectData[i];
      const g = rectData[i + 1];
      const b = rectData[i + 2];
      const brightness = (r + g + b) / 3;
      const gray = Math.min(255, Math.max(0, brightness));
      const adjusted = Math.min(255, Math.max(0, (gray - 128) * (Number(options.contrast) || 1.6) + 128));
      const finalVal = adjusted > threshold ? 255 : 0;
      rectData[i] = finalVal;
      rectData[i + 1] = finalVal;
      rectData[i + 2] = finalVal;
    }

    outputCtx.putImageData(cropRect, 0, 0);
    const blob = await canvasToBlob(outputCanvas, 'image/png', 0.96);

    return {
      url: URL.createObjectURL(blob),
      fileName: `scanned-${file.name.replace(/\.[^/.]+$/, '')}.png`
    };
  }

  async function enhanceDocument(file, options = {}) {
    if (!file) {
      throw new Error('Please upload a document image before enhancing it.');
    }

    const dataUrl = await fileToDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The image could not be loaded.'));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);

    let sourceData = context.getImageData(0, 0, canvas.width, canvas.height);
    const threshold = Number(options.threshold) || 180;
    const contrast = Number(options.contrast) || 1.6;
    const sharpenAmount = Number(options.sharpen) || 1.2;
    const cleanup = options.cleanup !== false;

    if (options.autocrop !== false) {
      const bounds = detectDocumentBounds(sourceData.data, canvas.width, canvas.height, threshold);
      if (bounds) {
        const { x, y, width, height } = bounds;
        const cropped = document.createElement('canvas');
        cropped.width = width;
        cropped.height = height;
        cropped.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(cropped, 0, 0);
        sourceData = context.getImageData(0, 0, canvas.width, canvas.height);
      }
    }

    const pixelData = sourceData.data;
    for (let index = 0; index < pixelData.length; index += 4) {
      const brightness = (pixelData[index] + pixelData[index + 1] + pixelData[index + 2]) / 3;
      const adjusted = Math.min(255, Math.max(0, (brightness - 128) * contrast + 128));
      const gray = cleanup ? Math.min(255, Math.max(0, adjusted)) : brightness;
      const finalValue = gray > threshold ? 255 : Math.max(0, gray - 10);
      pixelData[index] = finalValue;
      pixelData[index + 1] = finalValue;
      pixelData[index + 2] = finalValue;
    }

    context.putImageData(sourceData, 0, 0);

    if (sharpenAmount > 1) {
      const sharpened = applySharpen(context, canvas.width, canvas.height, sharpenAmount);
      context.putImageData(sharpened, 0, 0);
    }

    const blob = await canvasToBlob(canvas, 'image/png', 0.95);
    return {
      url: URL.createObjectURL(blob),
      fileName: `enhanced-${file.name.replace(/\.[^/.]+$/, '')}.png`
    };
  }

  function detectDocumentBounds(data, width, height, threshold) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const index = (y * width + x) * 4;
        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
        if (brightness < threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < 0 || maxY < 0) {
      return null;
    }

    return {
      x: Math.max(0, minX - 12),
      y: Math.max(0, minY - 12),
      width: Math.min(width - Math.max(0, minX - 12), maxX - minX + 24),
      height: Math.min(height - Math.max(0, minY - 12), maxY - minY + 24)
    };
  }

  function applySharpen(context, width, height, amount) {
    const source = context.getImageData(0, 0, width, height);
    const output = new ImageData(new Uint8ClampedArray(source.data), width, height);
    const data = source.data;
    const result = output.data;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * 4;
        const neighbors = [
          data[((y - 1) * width + x) * 4], data[((y - 1) * width + x + 1) * 4], data[((y - 1) * width + x - 1) * 4],
          data[(y * width + x - 1) * 4], data[(y * width + x + 1) * 4],
          data[((y + 1) * width + x - 1) * 4], data[((y + 1) * width + x) * 4], data[((y + 1) * width + x + 1) * 4]
        ];
        const center = data[index];
        const sharpened = center * (1 + (amount - 1) * 3) - neighbors.reduce((sum, value) => sum + value, 0) * (amount - 1) / 7;
        const finalValue = Math.min(255, Math.max(0, sharpened));
        result[index] = finalValue;
        result[index + 1] = finalValue;
        result[index + 2] = finalValue;
        result[index + 3] = data[index + 3];
      }
    }

    return output;
  }

  async function ocrText(file, options = {}) {
    if (!file) {
      throw new Error('Please upload an image or PDF before running OCR.');
    }

    if (!window.Tesseract) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('OCR support could not be loaded.'));
        document.head.appendChild(script);
      });
    }

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (!window.pdfjsLib) {
        throw new Error('PDF rendering support is unavailable for OCR.');
      }

      const pdfData = await file.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
      const pageTexts = [];

      for (let i = 1; i <= doc.numPages; i += 1) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await window.Tesseract.recognize(canvas, options.language || 'eng');
        if (result && result.data && result.data.text && result.data.text.trim()) {
          pageTexts.push(`Page ${i}\n${result.data.text.trim()}`);
        }
      }

      const combined = pageTexts.join('\n\n') || 'No text was detected in this PDF.';
      return {
        type: 'text',
        value: combined,
        fileName: 'ocr-extracted-text.txt'
      };
    }

    const result = await window.Tesseract.recognize(file, options.language || 'eng', {
      logger: options.mode === 'debug' ? (message) => console.debug('[ocr]', message) : undefined
    });

    return {
      type: 'text',
      value: (result && result.data && result.data.text && result.data.text.trim()) || 'No text detected in the uploaded image.',
      fileName: `ocr-${file.name.replace(/\.[^/.]+$/, '')}.txt`
    };
  }

  window.scanQrCode = scanQrCode;
  window.scanDocument = scanDocument;
  window.enhanceDocument = enhanceDocument;
  window.ocrText = ocrText;

  function setupCameraCapture(form) {
    if (!form.dataset.tool || form.dataset.tool !== 'document-scanner') {
      return;
    }

    const toggleButton = form.querySelector('.camera-toggle');
    const captureButton = form.querySelector('.camera-capture');
    const video = form.querySelector('#scanner-camera');
    const canvas = form.querySelector('#scanner-capture-canvas');
    let stream = null;

    if (!toggleButton || !captureButton || !video || !canvas) {
      return;
    }

    const stopCamera = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      stream = null;
      if (video) {
        video.srcObject = null;
        video.hidden = true;
      }
      captureButton.hidden = true;
      toggleButton.textContent = 'Use camera';
      form.dataset.scannerCameraData = '';
    };

    toggleButton.addEventListener('click', async () => {
      if (stream) {
        stopCamera();
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFormStatus(form, 'Camera access is not supported in this browser.', true);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        video.srcObject = stream;
        video.hidden = false;
        await video.play();
        captureButton.hidden = false;
        toggleButton.textContent = 'Stop camera';
        setFormStatus(form, 'Camera is ready. Capture a document photo.', false);
      } catch (error) {
        setFormStatus(form, 'Unable to access the camera. Please upload a photo instead.', true);
      }
    });

    captureButton.addEventListener('click', () => {
      if (!stream || video.videoWidth === 0 || video.videoHeight === 0) {
        setFormStatus(form, 'Start the camera before capturing a photo.', true);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      form.dataset.scannerCameraData = canvas.toDataURL('image/png');
      setFormStatus(form, 'Photo captured. You can scan it now.', false);
    });

    const fileInput = form.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          form.dataset.scannerCameraData = '';
        }
      });
    }

    form.addEventListener('reset', stopCamera);
  }

  function setupQrCodeCameraCapture(form) {
    if (!form.dataset.tool || form.dataset.tool !== 'qr-code-scanner') {
      return;
    }

    const toggleButton = form.querySelector('.camera-toggle');
    const scanButton = form.querySelector('.camera-scan');
    const video = form.querySelector('#qr-camera');
    const canvas = form.querySelector('#qr-scan-canvas');
    let stream = null;

    if (!toggleButton || !scanButton || !video || !canvas) {
      return;
    }

    const stopCamera = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      stream = null;
      if (video) {
        video.srcObject = null;
        video.hidden = true;
      }
      toggleButton.textContent = 'Use camera';
      scanButton.hidden = true;
      form.dataset.scannerCameraData = '';
    };

    toggleButton.addEventListener('click', async () => {
      if (stream) {
        stopCamera();
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFormStatus(form, 'Camera access is not supported in this browser.', true);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        video.srcObject = stream;
        video.hidden = false;
        await video.play();
        scanButton.hidden = false;
        toggleButton.textContent = 'Stop camera';
        setFormStatus(form, 'Camera is ready. Scan the QR code.', false);
      } catch (error) {
        setFormStatus(form, 'Unable to access the camera. Please upload a QR image instead.', true);
      }
    });

    scanButton.addEventListener('click', () => {
      if (!stream || video.videoWidth === 0 || video.videoHeight === 0) {
        setFormStatus(form, 'Start the camera before scanning.', true);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      form.dataset.scannerCameraData = canvas.toDataURL('image/png');
      setFormStatus(form, 'QR capture ready. Process it now.', false);
    });

    form.addEventListener('reset', stopCamera);
  }

  function setupQrCodeForm(form) {
    setupQrCodeCameraCapture(form);
  }

  function init() {
    registerScannerHandlers();

    document.querySelectorAll('.image-tool').forEach((form) => {
      if (form.dataset.tool === 'document-scanner' || form.dataset.tool === 'qr-code-scanner') {
        setupCameraCapture(form);
        setupQrCodeForm(form);
      }
    });

    const trigger = function() {
      loadScript('/static/js/image-tools.js').then(function() {
        registerScannerHandlers();
      }).catch(function(error) {
        console.warn('[scanner-tools] shared tool bundle did not load:', error);
      });
    };

    document.addEventListener('pointerdown', function() {
      trigger();
    }, { once: true, passive: true });
    document.addEventListener('keydown', function() {
      trigger();
    }, { once: true });

    if (window.requestIdleCallback) {
      window.requestIdleCallback(trigger, { timeout: 1200 });
    } else {
      window.setTimeout(trigger, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
