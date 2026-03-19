const test = require('node:test');
const assert = require('node:assert/strict');

const MN_CONFIG = require('../States/MN.js');
const OR_CONFIG = require('../States/OR.js');
const {
  appState,
  parseMinnesotaPdfRows,
  parseMarriageCreditFromFullText,
  parseOrPdfRows,
  normalizeDeterministicRowsToData,
  getEffectivePdfPageRange,
  renderSelectedSource,
  updateActionButtons,
  showDiffTab
} = require('../renderer.js');

function resetAppState() {
  appState.selectedStateCode = null;
  appState.selectedStateConfig = null;
  appState.taxYear = 2024;
  appState.filePaths = {};
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  appState.extractedData = null;
  appState.diffResults = null;
}

function pdfTextItem(str, x, y = 500) {
  return {
    str,
    transform: [1, 0, 0, 1, x, y]
  };
}

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

test.afterEach(() => {
  resetAppState();
  delete global.document;
});

test('MN scenario regression: page 32 row still parses when the Minnesota columns drift', () => {
  const rows = parseMinnesotaPdfRows([
    pdfTextItem('23,200', 166),
    pdfTextItem('23,300', 252),
    pdfTextItem('1,244', 338),
    pdfTextItem('1,244', 414),
    pdfTextItem('1,245', 486),
    pdfTextItem('1,244', 525)
  ], 1000);

  assert.deepEqual(rows, [
    {
      income: 23200,
      upperIncome: 23300,
      values: {
        Single: 1244,
        MFJ: 1244,
        MFS: 1245,
        HOH: 1244
      }
    }
  ]);
});

test('MN M1MA regression: marriage credit fallback preserves 2025 bracket keys without offset', () => {
  const parsed = parseMarriageCreditFromFullText([
    { str: 'If line 6 is:' },
    { str: 'and line 7 is at least:' },
    { str: '$48,000 68,000 88,000 108,000 128,000 148,000 168,000 188,000 208,000 228,000 248,000 268,000 288,000 308,000 328,000' },
    { str: 'your credit amount is:' },
    { str: '$31,000 33,000 29 29 29 29 0 0 0 0 0 0 0 0 0 0 0 33,000 35,000 58 58 58 58 0 0 0 0 0 0 0 0 0 0 0 121,000 123,000 0 0 0 0 230 253 253 346 514 514 514 514 514 268 20' },
    { str: '2025 Schedule M1MA Instructions' }
  ]);

  assert.equal(parsed.rows[0].separateIncome, 31000);
  assert.equal(parsed.rows[0].jointIncome, 48000);
  assert.equal(parsed.rows[0].value, 29);
  assert.equal(parsed.rows[1].separateIncome, 31000);
  assert.equal(parsed.rows[1].jointIncome, 68000);
  assert.equal(parsed.rows.at(-1).separateIncome, 121000);
  assert.equal(parsed.rows.at(-1).jointIncome, 328000);
  assert.equal(parsed.rows.at(-1).value, 20);
});

test('OR scenario checkpoints: Oregon parser keeps representative values through 49,900', () => {
  const rows = parseOrPdfRows([
    pdfTextItem('0', 110, 700),
    pdfTextItem('20', 145, 700),
    pdfTextItem('0', 205, 700),
    pdfTextItem('0', 255, 700),
    pdfTextItem('19,000', 320, 700),
    pdfTextItem('19,100', 385, 700),
    pdfTextItem('1,365', 445, 700),
    pdfTextItem('1,114', 490, 700),
    pdfTextItem('20', 110, 680),
    pdfTextItem('50', 145, 680),
    pdfTextItem('2', 205, 680),
    pdfTextItem('2', 255, 680),
    pdfTextItem('49,900', 735, 680),
    pdfTextItem('50,000', 800, 680),
    pdfTextItem('4,069', 865, 680),
    pdfTextItem('3,769', 915, 680),
    pdfTextItem('50', 110, 660),
    pdfTextItem('100', 145, 660),
    pdfTextItem('4', 205, 660),
    pdfTextItem('4', 255, 660),
    pdfTextItem('4,000', 320, 660),
    pdfTextItem('4,100', 385, 660),
    pdfTextItem('192', 445, 660),
    pdfTextItem('192', 490, 660),
    pdfTextItem('100', 110, 640),
    pdfTextItem('200', 145, 640),
    pdfTextItem('7', 205, 640),
    pdfTextItem('7', 255, 640),
    pdfTextItem('9,000', 320, 640),
    pdfTextItem('9,100', 385, 640),
    pdfTextItem('525', 445, 640),
    pdfTextItem('439', 490, 640)
  ], 1000);

  const normalized = normalizeDeterministicRowsToData(
    rows,
    OR_CONFIG,
    { S: 'LowerBoundary', J: 'LowerBoundary' },
    'page 26'
  );

  assert.equal(normalized.S[0], 0);
  assert.equal(normalized.S[20], 2);
  assert.equal(normalized.S[50], 4);
  assert.equal(normalized.S[100], 7);
  assert.equal(normalized.S[4000], 192);
  assert.equal(normalized.J[4000], 192);
  assert.equal(normalized.S[9000], 525);
  assert.equal(normalized.J[9000], 439);
  assert.equal(normalized.S[19000], 1365);
  assert.equal(normalized.J[19000], 1114);
  assert.equal(normalized.S[49900], 4069);
  assert.equal(normalized.J[49900], 3769);
});

test('PDF page range scenario: manual range is required before extraction becomes available', () => {
  resetAppState();
  appState.selectedPdfPath = 'C:\\PDFs\\MN_m1-inst-24_final_2-23-26.pdf';
  appState.selectedStateConfig = MN_CONFIG;

  const extractBtn = { disabled: true };
  const updateJsonBtn = { disabled: true };
  const pdfSection = { style: { display: '' } };
  const pdfSummary = { textContent: '' };
  const pageStartInput = { value: '' };
  const pageEndInput = { value: '' };

  global.document = {
    getElementById(id) {
      return {
        extractBtn,
        updateJsonBtn,
        pdfSelectionSection: pdfSection,
        pdfSelectionSummary: pdfSummary,
        pdfPageStartInput: pageStartInput,
        pdfPageEndInput: pageEndInput
      }[id];
    }
  };

  renderSelectedSource();
  updateActionButtons();

  assert.equal(getEffectivePdfPageRange(), null);
  assert.equal(pdfSection.style.display, 'block');
  assert.match(pdfSummary.textContent, /Enter required PDF start\/end pages/);
  assert.equal(extractBtn.disabled, true);

  appState.pdfPageRangeOverride = { start: '36', end: '30' };
  updateActionButtons();
  assert.equal(extractBtn.disabled, true);

  appState.pdfPageRangeOverride = { start: '30', end: '36' };
  renderSelectedSource();
  updateActionButtons();

  assert.deepEqual(getEffectivePdfPageRange(), { start: 30, end: 36 });
  assert.match(pdfSummary.textContent, /Tax table pages 30-36/);
  assert.equal(extractBtn.disabled, false);
});

test('Review tab scenario: switching tabs keeps exactly one active tab and panel', () => {
  const singleTab = { classList: createClassList(['active']) };
  const jointTab = { classList: createClassList() };
  const singlePanel = { classList: createClassList(['active']) };
  const jointPanel = { classList: createClassList() };

  global.document = {
    querySelectorAll(selector) {
      if (selector === '.diff-tab') return [singleTab, jointTab];
      if (selector === '.diff-panel') return [singlePanel, jointPanel];
      return [];
    },
    querySelector(selector) {
      if (selector === '.diff-tab[data-status-key="S"]') return singleTab;
      if (selector === '.diff-tab[data-status-key="J"]') return jointTab;
      return null;
    },
    getElementById(id) {
      if (id === 'diff-panel-S') return singlePanel;
      if (id === 'diff-panel-J') return jointPanel;
      return null;
    }
  };

  showDiffTab('J');
  assert.equal(singleTab.classList.contains('active'), false);
  assert.equal(jointTab.classList.contains('active'), true);
  assert.equal(singlePanel.classList.contains('active'), false);
  assert.equal(jointPanel.classList.contains('active'), true);

  showDiffTab('S');
  assert.equal(singleTab.classList.contains('active'), true);
  assert.equal(jointTab.classList.contains('active'), false);
  assert.equal(singlePanel.classList.contains('active'), true);
  assert.equal(jointPanel.classList.contains('active'), false);
});
