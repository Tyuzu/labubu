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

window.imigiToolHandlers = window.imigiToolHandlers || {};

function invokeSpecializedTool(toolName, form, files) {
  const handler = window.imigiToolHandlers && window.imigiToolHandlers[toolName];
  if (typeof handler !== 'function') {
    return null;
  }

  return handler(form, files);
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
    '    <button type="button" class="ui-button" data-workflow-action="export-all">Export all</button>',
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
      return;
    }
    if (action === 'export-all') {
      exportAllWorkflowAssets();
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

async function exportAllWorkflowAssets() {
  if (!workflowState.history.length) {
    return;
  }

  const history = workflowState.history.filter((entry) => entry && entry.url && entry.fileName);
  if (!history.length) {
    return;
  }

  const zipResult = await createBatchZip('all-processed-assets', history);
  if (!zipResult) {
    return;
  }

  const link = document.createElement('a');
  link.href = zipResult.url;
  link.download = zipResult.fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  return ['compress', 'resize', 'jpg-to-png', 'png-to-jpg', 'webp-converter', 'png-to-webp', 'jpg-to-webp', 'crop', 'rotate', 'batch-image-converter'].includes(toolName);
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
    if (form.dataset.imigiLoaded === 'true') return;
    form.dataset.imigiLoaded = 'true';
    bindRangeValue(form);
    ensureStatusElement(form);

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
        const isVideoTool = String(form.dataset.tool || '').startsWith('video-');
        const maxBytes = isVideoTool ? 250 * 1024 * 1024 : 25 * 1024 * 1024;
        if (fileToValidate.size > maxBytes) {
          setFormStatus(form, `This file is too large. Please choose a file under ${isVideoTool ? '250MB' : '25MB'}.`, true);
          return;
        }

        if (isVideoTool && fileToValidate.type && !fileToValidate.type.startsWith('video/')) {
          setFormStatus(form, 'Please upload a valid video file.', true);
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

function setFormStatus(form, message, isError) {
  const block = form.parentElement;
  const status = block.querySelector('.tool-status');
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.style.color = isError ? '#b91c1c' : '#166534';
  status.style.fontWeight = '600';
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
  const specializedResult = invokeSpecializedTool(toolName, form, files);
  if (specializedResult !== null) {
    return specializedResult;
  }

  const file = files[0] || null;

  if (toolName === 'qr-code-scanner' && !window.jsQR) {
    throw new Error('QR scanning support is not available in this browser yet. Please try a modern browser or upload a clear image.');
  }

  if ((toolName === 'merge-pdf' || toolName === 'split-pdf' || toolName === 'compress-pdf' || toolName === 'jpg-to-pdf' || toolName === 'pdf-to-images' || toolName === 'rotate-pdf' || toolName === 'delete-pdf-pages' || toolName === 'extract-pdf-pages') && !window.PDFLib) {
    throw new Error('PDF support is still loading. Please wait a moment and try again.');
  }

  switch (toolName) {
    case 'batch-image-converter':
      return batchConvertImages(form, files);
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
    default:
      throw new Error('This tool is not implemented yet.');
  }
}

async function batchConvertImages(form, files) {
  if (!files || !files.length) {
    throw new Error('Choose at least one image to convert.');
  }

  const format = (form.querySelector('#batch-image-format')?.value || 'png').toLowerCase();
  const extension = format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';
  const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const results = await Promise.all(files.map((file) => convertImage(file, mimeType, Number(form.querySelector('#batch-image-quality')?.value || 0.9))));
  const zipResult = await createBatchZip('batch-image-conversion', results);
  return zipResult || results[0];
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
    } else if (form.dataset.tool === 'video-filters') {
      downloadLink.textContent = 'Download filtered video';
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

function initializeDynamicallyLoadedTools() {
  workflowState.history = readWorkflowHistory();
  initializeWorkflowUI();

  document.querySelectorAll('.image-tool').forEach((form) => {
    if (form.dataset.imigiLoaded === 'true') return;
    form.dataset.imigiLoaded = 'true';
    bindRangeValue(form);
    ensureStatusElement(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="file"]');
      const files = input && input.files ? Array.from(input.files) : [];
      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton ? submitButton.textContent : '';

      if (!files.length && !['image-to-base64', 'base64-to-image'].includes(form.dataset.tool)) {
        setFormStatus(form, 'Please choose a video or image file first.', true);
        return;
      }

      const file = files[0];
      if (file) {
        const isVideo = String(form.dataset.tool || '').startsWith('video-');
        const maxBytes = isVideo ? 250 * 1024 * 1024 : 25 * 1024 * 1024;
        if (file.size > maxBytes) {
          setFormStatus(form, `This file is too large. Please choose a file under ${isVideo ? '250MB' : '25MB'}.`, true);
          return;
        }
        if (isVideo && file.type && !file.type.startsWith('video/')) {
          setFormStatus(form, 'Please upload a valid video file.', true);
          return;
        }
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Loading engine…';
      }
      setFormStatus(form, 'Loading FFmpeg in your browser. Large videos may take several minutes…', false);

      try {
        const result = await queueWorkflowJob(formatToolLabel(form.dataset.tool), () => runTool(form.dataset.tool, form, files));
        displayResult(form, result);
        recordWorkflowHistory({
          label: formatToolLabel(form.dataset.tool),
          fileName: result && result.fileName ? result.fileName : 'result-file',
          url: result && result.url ? result.url : ''
        });
        setFormStatus(form, 'Processing complete. Preview and download are ready.', false);
      } catch (error) {
        console.error('[video-tools]', error);
        setFormStatus(form, error && error.message ? error.message : 'Unable to process the video.', true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  });

  const downloadLinks = document.querySelectorAll('.download-link');
  downloadLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const form = link.closest('.tool-card')?.querySelector('.image-tool');
      if (form && form.dataset.tool && String(form.dataset.tool).startsWith('video-') && link.download) {
        setFormStatus(form, 'Download started.', false);
      }
    });
  });
}

initializeDynamicallyLoadedTools();
