document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.image-tool').forEach((form) => {
    bindRangeValue(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="file"]');

      if (!input || !input.files || !input.files[0]) {
        alert('Please choose an image file first.');
        return;
      }

      try {
        const file = input.files[0];
        const result = await runTool(form.dataset.tool, form, file);
        displayResult(form, result);
      } catch (error) {
        alert(error.message || 'Unable to process the image.');
      }
    });
  });

  document.querySelectorAll('.base64-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const textarea = form.querySelector('textarea');
      const value = (textarea?.value || '').trim();

      if (!value) {
        alert('Paste a Base64 string before decoding.');
        return;
      }

      try {
        const matches = value.match(/^data:image\/.+;base64,/) ? value : `data:image/png;base64,${value}`;
        const preview = form.parentElement.querySelector('.tool-preview');
        const link = form.parentElement.querySelector('.download-link');

        if (preview) {
          preview.src = matches;
          preview.hidden = false;
        }

        if (link) {
          link.href = matches;
          link.download = 'decoded-image.png';
          link.hidden = false;
        }
      } catch (error) {
        alert('The Base64 content could not be decoded.');
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

async function runTool(toolName, form, file) {
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
      return await fileToBase64(file);
    case 'passport':
      return passportMaker(file, {
        width: getNumber(form, 'passport-width', 413),
        height: getNumber(form, 'passport-height', 531)
      });
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

  const blob = await canvasToBlob(canvas, file.type.includes('png') ? 'image/png' : 'image/jpeg', 0.9);
  return {
    url: URL.createObjectURL(blob),
    fileName: `resized-${getBaseName(file.name)}.${formatToExtension(file.type.includes('png') ? 'image/png' : 'image/jpeg')}`
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

function canvasToBlob(canvas, format, quality = 0.8) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to generate the image output.'));
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
