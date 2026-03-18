// ─── State ────────────────────────────────────────────────────────────────────

let appState = {
  selectedStateCode: null,
  selectedStateConfig: null,
  taxYear: new Date().getFullYear(),
  regulatoryYear: new Date().getFullYear(),
  filePaths: {},        // { [statusKey]: path }
  selectedPdfPath: null,
  pdfPageRangeOverride: { start: '', end: '' },
  extractedData: null,  // { [statusKey]: { [income]: value } }
  diffResults: null,    // { [statusKey]: { changed: [], matched: number, missing: number } }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {

  const states = await window.api.getAllStates();
  populateStateDropdown(states);
  populateYearDropdowns();

  bindEvents();

  // Select first state by default
  if (states.length > 0) {
    document.getElementById('stateSelect').value = states[0].code;
    await onStateChange(states[0].code);
  }

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
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
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

async function selectPdf() {
  const selected = await window.api.selectPdfFile();
  if (!selected) return;

  appState.selectedPdfPath = selected;
  appState.pdfPageRangeOverride = { start: '', end: '' };

  renderSelectedSource();
  updateActionButtons();
}

function getEffectivePdfPageRange() {
  const start = parseInt(appState.pdfPageRangeOverride.start, 10);
  const end = parseInt(appState.pdfPageRangeOverride.end, 10);

  if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
    return { start, end };
  }

  return null;
}

function syncPdfPageInputs() {
  const startInput = document.getElementById('pdfPageStartInput');
  const endInput = document.getElementById('pdfPageEndInput');
  if (!startInput || !endInput) return;

  startInput.value = appState.pdfPageRangeOverride.start;
  endInput.value = appState.pdfPageRangeOverride.end;
}

function renderSelectedSource() {
  const pdfSection = document.getElementById('pdfSelectionSection');
  const pdfSummary = document.getElementById('pdfSelectionSummary');

  if (appState.selectedPdfPath) {
    const effective = getEffectivePdfPageRange();
    pdfSection.style.display = 'block';
    syncPdfPageInputs();
    const fileName = appState.selectedPdfPath.split(/[\/\\]/).pop();
    if (effective) {
      pdfSummary.textContent = `PDF selected: ${fileName} | Tax table pages ${effective.start}-${effective.end}`;
    } else {
      pdfSummary.textContent = `PDF selected: ${fileName} | Enter required PDF start/end pages for tax year ${appState.taxYear}`;
    }
    return;
  }

  pdfSection.style.display = 'none';
  pdfSummary.textContent = '';
  syncPdfPageInputs();
}
// ????????? Extraction ───────────────────────────────────────────────────────────────

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
    byRatio(0.08, 0.535),
    byRatio(0.53, 0.99)
  ];
}
function findNumericItemsInRange(items, range) {
  return items
    .filter(item => item.x >= range[0] && item.x <= range[1])
    .map(item => ({ ...item, numericValue: parseIntegerText(item.str) }))
    .filter(item => item.numericValue !== null)
    .sort((a, b) => a.x - b.x);
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
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({
    str: 'str' in item ? item.str : '',
    x: item.transform?.[4],
    y: item.transform?.[5]
  })));
  const blockRanges = getMinnesotaPdfBlockColumnRanges(pageWidth);
  const parsed = [];

  for (const row of rows) {
    for (const range of blockRanges) {
      const numericItems = findNumericItemsInRange(row.items, range);
      if (numericItems.length < 6) continue;

      const valueWindow = findMinnesotaValueWindow(numericItems);
      if (!valueWindow) continue;

      const { lower, upper, single, mfj, mfs, hoh } = valueWindow;
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
async function extractData() {
  const config = appState.selectedStateConfig;

  if (!appState.selectedPdfPath) {
    showToast('Please select a PDF first.', 'error');
    return;
  }

  const pageRange = getEffectivePdfPageRange();
  if (!pageRange) {
    showToast('Please enter valid PDF start and end pages first.', 'error');
    return;
  }

  if (!['MN', 'OR'].includes(config?.code)) {
    showToast('Only Oregon and Minnesota are supported.', 'error');
    return;
  }

  setExtracting(true);

  try {
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
    const missingExtractedIncomes = [];
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
        missingExtractedIncomes.push(Number(incomeStr));
      }
    }

    diffResults[status.key] = {
      changed,
      matched,
      missing,
      missingFromExtraction,
      missingExtractedIncomes,
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

  const missingIncomeDebug = diff.missingExtractedIncomes?.length
    ? ` Missing incomes: ${diff.missingExtractedIncomes.map(income => `${income.toLocaleString()}`).join(', ')}.`
    : '';

  const extractionWarning = diff.missingFromExtraction > 0
    ? `<div class="diff-error">Warning: ${diff.missingFromExtraction} file rows were not returned by extraction.${diff.minExtractedIncome !== null ? ` Extracted range: ${diff.minExtractedIncome.toLocaleString()} to ${diff.maxExtractedIncome.toLocaleString()}.` : ''}${missingIncomeDebug}</div>`
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

// ????????? UI helpers ───────────────────────────────────────────────────────────────

function setExtracting(active) {
  const btn = document.getElementById('extractBtn');
  const progress = document.getElementById('extractionProgress');
  btn.disabled = active;
  btn.textContent = active ? 'Extracting...' : 'Extract Data from PDF';
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
  const hasSource = Boolean(appState.selectedPdfPath) && Boolean(getEffectivePdfPageRange());
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

  if (type === 'error') {
    toastTimeout = null;
    return;
  }

  toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─── Event bindings ───────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('stateSelect').addEventListener('change', e => onStateChange(e.target.value));

  document.getElementById('taxYearSelect').addEventListener('change', e => {
    appState.taxYear = parseInt(e.target.value);
    renderSelectedSource();
    updateActionButtons();
  });

  document.getElementById('regulatoryYearInput').addEventListener('change', async e => {
    appState.regulatoryYear = parseInt(e.target.value);
    await loadFilePaths();
    renderFilePickers();
    updateActionButtons();
  });

  document.getElementById('selectPdfBtn').addEventListener('click', selectPdf);
  document.getElementById('pdfPageStartInput').addEventListener('input', e => { appState.pdfPageRangeOverride.start = e.target.value.trim(); renderSelectedSource(); updateActionButtons(); });
  document.getElementById('pdfPageEndInput').addEventListener('input', e => { appState.pdfPageRangeOverride.end = e.target.value.trim(); renderSelectedSource(); updateActionButtons(); });
  document.getElementById('extractBtn').addEventListener('click', extractData);
  document.getElementById('updateJsonBtn').addEventListener('click', updateJsonFiles);
}

// ─── Start ────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    appState,
    parseIntegerText,
    groupPdfTextItemsByRow,
    findNumericItemsInRange,
    findMinnesotaValueWindow,
    parseMinnesotaPdfRows,
    parseOrPdfRows,
    normalizeDeterministicRowsToData,
    mergeExtractedData,
    getEffectivePdfPageRange,
    renderSelectedSource,
    updateActionButtons,
    showDiffTab
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  init();
}
































