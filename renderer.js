
const STANDARD_WORKFLOW_KEY = 'standard';
const MARRIAGE_CREDIT_WORKFLOW_KEY = 'm1ma';
const HOMEOWNER_REFUND_WORKFLOW_KEY = 'm1pr';
const MARRIAGE_CREDIT_FILE_TARGET = {
  key: 'M1MA',
  label: 'Marriage Credit',
  fileLabel: 'M1MA'
};
const HOMEOWNER_REFUND_FILE_TARGETS = [
  { key: 'M1PR_ROW', label: 'Homeowner Refund Row Table', fileLabel: 'M1PR Row' },
  { key: 'M1PR_REFUND', label: 'Homeowner Refund Table', fileLabel: 'M1PR Refund' }
];

let appState = {
  selectedStateCode: null,
  selectedStateConfig: null,
  selectedWorkflowKey: STANDARD_WORKFLOW_KEY,
  taxYear: new Date().getFullYear(),
  filePaths: {},
  selectedPdfPath: null,
  pdfPageRangeOverride: { start: '', end: '' },
  extractedData: null,
  diffResults: null,
  marriageCreditReview: null,
  homeownerRefundReview: null,
  homeownerRefundUi: {
    activeTab: 'rowTable',
    statusFilters: {
      rowTable: 'all',
      refundTable: 'all'
    }
  },
};

async function init() {
  const states = await window.api.getAllStates();
  populateStateDropdown(states);
  populateYearDropdowns();
  bindEvents();
  if (states.length > 0) {
    document.getElementById('stateSelect').value = states[0].code;
    await onStateChange(states[0].code);
  }
}

function populateStateDropdown(states) {
  document.getElementById('stateSelect').innerHTML = states.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('');
}

function populateYearDropdowns() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 3; y--) years.push(y);
  document.getElementById('taxYearSelect').innerHTML = years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('');
  appState.taxYear = currentYear;
}

function resetExtractedState() {
  appState.extractedData = null;
  appState.diffResults = null;
  appState.marriageCreditReview = null;
  appState.homeownerRefundReview = null;
  appState.homeownerRefundUi = {
    activeTab: 'rowTable',
    statusFilters: {
      rowTable: 'all',
      refundTable: 'all'
    }
  };
}

function getWorkflowOptions() {
  if (appState.selectedStateConfig?.code === 'MN') {
    return [
      { key: STANDARD_WORKFLOW_KEY, label: 'Standard Tax Tables', hint: 'Minnesota M1 filing-status tables with diff review.' },
      { key: MARRIAGE_CREDIT_WORKFLOW_KEY, label: 'M1MA Marriage Credit', hint: 'Extract the two-key marriage-credit table, preview the full grid, then replace one JSON file.' },
      { key: HOMEOWNER_REFUND_WORKFLOW_KEY, label: 'M1PR Homeowner Refund', hint: 'Extract the row-table and refund-table grids, review both, then replace two JSON files.' }
    ];
  }
  return [{ key: STANDARD_WORKFLOW_KEY, label: 'Standard Tax Tables', hint: 'Built-in PDF extraction for the configured tax tables.' }];
}

function isMarriageCreditWorkflow() {
  return appState.selectedStateConfig?.code === 'MN' && appState.selectedWorkflowKey === MARRIAGE_CREDIT_WORKFLOW_KEY;
}

function isHomeownerRefundWorkflow() {
  return appState.selectedStateConfig?.code === 'MN' && appState.selectedWorkflowKey === HOMEOWNER_REFUND_WORKFLOW_KEY;
}

function getWorkflowStorageKey() {
  if (isMarriageCreditWorkflow()) return MARRIAGE_CREDIT_WORKFLOW_KEY;
  if (isHomeownerRefundWorkflow()) return HOMEOWNER_REFUND_WORKFLOW_KEY;
  return STANDARD_WORKFLOW_KEY;
}

function getActiveFileTargets() {
  if (isMarriageCreditWorkflow()) return [MARRIAGE_CREDIT_FILE_TARGET];
  if (isHomeownerRefundWorkflow()) return HOMEOWNER_REFUND_FILE_TARGETS;
  return appState.selectedStateConfig?.filingStatuses || [];
}

function renderWorkflowPicker() {
  const group = document.getElementById('workflowGroup');
  const select = document.getElementById('workflowSelect');
  const hint = document.getElementById('workflowHint');
  const options = getWorkflowOptions();
  if (options.length <= 1) {
    group.style.display = 'none';
    select.innerHTML = '';
    hint.textContent = '';
    appState.selectedWorkflowKey = STANDARD_WORKFLOW_KEY;
    return;
  }
  group.style.display = 'flex';
  select.innerHTML = options.map(option => `<option value="${option.key}" ${option.key === appState.selectedWorkflowKey ? 'selected' : ''}>${option.label}</option>`).join('');
  hint.textContent = (options.find(option => option.key === appState.selectedWorkflowKey) || options[0]).hint;
}

function renderWorkflowText() {
  document.getElementById('sourceSubtitle').textContent = isMarriageCreditWorkflow()
    ? 'Select the Minnesota Schedule M1MA instruction PDF and the page range that contains the marriage-credit table.'
    : isHomeownerRefundWorkflow()
      ? 'Select the Minnesota M1PR instruction PDF and the page range that contains the Homestead Credit Refund Table.'
      : 'Select an instruction PDF for the selected state and year.';
  document.getElementById('uploadHint').textContent = isMarriageCreditWorkflow()
    ? 'PDF only - use the page range that contains the marriage-credit table'
    : isHomeownerRefundWorkflow()
      ? 'PDF only - use the page range that contains the Homestead Credit Refund Table'
      : 'PDF only - enter the start and end tax-table pages manually';
  document.getElementById('pageRangeHint').textContent = isMarriageCreditWorkflow()
    ? 'Enter the exact PDF pages that contain the Schedule M1MA marriage-credit table before extracting.'
    : isHomeownerRefundWorkflow()
      ? 'Enter the exact PDF pages that contain the Homestead Credit Refund Table before extracting.'
      : 'Enter the exact tax-table pages from the selected PDF before running extraction.';
  document.getElementById('extractSectionTitle').textContent = isMarriageCreditWorkflow()
    ? 'Extract Marriage Credit Table'
    : isHomeownerRefundWorkflow()
      ? 'Extract Homeowner Refund Tables'
      : 'Extract Data';
  document.getElementById('extractSectionSubtitle').textContent = isMarriageCreditWorkflow()
    ? 'The built-in parser reads the M1MA table and prepares a full two-key preview for review.'
    : isHomeownerRefundWorkflow()
      ? 'The built-in parser reads the M1PR Homestead Credit Refund Table and prepares both review tables.'
      : 'The built-in parser reads the selected PDF pages and extracts all income brackets.';
  document.getElementById('updateSectionTitle').textContent = isMarriageCreditWorkflow()
    ? 'Replace Marriage Credit JSON'
    : isHomeownerRefundWorkflow()
      ? 'Replace Homeowner Refund JSON'
      : 'Update JSON Files';
  document.getElementById('updateSectionSubtitle').textContent = isMarriageCreditWorkflow()
    ? 'Writes a full replacement MNMarriageCredit table after you review the extracted grid.'
    : isHomeownerRefundWorkflow()
      ? 'Writes full replacement M1PR row and refund tables after you review both extracted grids.'
      : 'Writes new values to all filing status files. Review the diff above before proceeding.';
  document.getElementById('updateJsonBtn').textContent = isMarriageCreditWorkflow()
    ? 'Replace Marriage Credit JSON'
    : isHomeownerRefundWorkflow()
      ? 'Replace Homeowner Refund JSON'
      : 'Update JSON Files';
}

async function onStateChange(stateCode) {
  appState.selectedStateCode = stateCode;
  appState.selectedStateConfig = await window.api.getStateConfig(stateCode);
  appState.selectedWorkflowKey = STANDARD_WORKFLOW_KEY;
  appState.filePaths = {};
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  resetExtractedState();
  renderWorkflowPicker();
  renderWorkflowText();
  renderSelectedSource();
  await loadFilePaths();
  renderFilePickers();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
}

async function onWorkflowChange(workflowKey) {
  appState.selectedWorkflowKey = workflowKey;
  appState.filePaths = {};
  resetExtractedState();
  renderWorkflowPicker();
  renderWorkflowText();
  renderSelectedSource();
  await loadFilePaths();
  renderFilePickers();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
}

async function loadFilePaths() {
  appState.filePaths = await window.api.readJsonFilePaths(appState.selectedStateCode, appState.taxYear, getWorkflowStorageKey()) || {};
}

function renderFilePickers() {
  const targets = getActiveFileTargets();
  document.getElementById('filePickersContainer').innerHTML = targets.map(target => {
    const currentPath = appState.filePaths[target.key] || '';
    return `<div class="file-picker-row" data-key="${target.key}"><div class="file-picker-label"><span class="status-badge">${target.fileLabel}</span><span class="status-desc">${target.label}</span></div><div class="file-picker-input"><code class="path-display" id="path-${target.key}">${currentPath || 'Not selected'}</code></div></div>`;
  }).join('');
}

async function persistFilePaths() {
  await window.api.saveJsonFilePaths(appState.selectedStateCode, { stateCode: appState.selectedStateCode, regulatoryYear: appState.taxYear, filePaths: appState.filePaths }, getWorkflowStorageKey());
}

async function selectPdf() {
  const selected = await window.api.selectPdfFile();
  if (!selected) return;
  appState.selectedPdfPath = selected;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  resetExtractedState();
  renderSelectedSource();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
}

function getEffectivePdfPageRange() {
  const start = parseInt(appState.pdfPageRangeOverride.start, 10);
  const end = parseInt(appState.pdfPageRangeOverride.end, 10);
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start ? { start, end } : null;
}

function syncPdfPageInputs() {
  document.getElementById('pdfPageStartInput').value = appState.pdfPageRangeOverride.start;
  document.getElementById('pdfPageEndInput').value = appState.pdfPageRangeOverride.end;
}

function getWorkflowPageRangeLabel() {
  if (isMarriageCreditWorkflow()) return 'Schedule M1MA pages';
  if (isHomeownerRefundWorkflow()) return 'M1PR refund-table pages';
  return 'Tax table pages';
}

function getPendingWorkflowPageRangeLabel() {
  if (isMarriageCreditWorkflow()) return 'Enter the Schedule M1MA table page range';
  if (isHomeownerRefundWorkflow()) return 'Enter the M1PR refund-table page range';
  return `Enter required PDF start/end pages for tax year ${appState.taxYear}`;
}

function renderSelectedSource() {
  const pdfSection = document.getElementById('pdfSelectionSection');
  const pdfSummary = document.getElementById('pdfSelectionSummary');
  if (appState.selectedPdfPath) {
    const effective = getEffectivePdfPageRange();
    pdfSection.style.display = 'block';
    syncPdfPageInputs();
    const fileName = appState.selectedPdfPath.split(/[\/\\]/).pop();
    pdfSummary.textContent = effective
      ? `PDF selected: ${fileName} | ${getWorkflowPageRangeLabel()} ${effective.start}-${effective.end}`
      : `PDF selected: ${fileName} | ${getPendingWorkflowPageRangeLabel()}`;
    return;
  }
  pdfSection.style.display = 'none';
  pdfSummary.textContent = '';
  syncPdfPageInputs();
}

function mergeExtractedData(existing, incoming, config, pageLabel) {
  const merged = { ...existing };
  for (const status of config.filingStatuses) {
    const currentValues = merged[status.key] ? { ...merged[status.key] } : {};
    const incomingValues = incoming[status.key] || {};
    for (const [incomeKey, value] of Object.entries(incomingValues)) {
      if (currentValues[incomeKey] !== undefined && currentValues[incomeKey] !== value) throw new Error(`Conflicting value for ${status.label} at income ${incomeKey} on ${pageLabel}. Existing value: ${currentValues[incomeKey]}, new value: ${value}.`);
      if (currentValues[incomeKey] === value) continue;
      currentValues[incomeKey] = value;
    }
    merged[status.key] = currentValues;
  }
  return merged;
}

let pdfJsLibPromise;
async function getPdfJsLib() {
  if (!pdfJsLibPromise) pdfJsLibPromise = import('./node_modules/pdfjs-dist/build/pdf.mjs');
  const pdfjsLib = await pdfJsLibPromise;
  pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs';
  return pdfjsLib;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseIntegerText(str) {
  if (typeof str !== 'string') return null;
  const clean = str.trim();
  if (!/^\d[\d,]*$/.test(clean)) return null;
  const value = parseInt(clean.replace(/,/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

function groupPdfTextItemsByRow(items, tolerance = 1.5) {
  const sorted = items.filter(item => Number.isFinite(item.x) && Number.isFinite(item.y) && item.str && item.str.trim()).sort((a, b) => Math.abs(b.y - a.y) < tolerance ? a.x - b.x : b.y - a.y);
  const rows = [];
  for (const item of sorted) {
    const row = rows.find(existing => Math.abs(existing.y - item.y) <= tolerance);
    if (row) { row.items.push(item); row.y = (row.y + item.y) / 2; } else rows.push({ y: item.y, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

function getMinnesotaPdfBlockColumnRanges(pageWidth) {
  const byRatio = (start, end) => [pageWidth * start, pageWidth * end];
  return [byRatio(0.08, 0.535), byRatio(0.53, 0.99)];
}

function findNumericItemsInRange(items, range) {
  return items.filter(item => item.x >= range[0] && item.x <= range[1]).map(item => ({ ...item, numericValue: parseIntegerText(item.str) })).filter(item => item.numericValue !== null).sort((a, b) => a.x - b.x);
}

function findMinnesotaValueWindow(numericItems) {
  for (let i = 0; i <= numericItems.length - 6; i++) {
    const window = numericItems.slice(i, i + 6);
    const [lower, upper, single, mfj, mfs, hoh] = window;
    if (lower.numericValue >= upper.numericValue) continue;
    if (window.some(item => !Number.isFinite(item.numericValue))) continue;
    return { lower, upper, single, mfj, mfs, hoh };
  }
  return null;
}

function parseMinnesotaPdfRows(textItems, pageWidth) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const parsed = [];
  for (const row of rows) for (const range of getMinnesotaPdfBlockColumnRanges(pageWidth)) {
    const numericItems = findNumericItemsInRange(row.items, range);
    if (numericItems.length < 6) continue;
    const valueWindow = findMinnesotaValueWindow(numericItems);
    if (!valueWindow) continue;
    const { lower, upper, single, mfj, mfs, hoh } = valueWindow;
    parsed.push({ income: lower.numericValue, upperIncome: upper.numericValue, values: { Single: single.numericValue, MFJ: mfj.numericValue, MFS: mfs.numericValue, HOH: hoh.numericValue } });
  }
  return parsed;
}

function normalizeDeterministicRowsToData(rows, config, lookUpTypes, pageLabel) {
  const normalized = {};
  for (const status of config.filingStatuses) normalized[status.key] = {};
  for (const row of rows) for (const status of config.filingStatuses) {
    const lookUpType = lookUpTypes[status.key] || 'LowerBoundary';
    const key = lookUpType === 'UpperBoundary' ? row.upperIncome : row.income;
    const value = row.values[status.key];
    if (!Number.isFinite(key) || !Number.isFinite(value)) throw new Error(`Deterministic parser produced invalid numeric data for ${status.label} on ${pageLabel}.`);
    if (normalized[status.key][key] !== undefined && normalized[status.key][key] !== value) throw new Error(`Deterministic parser produced conflicting ${status.label} values at income ${key} on ${pageLabel}.`);
    normalized[status.key][key] = value;
  }
  return normalized;
}

function parseOrPdfRows(textItems, pageWidth) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const blockRanges = [[pageWidth * 0.09, pageWidth * 0.29], [pageWidth * 0.30, pageWidth * 0.50], [pageWidth * 0.51, pageWidth * 0.71], [pageWidth * 0.72, pageWidth * 0.93]];
  const parsed = [];
  for (const row of rows) for (const range of blockRanges) {
    const rowText = row.items.filter(item => item.x >= range[0] && item.x <= range[1]).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!rowText) continue;
    const numbers = Array.from(rowText.matchAll(/\d[\d,]*/g)).map(match => parseInt(match[0].replace(/,/g, ''), 10));
    if (numbers.length !== 4) continue;
    const [income, upperIncome, sValue, jValue] = numbers;
    if (!(income < upperIncome)) continue;
    parsed.push({ income, upperIncome, values: { S: sValue, J: jValue } });
  }
  return parsed;
}
function getRowText(row) {
  return row.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
}

function getRowNumericValues(row) {
  return row.items.map(item => parseIntegerText(item.str)).filter(value => value !== null);
}

function isStrictlyAscending(values) {
  for (let i = 1; i < values.length; i++) if (values[i] <= values[i - 1]) return false;
  return true;
}

function flattenMarriageCreditRows(jointLowerBounds, matrixRows) {
  const rowsFlat = [];
  for (const matrixRow of matrixRows) {
    jointLowerBounds.forEach((jointLower, index) => {
      rowsFlat.push({
        separateIncome: matrixRow.separateLower,
        jointIncome: jointLower,
        value: matrixRow.values[index],
        source: 'pdf'
      });
    });
  }
  return { jointLowerBounds, matrixRows, rows: rowsFlat };
}

function parseMarriageCreditPdfRows(textItems) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));

  const amountLabelIndex = rows.findIndex(row => {
    const rowText = getRowText(row).toLowerCase();
    return rowText.includes('credit') && rowText.includes('amount');
  });

  if (amountLabelIndex === -1) {
    throw new Error('Could not locate the start of the marriage-credit data rows.');
  }

  let lowerHeaderIndex = -1;
  for (let index = amountLabelIndex - 1; index >= 0; index--) {
    const numbers = getRowNumericValues(rows[index]);
    if (numbers.length >= 15 && isStrictlyAscending(numbers.slice(0, 15)) && numbers[0] >= 40000) {
      lowerHeaderIndex = index;
      break;
    }
  }

  if (lowerHeaderIndex === -1) {
    throw new Error('Could not locate the marriage-credit joint-income header row.');
  }

  const jointLowerBounds = getRowNumericValues(rows[lowerHeaderIndex]).slice(0, 15);
  if (jointLowerBounds.length !== 15) {
    throw new Error(`Expected 15 joint-income brackets, found ${jointLowerBounds.length}.`);
  }

  const matrixRows = [];
  for (let index = amountLabelIndex + 1; index < rows.length; index++) {
    const numbers = getRowNumericValues(rows[index]);
    if (numbers.length < jointLowerBounds.length + 2) continue;

    const separateLower = numbers[0];
    const separateUpper = numbers[1];
    const values = numbers.slice(2, 2 + jointLowerBounds.length);

    if (!(separateLower < separateUpper) || values.length !== jointLowerBounds.length) continue;

    matrixRows.push({ separateLower, separateUpper, values });
  }

  if (matrixRows.length === 0) {
    throw new Error('Deterministic parser found no marriage-credit data rows.');
  }

  return flattenMarriageCreditRows(jointLowerBounds, matrixRows);
}

function parseMarriageCreditFromFullText(textItems) {
  const joinedText = textItems
    .map(item => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const anchorMatch = joinedText.match(/and line 7 is at least:\s*(.*?)\s*your credit amount is:/i);
  if (!anchorMatch) {
    throw new Error('Could not locate the marriage-credit header text block.');
  }

  const headerNumbers = Array.from(anchorMatch[1].matchAll(/\d[\d,]*/g))
    .map(match => parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite);
  const jointLowerBounds = headerNumbers.slice(0, 15);

  if (jointLowerBounds.length !== 15) {
    throw new Error(`Expected 15 joint-income brackets in full text, found ${jointLowerBounds.length}.`);
  }

  const bodyMatch = joinedText.match(/your credit amount is:\s*(.*?)(?:202\d\s+Schedule\s+M1MA\s+Instructions|$)/i);
  if (!bodyMatch) {
    throw new Error('Could not locate the marriage-credit table body text.');
  }

  const bodyNumbers = Array.from(bodyMatch[1].matchAll(/\d[\d,]*/g))
    .map(match => parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite);

  const matrixRows = [];
  const rowWidth = 17;
  for (let index = 0; index + rowWidth <= bodyNumbers.length; index += rowWidth) {
    const slice = bodyNumbers.slice(index, index + rowWidth);
    const separateLower = slice[0];
    const separateUpper = slice[1];
    const values = slice.slice(2);

    if (!(separateLower < separateUpper) || values.length !== 15) {
      break;
    }

    matrixRows.push({ separateLower, separateUpper, values });
  }

  if (matrixRows.length === 0) {
    throw new Error('Deterministic parser found no marriage-credit rows in the full text stream.');
  }

  return flattenMarriageCreditRows(jointLowerBounds, matrixRows);
}

function isSequentialStep(values, step) {
  if (values.length < 2) return false;
  for (let index = 1; index < values.length; index++) if (values[index] - values[index - 1] !== step) return false;
  return true;
}

function looksLikeHomeownerRefundAmountHeader(values) {
  return values.length >= 8 && values.length <= 12 && values[0] >= 0 && isSequentialStep(values, 25);
}

function parseHomeownerRefundPageRows(textItems) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const parsedRows = [];

  for (let index = 0; index < rows.length; index++) {
    const amountStarts = getRowNumericValues(rows[index]);
    if (!looksLikeHomeownerRefundAmountHeader(amountStarts)) continue;

    let upperHeaderIndex = -1;
    // The final M1PR page can insert worksheet labels between the lower and upper amount headers.
    for (let candidate = index + 1; candidate <= Math.min(rows.length - 1, index + 8); candidate++) {
      const amountEnds = getRowNumericValues(rows[candidate]);
      const rowText = getRowText(rows[candidate]).toLowerCase();
      const matchingNumericValues = amountEnds.length === amountStarts.length || amountEnds.length === amountStarts.length - 1;
      if (!matchingNumericValues) continue;
      if (!amountEnds.every((value, amountIndex) => value === amountStarts[amountIndex] + 25)) continue;
      if (amountEnds.length !== amountStarts.length && !rowText.includes('&')) continue;
      upperHeaderIndex = candidate;
      break;
    }

    if (upperHeaderIndex === -1) continue;

    let lastDataIndex = upperHeaderIndex;
    for (let rowIndex = upperHeaderIndex + 1; rowIndex < rows.length; rowIndex++) {
      const rowText = getRowText(rows[rowIndex]);
      const rowTextLower = rowText.toLowerCase();
      const numericValues = getRowNumericValues(rows[rowIndex]);

      if (looksLikeHomeownerRefundAmountHeader(numericValues)) break;
      if (rowTextLower.includes('refund worksheet')) break;
      if (rowTextLower.includes('homestead credit refund table') && numericValues.length === 0) {
        if (parsedRows.length > 0) break;
        continue;
      }
      if (numericValues.length < amountStarts.length + 1) continue;

      const rowLower = numericValues[0];
      const truncatedByWorksheetMarker = rowText.includes('*');
      let hasNumericUpper = numericValues.length >= amountStarts.length + 2 || (truncatedByWorksheetMarker && numericValues.length >= amountStarts.length + 1);
      let rowUpper = hasNumericUpper ? numericValues[1] : null;
      const values = numericValues.slice(hasNumericUpper ? 2 : 1, (hasNumericUpper ? 2 : 1) + amountStarts.length);
      const alignedAmountStarts = amountStarts;
      const isFinalHomeownerAmountSegment = amountStarts[amountStarts.length - 1] === 3500;
      const hasSuspiciousTrailingValue = isFinalHomeownerAmountSegment && values.length === amountStarts.length && values.length > 1 && values[values.length - 1] < values[values.length - 2];
      const hasImplausiblyLargeTrailingValue = isFinalHomeownerAmountSegment && values.length === amountStarts.length && values.length > 1 && values[values.length - 1] > values[values.length - 2] + 500;
      const misreadUpperLooksLikeFirstRefund = hasSuspiciousTrailingValue && hasNumericUpper && Number.isFinite(rowUpper) && values.length > 0 && Math.abs(values[0] - rowUpper - 22) <= 3;
      let alignedValues = truncatedByWorksheetMarker && values.length === amountStarts.length - 1
        ? [...values, 99999]
        : values;
      let starValueIndices = truncatedByWorksheetMarker && values.length === amountStarts.length - 1
        ? [amountStarts.length - 1]
        : [];

      if (misreadUpperLooksLikeFirstRefund) {
        alignedValues = [rowUpper, ...values.slice(0, -1), 99999];
        starValueIndices = [amountStarts.length - 1];
        hasNumericUpper = false;
        rowUpper = null;
      } else if (hasSuspiciousTrailingValue || hasImplausiblyLargeTrailingValue) {
        alignedValues = [...values.slice(0, -1), 99999];
        starValueIndices = [amountStarts.length - 1];
      }

      if (alignedValues.length !== alignedAmountStarts.length) continue;
      if (hasNumericUpper && !(rowLower < rowUpper)) continue;

      parsedRows.push({ rowLower, rowUpper, amountStarts: alignedAmountStarts, values: alignedValues, starValueIndices });
      lastDataIndex = rowIndex;
    }

    index = lastDataIndex;
  }

  if (parsedRows.length === 0) {
    throw new Error('Deterministic parser found no homeowner-refund rows in the selected page.');
  }

  return parsedRows;
}

function sortGenericTableRows(rows) {
  return [...rows].sort((a, b) => {
    const maxLength = Math.max(a.key.length, b.key.length);
    for (let index = 0; index < maxLength; index++) {
      const left = a.key[index] ?? Number.NEGATIVE_INFINITY;
      const right = b.key[index] ?? Number.NEGATIVE_INFINITY;
      if (left !== right) return left - right;
    }
    return Number(a.value) - Number(b.value);
  });
}

function buildGenericTableKey(row) {
  return row.key.join('|');
}

function buildGenericTableReview(extractedRows, currentTableResult = null, options = {}) {
  const normalizedExtractedRows = sortGenericTableRows(extractedRows.map(row => ({
    ...row,
    key: row.key.map(part => Number(part)),
    value: Number(row.value),
    source: row.source || 'pdf'
  })));
  const currentRows = currentTableResult?.success ? sortGenericTableRows(currentTableResult.rows.map(row => ({ key: row.key.map(part => Number(part)), value: Number(row.value) }))) : [];
  const currentByKey = new Map(currentRows.map(row => [buildGenericTableKey(row), row]));
  let changedCount = 0;
  let unchangedCount = 0;
  let newCount = 0;

  const reviewRows = normalizedExtractedRows.map(row => {
    const current = currentByKey.get(buildGenericTableKey(row));
    let reviewStatus = 'new';
    if (current) {
      if (Number(current.value) === Number(row.value)) { reviewStatus = 'match'; unchangedCount++; }
      else { reviewStatus = 'changed'; changedCount++; }
    } else newCount++;
    return { ...row, currentValue: current ? Number(current.value) : null, reviewStatus };
  });

  const combinedKeys = new Set(reviewRows.map(buildGenericTableKey));
  const missingCount = currentRows.filter(row => !combinedKeys.has(buildGenericTableKey(row))).length;

  return {
    rows: reviewRows,
    extractedCount: options.extractedCountOverride ?? normalizedExtractedRows.length,
    currentCount: currentRows.length,
    changedCount,
    unchangedCount,
    newCount,
    missingCount,
    currentYear: currentTableResult?.year || null
  };
}

function overlayGenericTableRows(currentRows, extractedRows) {
  const rowMap = new Map((currentRows || []).map(row => [buildGenericTableKey(row), { ...row, key: [...row.key], value: Number(row.value) }]));
  for (const row of extractedRows) rowMap.set(buildGenericTableKey(row), { ...row, key: [...row.key], value: Number(row.value) });
  return sortGenericTableRows([...rowMap.values()]);
}

function normalizeHomeownerRefundJsonRows(rows) {
  return rows.map(row => ({
    key: [...row.key],
    value: row.isStarValue ? 99999 : Number(row.value)
  }));
}

function buildHomeownerRefundTables(parsedRows) {
  const rowNumberByLower = new Map();
  const rowLowers = [];

  for (const parsedRow of parsedRows) {
    if (!rowNumberByLower.has(parsedRow.rowLower)) {
      rowNumberByLower.set(parsedRow.rowLower, rowNumberByLower.size + 1);
      rowLowers.push(parsedRow.rowLower);
    }
  }

  const rowTableRows = rowLowers.map((rowLower, index) => ({
    key: [index === 0 ? -1000000 : rowLower],
    value: index + 1
  }));

  const refundRows = [];
  for (let parsedRowIndex = 0; parsedRowIndex < parsedRows.length; parsedRowIndex++) {
    const parsedRow = parsedRows[parsedRowIndex];
    const nextParsedRow = parsedRows[parsedRowIndex + 1] || null;
    const rowNumber = rowNumberByLower.get(parsedRow.rowLower);
    parsedRow.amountStarts.forEach((amountStart, amountIndex) => {
      const isLastAmountColumn = amountIndex === parsedRow.amountStarts.length - 1;
      const leaksNextRowBoundary = isLastAmountColumn && amountStart === 3500 && nextParsedRow && Number(parsedRow.values[amountIndex]) === Number(nextParsedRow.rowLower);
      const isStarValue = parsedRow.starValueIndices?.includes(amountIndex)
        || Number(parsedRow.values[amountIndex]) === 99999
        || leaksNextRowBoundary;
      refundRows.push({
        key: [rowNumber, amountStart],
        value: isStarValue ? 99999 : parsedRow.values[amountIndex],
        isStarValue
      });
    });
  }

  return {
    rowTableRows: sortGenericTableRows(rowTableRows),
    refundRows: sortGenericTableRows(refundRows)
  };
}

async function extractHomeownerRefundFromPdf(filePath, pageRange) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let parsedRows = [];
  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), `Parsing M1PR page ${pageNo}...`);
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    parsedRows = parsedRows.concat(parseHomeownerRefundPageRows(textContent.items));
  }
  if (parsedRows.length === 0) throw new Error('Deterministic parser found no homeowner-refund rows in the selected page range.');
  return buildHomeownerRefundTables(parsedRows);
}

async function extractPdfDeterministically(filePath, pageRange, config, lookUpTypes) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let mergedData = {};
  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), `Parsing ${config.name} PDF page ${pageNo}...`);
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const rows = config.code === 'MN' ? parseMinnesotaPdfRows(textContent.items, viewport.width) : parseOrPdfRows(textContent.items, viewport.width);
    if (rows.length === 0) throw new Error(`Deterministic parser found no tax table rows on page ${pageNo}.`);
    mergedData = mergeExtractedData(mergedData, normalizeDeterministicRowsToData(rows, config, lookUpTypes, `page ${pageNo}`), config, `page ${pageNo}`);
  }
  return mergedData;
}

async function extractMarriageCreditFromPdf(filePath, pageRange) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let extractedRows = [];
  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), `Parsing Schedule M1MA page ${pageNo}...`);
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    let parsedPage;
    try {
      parsedPage = parseMarriageCreditPdfRows(textContent.items);
    } catch (rowError) {
      parsedPage = parseMarriageCreditFromFullText(textContent.items);
    }
    extractedRows = extractedRows.concat(parsedPage.rows);
  }
  if (extractedRows.length === 0) throw new Error('Deterministic parser found no marriage-credit rows in the selected page range.');
  return { rows: sortMarriageCreditRows(extractedRows) };
}

function sortMarriageCreditRows(rows) {
  return [...rows].sort((a, b) => a.separateIncome - b.separateIncome || a.jointIncome - b.jointIncome);
}

function buildMarriageCreditKey(row) {
  return `${row.separateIncome}|${row.jointIncome}`;
}

function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function buildMarriageCreditReview(extractedRows, currentTableResult = null) {
  const extractedOnlyRows = sortMarriageCreditRows(extractedRows.map(row => ({ separateIncome: Number(row.separateIncome), jointIncome: Number(row.jointIncome), value: Number(row.value), source: row.source || 'pdf' })));
  const extractedByKey = new Map(extractedOnlyRows.map(row => [buildMarriageCreditKey(row), row]));
  const currentRows = currentTableResult?.success ? sortMarriageCreditRows(currentTableResult.rows) : [];
  const currentByKey = new Map(currentRows.map(row => [buildMarriageCreditKey(row), row]));
  const warnings = [];
  const carriedRows = [];
  const missingCurrentRows = currentRows.filter(row => !extractedByKey.has(buildMarriageCreditKey(row)));

  if (missingCurrentRows.length > 0) {
    const currentSeparateBrackets = getUniqueSorted(currentRows.map(row => row.separateIncome));
    const highestSeparateIncome = currentSeparateBrackets[currentSeparateBrackets.length - 1];
    const topBracketRows = currentRows.filter(row => row.separateIncome === highestSeparateIncome);
    const missingOnlyTopBracket = missingCurrentRows.length === topBracketRows.length && missingCurrentRows.every(row => row.separateIncome === highestSeparateIncome);
    if (missingOnlyTopBracket) {
      carriedRows.push(...topBracketRows.map(row => ({ ...row, source: 'existing-file' })));
      warnings.push(`PDF text extraction did not return the ${highestSeparateIncome.toLocaleString()} separate-income bracket. The preview carries forward ${topBracketRows.length} row(s) from the current JSON so you can review the final table before replace.`);
    } else {
      warnings.push(`PDF extraction missed ${missingCurrentRows.length} row(s) that exist in the current JSON. Those rows were not auto-filled because the missing pattern was not limited to the final bracket.`);
    }
  }

  const rows = sortMarriageCreditRows([...extractedOnlyRows, ...carriedRows]);
  let changedCount = 0;
  let unchangedCount = 0;
  let newCount = 0;
  const reviewRows = rows.map(row => {
    const current = currentByKey.get(buildMarriageCreditKey(row));
    let reviewStatus = 'new';
    if (current) {
      if (Number(current.value) === Number(row.value)) { reviewStatus = 'match'; unchangedCount++; }
      else { reviewStatus = 'changed'; changedCount++; }
    } else newCount++;
    return { ...row, currentValue: current ? Number(current.value) : null, reviewStatus };
  });
  const combinedKeys = new Set(reviewRows.map(buildMarriageCreditKey));
  const missingCount = currentRows.filter(row => !combinedKeys.has(buildMarriageCreditKey(row))).length;
  return { rows: reviewRows, extractedCount: extractedOnlyRows.length, carriedCount: carriedRows.length, currentCount: currentRows.length, changedCount, unchangedCount, newCount, missingCount, warnings, currentYear: currentTableResult?.year || null };
}

function getMarriageCreditStatusLabel(row) {
  if (row.source === 'existing-file') return 'Carried';
  if (row.reviewStatus === 'changed') return 'Changed';
  if (row.reviewStatus === 'match') return 'Match';
  return 'New';
}

function getMarriageCreditStatusClass(row) {
  if (row.source === 'existing-file') return 'badge-warn';
  if (row.reviewStatus === 'changed') return 'badge-changed';
  if (row.reviewStatus === 'match') return 'badge-ok';
  return 'badge-accent';
}

async function extractData() {
  clearToast();
  if (!appState.selectedPdfPath) return showToast('Please select a PDF first.', 'error');
  const pageRange = getEffectivePdfPageRange();
  if (!pageRange) return showToast('Please enter valid PDF start and end pages first.', 'error');
  setExtracting(true);
  try {
    if (isMarriageCreditWorkflow()) {
      const target = getActiveFileTargets()[0];
      const currentPath = appState.filePaths[target.key];
      updateProgress(10, 'Reading current marriage-credit JSON...');
      const currentTable = currentPath ? await window.api.readMarriageCreditTable(currentPath) : null;
      updateProgress(20, 'Parsing Schedule M1MA PDF text directly...');
      appState.marriageCreditReview = buildMarriageCreditReview((await extractMarriageCreditFromPdf(appState.selectedPdfPath, pageRange)).rows, currentTable && currentTable.success ? currentTable : null);
      appState.homeownerRefundReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 800);
    }

    if (isHomeownerRefundWorkflow()) {
      const targets = getActiveFileTargets();
      const rowPath = appState.filePaths[targets[0].key];
      const refundPath = appState.filePaths[targets[1].key];
      updateProgress(10, 'Reading current homeowner-refund JSON files...');
      const currentRowTable = rowPath ? await window.api.readGenericTable(rowPath) : null;
      const currentRefundTable = refundPath ? await window.api.readGenericTable(refundPath) : null;
      updateProgress(20, 'Parsing M1PR Homestead Credit Refund Table...');
      const extractedTables = await extractHomeownerRefundFromPdf(appState.selectedPdfPath, pageRange);
      const currentRefundRows = currentRefundTable && currentRefundTable.success ? currentRefundTable.rows : [];
      appState.homeownerRefundUi = {
        activeTab: appState.homeownerRefundUi?.activeTab || 'rowTable',
        statusFilters: {
          rowTable: appState.homeownerRefundUi?.statusFilters?.rowTable || 'all',
          refundTable: appState.homeownerRefundUi?.statusFilters?.refundTable || 'all'
        }
      };
      appState.homeownerRefundReview = {
        rowTable: buildGenericTableReview(extractedTables.rowTableRows, currentRowTable && currentRowTable.success ? currentRowTable : null),
        refundTable: buildGenericTableReview(overlayGenericTableRows(currentRefundRows, extractedTables.refundRows), currentRefundTable && currentRefundTable.success ? currentRefundTable : null, { extractedCountOverride: extractedTables.refundRows.length })
      };
      appState.marriageCreditReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 800);
    }

    const config = appState.selectedStateConfig;
    if (!['MN', 'OR'].includes(config?.code)) throw new Error('Only Oregon and Minnesota are supported.');
    updateProgress(10, 'Reading JSON file metadata...');
    const lookUpTypes = {};
    for (const status of config.filingStatuses) {
      const filePath = appState.filePaths[status.key];
      const result = filePath ? await window.api.readCurrentJsonValues(filePath) : null;
      lookUpTypes[status.key] = result?.success ? (result.lookUpType || 'LowerBoundary') : 'LowerBoundary';
    }
    updateProgress(20, `Parsing ${config.name} PDF text directly...`);
    appState.extractedData = await extractPdfDeterministically(appState.selectedPdfPath, pageRange, config, lookUpTypes);
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
    if (!filePath) { diffResults[status.key] = { error: 'No file path configured', changed: [], matched: 0, missing: 0 }; continue; }
    const currentResult = await window.api.readCurrentJsonValues(filePath);
    if (!currentResult.success) { diffResults[status.key] = { error: currentResult.message, changed: [], matched: 0, missing: 0 }; continue; }
    const currentValues = currentResult.values;
    const changed = [];
    let matched = 0; let missing = 0; let missingFromExtraction = 0;
    const missingExtractedIncomes = [];
    let minExtractedIncome = null; let maxExtractedIncome = null;
    for (const [incomeStr, newVal] of Object.entries(newValues)) {
      const income = parseInt(incomeStr, 10);
      const currentVal = currentValues[income];
      minExtractedIncome = minExtractedIncome === null ? income : Math.min(minExtractedIncome, income);
      maxExtractedIncome = maxExtractedIncome === null ? income : Math.max(maxExtractedIncome, income);
      if (currentVal === undefined) missing++;
      else if (Number(currentVal) !== Number(newVal)) changed.push({ income, currentVal: Number(currentVal), newVal: Number(newVal), delta: Number(newVal) - Number(currentVal) });
      else matched++;
    }
    for (const incomeStr of Object.keys(currentValues)) if (newValues[incomeStr] === undefined) { missingFromExtraction++; missingExtractedIncomes.push(Number(incomeStr)); }
    diffResults[status.key] = { changed, matched, missing, missingFromExtraction, missingExtractedIncomes, totalExtracted: Object.keys(newValues).length, totalCurrent: Object.keys(currentValues).length, minExtractedIncome, maxExtractedIncome, currentYear: currentResult.year, lookUpType: currentResult.lookUpType };
  }
  appState.diffResults = diffResults;
  renderDiffSection();
  updateActionButtons();
}

function renderDiffSection() {
  const container = document.getElementById('diffSection');
  const config = appState.selectedStateConfig;
  if (isMarriageCreditWorkflow() || isHomeownerRefundWorkflow() || !appState.diffResults || !config) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const tabsHtml = config.filingStatuses.map((status, i) => {
    const diff = appState.diffResults[status.key];
    const changedCount = diff?.changed?.length || 0;
    const hasError = diff?.error;
    const badge = hasError ? '!' : changedCount;
    const badgeClass = hasError ? 'badge-error' : changedCount > 0 ? 'badge-changed' : 'badge-ok';
    return `<button class="diff-tab ${i === 0 ? 'active' : ''}" data-status-key="${status.key}">${status.fileLabel}<span class="diff-badge ${badgeClass}">${badge}</span></button>`;
  }).join('');
  const panelsHtml = config.filingStatuses.map((status, i) => `<div class="diff-panel ${i === 0 ? 'active' : ''}" id="diff-panel-${status.key}">${renderDiffPanel(status, appState.diffResults[status.key])}</div>`).join('');
  container.innerHTML = `<div class="section-header"><h2 class="section-title">Review Changes</h2><p class="section-subtitle">Only rows with changed values are shown. Verify before updating.</p></div><div class="diff-tabs">${tabsHtml}</div><div class="diff-panels">${panelsHtml}</div>`;
  container.querySelectorAll('.diff-tab').forEach(tab => tab.addEventListener('click', () => showDiffTab(tab.dataset.statusKey)));
}

function renderDiffPanel(status, diff) {
  if (!diff) return '<p class="diff-empty">No data available.</p>';
  if (diff.error) return `<div class="diff-error">Warning: ${diff.error}</div>`;
  const summaryHtml = `<div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value ${diff.changed.length > 0 ? 'changed' : 'ok'}">${diff.changed.length}</span><span class="diff-stat-label">Changed</span></div><div class="diff-stat"><span class="diff-stat-value ok">${diff.matched}</span><span class="diff-stat-label">Unchanged</span></div><div class="diff-stat"><span class="diff-stat-value ${diff.missing > 0 ? 'warn' : 'ok'}">${diff.missing}</span><span class="diff-stat-label">Not in file</span></div><div class="diff-stat"><span class="diff-stat-value ${diff.missingFromExtraction > 0 ? 'warn' : 'ok'}">${diff.missingFromExtraction}</span><span class="diff-stat-label">Missed by extraction</span></div><div class="diff-stat"><span class="diff-stat-value">${diff.totalExtracted} / ${diff.totalCurrent}</span><span class="diff-stat-label">Extracted vs file</span></div>${diff.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${diff.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div>`;
  const missingIncomeDebug = diff.missingExtractedIncomes?.length ? ` Missing incomes: ${diff.missingExtractedIncomes.map(income => `${income.toLocaleString()}`).join(', ')}.` : '';
  const extractionWarning = diff.missingFromExtraction > 0 ? `<div class="diff-error">Warning: ${diff.missingFromExtraction} file rows were not returned by extraction.${diff.minExtractedIncome !== null ? ` Extracted range: ${diff.minExtractedIncome.toLocaleString()} to ${diff.maxExtractedIncome.toLocaleString()}.` : ''}${missingIncomeDebug}</div>` : '';
  if (diff.changed.length === 0) return summaryHtml + extractionWarning + '<div class="diff-empty">No value changes detected for this filing status.</div>';
  const rowsHtml = diff.changed.map(row => `<tr><td class="income-col">$${row.income.toLocaleString()}</td><td class="current-col">${row.currentVal.toLocaleString()}</td><td class="new-col">${row.newVal.toLocaleString()}</td><td class="delta-col ${row.delta > 0 ? 'delta-up' : 'delta-down'}">${row.delta > 0 ? '+' : ''}${row.delta.toLocaleString()}</td></tr>`).join('');
  return summaryHtml + extractionWarning + `<div class="diff-table-wrapper"><table class="diff-table"><thead><tr><th>Income</th><th>Current Value</th><th>New Value</th><th>Change</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function showDiffTab(statusKey) {
  document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.diff-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.diff-tab[data-status-key="${statusKey}"]`)?.classList.add('active');
  document.getElementById(`diff-panel-${statusKey}`)?.classList.add('active');
}

function getGenericReviewStatusLabel(row) {
  if (row.reviewStatus === 'changed') return 'Changed';
  if (row.reviewStatus === 'match') return 'Match';
  return 'New';
}

function getGenericReviewStatusClass(row) {
  if (row.reviewStatus === 'changed') return 'badge-changed';
  if (row.reviewStatus === 'match') return 'badge-ok';
  return 'badge-accent';
}

function ensureHomeownerRefundUiState() {
  if (!appState.homeownerRefundUi) {
    appState.homeownerRefundUi = {
      activeTab: 'rowTable',
      statusFilters: { rowTable: 'all', refundTable: 'all' }
    };
  }
  if (!appState.homeownerRefundUi.statusFilters) appState.homeownerRefundUi.statusFilters = { rowTable: 'all', refundTable: 'all' };
  if (!appState.homeownerRefundUi.activeTab) appState.homeownerRefundUi.activeTab = 'rowTable';
}

function getFilteredGenericReviewRows(review, statusFilter) {
  if (!review?.rows) return [];
  if (!statusFilter || statusFilter === 'all') return review.rows;
  return review.rows.filter(row => row.reviewStatus === statusFilter);
}

function renderGenericStatusFilter(filterKey, currentValue) {
  return `<label class="review-filter-label">Status<select class="review-filter homeowner-refund-status-filter" data-filter-key="${filterKey}"><option value="all" ${currentValue === 'all' ? 'selected' : ''}>All</option><option value="changed" ${currentValue === 'changed' ? 'selected' : ''}>Changed</option><option value="match" ${currentValue === 'match' ? 'selected' : ''}>Match</option><option value="new" ${currentValue === 'new' ? 'selected' : ''}>New</option></select></label>`;
}

function showHomeownerRefundReviewTab(tabKey) {
  ensureHomeownerRefundUiState();
  appState.homeownerRefundUi.activeTab = tabKey;
  renderMarriageCreditSection();
}

function renderHomeownerRefundReviewTable(review, options) {
  ensureHomeownerRefundUiState();
  const activeFilter = appState.homeownerRefundUi.statusFilters[options.filterKey] || 'all';
  const filteredRows = getFilteredGenericReviewRows(review, activeFilter);
  const rowsHtml = filteredRows.map((row, index) => `<tr><td>${index + 1}</td>${options.renderCells(row)}<td><span class="diff-badge ${getGenericReviewStatusClass(row)}">${getGenericReviewStatusLabel(row)}</span></td></tr>`).join('');
  const emptyHtml = `<div class="diff-empty">No rows match the current status filter.</div>`;
  return `<div class="content-section"><div class="section-header"><div><h2 class="section-title">${options.title}</h2><p class="section-subtitle">${options.subtitle}</p></div><div class="review-toolbar">${renderGenericStatusFilter(options.filterKey, activeFilter)}</div></div><div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${filteredRows.length}</span><span class="diff-stat-label">Visible rows</span></div><div class="diff-stat"><span class="diff-stat-value">${review.rows.length}</span><span class="diff-stat-label">Preview rows</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.extractedCount}</span><span class="diff-stat-label">Extracted from PDF</span></div><div class="diff-stat"><span class="diff-stat-value ${review.changedCount > 0 ? 'changed' : 'ok'}">${review.changedCount}</span><span class="diff-stat-label">Changed vs file</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.unchangedCount}</span><span class="diff-stat-label">Unchanged vs file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.missingCount > 0 ? 'warn' : 'ok'}">${review.missingCount}</span><span class="diff-stat-label">Still missing</span></div>${review.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${review.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div>${filteredRows.length === 0 ? emptyHtml : `<div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th>${options.headerHtml}<th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`}</div>`;
}

function renderMarriageCreditSection() {
  const container = document.getElementById('marriageCreditSection');

  if (isHomeownerRefundWorkflow()) {
    const review = appState.homeownerRefundReview;
    if (!review) { container.style.display = 'none'; container.innerHTML = ''; return; }
    ensureHomeownerRefundUiState();
    container.style.display = 'block';
    const tabs = [
      { key: 'rowTable', label: 'Row Table', badge: review.rowTable.changedCount },
      { key: 'refundTable', label: 'Refund Table', badge: review.refundTable.changedCount }
    ];
    const tabsHtml = tabs.map(tab => `<button class="diff-tab homeowner-refund-tab ${appState.homeownerRefundUi.activeTab === tab.key ? 'active' : ''}" data-homeowner-tab="${tab.key}">${tab.label}<span class="diff-badge ${tab.badge > 0 ? 'badge-changed' : 'badge-ok'}">${tab.badge}</span></button>`).join('');
    const rowPanelHtml = `<div class="diff-panel homeowner-refund-panel ${appState.homeownerRefundUi.activeTab === 'rowTable' ? 'active' : ''}" id="homeowner-refund-panel-rowTable">${renderHomeownerRefundReviewTable(review.rowTable, { title: 'Review Homeowner Refund Row Table', subtitle: 'Generated row lookup for the Homestead Credit Refund Table. The first extracted row is remapped to lower boundary -1000000.', headerHtml: '<th>MNAmtDecNN (Row Lower Boundary)</th><th>Value</th>', filterKey: 'rowTable', renderCells: row => `<td>${row.key[0].toLocaleString()}</td><td>${row.value.toLocaleString()}</td>` })}</div>`;
    const refundPanelHtml = `<div class="diff-panel homeowner-refund-panel ${appState.homeownerRefundUi.activeTab === 'refundTable' ? 'active' : ''}" id="homeowner-refund-panel-refundTable">${renderHomeownerRefundReviewTable(review.refundTable, { title: 'Review Homeowner Refund Table', subtitle: 'Generated two-key refund grid for M1PR using row number plus property-tax amount.', headerHtml: '<th>Integer (Row Number)</th><th>MNAmtDecNN (Amount)</th><th>Value</th>', filterKey: 'refundTable', renderCells: row => `<td>${row.key[0].toLocaleString()}</td><td>${row.key[1].toLocaleString()}</td><td>${row.value.toLocaleString()}</td>` })}</div>`;
    container.innerHTML = `<div class="section-header"><h2 class="section-title">Review Homeowner Refund Tables</h2><p class="section-subtitle">Switch between the generated row lookup and refund grid, then use the status filter to jump to changed rows quickly.</p></div><div class="diff-tabs homeowner-refund-tabs">${tabsHtml}</div><div class="diff-panels homeowner-refund-panels">${rowPanelHtml}${refundPanelHtml}</div>`;
    container.querySelectorAll('.homeowner-refund-tab').forEach(tab => tab.addEventListener('click', () => showHomeownerRefundReviewTab(tab.dataset.homeownerTab)));
    container.querySelectorAll('.homeowner-refund-status-filter').forEach(select => select.addEventListener('change', event => {
      ensureHomeownerRefundUiState();
      appState.homeownerRefundUi.statusFilters[event.target.dataset.filterKey] = event.target.value;
      renderMarriageCreditSection();
    }));
    return;
  }

  const review = appState.marriageCreditReview;
  if (!isMarriageCreditWorkflow() || !review) { container.style.display = 'none'; container.innerHTML = ''; return; }
  const warningHtml = review.warnings.map(message => `<div class="review-alert warn">${message}</div>`).join('');
  const rowsHtml = review.rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.separateIncome.toLocaleString()}</td><td>${row.jointIncome.toLocaleString()}</td><td>${row.value.toLocaleString()}</td><td><span class="diff-badge ${getMarriageCreditStatusClass(row)}">${getMarriageCreditStatusLabel(row)}</span></td></tr>`).join('');
  container.style.display = 'block';
  container.innerHTML = `<div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Marriage Credit Table</h2><p class="section-subtitle">Full extracted grid for MN Schedule M1MA. Approve this preview before replacing the JSON file.</p></div></div>${warningHtml}<div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${review.rows.length}</span><span class="diff-stat-label">Preview rows</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.extractedCount}</span><span class="diff-stat-label">Extracted from PDF</span></div><div class="diff-stat"><span class="diff-stat-value ${review.carriedCount > 0 ? 'warn' : 'ok'}">${review.carriedCount}</span><span class="diff-stat-label">Carried from file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.changedCount > 0 ? 'changed' : 'ok'}">${review.changedCount}</span><span class="diff-stat-label">Changed vs file</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.unchangedCount}</span><span class="diff-stat-label">Unchanged vs file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.missingCount > 0 ? 'warn' : 'ok'}">${review.missingCount}</span><span class="diff-stat-label">Still missing</span></div>${review.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${review.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div><div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th><th>MNAmtDec (SeparateIncome)</th><th>MNAmtDecNN (JointIncome)</th><th>Value</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></div>`;
}
async function updateJsonFiles() {
  if (isMarriageCreditWorkflow()) return replaceMarriageCreditJson();
  if (isHomeownerRefundWorkflow()) return replaceHomeownerRefundJson();
  const config = appState.selectedStateConfig;
  if (!config.filingStatuses.every(s => appState.filePaths[s.key])) return showToast('Please select all JSON file paths before updating.', 'error');
  setUpdating(true);
  const results = await window.api.updateJsonFiles({ taxYear: appState.taxYear, updates: config.filingStatuses.map(status => ({ statusKey: status.key, filePath: appState.filePaths[status.key], newValues: appState.extractedData[status.key] })) });
  setUpdating(false);
  if (results.every(r => r.success)) { showToast(`All ${results.length} JSON files updated successfully for tax year ${appState.taxYear}.`, 'success'); return buildDiff(); }
  showToast(`Some files failed to update:
${results.filter(r => !r.success).map(f => `${f.statusKey}: ${f.message}`).join('\n')}`, 'error');
}

async function replaceMarriageCreditJson() {
  const filePath = appState.filePaths[getActiveFileTargets()[0].key];
  const review = appState.marriageCreditReview;
  if (!filePath) return showToast('Please select the MNMarriageCredit JSON path before replacing.', 'error');
  if (!review?.rows?.length) return showToast('Please extract and review the marriage-credit table first.', 'error');
  setUpdating(true);
  const result = await window.api.replaceMarriageCreditTable({ filePath, taxYear: appState.taxYear, rows: review.rows.map(row => ({ separateIncome: row.separateIncome, jointIncome: row.jointIncome, value: row.value })) });
  setUpdating(false);
  if (!result.success) return showToast(`Marriage credit replace failed: ${result.message}`, 'error');
  const refreshed = await window.api.readMarriageCreditTable(filePath);
  appState.marriageCreditReview = buildMarriageCreditReview(review.rows, refreshed.success ? refreshed : null);
  renderMarriageCreditSection();
  updateActionButtons();
  showToast(`Marriage credit JSON replaced with ${result.updatedCount} rows.`, 'success');
}

async function replaceHomeownerRefundJson() {
  const review = appState.homeownerRefundReview;
  const rowPath = appState.filePaths.M1PR_ROW;
  const refundPath = appState.filePaths.M1PR_REFUND;
  if (!rowPath || !refundPath) return showToast('Please configure both M1PR JSON paths before replacing.', 'error');
  if (!review?.rowTable?.rows?.length || !review?.refundTable?.rows?.length) return showToast('Please extract and review the homeowner-refund tables first.', 'error');

  setUpdating(true);
  const [rowResult, refundResult] = await Promise.all([
    window.api.replaceGenericTable({ filePath: rowPath, taxYear: appState.taxYear, rows: review.rowTable.rows.map(row => ({ key: row.key, value: row.value })) }),
    window.api.replaceGenericTable({ filePath: refundPath, taxYear: appState.taxYear, rows: normalizeHomeownerRefundJsonRows(review.refundTable.rows) })
  ]);
  setUpdating(false);

  if (!rowResult.success || !refundResult.success) {
    return showToast(`Homeowner refund replace failed:
${[rowResult, refundResult].filter(result => !result.success).map(result => result.message).join('\n')}`, 'error');
  }

  const [refreshedRowTable, refreshedRefundTable] = await Promise.all([
    window.api.readGenericTable(rowPath),
    window.api.readGenericTable(refundPath)
  ]);

  appState.homeownerRefundReview = {
    rowTable: buildGenericTableReview(review.rowTable.rows, refreshedRowTable.success ? refreshedRowTable : null),
    refundTable: buildGenericTableReview(review.refundTable.rows, refreshedRefundTable.success ? refreshedRefundTable : null, { extractedCountOverride: review.refundTable.extractedCount })
  };
  renderMarriageCreditSection();
  updateActionButtons();
  showToast(`Homeowner refund JSON replaced with ${rowResult.updatedCount + refundResult.updatedCount} rows across both files.`, 'success');
}

function renderExtractedDataSection() {
  const section = document.getElementById('extractedDataSection');
  if (isMarriageCreditWorkflow()) {
    if (!appState.marriageCreditReview) { section.style.display = 'none'; return; }
    const review = appState.marriageCreditReview;
    const separateBrackets = getUniqueSorted(review.rows.map(row => row.separateIncome));
    const jointBrackets = getUniqueSorted(review.rows.map(row => row.jointIncome));
    const maxValue = Math.max(...review.rows.map(row => row.value));
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${review.extractedCount}</span><label>PDF rows</label></div><div class="extraction-stat"><span>${separateBrackets.length}</span><label>Separate-income brackets</label></div><div class="extraction-stat"><span>${jointBrackets.length}</span><label>Joint-income brackets</label></div><div class="extraction-stat"><span>${maxValue.toLocaleString()}</span><label>Max credit</label></div>`;
    return;
  }
  if (isHomeownerRefundWorkflow()) {
    if (!appState.homeownerRefundReview) { section.style.display = 'none'; return; }
    const review = appState.homeownerRefundReview;
    const rowCount = review.rowTable.rows.length;
    const refundCount = review.refundTable.rows.length;
    const amountColumns = getUniqueSorted(review.refundTable.rows.map(row => row.key[1]));
    const maxRefund = Math.max(...review.refundTable.rows.map(row => row.value));
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${rowCount}</span><label>Row-table entries</label></div><div class="extraction-stat"><span>${refundCount}</span><label>Refund entries</label></div><div class="extraction-stat"><span>${amountColumns.length}</span><label>Amount columns</label></div><div class="extraction-stat"><span>${maxRefund.toLocaleString()}</span><label>Max refund</label></div>`;
    return;
  }
  if (!appState.extractedData) { section.style.display = 'none'; return; }
  const maxIncome = Math.max(...Object.values(appState.extractedData).flatMap(v => Object.keys(v).map(Number)));
  const totalEntries = Math.max(...Object.values(appState.extractedData).map(vals => Object.keys(vals).length));
  section.style.display = 'block';
  document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${totalEntries}</span><label>Income brackets</label></div><div class="extraction-stat"><span>${appState.selectedStateConfig.filingStatuses.length}</span><label>Filing statuses</label></div><div class="extraction-stat"><span>$${maxIncome.toLocaleString()}</span><label>Max income</label></div><div class="extraction-stat"><span>${appState.taxYear}</span><label>Tax year</label></div>`;
}

function setExtracting(active) {
  document.getElementById('extractBtn').disabled = active;
  document.getElementById('extractBtn').textContent = active
    ? (isMarriageCreditWorkflow() ? 'Extracting Marriage Credit...' : isHomeownerRefundWorkflow() ? 'Extracting Homeowner Refund...' : 'Extracting...')
    : (isMarriageCreditWorkflow() ? 'Extract Marriage Credit Table' : isHomeownerRefundWorkflow() ? 'Extract Homeowner Refund Tables' : 'Extract Data from PDF');
  document.getElementById('extractionProgress').style.display = active ? 'block' : 'none';
  if (!active) updateProgress(0, '');
}

function setUpdating(active) {
  document.getElementById('updateJsonBtn').disabled = active;
  document.getElementById('updateJsonBtn').textContent = active
    ? (isMarriageCreditWorkflow() || isHomeownerRefundWorkflow() ? 'Replacing...' : 'Updating...')
    : (isMarriageCreditWorkflow() ? 'Replace Marriage Credit JSON' : isHomeownerRefundWorkflow() ? 'Replace Homeowner Refund JSON' : 'Update JSON Files');
}

function updateProgress(pct, msg) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = msg;
}

function updateActionButtons() {
  const hasSource = Boolean(appState.selectedPdfPath) && Boolean(getEffectivePdfPageRange());
  const allPathsSet = getActiveFileTargets().length > 0 && getActiveFileTargets().every(target => appState.filePaths[target.key]);
  const hasExtracted = isMarriageCreditWorkflow()
    ? Boolean(appState.marriageCreditReview?.rows?.length)
    : isHomeownerRefundWorkflow()
      ? Boolean(appState.homeownerRefundReview?.rowTable?.rows?.length && appState.homeownerRefundReview?.refundTable?.rows?.length)
      : Boolean(appState.extractedData);
  document.getElementById('extractBtn').disabled = !hasSource;
  document.getElementById('updateJsonBtn').disabled = !(hasExtracted && allPathsSet);
}
let toastTimeout;
function clearToast() {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimeout);
  toast.classList.remove('show');
  toast.className = 'toast';
  toast.textContent = '';
}
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimeout);
  const timeoutMs = type === 'error' ? 8000 : 4000;
  toastTimeout = setTimeout(() => toast.classList.remove('show'), timeoutMs);
}

function bindEvents() {
  document.getElementById('stateSelect').addEventListener('change', e => onStateChange(e.target.value));
  document.getElementById('taxYearSelect').addEventListener('change', async e => {
    appState.taxYear = parseInt(e.target.value, 10); appState.filePaths = {}; resetExtractedState(); renderSelectedSource(); await loadFilePaths(); renderFilePickers(); renderExtractedDataSection(); renderDiffSection(); renderMarriageCreditSection(); updateActionButtons();
  });
  document.getElementById('workflowSelect').addEventListener('change', e => onWorkflowChange(e.target.value));
  document.getElementById('selectPdfBtn').addEventListener('click', selectPdf);
  document.getElementById('pdfPageStartInput').addEventListener('input', e => { clearToast(); appState.pdfPageRangeOverride.start = e.target.value.trim(); renderSelectedSource(); updateActionButtons(); });
  document.getElementById('pdfPageEndInput').addEventListener('input', e => { clearToast(); appState.pdfPageRangeOverride.end = e.target.value.trim(); renderSelectedSource(); updateActionButtons(); });
  document.getElementById('extractBtn').addEventListener('click', extractData);
  document.getElementById('updateJsonBtn').addEventListener('click', updateJsonFiles);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { appState, parseIntegerText, groupPdfTextItemsByRow, findNumericItemsInRange, findMinnesotaValueWindow, parseMinnesotaPdfRows, parseMarriageCreditPdfRows, parseMarriageCreditFromFullText, parseHomeownerRefundPageRows, buildHomeownerRefundTables, overlayGenericTableRows, normalizeHomeownerRefundJsonRows, parseOrPdfRows, normalizeDeterministicRowsToData, mergeExtractedData, sortMarriageCreditRows, buildMarriageCreditReview, buildGenericTableReview, getEffectivePdfPageRange, renderSelectedSource, updateActionButtons, showDiffTab };
if (typeof window !== 'undefined' && typeof document !== 'undefined') init();



