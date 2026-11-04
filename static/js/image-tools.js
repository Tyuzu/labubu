document.addEventListener('DOMContentLoaded', () => {
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.querySelectorAll('.file-dropzone').forEach((dropzone) => {
    const input = dropzone.querySelector('input[type="file"]');
    const filename = dropzone.querySelector('.dropzone-filename');

    const syncFilename = () => {
      if (!input || !filename) return;
      const selectedName = input.files && input.files.length ? input.files[0].name : 'No file selected';
      filename.textContent = selectedName;
      dropzone.classList.toggle('has-file', Boolean(input.files && input.files.length));
    };

    if (input) {
      input.addEventListener('change', syncFilename);
    }

    dropzone.addEventListener('click', (event) => {
      if (event.target === input) return;
      input && input.click();
    });

    dropzone.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        input && input.click();
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (event) => {
      if (input && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        input.files = event.dataTransfer.files;
        syncFilename();
      }
    });

    syncFilename();
  });

  document.querySelectorAll('.image-tool').forEach((form) => {
    bindRangeValue(form);
    ensureStatusElement(form);
    setupCameraCapture(form);
    setupQrCodeForm(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="file"]');
      let files = input && input.files ? Array.from(input.files) : [];
      const submitButton = form.querySelector('button[type="submit"]');

      if (!form.dataset.tool) {
        return;
      }

      if (['document-scanner', 'qr-code-scanner'].includes(form.dataset.tool) && files.length === 0 && form.dataset.scannerCameraData) {
        files = [await dataUrlToFile(form.dataset.scannerCameraData, form.dataset.tool === 'qr-code-scanner' ? 'qr-code-scan.png' : 'camera-scan.png')];
      }

      if (files.length === 0 && !['image-to-base64', 'base64-to-image'].includes(form.dataset.tool)) {
        setFormStatus(form, 'Please choose a file or capture a photo first.', true);
        return;
      }

      const fileToValidate = files[0] || null;
      if (fileToValidate) {
        if (fileToValidate.size > 25 * 1024 * 1024) {
          setFormStatus(form, 'This file is too large. Please choose a file under 25MB.', true);
          return;
        }

        if (form.dataset.tool === 'qr-code-scanner' && !fileToValidate.type.startsWith('image/')) {
          setFormStatus(form, 'Please upload a valid image containing a QR code.', true);
          return;
        }
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Compressing...';
      }

      setFormStatus(form, 'Processing your file...', false);

      try {
        const result = await runTool(form.dataset.tool, form, files);
        displayResult(form, result);
        setFormStatus(form, 'Your file is ready to download.', false);
      } catch (error) {
        setFormStatus(form, error.message || 'Unable to process the file.', true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Compress another image';
        }
      }
    });
  });

  document.querySelectorAll('.base64-form').forEach((form) => {
    ensureStatusElement(form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const textarea = form.querySelector('textarea');
      const value = (textarea?.value || '').trim();

      if (!value) {
        setFormStatus(form, 'Paste a Base64 string before decoding.', true);
        return;
      }

      try {
        setFormStatus(form, 'Decoding your image...', false);
        const base64 = value.match(/^data:image\/.+;base64,/) ? value : `data:image/png;base64,${value}`;
        const preview = form.parentElement.querySelector('.tool-preview');
        const link = form.parentElement.querySelector('.download-link');

        if (preview) {
          preview.src = base64;
          preview.hidden = false;
        }

        if (link) {
          link.href = base64;
          link.download = 'decoded-image.png';
          link.hidden = false;
        }

        setFormStatus(form, 'Image decoded successfully.', false);
      } catch (error) {
        setFormStatus(form, 'The Base64 content could not be decoded.', true);
      }
    });
  });

  document.querySelectorAll('[data-copy-output]').forEach((button) => {
    button.addEventListener('click', async () => {
      const output = document.querySelector('.tool-output');
      if (!output) return;
      await navigator.clipboard.writeText(output.value);
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = 'Copy Base64';
      }, 1200);
    });
  });
});

function ensureStatusElement(form) {
  const resultBlock = form.parentElement.querySelector('.result-block') || form.parentElement;
  if (!resultBlock.querySelector('.tool-status')) {
    const status = document.createElement('p');
    status.className = 'tool-status';
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    resultBlock.appendChild(status);
  }
}

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

function setFormStatus(form, message, isError) {
  const block = form.parentElement;
  const status = block.querySelector('.tool-status');
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.style.color = isError ? '#b91c1c' : '#166534';
  status.style.fontWeight = '600';
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

function bindRangeValue(form) {
  const rangeInput = form.querySelector('input[type="range"]');
  const output = form.querySelector('[data-quality-value]');

  if (!rangeInput || !output) return;

  const updateValue = () => {
    output.textContent = Number(rangeInput.value).toFixed(2);
  };

  updateValue();
  rangeInput.addEventListener('input', updateValue);
}

async function runTool(toolName, form, files) {
  const file = files[0] || null;

  if (toolName === 'qr-code-scanner' && !window.jsQR) {
    throw new Error('QR scanning support is not available in this browser yet. Please try a modern browser or upload a clear image.');
  }

  if ((toolName === 'merge-pdf' || toolName === 'split-pdf' || toolName === 'compress-pdf' || toolName === 'jpg-to-pdf' || toolName === 'pdf-to-images' || toolName === 'rotate-pdf' || toolName === 'delete-pdf-pages' || toolName === 'extract-pdf-pages') && !window.PDFLib) {
    throw new Error('PDF support is still loading. Please wait a moment and try again.');
  }

  switch (toolName) {
    case 'compress':
      return convertImage(file, 'image/jpeg', Number(getRangeValue(form) || 0.7));
    case 'resize':
      return resizeImage(file, getNumber(form, 'resize-width', 1200), getNumber(form, 'resize-height', 800));
    case 'jpg-to-png':
      return convertImage(file, 'image/png');
    case 'png-to-jpg':
      return convertImage(file, 'image/jpeg');
    case 'webp-converter':
      return convertImage(file, 'image/webp', Number(getRangeValue(form) || 0.8));
    case 'png-to-webp':
      return convertImage(file, 'image/webp', Number(getRangeValue(form) || 0.8));
    case 'jpg-to-webp':
      return convertImage(file, 'image/webp', Number(getRangeValue(form) || 0.8));
    case 'crop':
      return cropImage(file, {
        x: getNumber(form, 'crop-x', 0),
        y: getNumber(form, 'crop-y', 0),
        width: getNumber(form, 'crop-width', 600),
        height: getNumber(form, 'crop-height', 400)
      });
    case 'rotate':
      return rotateImage(file, getNumber(form, 'rotate-angle', 90));
    case 'image-to-base64':
      return fileToBase64(file);
    case 'passport':
      return passportMaker(file, {
        width: getNumber(form, 'passport-width', 413),
        height: getNumber(form, 'passport-height', 531)
      });
    case 'document-scanner':
      return scanDocument(file, {
        threshold: Number(form.querySelector('#scanner-threshold')?.value || 180),
        padding: Number(form.querySelector('#scanner-padding')?.value || 18),
        contrast: Number(form.querySelector('#scanner-contrast')?.value || 1.6)
      });
    case 'qr-code-scanner':
      return scanQrCode(file, form);
    case 'merge-pdf':
      return mergePdf(files);
    case 'split-pdf':
      return splitPdf(file, form.querySelector('#split-range')?.value || '1-3');
    case 'compress-pdf':
      return compressPdf(file, form.querySelector('#compress-level')?.value || 'medium');
    case 'jpg-to-pdf':
      return jpgToPdf(files);
    case 'pdf-to-images':
      return pdfToImages(file, form.querySelector('#pdf-images-format')?.value || 'jpg');
    case 'rotate-pdf':
      return rotatePdf(file, Number(form.querySelector('#rotate-pdf-angle')?.value || 90));
    case 'delete-pdf-pages':
      return deletePdfPages(file, form.querySelector('#delete-page-range')?.value || '2');
    case 'extract-pdf-pages':
      return extractPdfPages(file, form.querySelector('#extract-page-range')?.value || '1-2');
    case 'video-cropper':
      return processVideoTool(file, form, 'crop', {
        x: getNumber(form, 'video-crop-x', 0),
        y: getNumber(form, 'video-crop-y', 0),
        width: getNumber(form, 'video-crop-width', 1280),
        height: getNumber(form, 'video-crop-height', 720)
      });
    case 'video-trimmer':
      return processVideoTool(file, form, 'trim', {
        start: getNumber(form, 'video-trim-start', 0),
        end: getNumber(form, 'video-trim-end', 10)
      });
    case 'video-filters':
      return processVideoTool(file, form, 'filter', {
        filter: form.querySelector('#video-filter-style')?.value || 'cinematic'
      });
    default:
      throw new Error('This tool is not implemented yet.');
  }
}

function getVideoProcessingMode(form) {
  const mode = form.querySelector('[id$="-mode"]')?.value || 'cdn';
  return mode === 'self-hosted' ? 'self-hosted' : 'cdn';
}

async function processVideoTool(file, form, action, params) {
  const mode = getVideoProcessingMode(form);
  if (mode === 'self-hosted') {
    return processVideoOnServer(file, action, params);
  }

  switch (action) {
    case 'crop':
      return cropVideo(file, params);
    case 'trim':
      return trimVideo(file, params);
    case 'filter':
      return applyVideoFilter(file, params.filter || 'cinematic');
    default:
      throw new Error('Unknown video action.');
  }
}

async function processVideoOnServer(file, action, params) {
  if (!file) {
    throw new Error('Please upload a video before processing.');
  }

  const formData = new FormData();
  formData.append('action', action);
  formData.append('video', file, file.name);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  const response = await fetch('/api/video/process', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'The self-hosted FFmpeg backend failed to process the video.');
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  const fileName = match ? match[1] : `${action}-video.mp4`;

  return {
    url: URL.createObjectURL(blob),
    fileName
  };
}

function displayResult(form, result) {
  const preview = form.parentElement.querySelector('.tool-preview');
  const downloadLink = form.parentElement.querySelector('.download-link');
  const output = form.parentElement.querySelector('.tool-output');
  const copyButton = form.parentElement.querySelector('[data-copy-output]');
  const submitButton = form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.textContent = 'Compress another image';
  }

  if (result && (result.type === 'base64' || result.type === 'text')) {
    if (output) {
      output.value = result.value;
      output.hidden = false;
    }
    if (copyButton) {
      copyButton.hidden = false;
    }
    if (downloadLink && result.fileName) {
      const blob = new Blob([String(result.value || '')], { type: result.type === 'text' ? 'text/plain;charset=utf-8' : 'text/plain;charset=utf-8' });
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = result.fileName;
      downloadLink.hidden = false;
      downloadLink.textContent = result.type === 'text' ? 'Download QR result' : 'Download Base64';
    }
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute('src');
    }
    return;
  }

  if (preview) {
    preview.src = result.url;
    preview.hidden = false;
  }

  if (downloadLink) {
    downloadLink.href = result.url;
    downloadLink.download = result.fileName;
    downloadLink.hidden = false;
    const fileExtension = (result.fileName || '').split('.').pop()?.toLowerCase();
    if (fileExtension === 'zip') {
      downloadLink.textContent = 'Download images archive';
    } else if (fileExtension === 'pdf') {
      downloadLink.textContent = 'Download PDF';
    } else {
      downloadLink.textContent = 'Download processed file';
    }
  }

  if (output) {
    output.hidden = true;
  }

  if (copyButton) {
    copyButton.hidden = true;
  }
}

function getRangeValue(form) {
  const range = form.querySelector('input[type="range"]');
  return range ? Number(range.value) : 0.8;
}

function getNumber(form, id, fallback) {
  const field = form.querySelector(`#${id}`);
  const value = field ? Number(field.value) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

async function readImage(file) {
  const dataUrl = await fileToDataUrl(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be loaded.'));
    image.src = dataUrl;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, fileName) {
  const [header, content] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(content);
  const array = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    array[index] = binary.charCodeAt(index);
  }

  return new File([array], fileName, { type: mime, lastModified: Date.now() });
}

async function fileToBase64(file) {
  const value = await fileToDataUrl(file);
  return { type: 'base64', value: value };
}

async function convertImage(file, format, quality = 0.8) {
  const image = await readImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);

  const blob = await canvasToBlob(canvas, format, quality);
  return {
    url: URL.createObjectURL(blob),
    fileName: `${getBaseName(file.name)}.${formatToExtension(format)}`
  };
}

async function resizeImage(file, width, height) {
  const image = await readImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  const format = file.type.includes('png') ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, format, 0.9);
  return {
    url: URL.createObjectURL(blob),
    fileName: `resized-${getBaseName(file.name)}.${formatToExtension(format)}`
  };
}

async function cropImage(file, options) {
  const image = await readImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;

  const context = canvas.getContext('2d');
  context.drawImage(image, options.x, options.y, options.width, options.height, 0, 0, options.width, options.height);

  const blob = await canvasToBlob(canvas, 'image/png', 0.9);
  return {
    url: URL.createObjectURL(blob),
    fileName: `cropped-${getBaseName(file.name)}.png`
  };
}

async function rotateImage(file, angle) {
  const image = await readImage(file);
  const radians = (angle * Math.PI) / 180;
  const canvas = document.createElement('canvas');
  const rotatedWidth = Math.abs(Math.cos(radians)) * image.width + Math.abs(Math.sin(radians)) * image.height;
  const rotatedHeight = Math.abs(Math.sin(radians)) * image.width + Math.abs(Math.cos(radians)) * image.height;
  canvas.width = Math.ceil(rotatedWidth);
  canvas.height = Math.ceil(rotatedHeight);

  const context = canvas.getContext('2d');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  const blob = await canvasToBlob(canvas, 'image/png', 0.9);
  return {
    url: URL.createObjectURL(blob),
    fileName: `rotated-${getBaseName(file.name)}.png`
  };
}

async function passportMaker(file, options) {
  const image = await readImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;

  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const maxWidth = canvas.width * 0.72;
  const maxHeight = canvas.height * 0.72;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  const x = (canvas.width - drawWidth) / 2;
  const y = (canvas.height - drawHeight) / 2;

  context.drawImage(image, x, y, drawWidth, drawHeight);

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return {
    url: URL.createObjectURL(blob),
    fileName: `passport-photo-${getBaseName(file.name)}.jpg`
  };
}

async function scanQrCode(file, form) {
  if (!file) {
    throw new Error('Please upload a QR code image or use the camera first.');
  }

  if (!window.jsQR) {
    throw new Error('QR scanning support is not available in this browser yet.');
  }

  const image = await readImage(file);
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
    preview.src = fileToDataUrl ? await fileToDataUrl(file) : URL.createObjectURL(file);
    preview.hidden = false;
  }

  return {
    type: 'text',
    value: code.data,
    fileName: 'qr-code-result.txt'
  };
}

async function scanDocument(file, options = {}) {
  const image = await readImage(file);
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
    fileName: `scanned-${getBaseName(file.name)}.png`
  };
}

async function mergePdf(files) {
  if (!window.PDFLib || files.length < 2) {
    throw new Error('Please choose at least two PDF files to merge.');
  }

  const mergedPdf = await window.PDFLib.PDFDocument.create();

  for (const file of files) {
    const sourcePdf = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  const bytes = await mergedPdf.save();
  return createDownloadResult(bytes, 'merged.pdf');
}

async function splitPdf(file, rangeText) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before splitting.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const indices = parseRange(rangeText, source.getPageCount());
  const result = await window.PDFLib.PDFDocument.create();

  const pages = await result.copyPages(source, indices);
  pages.forEach((page) => result.addPage(page));

  const bytes = await result.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-split.pdf`);
}

async function compressPdf(file, level) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before compressing.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const saveOptions = {
    useObjectStreams: level === 'high'
  };
  const bytes = await source.save(saveOptions);
  return createDownloadResult(bytes, `${getBaseName(file.name)}-compressed.pdf`);
}

async function jpgToPdf(files) {
  if (!window.PDFLib || files.length === 0) {
    throw new Error('Please choose at least one JPG image.');
  }

  const pdf = await window.PDFLib.PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const image = await pdf.embedJpg(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height
    });
  }

  const bytes = await pdf.save();
  return createDownloadResult(bytes, 'converted-images.pdf');
}

async function pdfToImages(file, format) {
  if (!window.pdfjsLib || !file) {
    throw new Error('PDF rendering support is unavailable.');
  }

  const pdfData = await file.arrayBuffer();
  const doc = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
  const zip = new JSZip();

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await canvasToBlob(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.9);
    zip.file(`page-${i}.${format === 'png' ? 'png' : 'jpg'}`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return createDownloadResult(zipBlob, `${getBaseName(file.name)}-pages.zip`);
}

async function rotatePdf(file, angle) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before rotating.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const pages = source.getPages();
  pages.forEach((page) => {
    page.setRotation(window.PDFLib.degrees(angle));
  });

  const bytes = await source.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-rotated.pdf`);
}

async function deletePdfPages(file, rangeText) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before deleting pages.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const removeSet = new Set(parseRange(rangeText, source.getPageCount()));
  const result = await window.PDFLib.PDFDocument.create();

  const pages = await result.copyPages(source, source.getPageIndices().filter((idx) => !removeSet.has(idx)));
  pages.forEach((page) => result.addPage(page));

  const bytes = await result.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-edited.pdf`);
}

async function extractPdfPages(file, rangeText) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before extracting pages.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const indices = parseRange(rangeText, source.getPageCount());
  const result = await window.PDFLib.PDFDocument.create();

  const pages = await result.copyPages(source, indices);
  pages.forEach((page) => result.addPage(page));

  const bytes = await result.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-extracted.pdf`);
}

function parseRange(rangeText, totalPages) {
  if (!rangeText || !rangeText.trim()) {
    return [0];
  }

  const values = new Set();
  rangeText.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    if (trimmed.includes('-')) {
      const [startText, endText] = trimmed.split('-');
      const start = Math.max(0, Number(startText) - 1);
      const end = Math.max(start, Number(endText) - 1);
      for (let i = start; i <= end; i += 1) {
        values.add(i);
      }
      return;
    }

    const value = Math.max(0, Number(trimmed) - 1);
    values.add(value);
  });

  return Array.from(values).filter((value) => value >= 0 && value < totalPages);
}

function createDownloadResult(blob, fileName) {
  return {
    type: 'blob',
    url: URL.createObjectURL(blob),
    fileName
  };
}

let ffmpegInstance = null;
let ffmpegUtil = null;

async function getFFmpeg() {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  const [{ FFmpeg }, utilModule] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js'),
    import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.10/dist/esm/index.js')
  ]);

  ffmpegUtil = utilModule;

  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    if (message && typeof console !== 'undefined') {
      console.debug('[ffmpeg]', message);
    }
  });

  await ffmpeg.load({
    coreURL: await ffmpegUtil.toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await ffmpegUtil.toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm', 'application/wasm')
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function runVideoFFmpeg(file, args, outputName) {
  if (!file) {
    throw new Error('Please upload a video before processing.');
  }

  const ffmpeg = await getFFmpeg();
  const extension = getFileExtension(file.name);
  const inputName = `input.${extension}`;

  await ffmpeg.writeFile(inputName, await ffmpegUtil.fetchFile(file));
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);

  return new Blob([data.buffer], { type: 'video/mp4' });
}

async function cropVideo(file, options) {
  const width = Math.max(1, Number(options.width) || 1280);
  const height = Math.max(1, Number(options.height) || 720);
  const x = Math.max(0, Number(options.x) || 0);
  const y = Math.max(0, Number(options.y) || 0);

  const inputName = `input.${getFileExtension(file.name)}`;
  const outputName = `cropped-${Date.now()}.mp4`;
  const blob = await runVideoFFmpeg(file, [
    '-i', inputName,
    '-vf', `crop=${width}:${height}:${x}:${y}`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputName
  ], outputName);

  return createDownloadResult(blob, `${getBaseName(file.name)}-cropped.mp4`);
}

async function trimVideo(file, options) {
  const start = Math.max(0, Number(options.start) || 0);
  const end = Math.max(start + 0.1, Number(options.end) || 10);

  const inputName = `input.${getFileExtension(file.name)}`;
  const outputName = `trimmed-${Date.now()}.mp4`;
  const blob = await runVideoFFmpeg(file, [
    '-i', inputName,
    '-ss', String(start),
    '-to', String(end),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputName
  ], outputName);

  return createDownloadResult(blob, `${getBaseName(file.name)}-trimmed.mp4`);
}

async function applyVideoFilter(file, preset) {
  const presetMap = {
    cinematic: 'eq=contrast=1.15:saturation=1.35:brightness=0.04',
    warm: 'eq=contrast=1.1:saturation=1.4:brightness=0.08',
    cool: 'eq=contrast=1.2:saturation=0.95:brightness=-0.03',
    vintage: 'eq=contrast=1.35:saturation=0.8:brightness=0.06',
    contrast: 'eq=contrast=1.6:saturation=1.2:brightness=0.02'
  };

  const filter = presetMap[preset] || presetMap.cinematic;
  const inputName = `input.${getFileExtension(file.name)}`;
  const outputName = `filtered-${Date.now()}.mp4`;
  const blob = await runVideoFFmpeg(file, [
    '-i', inputName,
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputName
  ], outputName);

  return createDownloadResult(blob, `${getBaseName(file.name)}-filtered.mp4`);
}

function getFileExtension(name) {
  if (!name) return 'mp4';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'mp4';
}

function canvasToBlob(canvas, format, quality = 0.8) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to generate the output file.'));
        return;
      }
      resolve(blob);
    }, format, quality);
  });
}

function getBaseName(name) {
  const cleaned = name.split('.');
  cleaned.pop();
  return cleaned.join('.') || 'image';
}

function formatToExtension(format) {
  if (format === 'image/png') return 'png';
  if (format === 'image/webp') return 'webp';
  return 'jpg';
}
