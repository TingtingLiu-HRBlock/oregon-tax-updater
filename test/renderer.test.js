const test = require('node:test');
const assert = require('node:assert/strict');

const MN_CONFIG = require('../States/MN.js');
const OR_CONFIG = require('../States/OR.js');
const {
  appState,
  parseMinnesotaPdfRows,
  parseMarriageCreditFromFullText,
  parseHomeownerRefundPageRows,
  buildHomeownerRefundTables,
  overlayGenericTableRows,
  normalizeHomeownerRefundJsonRows,
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
  appState.marriageCreditReview = null;
  appState.homeownerRefundReview = null;
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

test('MN M1PR regression: parser builds row and refund tables from a standard segment without line-number coupling', () => {
  const parsedRows = parseHomeownerRefundPageRows([
    pdfTextItem('0', 100, 700), pdfTextItem('25', 150, 700), pdfTextItem('50', 200, 700), pdfTextItem('75', 250, 700), pdfTextItem('100', 300, 700), pdfTextItem('125', 350, 700), pdfTextItem('150', 400, 700), pdfTextItem('175', 450, 700), pdfTextItem('200', 500, 700), pdfTextItem('225', 550, 700), pdfTextItem('250', 600, 700), pdfTextItem('275', 650, 700),
    pdfTextItem('25', 100, 680), pdfTextItem('50', 150, 680), pdfTextItem('75', 200, 680), pdfTextItem('100', 250, 680), pdfTextItem('125', 300, 680), pdfTextItem('150', 350, 680), pdfTextItem('175', 400, 680), pdfTextItem('200', 450, 680), pdfTextItem('225', 500, 680), pdfTextItem('250', 550, 680), pdfTextItem('275', 600, 680), pdfTextItem('300', 650, 680),
    pdfTextItem('0', 100, 640), pdfTextItem('2,190', 150, 640), pdfTextItem('1', 200, 640), pdfTextItem('23', 250, 640), pdfTextItem('45', 300, 640), pdfTextItem('67', 350, 640), pdfTextItem('89', 400, 640), pdfTextItem('111', 450, 640), pdfTextItem('133', 500, 640), pdfTextItem('155', 550, 640), pdfTextItem('177', 600, 640), pdfTextItem('199', 650, 640), pdfTextItem('221', 700, 640), pdfTextItem('243', 750, 640),
    pdfTextItem('2,190', 100, 620), pdfTextItem('4,360', 150, 620), pdfTextItem('0', 200, 620), pdfTextItem('1', 250, 620), pdfTextItem('23', 300, 620), pdfTextItem('45', 350, 620), pdfTextItem('67', 400, 620), pdfTextItem('89', 450, 620), pdfTextItem('111', 500, 620), pdfTextItem('133', 550, 620), pdfTextItem('155', 600, 620), pdfTextItem('177', 650, 620), pdfTextItem('199', 700, 620), pdfTextItem('221', 750, 620)
  ]);

  const tables = buildHomeownerRefundTables(parsedRows);

  assert.equal(parsedRows.length, 2);
  assert.deepEqual(tables.rowTableRows, [
    { key: [-1000000], value: 1 },
    { key: [2190], value: 2 }
  ]);
  assert.equal(tables.refundRows[0].key[0], 1);
  assert.equal(tables.refundRows[0].key[1], 0);
  assert.equal(tables.refundRows[0].value, 1);
  assert.equal(tables.refundRows.at(-1).key[0], 2);
  assert.equal(tables.refundRows.at(-1).key[1], 275);
  assert.equal(tables.refundRows.at(-1).value, 221);
});

test('MN M1PR regression: final-page parser tolerates worksheet rows between amount headers', () => {
  const parsedRows = parseHomeownerRefundPageRows([
    pdfTextItem('3,300', 100, 700), pdfTextItem('3,325', 150, 700), pdfTextItem('3,350', 200, 700), pdfTextItem('3,375', 250, 700), pdfTextItem('3,400', 300, 700), pdfTextItem('3,425', 350, 700), pdfTextItem('3,450', 400, 700), pdfTextItem('3,475', 450, 700), pdfTextItem('3,500', 500, 700),
    pdfTextItem('Refund Worksheet', 100, 690),
    pdfTextItem('1', 100, 680), pdfTextItem('Amount from line 16', 150, 680),
    pdfTextItem('at least but less than your homestead credit refund is:', 100, 670),
    pdfTextItem('3,325', 100, 660), pdfTextItem('3,350', 150, 660), pdfTextItem('3,375', 200, 660), pdfTextItem('3,400', 250, 660), pdfTextItem('3,425', 300, 660), pdfTextItem('3,450', 350, 660), pdfTextItem('3,475', 400, 660), pdfTextItem('3,500', 450, 660), pdfTextItem('& up', 500, 660),
    pdfTextItem('142,490', 100, 640), pdfTextItem('& over', 150, 640), pdfTextItem('0', 200, 640), pdfTextItem('0', 250, 640), pdfTextItem('0', 300, 640), pdfTextItem('0', 350, 640), pdfTextItem('0', 400, 640), pdfTextItem('0', 450, 640), pdfTextItem('0', 500, 640), pdfTextItem('0', 550, 640), pdfTextItem('0', 600, 640)
  ]);

  assert.equal(parsedRows.length, 1);
  assert.equal(parsedRows[0].rowLower, 142490);
  assert.equal(parsedRows[0].amountStarts.at(-1), 3500);
});

test('MN M1PR regression: overlayGenericTableRows lets extracted values override current JSON by key', () => {
  const overlaid = overlayGenericTableRows([
    { key: [2, 3300], value: 111 },
    { key: [2, 3325], value: 222 },
    { key: [2, 3500], value: 99999 }
  ], [
    { key: [2, 3300], value: 2883 },
    { key: [2, 3325], value: 2905 },
    { key: [2, 3350], value: 2927 }
  ]);

  assert.deepEqual(overlaid.filter(row => row.key[0] === 2).sort((a, b) => a.key[1] - b.key[1]), [
    { key: [2, 3300], value: 2883 },
    { key: [2, 3325], value: 2905 },
    { key: [2, 3350], value: 2927 },
    { key: [2, 3500], value: 99999 }
  ]);
});
test('MN M1PR regression: normalizeHomeownerRefundJsonRows forces starred cells to 99999 for replace payloads', () => {
  const normalized = normalizeHomeownerRefundJsonRows([
    { key: [2, 3475], value: 3037 },
    { key: [2, 3500], value: 0, isStarValue: true }
  ]);

  assert.deepEqual(normalized, [
    { key: [2, 3475], value: 3037 },
    { key: [2, 3500], value: 99999 }
  ]);
});

test('MN M1PR regression: starred final-page cells become 99999', () => {
  const parsedRows = parseHomeownerRefundPageRows([
    pdfTextItem('3,300', 100, 700), pdfTextItem('3,325', 150, 700), pdfTextItem('3,350', 200, 700), pdfTextItem('3,375', 250, 700), pdfTextItem('3,400', 300, 700), pdfTextItem('3,425', 350, 700), pdfTextItem('3,450', 400, 700), pdfTextItem('3,475', 450, 700), pdfTextItem('3,500', 500, 700),
    pdfTextItem('Refund Worksheet', 100, 690),
    pdfTextItem('3,325', 100, 660), pdfTextItem('3,350', 150, 660), pdfTextItem('3,375', 200, 660), pdfTextItem('3,400', 250, 660), pdfTextItem('3,425', 300, 660), pdfTextItem('3,450', 350, 660), pdfTextItem('3,475', 400, 660), pdfTextItem('3,500', 450, 660), pdfTextItem('& up', 500, 660),
    pdfTextItem('2,190', 100, 640), pdfTextItem('4,360', 150, 640), pdfTextItem('2,883', 200, 640), pdfTextItem('2,905', 250, 640), pdfTextItem('2,927', 300, 640), pdfTextItem('2,949', 350, 640), pdfTextItem('2,971', 400, 640), pdfTextItem('2,993', 450, 640), pdfTextItem('3,015', 500, 640), pdfTextItem('3,037', 550, 640), pdfTextItem('*', 600, 640)
  ]);

  const tables = buildHomeownerRefundTables(parsedRows);
  assert.deepEqual(
    tables.refundRows
      .filter(row => row.key[0] === 1)
      .sort((a, b) => a.key[1] - b.key[1])
      .map(row => ({ key: row.key, value: row.value, isStarValue: row.isStarValue })),
    [
      { key: [1, 3300], value: 2883, isStarValue: false },
      { key: [1, 3325], value: 2905, isStarValue: false },
      { key: [1, 3350], value: 2927, isStarValue: false },
      { key: [1, 3375], value: 2949, isStarValue: false },
      { key: [1, 3400], value: 2971, isStarValue: false },
      { key: [1, 3425], value: 2993, isStarValue: false },
      { key: [1, 3450], value: 3015, isStarValue: false },
      { key: [1, 3475], value: 3037, isStarValue: false },
      { key: [1, 3500], value: 99999, isStarValue: true }
    ]
  );
});

test('MN M1PR regression: OCR-shaped final starred rows still normalize the 3500 cell to 99999', () => {
  const parsedRows = parseHomeownerRefundPageRows([
    pdfTextItem('3,300', 100, 700), pdfTextItem('3,325', 150, 700), pdfTextItem('3,350', 200, 700), pdfTextItem('3,375', 250, 700), pdfTextItem('3,400', 300, 700), pdfTextItem('3,425', 350, 700), pdfTextItem('3,450', 400, 700), pdfTextItem('3,475', 450, 700), pdfTextItem('3,500', 500, 700),
    pdfTextItem('3,325', 100, 680), pdfTextItem('3,350', 150, 680), pdfTextItem('3,375', 200, 680), pdfTextItem('3,400', 250, 680), pdfTextItem('3,425', 300, 680), pdfTextItem('3,450', 350, 680), pdfTextItem('3,475', 400, 680), pdfTextItem('3,500', 450, 680), pdfTextItem('& up', 500, 680),
    pdfTextItem('0', 100, 640), pdfTextItem('2,883', 200, 640), pdfTextItem('2,905', 250, 640), pdfTextItem('2,927', 300, 640), pdfTextItem('2,949', 350, 640), pdfTextItem('2,971', 400, 640), pdfTextItem('2,993', 450, 640), pdfTextItem('3,015', 500, 640), pdfTextItem('3,037', 550, 640), pdfTextItem('2', 600, 640)
  ]);

  const tables = buildHomeownerRefundTables(parsedRows);
  assert.deepEqual(
    tables.refundRows.filter(row => row.key[0] === 1 && row.key[1] >= 3300).sort((a, b) => a.key[1] - b.key[1]).map(row => ({ key: row.key, value: row.value, isStarValue: row.isStarValue })),
    [
      { key: [1, 3300], value: 2883, isStarValue: false },
      { key: [1, 3325], value: 2905, isStarValue: false },
      { key: [1, 3350], value: 2927, isStarValue: false },
      { key: [1, 3375], value: 2949, isStarValue: false },
      { key: [1, 3400], value: 2971, isStarValue: false },
      { key: [1, 3425], value: 2993, isStarValue: false },
      { key: [1, 3450], value: 3015, isStarValue: false },
      { key: [1, 3475], value: 3037, isStarValue: false },
      { key: [1, 3500], value: 99999, isStarValue: true }
    ]
  );
});

test('MN M1PR regression: 3500 cells that leak the next row lower boundary become 99999', () => {
  const tables = buildHomeownerRefundTables([
    {
      rowLower: 85170,
      rowUpper: 87360,
      amountStarts: [3300, 3325, 3350, 3375, 3400, 3425, 3450, 3475, 3500],
      values: [2801, 2823, 2845, 2867, 2889, 2911, 2933, 2955, 6600],
      starValueIndices: []
    },
    {
      rowLower: 6600,
      rowUpper: 8810,
      amountStarts: [0, 25, 50],
      values: [4, 26, 48],
      starValueIndices: []
    }
  ]);

  assert.deepEqual(
    tables.refundRows.filter(row => row.key[0] === 1).sort((a, b) => a.key[1] - b.key[1]).map(row => ({ key: row.key, value: row.value, isStarValue: row.isStarValue })),
    [
      { key: [1, 3300], value: 2801, isStarValue: false },
      { key: [1, 3325], value: 2823, isStarValue: false },
      { key: [1, 3350], value: 2845, isStarValue: false },
      { key: [1, 3375], value: 2867, isStarValue: false },
      { key: [1, 3400], value: 2889, isStarValue: false },
      { key: [1, 3425], value: 2911, isStarValue: false },
      { key: [1, 3450], value: 2933, isStarValue: false },
      { key: [1, 3475], value: 2955, isStarValue: false },
      { key: [1, 3500], value: 99999, isStarValue: true }
    ]
  );
});

test('MN M1PR regression: implausibly large final 3500 values become 99999', () => {
  const parsedRows = parseHomeownerRefundPageRows([
    pdfTextItem('3,300', 100, 700), pdfTextItem('3,325', 150, 700), pdfTextItem('3,350', 200, 700), pdfTextItem('3,375', 250, 700), pdfTextItem('3,400', 300, 700), pdfTextItem('3,425', 350, 700), pdfTextItem('3,450', 400, 700), pdfTextItem('3,475', 450, 700), pdfTextItem('3,500', 500, 700),
    pdfTextItem('3,325', 100, 680), pdfTextItem('3,350', 150, 680), pdfTextItem('3,375', 200, 680), pdfTextItem('3,400', 250, 680), pdfTextItem('3,425', 300, 680), pdfTextItem('3,450', 350, 680), pdfTextItem('3,475', 400, 680), pdfTextItem('3,500', 450, 680), pdfTextItem('& up', 500, 680),
    pdfTextItem('83,470', 100, 640), pdfTextItem('85,660', 150, 640), pdfTextItem('1,021', 200, 640), pdfTextItem('1,037', 250, 640), pdfTextItem('1,053', 300, 640), pdfTextItem('1,069', 350, 640), pdfTextItem('1,084', 400, 640), pdfTextItem('1,100', 450, 640), pdfTextItem('1,116', 500, 640), pdfTextItem('1,132', 550, 640), pdfTextItem('6,600', 600, 640)
  ]);

  const tables = buildHomeownerRefundTables(parsedRows);
  assert.equal(tables.refundRows.find(row => row.key[0] === 1 && row.key[1] === 3500)?.value, 99999);
  assert.equal(tables.refundRows.find(row => row.key[0] === 1 && row.key[1] === 3500)?.isStarValue, true);
});

test('MN M1PR regression: parser keeps the final & over row with no numeric upper bound', () => {
  const parsedRows = parseHomeownerRefundPageRows([
    pdfTextItem('3,300', 100, 700), pdfTextItem('3,325', 150, 700), pdfTextItem('3,350', 200, 700), pdfTextItem('3,375', 250, 700), pdfTextItem('3,400', 300, 700), pdfTextItem('3,425', 350, 700), pdfTextItem('3,450', 400, 700), pdfTextItem('3,475', 450, 700), pdfTextItem('3,500', 500, 700),
    pdfTextItem('3,325', 100, 680), pdfTextItem('3,350', 150, 680), pdfTextItem('3,375', 200, 680), pdfTextItem('3,400', 250, 680), pdfTextItem('3,425', 300, 680), pdfTextItem('3,450', 350, 680), pdfTextItem('3,475', 400, 680), pdfTextItem('3,500', 450, 680), pdfTextItem('& up', 500, 680),
    pdfTextItem('142,490', 100, 640), pdfTextItem('& over', 150, 640), pdfTextItem('0', 200, 640), pdfTextItem('0', 250, 640), pdfTextItem('0', 300, 640), pdfTextItem('0', 350, 640), pdfTextItem('0', 400, 640), pdfTextItem('0', 450, 640), pdfTextItem('0', 500, 640), pdfTextItem('0', 550, 640), pdfTextItem('0', 600, 640)
  ]);

  assert.equal(parsedRows.length, 1);
  assert.equal(parsedRows[0].rowLower, 142490);
  assert.equal(parsedRows[0].rowUpper, null);
  assert.equal(parsedRows[0].amountStarts.length, 9);
  assert.equal(parsedRows[0].values.length, 9);
  assert.ok(parsedRows[0].values.every(value => value === 0));
});

test('OR scenario checkpoints: Oregon parser keeps representative values through 49,900', () => {
  const rows = parseOrPdfRows([
    pdfTextItem('0', 110, 700), pdfTextItem('20', 145, 700), pdfTextItem('0', 205, 700), pdfTextItem('0', 255, 700), pdfTextItem('19,000', 320, 700), pdfTextItem('19,100', 385, 700), pdfTextItem('1,365', 445, 700), pdfTextItem('1,114', 490, 700),
    pdfTextItem('20', 110, 680), pdfTextItem('50', 145, 680), pdfTextItem('2', 205, 680), pdfTextItem('2', 255, 680), pdfTextItem('49,900', 735, 680), pdfTextItem('50,000', 800, 680), pdfTextItem('4,069', 865, 680), pdfTextItem('3,769', 915, 680),
    pdfTextItem('50', 110, 660), pdfTextItem('100', 145, 660), pdfTextItem('4', 205, 660), pdfTextItem('4', 255, 660), pdfTextItem('4,000', 320, 660), pdfTextItem('4,100', 385, 660), pdfTextItem('192', 445, 660), pdfTextItem('192', 490, 660),
    pdfTextItem('100', 110, 640), pdfTextItem('200', 145, 640), pdfTextItem('7', 205, 640), pdfTextItem('7', 255, 640), pdfTextItem('9,000', 320, 640), pdfTextItem('9,100', 385, 640), pdfTextItem('525', 445, 640), pdfTextItem('439', 490, 640)
  ], 1000);

  const normalized = normalizeDeterministicRowsToData(rows, OR_CONFIG, { S: 'LowerBoundary', J: 'LowerBoundary' }, 'page 26');

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
  appState.selectedPdfPath = 'C\\PDFs\\MN_m1-inst-24_final_2-23-26.pdf';
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
