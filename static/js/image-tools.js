const workflowState = {
  queue: [],
  history: [],
  redo: [],
  processing: false
};

function getWorkflowStorageKey() {
  return 'imigi-workflow-history';
}

function readWorkflowHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(getWorkflowStorageKey()) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function persistWorkflowHistory() {
  try {
    localStorage.setItem(getWorkflowStorageKey(), JSON.stringify(workflowState.history.slice(0, 10)));
  } catch (error) {
    console.warn('[workflow] unable to store history', error);
  }
}

function formatToolLabel(toolName) {
  const labels = {
    'compress': 'Image compression',
    'resize': 'Image resize',
    'jpg-to-png': 'JPG to PNG',
    'png-to-jpg': 'PNG to JPG',
    'webp-converter': 'Image conversion',
    'png-to-webp': 'PNG to WebP',
    'jpg-to-webp': 'JPG to WebP',
    'crop': 'Image crop',
    'rotate': 'Image rotate',
    'passport': 'Passport photo',
    'document-scanner': 'Document scan',
    'document-enhancer': 'Document enhancement',
    'ocr-text': 'OCR text extraction',
    'qr-code-scanner': 'QR scan',
    'merge-pdf': 'PDF merge',
    'split-pdf': 'PDF split',
    'compress-pdf': 'PDF compress',
    'jpg-to-pdf': 'JPG to PDF',
    'pdf-to-images': 'PDF to images',
    'rotate-pdf': 'PDF rotate',
    'delete-pdf-pages': 'Delete PDF pages',
    'extract-pdf-pages': 'Extract PDF pages',
    'video-cropper': 'Video crop',
    'video-trimmer': 'Video trim',
    'video-filters': 'Video filter'
  };

  return labels[toolName] || 'Tool action';
}

function initializeWorkflowUI() {
  if (document.getElementById('imigi-workflow-panel')) {
    renderWorkflowPanel();
    return;
  }

  const panel = document.createElement('aside');
  panel.id = 'imigi-workflow-panel';
  panel.className = 'workflow-panel';
  panel.innerHTML = [
    '<div class="workflow-panel__header">',
    '  <div>',
    '    <span class="workflow-eyebrow">Workflow</span>',
    '    <h3>Queue, history, and exports</h3>',
    '  </div>',
    '  <div class="workflow-actions">',
    '    <button type="button" class="ui-button ui-button--secondary" data-workflow-action="undo">Undo</button>',
    '    <button type="button" class="ui-button ui-button--secondary" data-workflow-action="redo">Redo</button>',
    '  </div>',
    '</div>',
    '<div class="workflow-stack">',
    '  <div class="workflow-group">',
    '    <h4>Queue</h4>',
    '    <ul id="imigi-workflow-queue" class="workflow-list workflow-list--queue"></ul>',
    '  </div>',
    '  <div class="workflow-group">',
    '    <h4>Recent history</h4>',
    '    <ul id="imigi-workflow-history" class="workflow-list workflow-list--history"></ul>',
    '  </div>',
    '</div>'
  ].join('');

  const target = document.querySelector('main.container');
  if (target) {
    target.insertBefore(panel, target.firstChild);
  }

  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workflow-action]');
    if (!button) return;
    const action = button.dataset.workflowAction;
    if (action === 'undo') {
      const form = document.querySelector('.image-tool.active-history') || document.querySelector('.image-tool');
      if (form) {
        undoWorkflowLatest(form);
      }
      return;
    }
    if (action === 'redo') {
      const form = document.querySelector('.image-tool.active-history') || document.querySelector('.image-tool');
      if (form) {
        redoWorkflowLatest(form);
      }
    }
  });

  renderWorkflowPanel();
}

function renderWorkflowPanel() {
  const panel = document.getElementById('imigi-workflow-panel');
  if (!panel) return;

  const queueList = document.getElementById('imigi-workflow-queue');
  const historyList = document.getElementById('imigi-workflow-history');
  if (!queueList || !historyList) return;

  queueList.innerHTML = workflowState.queue.length
    ? workflowState.queue.map((job) => '<li><span>' + (job.label || 'Queued job') + '</span><small>' + (job.status || 'Queued') + '</small></li>').join('')
    : '<li class="workflow-empty"><span>No jobs queued</span><small>Waiting for your next upload</small></li>';

  historyList.innerHTML = workflowState.history.length
    ? workflowState.history.slice(0, 5).map((item) => '<li><button type="button" data-restore-history="' + item.id + '"><span>' + (item.label || item.fileName || 'Recent result') + '</span><small>' + (item.fileName || 'Output') + '</small></button></li>').join('')
    : '<li class="workflow-empty"><span>No recent history</span><small>Your last edits will appear here</small></li>';

  historyList.querySelectorAll('[data-restore-history]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = workflowState.history.find((entry) => String(entry.id) === button.dataset.restoreHistory);
      if (!item) return;
      const form = document.querySelector('.image-tool');
      if (!form) return;
      form.classList.add('active-history');
      restoreWorkflowHistory(form, item);
    });
  });
}

function queueWorkflowJob(label, task) {
  return new Promise((resolve, reject) => {
    workflowState.queue.push({
      id: Date.now() + Math.random(),
      label,
      status: 'Queued',
      task,
      resolve,
      reject
    });
    renderWorkflowPanel();
    processWorkflowQueue();
  });
}

async function processWorkflowQueue() {
  if (workflowState.processing || !workflowState.queue.length) {
    renderWorkflowPanel();
    return;
  }

  workflowState.processing = true;
  const current = workflowState.queue.shift();
  if (current) {
    current.status = 'Running';
    renderWorkflowPanel();
    try {
      const result = await current.task();
      current.resolve(result);
    } catch (error) {
      current.reject(error);
    } finally {
      renderWorkflowPanel();
    }
  }

  workflowState.processing = false;
  if (workflowState.queue.length) {
    processWorkflowQueue();
  }
}

function restoreWorkflowHistory(form, item) {
  const preview = form.parentElement.querySelector('.tool-preview');
  const downloadLink = form.parentElement.querySelector('.download-link');
  const output = form.parentElement.querySelector('.tool-output');
  const copyButton = form.parentElement.querySelector('[data-copy-output]');

  if (downloadLink) {
    downloadLink.href = item.url;
    downloadLink.download = item.fileName;
    downloadLink.hidden = false;
    downloadLink.textContent = item.fileName && item.fileName.toLowerCase().endsWith('.zip') ? 'Download ZIP archive' : 'Download processed file';
  }

  if (preview) {
    preview.src = item.url;
    preview.hidden = false;
  }

  if (output) {
    output.hidden = true;
  }

  if (copyButton) {
    copyButton.hidden = true;
  }

  setFormStatus(form, 'Restored a recent result from history.', false);
}

function undoWorkflowLatest(form) {
  if (workflowState.history.length < 2) {
    setFormStatus(form, 'There is no earlier result to undo.', false);
    return;
  }

  const current = workflowState.history.shift();
  workflowState.redo.unshift(current);
  const previous = workflowState.history[0];
  persistWorkflowHistory();
  renderWorkflowPanel();

  if (previous) {
    restoreWorkflowHistory(form, previous);
    return;
  }

  setFormStatus(form, 'Undo complete. Nothing earlier is available.', false);
}

function redoWorkflowLatest(form) {
  if (!workflowState.redo.length) {
    setFormStatus(form, 'There is no redo item ready.', false);
    return;
  }

  const item = workflowState.redo.shift();
  workflowState.history.unshift(item);
  persistWorkflowHistory();
  renderWorkflowPanel();
  restoreWorkflowHistory(form, item);
}

function recordWorkflowHistory(entry) {
  if (!entry || !entry.fileName || !entry.url) {
    return;
  }

  const nextEntry = {
    id: Date.now() + Math.random(),
    label: entry.label || entry.fileName,
    fileName: entry.fileName,
    url: entry.url,
    createdAt: Date.now()
  };

  workflowState.history = [nextEntry].concat(workflowState.history.filter((item) => !(item.url === nextEntry.url && item.fileName === nextEntry.fileName))).slice(0, 8);
  workflowState.redo = [];
  persistWorkflowHistory();
  renderWorkflowPanel();
}

function canProcessBatch(toolName) {
  return ['compress', 'resize', 'jpg-to-png', 'png-to-jpg', 'webp-converter', 'png-to-webp', 'jpg-to-webp', 'crop', 'rotate'].includes(toolName);
}

async function createBatchZip(fileLabel, results) {
  if (!window.JSZip || !results || results.length === 0) {
    return null;
  }

  const zip = new JSZip();
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const name = (result && result.fileName) || 'result-' + (index + 1) + '.bin';
    if (!result || !result.url) {
      continue;
    }
    const blob = await fetch(result.url).then((response) => response.blob());
    zip.file(name, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    type: 'blob',
    url: URL.createObjectURL(zipBlob),
    fileName: (fileLabel || 'batch-export') + '.zip',
    isZip: true
  };
}

async function processBatchTool(form, files) {
  const toolName = form.dataset.tool;
  if (!canProcessBatch(toolName) || files.length < 2) {
    return runTool(toolName, form, files);
  }

  const results = [];
  for (const file of files) {
    const result = await queueWorkflowJob(formatToolLabel(toolName) + ' · ' + file.name, () => runTool(toolName, form, [file]));
    results.push(result);
  }

  const zipResult = await createBatchZip((form.dataset.tool || 'batch-export').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'batch-export', results);
  return zipResult || results[0];
}

document.addEventListener('DOMContentLoaded', () => {
  workflowState.history = readWorkflowHistory();
  initializeWorkflowUI();

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
        submitButton.textContent = 'Queued...';
      }

      setFormStatus(form, files.length > 1 ? 'Queuing your batch for processing...' : 'Processing your file...', false);

      try {
        const result = await queueWorkflowJob(formatToolLabel(form.dataset.tool), () => {
          if (files.length > 1 && canProcessBatch(form.dataset.tool)) {
            return processBatchTool(form, files);
          }
          return runTool(form.dataset.tool, form, files);
        });

        displayResult(form, result);
        recordWorkflowHistory({
          label: formatToolLabel(form.dataset.tool),
          fileName: result && result.fileName ? result.fileName : 'result-file',
          url: result && result.url ? result.url : ''
        });
        setFormStatus(form, files.length > 1 ? 'Your batch is ready to download.' : 'Your file is ready to download.', false);
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
    case 'document-enhancer':
      return enhanceDocument(file, {
        threshold: Number(form.querySelector('#doc-enhance-threshold')?.value || 180),
        contrast: Number(form.querySelector('#doc-enhance-contrast')?.value || 1.6),
        sharpen: Number(form.querySelector('#doc-enhance-sharpen')?.value || 1.2),
        cleanup: Boolean(form.querySelector('#doc-enhance-cleanup')?.checked ?? true),
        autocrop: Boolean(form.querySelector('#doc-enhance-autocrop')?.checked ?? true)
      });
    case 'ocr-text':
      return ocrText(file, {
        language: form.querySelector('#ocr-language')?.value || 'eng',
        mode: form.querySelector('#ocr-mode')?.value || 'document'
      });
    case 'qr-code-scanner':
      return scanQrCode(file, form);
    case 'merge-pdf':
      return processPdfTool(files, form, 'merge');
    case 'split-pdf':
      return processPdfTool(file, form, 'split', { range: form.querySelector('#split-range')?.value || '1-3' });
    case 'compress-pdf':
      return processPdfTool(file, form, 'compress', { level: form.querySelector('#compress-level')?.value || 'medium' });
    case 'jpg-to-pdf':
      return processPdfTool(files, form, 'jpg-to-pdf');
    case 'pdf-to-images':
      return processPdfTool(file, form, 'pdf-to-images', { format: form.querySelector('#pdf-images-format')?.value || 'jpg' });
    case 'rotate-pdf':
      return processPdfTool(file, form, 'rotate', { angle: Number(form.querySelector('#rotate-pdf-angle')?.value || 90) });
    case 'delete-pdf-pages':
      return processPdfTool(file, form, 'delete-pages', { range: form.querySelector('#delete-page-range')?.value || '2' });
    case 'extract-pdf-pages':
      return processPdfTool(file, form, 'extract-pages', { range: form.querySelector('#extract-page-range')?.value || '1-2' });
    case 'pdf-page-editor': {
      const action = form.querySelector('#pdf-editor-action')?.value || 'reorder-pages';
      if (action === 'watermark') {
        return processPdfTool(file, form, 'watermark', {
          text: form.querySelector('#pdf-watermark-text')?.value || 'Imigi',
          size: Number(form.querySelector('#pdf-watermark-size')?.value || 28)
        });
      }
      if (action === 'page-numbers') {
        return processPdfTool(file, form, 'page-numbers', {
          text: form.querySelector('#pdf-page-number-text')?.value || 'Page {n}',
          size: Number(form.querySelector('#pdf-page-number-size')?.value || 14)
        });
      }
      if (action === 'rotate-selected-pages') {
        return processPdfTool(file, form, 'rotate-selected-pages', {
          range: form.querySelector('#pdf-rotate-range')?.value || '1,3',
          angle: Number(form.querySelector('#pdf-rotate-angle')?.value || 90)
        });
      }
      return processPdfTool(file, form, 'reorder-pages', {
        range: form.querySelector('#pdf-reorder-range')?.value || '2,1'
      });
    }
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

async function processPdfTool(input, form, action, params = {}) {
  try {
    if (Array.isArray(input)) {
      if (action === 'merge') {
        return mergePdf(input);
      }
      if (action === 'jpg-to-pdf') {
        return jpgToPdf(input);
      }
      throw new Error('Unsupported PDF action in browser runtime.');
    }

    if (input && action === 'split') {
      return splitPdf(input, params.range || '1-3');
    }
    if (input && action === 'compress') {
      return compressPdf(input, params.level || 'medium');
    }
    if (input && action === 'pdf-to-images') {
      return pdfToImages(input, params.format || 'jpg');
    }
    if (input && action === 'rotate') {
      return rotatePdf(input, Number(params.angle || 90));
    }
    if (input && action === 'delete-pages') {
      return deletePdfPages(input, params.range || '2');
    }
    if (input && action === 'extract-pages') {
      return extractPdfPages(input, params.range || '1-2');
    }
    if (input && action === 'reorder-pages') {
      return reorderPdfPages(input, params.range || '2,1');
    }
    if (input && action === 'watermark') {
      return watermarkPdf(input, params);
    }
    if (input && action === 'page-numbers') {
      return addPageNumbers(input, params);
    }
    if (input && action === 'rotate-selected-pages') {
      return rotateSelectedPdfPages(input, params.range || '1', Number(params.angle || 90));
    }

    throw new Error('Unsupported PDF action in browser runtime.');
  } catch (error) {
    console.warn('[pdf] Browser PDF processing failed, falling back to backend:', error);

    if (!input) {
      throw error;
    }

    const formData = new FormData();
    formData.append('action', action);

    if (Array.isArray(input)) {
      input.forEach((file) => {
        if (file) formData.append('pdfs', file, file.name);
      });
    } else {
      formData.append('pdf', input, input.name);
    }

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await fetch('/api/pdf/process', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'The server-side PDF backend could not complete this action.');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    const fileName = match ? match[1] : 'processed.pdf';

    return {
      url: URL.createObjectURL(blob),
      fileName,
      type: 'blob'
    };
  }
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

  if (result && result.isZip) {
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute('src');
    }
    if (downloadLink) {
      downloadLink.href = result.url;
      downloadLink.download = result.fileName;
      downloadLink.hidden = false;
      downloadLink.textContent = 'Download ZIP archive';
    }
    if (output) {
      output.hidden = true;
    }
    if (copyButton) {
      copyButton.hidden = true;
    }
    return;
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

async function enhanceDocument(file, options = {}) {
  if (!file) {
    throw new Error('Please upload a document image before enhancing it.');
  }

  const image = await readImage(file);
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
    const r = pixelData[index];
    const g = pixelData[index + 1];
    const b = pixelData[index + 2];
    const brightness = (r + g + b) / 3;
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
    fileName: `enhanced-${getBaseName(file.name)}.png`
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
    fileName: `ocr-${getBaseName(file.name)}.txt`
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

async function reorderPdfPages(file, rangeText) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before reordering pages.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const order = parseExplicitOrder(rangeText, source.getPageCount());
  const result = await window.PDFLib.PDFDocument.create();
  const pages = await result.copyPages(source, order);
  pages.forEach((page) => result.addPage(page));

  const bytes = await result.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-reordered.pdf`);
}

async function watermarkPdf(file, options = {}) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before adding a watermark.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const text = options.text || 'Imigi';
  const size = Number(options.size) || 28;
  const pages = source.getPages();

  pages.forEach((page) => {
    const width = page.getWidth();
    const height = page.getHeight();
    page.drawText(text, {
      x: width / 2 - 80,
      y: height / 2 - 20,
      size,
      rotate: window.PDFLib.degrees(-45),
      opacity: 0.2,
      color: window.PDFLib.rgb(0.35, 0.4, 0.8)
    });
  });

  const bytes = await source.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-watermarked.pdf`);
}

async function addPageNumbers(file, options = {}) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before adding page numbers.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const pages = source.getPages();
  const template = options.text || 'Page {n}';
  const size = Number(options.size) || 12;

  pages.forEach((page, index) => {
    const width = page.getWidth();
    const height = page.getHeight();
    page.drawText(template.replace('{n}', String(index + 1)), {
      x: width / 2 - 35,
      y: 20,
      size,
      color: window.PDFLib.rgb(0.2, 0.2, 0.2)
    });
  });

  const bytes = await source.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-numbered.pdf`);
}

async function rotateSelectedPdfPages(file, rangeText, angle) {
  if (!window.PDFLib || !file) {
    throw new Error('Please upload a PDF before rotating selected pages.');
  }

  const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  const set = new Set(parseRange(rangeText, source.getPageCount()));
  const pages = source.getPages();

  pages.forEach((page, index) => {
    if (set.has(index)) {
      page.setRotation(window.PDFLib.degrees(Number(angle) || 90));
    }
  });

  const bytes = await source.save();
  return createDownloadResult(bytes, `${getBaseName(file.name)}-rotated-pages.pdf`);
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

function parseExplicitOrder(rangeText, totalPages) {
  if (!rangeText || !rangeText.trim()) {
    return [0];
  }

  const values = [];
  const seen = new Set();

  rangeText.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (trimmed.includes('-')) {
      const [startText, endText] = trimmed.split('-');
      const start = Math.max(1, Number(startText));
      const end = Math.max(start, Number(endText));
      for (let i = start; i <= end; i += 1) {
        if (!seen.has(i)) {
          seen.add(i);
          values.push(i - 1);
        }
      }
      return;
    }

    const value = Math.max(1, Number(trimmed));
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value - 1);
    }
  });

  if (!values.length) {
    return [0];
  }

  return values.filter((value) => value >= 0 && value < totalPages);
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

async function runVideoFFmpeg(file, args, outputName, outputFormat) {
  if (!file) {
    throw new Error('Please upload a video before processing.');
  }

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

async function cropVideo(file, options) {
  const width = Math.max(1, Number(options.width) || 1280);
  const height = Math.max(1, Number(options.height) || 720);
  const x = Math.max(0, Number(options.x) || 0);
  const y = Math.max(0, Number(options.y) || 0);
  const outputFormat = resolveVideoOutputExtension(options.format);

  const inputName = `input.${getFileExtension(file.name)}`;
  const outputName = `cropped-${Date.now()}.${outputFormat}`;
  const blob = await runVideoFFmpeg(file, [
    '-i', inputName,
    '-vf', `crop=${width}:${height}:${x}:${y}`,
    '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264',
    '-preset', 'veryfast',
    '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac',
    '-movflags', '+faststart',
    outputName
  ], outputName, outputFormat);

  return createDownloadResult(blob, `${getBaseName(file.name)}-cropped.${outputFormat}`);
}

async function trimVideo(file, options) {
  const start = Math.max(0, Number(options.start) || 0);
  const end = Math.max(start + 0.1, Number(options.end) || 10);
  const outputFormat = resolveVideoOutputExtension(options.format);

  const inputName = `input.${getFileExtension(file.name)}`;
  const outputName = `trimmed-${Date.now()}.${outputFormat}`;
  const blob = await runVideoFFmpeg(file, [
    '-i', inputName,
    '-ss', String(start),
    '-to', String(end),
    '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264',
    '-preset', 'veryfast',
    '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac',
    '-movflags', '+faststart',
    outputName
  ], outputName, outputFormat);

  return createDownloadResult(blob, `${getBaseName(file.name)}-trimmed.${outputFormat}`);
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
    noir: 'curves=r=' + '0.2' + ':' + '0.4' + ':1.0/0.0:1.0, curves=g=' + '0.2' + ':' + '0.4' + ':1.0/0.0:1.0, curves=b=' + '0.2' + ':' + '0.4' + ':1.0/0.0:1.0',
    sharp: 'unsharp=5:5:1.2:5:5:0.8',
    sunset: 'eq=contrast=1.25:saturation=1.5:brightness=0.09',
    dreamy: 'eq=contrast=1.08:saturation=1.1:brightness=0.08'
  };

  const filter = presetMap[preset] || presetMap.cinematic;
  const outputFormat = resolveVideoOutputExtension(format);
  const inputName = `input.${getFileExtension(file.name)}`;
  const outputName = `filtered-${Date.now()}.${outputFormat}`;
  const blob = await runVideoFFmpeg(file, [
    '-i', inputName,
    '-vf', filter,
    '-c:v', outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264',
    '-preset', 'veryfast',
    '-c:a', outputFormat === 'webm' ? 'libopus' : 'aac',
    '-movflags', '+faststart',
    outputName
  ], outputName, outputFormat);

  return createDownloadResult(blob, `${getBaseName(file.name)}-filtered.${outputFormat}`);
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
