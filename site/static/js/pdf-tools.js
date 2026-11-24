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

  function registerPdfHandlers() {
    window.imigiToolHandlers = window.imigiToolHandlers || {};

    window.imigiToolHandlers['merge-pdf'] = function(form, files) {
      return window.processPdfTool(files, form, 'merge');
    };

    window.imigiToolHandlers['split-pdf'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      return window.processPdfTool(file, form, 'split', { range: form.querySelector('#split-range')?.value || '1-3' });
    };

    window.imigiToolHandlers['compress-pdf'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      return window.processPdfTool(file, form, 'compress', { level: form.querySelector('#compress-level')?.value || 'medium' });
    };

    window.imigiToolHandlers['jpg-to-pdf'] = function(form, files) {
      return window.processPdfTool(files, form, 'jpg-to-pdf');
    };

    window.imigiToolHandlers['pdf-to-images'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      return window.processPdfTool(file, form, 'pdf-to-images', { format: form.querySelector('#pdf-images-format')?.value || 'jpg' });
    };

    window.imigiToolHandlers['rotate-pdf'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      return window.processPdfTool(file, form, 'rotate', { angle: Number(form.querySelector('#rotate-pdf-angle')?.value || 90) });
    };

    window.imigiToolHandlers['delete-pdf-pages'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      return window.processPdfTool(file, form, 'delete-pages', { range: form.querySelector('#delete-page-range')?.value || '2' });
    };

    window.imigiToolHandlers['extract-pdf-pages'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      return window.processPdfTool(file, form, 'extract-pages', { range: form.querySelector('#extract-page-range')?.value || '1-2' });
    };

    window.imigiToolHandlers['pdf-page-editor'] = function(form, files) {
      const file = (files && files[0]) || form.querySelector('input[type="file"]')?.files?.[0];
      const action = form.querySelector('#pdf-editor-action')?.value || 'reorder-pages';
      if (action === 'watermark') {
        return window.processPdfTool(file, form, 'watermark', {
          text: form.querySelector('#pdf-watermark-text')?.value || 'Imigi',
          size: Number(form.querySelector('#pdf-watermark-size')?.value || 28)
        });
      }
      if (action === 'page-numbers') {
        return window.processPdfTool(file, form, 'page-numbers', {
          text: form.querySelector('#pdf-page-number-text')?.value || 'Page {n}',
          size: Number(form.querySelector('#pdf-page-number-size')?.value || 14)
        });
      }
      if (action === 'rotate-selected-pages') {
        return window.processPdfTool(file, form, 'rotate-selected-pages', {
          range: form.querySelector('#pdf-rotate-range')?.value || '1,3',
          angle: Number(form.querySelector('#pdf-rotate-angle')?.value || 90)
        });
      }
      return window.processPdfTool(file, form, 'reorder-pages', {
        range: form.querySelector('#pdf-reorder-range')?.value || '2,1'
      });
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

      if (input && action === 'split') return splitPdf(input, params.range || '1-3');
      if (input && action === 'compress') return compressPdf(input, params.level || 'medium');
      if (input && action === 'pdf-to-images') return pdfToImages(input, params.format || 'jpg');
      if (input && action === 'rotate') return rotatePdf(input, Number(params.angle || 90));
      if (input && action === 'delete-pages') return deletePdfPages(input, params.range || '2');
      if (input && action === 'extract-pages') return extractPdfPages(input, params.range || '1-2');
      if (input && action === 'reorder-pages') return reorderPdfPages(input, params.range || '2,1');
      if (input && action === 'watermark') return watermarkPdf(input, params);
      if (input && action === 'page-numbers') return addPageNumbers(input, params);
      if (input && action === 'rotate-selected-pages') return rotateSelectedPdfPages(input, params.range || '1', Number(params.angle || 90));

      throw new Error('Unsupported PDF action in browser runtime.');
    } catch (error) {
      console.warn('[pdf] Browser PDF processing failed:', error);
      throw new Error('This PDF operation is unavailable in the static browser build. ' + (error.message || 'Please try a supported browser engine.'));
    }
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
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before splitting.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const indices = parseRange(rangeText, source.getPageCount());
    const result = await window.PDFLib.PDFDocument.create();
    const pages = await result.copyPages(source, indices);
    pages.forEach((page) => result.addPage(page));
    const bytes = await result.save();
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-split.pdf`);
  }

  async function compressPdf(file, level) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before compressing.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const bytes = await source.save({ useObjectStreams: level === 'high' });
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-compressed.pdf`);
  }

  async function jpgToPdf(files) {
    if (!window.PDFLib || files.length === 0) throw new Error('Please choose at least one JPG image.');
    const pdf = await window.PDFLib.PDFDocument.create();
    for (const file of files) {
      const image = await pdf.embedJpg(await file.arrayBuffer());
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    const bytes = await pdf.save();
    return createDownloadResult(bytes, 'converted-images.pdf');
  }

  async function pdfToImages(file, format) {
    if (!window.pdfjsLib || !file) throw new Error('PDF rendering support is unavailable.');
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
    return createDownloadResult(zipBlob, `${file.name.replace(/\.[^/.]+$/, '')}-pages.zip`);
  }

  async function rotatePdf(file, angle) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before rotating.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    source.getPages().forEach((page) => page.setRotation(window.PDFLib.degrees(Number(angle) || 90)));
    const bytes = await source.save();
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-rotated.pdf`);
  }

  async function deletePdfPages(file, rangeText) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before deleting pages.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const removeSet = new Set(parseRange(rangeText, source.getPageCount()));
    const result = await window.PDFLib.PDFDocument.create();
    const pages = await result.copyPages(source, source.getPageIndices().filter((idx) => !removeSet.has(idx)));
    pages.forEach((page) => result.addPage(page));
    const bytes = await result.save();
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-edited.pdf`);
  }

  async function extractPdfPages(file, rangeText) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before extracting pages.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const indices = parseRange(rangeText, source.getPageCount());
    const result = await window.PDFLib.PDFDocument.create();
    const pages = await result.copyPages(source, indices);
    pages.forEach((page) => result.addPage(page));
    const bytes = await result.save();
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-extracted.pdf`);
  }

  async function reorderPdfPages(file, rangeText) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before reordering pages.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const order = parseExplicitOrder(rangeText, source.getPageCount());
    const result = await window.PDFLib.PDFDocument.create();
    const pages = await result.copyPages(source, order);
    pages.forEach((page) => result.addPage(page));
    const bytes = await result.save();
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-reordered.pdf`);
  }

  async function watermarkPdf(file, options = {}) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before adding a watermark.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const pages = source.getPages();
    const text = options.text || 'Imigi';
    const size = Number(options.size) || 28;
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
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-watermarked.pdf`);
  }

  async function addPageNumbers(file, options = {}) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before adding page numbers.');
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
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-numbered.pdf`);
  }

  async function rotateSelectedPdfPages(file, rangeText, angle) {
    if (!window.PDFLib || !file) throw new Error('Please upload a PDF before rotating selected pages.');
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const set = new Set(parseRange(rangeText, source.getPageCount()));
    source.getPages().forEach((page, index) => {
      if (set.has(index)) page.setRotation(window.PDFLib.degrees(Number(angle) || 90));
    });
    const bytes = await source.save();
    return createDownloadResult(bytes, `${file.name.replace(/\.[^/.]+$/, '')}-rotated-pages.pdf`);
  }

  function parseRange(rangeText, totalPages) {
    if (!rangeText || !rangeText.trim()) return [0];
    const values = new Set();
    rangeText.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      if (trimmed.includes('-')) {
        const [startText, endText] = trimmed.split('-');
        const start = Math.max(0, Number(startText) - 1);
        const end = Math.max(start, Number(endText) - 1);
        for (let i = start; i <= end; i += 1) values.add(i);
        return;
      }
      const value = Math.max(0, Number(trimmed) - 1);
      values.add(value);
    });
    return Array.from(values).filter((value) => value >= 0 && value < totalPages);
  }

  function parseExplicitOrder(rangeText, totalPages) {
    if (!rangeText || !rangeText.trim()) return [0];
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
    if (!values.length) return [0];
    return values.filter((value) => value >= 0 && value < totalPages);
  }

  function createDownloadResult(blob, fileName) {
    return { type: 'blob', url: URL.createObjectURL(blob), fileName };
  }

  window.processPdfTool = processPdfTool;

  function init() {
    registerPdfHandlers();

    const trigger = function() {
      loadScript('/static/js/image-tools.js').then(function() {
        registerPdfHandlers();
      }).catch(function(error) {
        console.warn('[pdf-tools] shared tool bundle did not load:', error);
      });
    };

    const activate = function(event) {
      if (event && event.target && event.target.closest && event.target.closest('form')) {
        trigger();
      } else {
        trigger();
      }
    };

    activate();

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
})();
