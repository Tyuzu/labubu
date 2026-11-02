document.addEventListener('DOMContentLoaded', () => {
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.querySelectorAll('.image-tool').forEach((form) => {
    bindRangeValue(form);
    ensureStatusElement(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="file"]');
      const files = input && input.files ? Array.from(input.files) : [];

      if (!form.dataset.tool) {
        return;
      }

      if (files.length === 0 && !['image-to-base64', 'base64-to-image'].includes(form.dataset.tool)) {
        setFormStatus(form, 'Please choose a file first.', true);
        return;
      }

      setFormStatus(form, 'Processing your file...', false);

      try {
        const result = await runTool(form.dataset.tool, form, files);
        displayResult(form, result);
        setFormStatus(form, 'Your file is ready to download.', false);
      } catch (error) {
        setFormStatus(form, error.message || 'Unable to process the file.', true);
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
  const file = files[0] || null;

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
    default:
      throw new Error('This tool is not implemented yet.');
  }
}

function displayResult(form, result) {
  const preview = form.parentElement.querySelector('.tool-preview');
  const downloadLink = form.parentElement.querySelector('.download-link');
  const output = form.parentElement.querySelector('.tool-output');
  const copyButton = form.parentElement.querySelector('[data-copy-output]');

  if (result && result.type === 'base64') {
    if (output) {
      output.value = result.value;
      output.hidden = false;
    }
    if (copyButton) {
      copyButton.hidden = false;
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
