// ─── State ────────────────────────────────────────────────────────────────────

let appState = {
  selectedStateCode: null,
  selectedStateConfig: null,
  taxYear: new Date().getFullYear(),
  regulatoryYear: new Date().getFullYear(),
  filePaths: {},        // { [statusKey]: path }
  selectedImages: [],
  selectedPdfPath: null,
  pdfPageRangeOverride: { start: '', end: '' },
  pdfPageRangeSource: 'configured',
  extractedData: null,  // { [statusKey]: { [income]: value } }
  diffResults: null,    // { [statusKey]: { changed: [], matched: number, missing: number } }
  settings: { openaiApiKey: '', anthropicApiKey: '' }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  appState.settings = await window.api.getSettings();

  const states = await window.api.getAllStates();
  populateStateDropdown(states);
  populateYearDropdowns();

  bindEvents();

  // Select first state by default
  if (states.length > 0) {
    document.getElementById('stateSelect').value = states[0].code;
    await onStateChange(states[0].code);
  }

  updateApiKeyIndicator();
}

// ─── Dropdowns ────────────────────────────────────────────────────────────────

function populateStateDropdown(states) {
  const select = document.getElementById('stateSelect');
  select.innerHTML = states.map(s =>
    `<option value="${s.code}">${s.name} (${s.code})</option>`
  ).join('');
}

function populateYearDropdowns() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 3; y--) years.push(y);

  const taxYearSel = document.getElementById('taxYearSelect');
  const regYearSel = document.getElementById('regulatoryYearInput');

  taxYearSel.innerHTML = years.map(y =>
    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
  ).join('');

  regYearSel.value = currentYear;
  appState.taxYear = currentYear;
  appState.regulatoryYear = currentYear;
}

// ─── State change ─────────────────────────────────────────────────────────────

async function onStateChange(stateCode) {
  appState.selectedStateCode = stateCode;
  appState.selectedStateConfig = await window.api.getStateConfig(stateCode);
  appState.selectedImages = [];
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  appState.pdfPageRangeSource = 'configured';
  appState.extractedData = null;
  appState.diffResults = null;

  renderSelectedSource();
  await loadFilePaths();
  renderFilePickers();
  renderExtractedDataSection();
  renderDiffSection();
  updateActionButtons();
}

async function loadFilePaths() {
  const { selectedStateCode, regulatoryYear } = appState;
  const saved = await window.api.readJsonFilePaths(selectedStateCode, regulatoryYear);
  appState.filePaths = saved || {};
}

// ─── File pickers ─────────────────────────────────────────────────────────────

function renderFilePickers() {
  const container = document.getElementById('filePickersContainer');
  const config = appState.selectedStateConfig;
  if (!config) { container.innerHTML = ''; return; }

  container.innerHTML = config.filingStatuses.map(status => {
    const currentPath = appState.filePaths[status.key] || '';
    return `
      <div class="file-picker-row" data-key="${status.key}">
        <div class="file-picker-label">
          <span class="status-badge">${status.fileLabel}</span>
          <span class="status-desc">${status.label}</span>
        </div>
        <div class="file-picker-input">
          <code class="path-display" id="path-${status.key}">${currentPath || 'Not selected'}</code>
          <button class="btn btn-sm btn-outline" onclick="selectJsonFile('${status.key}')">Browse</button>
        </div>
      </div>
    `;
  }).join('');
}

async function selectJsonFile(statusKey) {
  const currentPath = appState.filePaths[statusKey] || '';
  const selected = await window.api.selectJsonFile(statusKey, currentPath);
  if (selected) {
    appState.filePaths[statusKey] = selected;
    document.getElementById(`path-${statusKey}`).textContent = selected;
    await persistFilePaths();
    updateActionButtons();
  }
}

async function persistFilePaths() {
  await window.api.saveJsonFilePaths(appState.selectedStateCode, {
    stateCode: appState.selectedStateCode,
    regulatoryYear: appState.regulatoryYear,
    filePaths: appState.filePaths
  });
}

// ─── Image selection ──────────────────────────────────────────────────────────

async function selectImages() {
  const paths = await window.api.selectImages();
  if (!paths || paths.length === 0) return;

  appState.selectedImages = paths;
  appState.selectedPdfPath = null;
  renderSelectedSource();
  updateActionButtons();
}

async function selectPdf() {
  const selected = await window.api.selectPdfFile();
  if (!selected) return;

  appState.selectedPdfPath = selected;
  appState.selectedImages = [];

  const configured = getConfiguredPdfPageRange();
  if (configured) {
    appState.pdfPageRangeOverride = { start: String(configured.start), end: String(configured.end) };
    appState.pdfPageRangeSource = 'configured';
  } else {
    appState.pdfPageRangeOverride = { start: '', end: '' };
    appState.pdfPageRangeSource = 'manual override';
    try {
      const detected = await detectTaxTablePageRangeFromPdf(selected);
      if (detected) {
        appState.pdfPageRangeOverride = { start: String(detected.start), end: String(detected.end) };
        appState.pdfPageRangeSource = 'auto-detected';
      }
    } catch (error) {
      console.warn('PDF page-range detection failed:', error);
    }
  }

  renderSelectedSource();
  updateActionButtons();
}

function getConfiguredPdfPageRange() {
  const config = appState.selectedStateConfig;
  return config?.pdfTaxTablePagesByYear?.[appState.taxYear] || null;
}

function getEffectivePdfPageRange() {
  const start = parseInt(appState.pdfPageRangeOverride.start, 10);
  const end = parseInt(appState.pdfPageRangeOverride.end, 10);

  if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
    return { start, end };
  }

  return getConfiguredPdfPageRange();
}

function syncPdfPageInputs() {
  const startInput = document.getElementById('pdfPageStartInput');
  const endInput = document.getElementById('pdfPageEndInput');
  if (!startInput || !endInput) return;

  startInput.value = appState.pdfPageRangeOverride.start;
  endInput.value = appState.pdfPageRangeOverride.end;
}

function renderSelectedSource() {
  const previewSection = document.getElementById('imagePreviewSection');
  const preview = document.getElementById('imagePreview');
  const pdfSection = document.getElementById('pdfSelectionSection');
  const pdfSummary = document.getElementById('pdfSelectionSummary');

  if (appState.selectedPdfPath) {
    const configured = getConfiguredPdfPageRange();
    const effective = getEffectivePdfPageRange();
    previewSection.style.display = 'none';
    preview.innerHTML = '';
    pdfSection.style.display = 'block';
    syncPdfPageInputs();
    const fileName = appState.selectedPdfPath.split(/[/\\]/).pop();
    if (effective) {
      const sourceLabel = appState.pdfPageRangeSource;
      pdfSummary.textContent = `PDF selected: ${fileName} | Tax table pages ${effective.start}-${effective.end} (${sourceLabel})`;
    } else {
      pdfSummary.textContent = `PDF selected: ${fileName} | Enter PDF start/end pages for tax year ${appState.taxYear}`;
    }
    return;
  }

  pdfSection.style.display = 'none';
  pdfSummary.textContent = '';
  syncPdfPageInputs();

  if (appState.selectedImages.length > 0) {
    previewSection.style.display = 'block';
    preview.innerHTML = appState.selectedImages.map(p => `
      <div class="image-item">
        <img src="${p}" alt="Tax table screenshot" />
        <div class="image-filename">${p.split(/[/\\]/).pop()}</div>
      </div>
    `).join('');
    return;
  }

  previewSection.style.display = 'none';
  preview.innerHTML = '';
}
// ─── Extraction ───────────────────────────────────────────────────────────────

const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_MAX_RETRIES = 3;
const DEFAULT_IMAGE_SLICE_COUNT = 4;
const IMAGE_SLICE_OVERLAP_RATIO = 0.12;

function getImageSliceCount() {
  switch (appState.selectedStateCode) {
    case 'MN':
      return 2;
    case 'OR':
      return 4;
    default:
      return DEFAULT_IMAGE_SLICE_COUNT;
  }
}
function getImageSliceOverlapRatio() {
  switch (appState.selectedStateCode) {
    case 'MN':
      return 0;
    case 'OR':
      return IMAGE_SLICE_OVERLAP_RATIO;
    default:
      return IMAGE_SLICE_OVERLAP_RATIO;
  }
}
function getOpenAIApiKey() {
  return appState.settings.openaiApiKey || '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetryOpenAIRequest(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for slicing.'));
    img.src = src;
  });
}

async function splitImageIntoVerticalSlices(image, pageLabel) {
  const sourceUrl = `data:${image.mediaType};base64,${image.base64}`;
  const img = await loadImageElement(sourceUrl);
  const sliceCount = getImageSliceCount();

  const baseSliceWidth = Math.ceil(img.width / sliceCount);
  const overlapRatio = getImageSliceOverlapRatio();
  const overlap = overlapRatio > 0 ? Math.max(20, Math.floor(baseSliceWidth * overlapRatio)) : 0;
  const slices = [];

  for (let i = 0; i < sliceCount; i++) {
    const startX = i === 0 ? 0 : Math.max(0, i * baseSliceWidth - overlap);
    const endX = i === sliceCount - 1
      ? img.width
      : Math.min(img.width, (i + 1) * baseSliceWidth + overlap);
    const sliceWidth = Math.max(1, endX - startX);

    const canvas = document.createElement('canvas');
    canvas.width = sliceWidth;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create image crop canvas.');
    }

    ctx.drawImage(img, startX, 0, sliceWidth, img.height, 0, 0, sliceWidth, img.height);

    const dataUrl = canvas.toDataURL('image/png');
    slices.push({
      mediaType: 'image/png',
      base64: dataUrl.split(',')[1],
      label: `${pageLabel} strip ${i + 1}/${sliceCount}`
    });
  }

  return slices;
}
async function splitMinnesotaImageIntoStatusSlices(image, pageLabel, config) {
  const sourceUrl = `data:${image.mediaType};base64,${image.base64}`;
  const img = await loadImageElement(sourceUrl);
  const blockCount = 2;
  const blockWidth = img.width / blockCount;
  const centerGap = Math.max(8, Math.floor(img.width * 0.012));
  const blockInnerPadding = Math.max(6, Math.floor(blockWidth * 0.012));
  const incomeSectionRatio = 0.36;
  const valueSectionRatio = 0.64;
  const statusCount = config.filingStatuses.length;
  const slices = [];

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
    const blockStart = Math.floor(blockIndex * blockWidth) + (blockIndex === 0 ? 0 : centerGap);
    const blockEnd = Math.floor((blockIndex + 1) * blockWidth) - (blockIndex === blockCount - 1 ? 0 : centerGap);
    const usableStart = Math.max(0, blockStart + blockInnerPadding);
    const usableEnd = Math.min(img.width, blockEnd - blockInnerPadding);
    const usableWidth = Math.max(1, usableEnd - usableStart);

    const incomeWidth = Math.max(1, Math.floor(usableWidth * incomeSectionRatio));
    const valueStart = usableStart + incomeWidth;
    const valueWidth = Math.max(1, Math.floor(usableWidth * valueSectionRatio));
    const statusWidth = valueWidth / statusCount;

    for (let statusIndex = 0; statusIndex < statusCount; statusIndex++) {
      const status = config.filingStatuses[statusIndex];
      const statusStart = Math.max(0, Math.floor(valueStart + statusIndex * statusWidth) - 4);
      const statusEnd = Math.min(img.width, Math.ceil(valueStart + (statusIndex + 1) * statusWidth) + 4);
      const finalStatusWidth = Math.max(1, statusEnd - statusStart);
      const canvas = document.createElement('canvas');

      canvas.width = incomeWidth + finalStatusWidth;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to create Minnesota image crop canvas.');
      }

      // Compose the shared income columns with exactly one filing-status value column.
      ctx.drawImage(img, usableStart, 0, incomeWidth, img.height, 0, 0, incomeWidth, img.height);
      ctx.drawImage(img, statusStart, 0, finalStatusWidth, img.height, incomeWidth, 0, finalStatusWidth, img.height);

      const dataUrl = canvas.toDataURL('image/png');
      slices.push({
        mediaType: 'image/png',
        base64: dataUrl.split(',')[1],
        label: `${pageLabel} block ${blockIndex + 1}/${blockCount} ${status.fileLabel}`,
        statusKeys: [status.key]
      });
    }
  }

  return slices;
}
async function getImageExtractionSlices(image, pageLabel, config) {
  if (appState.selectedStateCode === 'MN') {
    return splitMinnesotaImageIntoStatusSlices(image, pageLabel, config);
  }

  return splitImageIntoVerticalSlices(image, pageLabel);
}
function extractOpenAIText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  if (!Array.isArray(data.output)) return '';

  return data.output
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => part.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n');
}

async function callOpenAIResponsesApi(requestBody) {
  let lastError;

  for (let attempt = 1; attempt <= OPENAI_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getOpenAIApiKey()}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let message = `API error ${response.status}`;

        try {
          const err = await response.json();
          message = err.error?.message || err.message || message;
        } catch {
          const fallback = await response.text();
          if (fallback) message = fallback;
        }

        if (shouldRetryOpenAIRequest(response.status) && attempt < OPENAI_MAX_RETRIES) {
          updateProgress(30, `OpenAI request failed (${response.status}). Retrying ${attempt}/${OPENAI_MAX_RETRIES - 1}...`);
          await sleep(1000 * attempt);
          continue;
        }

        throw new Error(message);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt >= OPENAI_MAX_RETRIES) break;
      updateProgress(30, `OpenAI request interrupted. Retrying ${attempt}/${OPENAI_MAX_RETRIES - 1}...`);
      await sleep(1000 * attempt);
    }
  }

  throw lastError || new Error('OpenAI request failed.');
}

function parseExtractedJson(rawText) {
  const clean = rawText.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function buildExtractionSchema(config) {
  const properties = {};
  const required = [];

  for (const status of config.filingStatuses) {
    required.push(status.key);
    properties[status.key] = {
      type: 'array',
      description: `${status.label} rows in ascending income order.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['income', 'value'],
        properties: {
          income: {
            type: 'number',
            description: 'Income key for this tax table row.'
          },
          value: {
            type: 'number',
            description: 'Tax amount for this tax table row.'
          }
        }
      }
    };
  }

  return {
    type: 'object',
    additionalProperties: false,
    required,
    properties
  };
}

function normalizeExtractedData(parsed, config) {
  const normalized = {};

  for (const status of config.filingStatuses) {
    const rows = parsed[status.key];
    if (!Array.isArray(rows)) {
      throw new Error(`Missing or invalid data for filing status: ${status.label}`);
    }

    const values = {};
    for (const row of rows) {
      const income = Number(row.income);
      const value = Number(row.value);

      if (!Number.isFinite(income) || !Number.isFinite(value)) {
        throw new Error(`Invalid numeric value returned for filing status: ${status.label}`);
      }

      if (values[income] !== undefined) {
        throw new Error(`Duplicate income bracket ${income} returned for filing status: ${status.label}`);
      }

      values[income] = value;
    }

    normalized[status.key] = values;
  }

  return normalized;
}
function mergeExtractedData(existing, incoming, config, pageLabel) {
  const merged = { ...existing };

  for (const status of config.filingStatuses) {
    const currentValues = merged[status.key] ? { ...merged[status.key] } : {};
    const incomingValues = incoming[status.key] || {};

    for (const [incomeKey, value] of Object.entries(incomingValues)) {
      if (currentValues[incomeKey] !== undefined && currentValues[incomeKey] !== value) {
        throw new Error(
          `Conflicting value for ${status.label} at income ${incomeKey} on ${pageLabel}. Existing value: ${currentValues[incomeKey]}, new value: ${value}.`
        );
      }

      if (currentValues[incomeKey] !== undefined && currentValues[incomeKey] === value) {
        continue;
      }

      currentValues[incomeKey] = value;
    }

    merged[status.key] = currentValues;
  }

  return merged;
}

let pdfJsLibPromise;

async function getPdfJsLib() {
  if (!pdfJsLibPromise) {
    pdfJsLibPromise = import('./node_modules/pdfjs-dist/build/pdf.mjs');
  }

  const pdfjsLib = await pdfJsLibPromise;
  pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs';
  return pdfjsLib;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function extractPdfPageText(page) {
  const textContent = await page.getTextContent();
  return textContent.items
    .map(item => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function detectTaxTablePageRangeFromPdf(filePath) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) {
    throw new Error(fileResult.message || 'Failed to read selected PDF.');
  }

  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  const pagesToScan = Math.min(pdf.numPages, 8);

  for (let pageNo = 1; pageNo <= pagesToScan; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const text = await extractPdfPageText(page);
    const match = text.match(/Tax\s+Tables?\s*(?:\.{2,}|\s)+(?:(\d+)\s*[-�]\s*(\d+)|(\d+))/i);
    if (!match) continue;

    const start = parseInt(match[1] || match[3], 10);
    const end = parseInt(match[2] || match[3], 10);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
      return { start, end, foundOnPage: pageNo };
    }
  }

  return null;
}
async function renderPdfPagesToImages(filePath, pageRange) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) {
    throw new Error(fileResult.message || 'Failed to read selected PDF.');
  }

  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  const images = [];

  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) {
      throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    }

    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create PDF render canvas.');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    images.push({
      mediaType: 'image/png',
      base64: dataUrl.split(',')[1],
      label: `page ${pageNo}`
    });
  }

  return images;
}
function parseIntegerText(str) {
  if (typeof str !== 'string') return null;
  const clean = str.trim();
  if (!/^\d[\d,]*$/.test(clean)) return null;
  const value = parseInt(clean.replace(/,/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}
function groupPdfTextItemsByRow(items, tolerance = 1.5) {
  const sorted = items
    .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y) && item.str && item.str.trim())
    .sort((a, b) => Math.abs(b.y - a.y) < tolerance ? a.x - b.x : b.y - a.y);

  const rows = [];
  for (const item of sorted) {
    const row = rows.find(existing => Math.abs(existing.y - item.y) <= tolerance);
    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }

  return rows;
}
function getMinnesotaPdfBlockColumnRanges(pageWidth) {
  const byRatio = (start, end) => [pageWidth * start, pageWidth * end];
  return [
    {
      atLeast: byRatio(0.08, 0.15),
      lessThan: byRatio(0.155, 0.23),
      Single: byRatio(0.235, 0.305),
      MFJ: byRatio(0.315, 0.395),
      MFS: byRatio(0.385, 0.465),
      HOH: byRatio(0.455, 0.535)
    },
    {
      atLeast: byRatio(0.53, 0.605),
      lessThan: byRatio(0.61, 0.69),
      Single: byRatio(0.685, 0.765),
      MFJ: byRatio(0.755, 0.84),
      MFS: byRatio(0.83, 0.915),
      HOH: byRatio(0.905, 0.99)
    }
  ];
}
function findNumericItemInRange(items, range) {
  const matches = items
    .filter(item => item.x >= range[0] && item.x <= range[1])
    .map(item => ({ ...item, numericValue: parseIntegerText(item.str) }))
    .filter(item => item.numericValue !== null);

  return matches.length > 0 ? matches[0] : null;
}
function parseMinnesotaPdfRows(textItems, pageWidth) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({
    str: 'str' in item ? item.str : '',
    x: item.transform?.[4],
    y: item.transform?.[5]
  })));
  const columnSets = getMinnesotaPdfBlockColumnRanges(pageWidth);
  const parsed = [];

  for (const row of rows) {
    for (const columns of columnSets) {
      const lower = findNumericItemInRange(row.items, columns.atLeast);
      const upper = findNumericItemInRange(row.items, columns.lessThan);
      const single = findNumericItemInRange(row.items, columns.Single);
      const mfj = findNumericItemInRange(row.items, columns.MFJ);
      const mfs = findNumericItemInRange(row.items, columns.MFS);
      const hoh = findNumericItemInRange(row.items, columns.HOH);

      if (!lower || !upper || !single || !mfj || !mfs || !hoh) continue;
      if (lower.numericValue >= upper.numericValue) continue;

      parsed.push({
        income: lower.numericValue,
        upperIncome: upper.numericValue,
        values: {
          Single: single.numericValue,
          MFJ: mfj.numericValue,
          MFS: mfs.numericValue,
          HOH: hoh.numericValue
        }
      });
    }
  }

  return parsed;
}
function normalizeDeterministicRowsToData(rows, config, lookUpTypes, pageLabel) {
  const normalized = {};
  for (const status of config.filingStatuses) {
    normalized[status.key] = {};
  }

  for (const row of rows) {
    for (const status of config.filingStatuses) {
      const lookUpType = lookUpTypes[status.key] || 'LowerBoundary';
      const key = lookUpType === 'UpperBoundary' ? row.upperIncome : row.income;
      const value = row.values[status.key];

      if (!Number.isFinite(key) || !Number.isFinite(value)) {
        throw new Error(`Deterministic parser produced invalid numeric data for ${status.label} on ${pageLabel}.`);
      }
      if (normalized[status.key][key] !== undefined && normalized[status.key][key] !== value) {
        throw new Error(`Deterministic parser produced conflicting ${status.label} values at income ${key} on ${pageLabel}.`);
      }

      normalized[status.key][key] = value;
    }
  }

  return normalized;
}
function parseOrPdfRows(textItems, pageWidth) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({
    str: 'str' in item ? item.str : '',
    x: item.transform?.[4],
    y: item.transform?.[5]
  })));
  const blockRanges = [
    [pageWidth * 0.09, pageWidth * 0.29],
    [pageWidth * 0.30, pageWidth * 0.50],
    [pageWidth * 0.51, pageWidth * 0.71],
    [pageWidth * 0.72, pageWidth * 0.93]
  ];
  const parsed = [];

  for (const row of rows) {
    for (const range of blockRanges) {
      const rowText = row.items
        .filter(item => item.x >= range[0] && item.x <= range[1])
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!rowText) continue;

      const numbers = Array.from(rowText.matchAll(/\d[\d,]*/g)).map(match => parseInt(match[0].replace(/,/g, ''), 10));
      if (numbers.length !== 4) continue;

      const [income, upperIncome, sValue, jValue] = numbers;
      if (!(income < upperIncome)) continue;

      parsed.push({
        income,
        upperIncome,
        values: {
          S: sValue,
          J: jValue
        }
      });
    }
  }

  return parsed;
}
function canUseDeterministicPdfParser(config) {
  return Boolean(appState.selectedPdfPath) && ['MN', 'OR'].includes(config?.code);
}
async function extractPdfDeterministically(filePath, pageRange, config, lookUpTypes) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) {
    throw new Error(fileResult.message || 'Failed to read selected PDF.');
  }

  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let mergedData = {};

  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) {
      throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    }

    const progressStart = 20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55);
    updateProgress(progressStart, `Parsing ${config.name} PDF page ${pageNo}...`);

    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const rows = config.code === 'MN'
      ? parseMinnesotaPdfRows(textContent.items, viewport.width)
      : parseOrPdfRows(textContent.items, viewport.width);

    if (rows.length === 0) {
      throw new Error(`Deterministic parser found no tax table rows on page ${pageNo}.`);
    }

    const pageData = normalizeDeterministicRowsToData(rows, config, lookUpTypes, `page ${pageNo}`);
    mergedData = mergeExtractedData(mergedData, pageData, config, `page ${pageNo}`);
  }

  return mergedData;
}
async function extractSinglePageData(image, prompt, config, pageLabel) {
  const input = [{
    role: 'user',
    content: [
      { type: 'input_text', text: prompt },
      {
        type: 'input_image',
        detail: 'high',
        image_url: `data:${image.mediaType};base64,${image.base64}`
      }
    ]
  }];

  const data = await callOpenAIResponsesApi({
    model: OPENAI_MODEL,
    input,
    text: {
      format: {
        type: 'json_schema',
        name: 'tax_table_extraction',
        strict: true,
        schema: buildExtractionSchema(config)
      }
    }
  });

  try {
    return normalizeExtractedData(parseExtractedJson(extractOpenAIText(data)), config);
  } catch {
    throw new Error(`OpenAI returned invalid structured data for ${pageLabel}.`);
  }
}
function buildExtractionPrompt(config, lookUpTypes) {
  const statusLabels = config.filingStatuses.map(s => `"${s.key}" = ${s.label}`).join(', ');
  const boundaryInstructions = config.filingStatuses.map(status => {
    const lookUpType = lookUpTypes[status.key];
    if (lookUpType === 'UpperBoundary') {
      return `- "${status.key}" uses UPPER BOUNDARY keys: assign the tax value to the "less than" (upper) income key.\n  Example: row "at least $20, less than $50, tax = $2" -> key 50 = 2`;
    }
    return `- "${status.key}" uses LOWER BOUNDARY keys: assign the tax value to the "at least" (lower) income key.\n  Example: row "at least $20, less than $50, tax = $2" -> key 20 = 2`;
  }).join('\n');

  const singleStatusCropRule = config.filingStatuses.length === 1
    ? `\nThe crop includes the shared income columns plus exactly one filing-status value column for ${config.filingStatuses[0].label}.\nRead only the printed numbers in that one filing-status column.\nDo not infer or copy values from neighboring filing statuses.\n`
    : '';

  return `You are extracting data from ${appState.selectedStateConfig.name} ${appState.taxYear} tax table source pages for ${appState.selectedStateConfig.formName}.

The table has these filing status columns: ${statusLabels}.
${singleStatusCropRule}
Return data that matches the provided JSON schema.
For each filing status, return an array of row objects with this shape:
{ "income": 0, "value": 0 }

Key assignment rules per filing status:
${boundaryInstructions}

Critical rule - do NOT shift values:
Each tax amount belongs to the row it appears on. Assign it to THAT row's key, not the next row's key.
For LowerBoundary: the key is the "at least" value of the SAME row.

The table may have irregular intervals at the very beginning (e.g. $0, $20, $50 before switching to $100 increments).
These follow the same rule. For example if the first rows are:
  Row 1: at least $0,  less than $20,  tax = $0  -> { "income": 0, "value": 0 }
  Row 2: at least $20, less than $50,  tax = $2  -> { "income": 20, "value": 2 }
  Row 3: at least $50, less than $100, tax = $4  -> { "income": 50, "value": 4 }
  Row 4: at least $100, less than $200, tax = $7 -> { "income": 100, "value": 7 }

Additional rules:
- Values are tax amounts as numbers, not strings.
- Include every row from every selected tax table page. Do not skip any rows.
- Keep each filing status array sorted by income ascending.
- Always return every filing status key from the schema, even if one page is harder to read.`;
}
async function extractData() {
  const config = appState.selectedStateConfig;
  const useDeterministicPdfParser = canUseDeterministicPdfParser(config);

  if (appState.selectedImages.length === 0 && !appState.selectedPdfPath) {
    showToast('Please select screenshots or a PDF first.', 'error');
    return;
  }

  if (!useDeterministicPdfParser && !getOpenAIApiKey()) {
    showToast('Please add your OpenAI API key in Settings first.', 'error');
    openSettings();
    return;
  }

  setExtracting(true);

  try {
    let imageData = [];
    let pageRange = null;

    if (appState.selectedPdfPath) {
      pageRange = getEffectivePdfPageRange();
      if (!pageRange) {
        throw new Error('Please enter a valid PDF start and end page range.');
      }

      if (!useDeterministicPdfParser) {
        updateProgress(5, 'Rendering selected PDF pages...');
        imageData = await renderPdfPagesToImages(appState.selectedPdfPath, pageRange);
      }
    } else {
      for (const imgPath of appState.selectedImages) {
        const result = await window.api.readImageAsBase64(imgPath);
        if (!result.success) throw new Error(`Failed to read image: ${imgPath}`);
        imageData.push({ ...result, label: imgPath.split(/[/\\]/).pop() });
      }
    }

    updateProgress(10, 'Reading JSON file metadata...');

    const lookUpTypes = {};
    for (const status of config.filingStatuses) {
      const filePath = appState.filePaths[status.key];
      if (filePath) {
        const result = await window.api.readCurrentJsonValues(filePath);
        lookUpTypes[status.key] = result.success
          ? (result.lookUpType || 'LowerBoundary')
          : 'LowerBoundary';
      } else {
        lookUpTypes[status.key] = 'LowerBoundary';
      }
    }

    if (useDeterministicPdfParser) {
      updateProgress(20, `Parsing ${config.name} PDF text directly...`);
      appState.extractedData = await extractPdfDeterministically(appState.selectedPdfPath, pageRange, config, lookUpTypes);

      updateProgress(85, 'Comparing with current JSON files...');
      await buildDiff();

      updateProgress(100, 'Complete!');
      setTimeout(() => setExtracting(false), 800);
      return;
    }

    updateProgress(20, 'Preparing request for OpenAI...');

    const slicedImages = [];
    for (let i = 0; i < imageData.length; i++) {
      const pageLabel = `page ${i + 1}`;
      updateProgress(20, `Preparing ${pageLabel} strips...`);
      const pageSlices = await getImageExtractionSlices(imageData[i], pageLabel, config);
      slicedImages.push(...pageSlices);
    }

    const prompt = buildExtractionPrompt(config, lookUpTypes);

    let mergedData = {};

    for (let i = 0; i < slicedImages.length; i++) {
      const slice = slicedImages[i];
      const startPct = 30 + Math.floor((i / slicedImages.length) * 40);
      const endPct = 30 + Math.floor(((i + 1) / slicedImages.length) * 40);

      updateProgress(startPct, `OpenAI is reading ${slice.label} of ${slicedImages.length}...`);
      const sliceConfig = slice.statusKeys?.length
        ? { ...config, filingStatuses: config.filingStatuses.filter(status => slice.statusKeys.includes(status.key)) }
        : config;
      const slicePrompt = sliceConfig === config ? prompt : buildExtractionPrompt(sliceConfig, lookUpTypes);
      const sliceData = await extractSinglePageData(slice, slicePrompt, sliceConfig, slice.label);

      updateProgress(Math.max(startPct + 1, endPct - 1), `Merging ${slice.label} results...`);
      mergedData = mergeExtractedData(mergedData, sliceData, config, slice.label);
    }

    appState.extractedData = mergedData;

    updateProgress(85, 'Comparing with current JSON files...');
    await buildDiff();

    updateProgress(100, 'Complete!');
    setTimeout(() => setExtracting(false), 800);

  } catch (error) {
    setExtracting(false);
    showToast(`Extraction failed: ${error.message}`, 'error');
    console.error('Extraction error:', error);
  }
}
async function buildDiff() {
  const config = appState.selectedStateConfig;
  const diffResults = {};

  for (const status of config.filingStatuses) {
    const filePath = appState.filePaths[status.key];
    const newValues = appState.extractedData[status.key];

    if (!filePath) {
      diffResults[status.key] = { error: 'No file path configured', changed: [], matched: 0, missing: 0 };
      continue;
    }

    const currentResult = await window.api.readCurrentJsonValues(filePath);
    if (!currentResult.success) {
      diffResults[status.key] = { error: currentResult.message, changed: [], matched: 0, missing: 0 };
      continue;
    }

    const currentValues = currentResult.values;
    const changed = [];
    let matched = 0;
    let missing = 0;
    let missingFromExtraction = 0;
    let minExtractedIncome = null;
    let maxExtractedIncome = null;

    for (const [incomeStr, newVal] of Object.entries(newValues)) {
      const income = parseInt(incomeStr);
      const currentVal = currentValues[income];

      minExtractedIncome = minExtractedIncome === null ? income : Math.min(minExtractedIncome, income);
      maxExtractedIncome = maxExtractedIncome === null ? income : Math.max(maxExtractedIncome, income);

      if (currentVal === undefined) {
        missing++;
      } else {
        const currentNum = Number(currentVal);
        const newNum = Number(newVal);
        if (currentNum !== newNum) {
          changed.push({ income, currentVal: currentNum, newVal: newNum, delta: newNum - currentNum });
        } else {
          matched++;
        }
      }
    }

    for (const incomeStr of Object.keys(currentValues)) {
      if (newValues[incomeStr] === undefined) {
        missingFromExtraction++;
      }
    }

    diffResults[status.key] = {
      changed,
      matched,
      missing,
      missingFromExtraction,
      totalExtracted: Object.keys(newValues).length,
      totalCurrent: Object.keys(currentValues).length,
      minExtractedIncome,
      maxExtractedIncome,
      currentYear: currentResult.year,
      lookUpType: currentResult.lookUpType
    };
  }

  appState.diffResults = diffResults;
  renderDiffSection();
  updateActionButtons();
}

function renderDiffSection() {
  const container = document.getElementById('diffSection');
  const config = appState.selectedStateConfig;

  if (!appState.diffResults || !config) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const tabsHtml = config.filingStatuses.map((status, i) => {
    const diff = appState.diffResults[status.key];
    const changedCount = diff?.changed?.length || 0;
    const hasError = diff?.error;
    const badge = hasError ? '!' : changedCount;
    const badgeClass = hasError ? 'badge-error' : changedCount > 0 ? 'badge-changed' : 'badge-ok';
    return `
      <button class="diff-tab ${i === 0 ? 'active' : ''}" data-status-key="${status.key}">
        ${status.fileLabel}
        <span class="diff-badge ${badgeClass}">${badge}</span>
      </button>
    `;
  }).join('');

  const panelsHtml = config.filingStatuses.map((status, i) => {
    const diff = appState.diffResults[status.key];
    return `
      <div class="diff-panel ${i === 0 ? 'active' : ''}" id="diff-panel-${status.key}">
        ${renderDiffPanel(status, diff)}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">Review Changes</h2>
      <p class="section-subtitle">Only rows with changed values are shown. Verify before updating.</p>
    </div>
    <div class="diff-tabs">${tabsHtml}</div>
    <div class="diff-panels">${panelsHtml}</div>
  `;

  container.querySelectorAll('.diff-tab').forEach(tab => {
    tab.addEventListener('click', () => showDiffTab(tab.dataset.statusKey));
  });
}
function renderDiffPanel(status, diff) {
  if (!diff) return '<p class="diff-empty">No data available.</p>';

  if (diff.error) {
    return `<div class="diff-error">⚠ ${diff.error}</div>`;
  }

  const summaryHtml = `
    <div class="diff-summary">
      <div class="diff-stat">
        <span class="diff-stat-value ${diff.changed.length > 0 ? 'changed' : 'ok'}">${diff.changed.length}</span>
        <span class="diff-stat-label">Changed</span>
      </div>
      <div class="diff-stat">
        <span class="diff-stat-value ok">${diff.matched}</span>
        <span class="diff-stat-label">Unchanged</span>
      </div>
      <div class="diff-stat">
        <span class="diff-stat-value ${diff.missing > 0 ? 'warn' : 'ok'}">${diff.missing}</span>
        <span class="diff-stat-label">Not in file</span>
      </div>
      <div class="diff-stat">
        <span class="diff-stat-value ${diff.missingFromExtraction > 0 ? 'warn' : 'ok'}">${diff.missingFromExtraction}</span>
        <span class="diff-stat-label">Missed by extraction</span>
      </div>
      <div class="diff-stat">
        <span class="diff-stat-value">${diff.totalExtracted} / ${diff.totalCurrent}</span>
        <span class="diff-stat-label">Extracted vs file</span>
      </div>
      ${diff.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${diff.currentYear} → ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}
    </div>
  `;

  const extractionWarning = diff.missingFromExtraction > 0
    ? `<div class="diff-error">Warning: ${diff.missingFromExtraction} file rows were not returned by extraction.${diff.minExtractedIncome !== null ? ` Extracted range: $${diff.minExtractedIncome.toLocaleString()} to $${diff.maxExtractedIncome.toLocaleString()}.` : ''}</div>`
    : '';

  if (diff.changed.length === 0) {
    return summaryHtml + extractionWarning + `<div class="diff-empty">✓ No value changes detected for this filing status.</div>`;
  }

  const rowsHtml = diff.changed.map(row => {
    const deltaClass = row.delta > 0 ? 'delta-up' : 'delta-down';
    const deltaSign = row.delta > 0 ? '+' : '';
    return `
      <tr>
        <td class="income-col">$${row.income.toLocaleString()}</td>
        <td class="current-col">${row.currentVal.toLocaleString()}</td>
        <td class="new-col">${row.newVal.toLocaleString()}</td>
        <td class="delta-col ${deltaClass}">${deltaSign}${row.delta.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  return summaryHtml + extractionWarning + `
    <div class="diff-table-wrapper">
      <table class="diff-table">
        <thead>
          <tr>
            <th>Income</th>
            <th>Current Value</th>
            <th>New Value</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
function showDiffTab(statusKey) {
  document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.diff-panel').forEach(p => p.classList.remove('active'));

  const tab = document.querySelector(`.diff-tab[data-status-key="${statusKey}"]`);
  const panel = document.getElementById(`diff-panel-${statusKey}`);
  if (tab) tab.classList.add('active');
  if (panel) panel.classList.add('active');
}

// ─── Update JSON files ────────────────────────────────────────────────────────

async function updateJsonFiles() {
  const config = appState.selectedStateConfig;
  const allPathsSet = config.filingStatuses.every(s => appState.filePaths[s.key]);

  if (!allPathsSet) {
    showToast('Please select all JSON file paths before updating.', 'error');
    return;
  }

  setUpdating(true);

  const updates = config.filingStatuses.map(status => ({
    statusKey: status.key,
    filePath: appState.filePaths[status.key],
    newValues: appState.extractedData[status.key]
  }));

  const results = await window.api.updateJsonFiles({
    taxYear: appState.taxYear,
    updates
  });

  setUpdating(false);

  const allSuccess = results.every(r => r.success);
  const failures = results.filter(r => !r.success);

  if (allSuccess) {
    showToast(`✓ All ${results.length} JSON files updated successfully for tax year ${appState.taxYear}!`, 'success');
    // Rebuild diff to show 0 changes after update
    await buildDiff();
  } else {
    const msg = failures.map(f => `${f.statusKey}: ${f.message}`).join('\n');
    showToast(`Some files failed to update:\n${msg}`, 'error');
  }
}

// ─── Extracted data display ───────────────────────────────────────────────────

function renderExtractedDataSection() {
  const section = document.getElementById('extractedDataSection');
  if (!appState.extractedData) {
    section.style.display = 'none';
    return;
  }

  const config = appState.selectedStateConfig;
  let totalEntries = 0;
  for (const vals of Object.values(appState.extractedData)) {
    totalEntries = Math.max(totalEntries, Object.keys(vals).length);
  }

  const maxIncome = Math.max(
    ...Object.values(appState.extractedData)
      .flatMap(v => Object.keys(v).map(Number))
  );

  section.style.display = 'block';
  document.getElementById('extractionSummary').innerHTML = `
    <div class="extraction-stat"><span>${totalEntries}</span><label>Income brackets</label></div>
    <div class="extraction-stat"><span>${config.filingStatuses.length}</span><label>Filing statuses</label></div>
    <div class="extraction-stat"><span>$${maxIncome.toLocaleString()}</span><label>Max income</label></div>
    <div class="extraction-stat"><span>${appState.taxYear}</span><label>Tax year</label></div>
  `;
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById('settingsPanel').classList.add('open');
  document.getElementById('apiKeyInput').value = getOpenAIApiKey();
}

function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('open');
}

async function saveSettings() {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  appState.settings.openaiApiKey = apiKey;
  await window.api.saveSettings(appState.settings);
  updateApiKeyIndicator();
  closeSettings();
  showToast('Settings saved.', 'success');
}

function updateApiKeyIndicator() {
  const indicator = document.getElementById('apiKeyIndicator');
  const hasKey = Boolean(getOpenAIApiKey());
  indicator.className = `api-key-dot ${hasKey ? 'connected' : 'missing'}`;
  indicator.title = hasKey ? 'API key configured' : 'No API key — click Settings';
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput');
  const btn = document.getElementById('toggleApiKeyBtn');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setExtracting(active) {
  const btn = document.getElementById('extractBtn');
  const progress = document.getElementById('extractionProgress');
  btn.disabled = active;
  btn.textContent = active ? 'Extracting...' : 'Extract Data from Images';
  progress.style.display = active ? 'block' : 'none';
  if (!active) updateProgress(0, '');
}

function setUpdating(active) {
  const btn = document.getElementById('updateJsonBtn');
  btn.disabled = active;
  btn.textContent = active ? 'Updating...' : 'Update JSON Files';
}

function updateProgress(pct, msg) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = msg;
}

function updateActionButtons() {
  const config = appState.selectedStateConfig;
  const hasSource = appState.selectedImages.length > 0 || Boolean(appState.selectedPdfPath);
  const hasExtracted = Boolean(appState.extractedData);
  const allPathsSet = config
    ? config.filingStatuses.every(s => appState.filePaths[s.key])
    : false;

  document.getElementById('extractBtn').disabled = !hasSource;
  document.getElementById('updateJsonBtn').disabled = !(hasExtracted && allPathsSet);
}

let toastTimeout;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─── Event bindings ───────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('stateSelect').addEventListener('change', e => onStateChange(e.target.value));

  document.getElementById('taxYearSelect').addEventListener('change', e => {
    appState.taxYear = parseInt(e.target.value);
  });

  document.getElementById('regulatoryYearInput').addEventListener('change', async e => {
    appState.regulatoryYear = parseInt(e.target.value);
    await loadFilePaths();
    renderFilePickers();
  });

  document.getElementById('selectImagesBtn').addEventListener('click', selectImages);
  document.getElementById('selectPdfBtn').addEventListener('click', selectPdf);
  document.getElementById('pdfPageStartInput').addEventListener('input', e => { appState.pdfPageRangeOverride.start = e.target.value.trim(); appState.pdfPageRangeSource = 'manual override'; renderSelectedSource(); updateActionButtons(); });
  document.getElementById('pdfPageEndInput').addEventListener('input', e => { appState.pdfPageRangeOverride.end = e.target.value.trim(); appState.pdfPageRangeSource = 'manual override'; renderSelectedSource(); updateActionButtons(); });
  document.getElementById('extractBtn').addEventListener('click', extractData);
  document.getElementById('updateJsonBtn').addEventListener('click', updateJsonFiles);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('toggleApiKeyBtn').addEventListener('click', toggleApiKeyVisibility);
  document.getElementById('settingsOverlay').addEventListener('click', closeSettings);
}

// ─── Start ────────────────────────────────────────────────────────────────────

init();




























