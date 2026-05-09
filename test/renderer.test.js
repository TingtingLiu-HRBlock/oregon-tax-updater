const test = require('node:test');
const assert = require('node:assert/strict');

const MN_CONFIG = require('../States/MN.js');
const OR_CONFIG = require('../States/OR.js');
const CO_CONFIG = require('../States/CO.js');
const { getState } = require('../States');
const {
  appState,
  parseMinnesotaPdfRows,
  parseMarriageCreditFromFullText,
  parseHomeownerRefundPageRows,
  parseRenterRefundPageRows,
  buildHomeownerRefundTables,
  buildRenterRefundTables,
  overlayGenericTableRows,
  normalizeRefundJsonRows,
  normalizeHomeownerRefundJsonRows,
  parseOrPdfRows,
  parseCoFamilyAffordabilityPageRows,
  buildCoFamilyReview,
  shiftDateTimeValueByYears,
  suggestYearOverYearValue,
  buildConstantsMaintenanceReview,
  buildUnitTestDateRollerReview,
  buildUnitTestLogReview,
  getUnitTestLogReadyApplyRows,
  normalizeDeterministicRowsToData,
  getEffectivePdfPageRange,
  renderWorkflowText,
  renderSelectedSource,
  renderMarriageCreditSection,
  updateActionButtons,
  showDiffTab,
  resetWorkflowContext,
  clearTransientData
} = require('../renderer.js');

function resetAppState() {
  appState.selectedStateCode = null;
  appState.selectedStateConfig = null;
  appState.selectedWorkflowKey = 'standard';
  appState.taxYear = 2024;
  appState.filePaths = {};
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  appState.extractedData = null;
  appState.diffResults = null;
  appState.marriageCreditReview = null;
  appState.homeownerRefundReview = null;
  appState.coFamilyAffordabilityReview = null;
  appState.constantsMaintenanceReview = null;
  appState.unitTestDateRollerReview = null;
  appState.unitTestLogReview = null;
  appState.constantsShiftDeltaYears = 1;
  appState.constantsMaintenanceUi = { activeTab: 'auto' };
  appState.unitTestDateRollerUi = { activeTab: 'ready' };
  appState.unitTestLogUi = { activeTab: 'ready' };
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

function createWorkflowTextDom(extra = {}) {
  const elements = {
    constantsShiftDirectionSelect: { value: '' },
    sourceSubtitle: { textContent: '' },
    uploadHint: { textContent: '' },
    pageRangeHint: { textContent: '' },
    extractSectionTitle: { textContent: '' },
    extractSectionSubtitle: { textContent: '' },
    extractBtn: { textContent: '', disabled: false },
    updateSectionTitle: { textContent: '' },
    updateSectionSubtitle: { textContent: '' },
    updateJsonBtn: { textContent: '', disabled: false, style: { display: '' } },
    constantsShiftControls: { style: { display: '' } },
    unitTestLogControls: { style: { display: '' } },
    constantsShiftHint: { textContent: '' },
    ...extra
  };
  global.document = {
    getElementById(id) {
      return elements[id];
    }
  };
  return elements;
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

test('MN M1RENT regression: final page accepts upper header rows that say and up', () => {
  const parsedRows = parseRenterRefundPageRows([
    pdfTextItem('If Schedule M1RENT,', 40, 700), pdfTextItem('$2,250', 160, 700), pdfTextItem('2,275', 200, 700), pdfTextItem('2,300', 240, 700), pdfTextItem('2,325', 280, 700), pdfTextItem('2,350', 320, 700),
    pdfTextItem('$2,275', 160, 680), pdfTextItem('2,300', 200, 680), pdfTextItem('2,325', 240, 680), pdfTextItem('2,350', 280, 680), pdfTextItem('2,375', 320, 680), pdfTextItem('and up', 360, 680),
    pdfTextItem('0', 80, 640), pdfTextItem('2,210', 130, 640), pdfTextItem('2,139', 170, 640), pdfTextItem('2,163', 210, 640), pdfTextItem('2,186', 250, 640), pdfTextItem('2,210', 290, 640), pdfTextItem('*', 330, 640)
  ]);

  assert.deepEqual(parsedRows[0].amountStarts, [2250, 2275, 2300, 2325, 2350]);
  assert.deepEqual(parsedRows[0].values, [2139, 2163, 2186, 2210, 99999]);
  assert.deepEqual(parsedRows[0].starValueIndices, [4]);
});

test('MN M1RENT regression: dollar-prefixed header amounts keep the 0 column aligned', () => {
  const parsedRows = parseRenterRefundPageRows([
    pdfTextItem('If Schedule M1RENT,', 40, 700), pdfTextItem('$ 0', 160, 700), pdfTextItem('25', 190, 700), pdfTextItem('50', 220, 700), pdfTextItem('75', 250, 700), pdfTextItem('100', 280, 700),
    pdfTextItem('$25', 160, 680), pdfTextItem('50', 190, 680), pdfTextItem('75', 220, 680), pdfTextItem('100', 250, 680), pdfTextItem('125', 280, 680),
    pdfTextItem('0', 80, 640), pdfTextItem('2,210', 130, 640), pdfTextItem('1', 170, 640), pdfTextItem('25', 200, 640), pdfTextItem('49', 230, 640), pdfTextItem('73', 260, 640), pdfTextItem('96', 290, 640),
    pdfTextItem('2,210', 80, 620), pdfTextItem('4,430', 130, 620), pdfTextItem('0', 170, 620), pdfTextItem('4', 200, 620), pdfTextItem('28', 230, 620), pdfTextItem('52', 260, 620), pdfTextItem('75', 290, 620)
  ]);

  const tables = buildRenterRefundTables(parsedRows);

  assert.deepEqual(parsedRows[0].amountStarts, [0, 25, 50, 75, 100]);
  assert.deepEqual(parsedRows[0].values, [1, 25, 49, 73, 96]);
  assert.deepEqual(tables.refundRows.filter(row => row.key[0] === 1).map(row => ({ key: row.key, value: row.value })), [
    { key: [1, 0], value: 1 },
    { key: [1, 25], value: 25 },
    { key: [1, 50], value: 49 },
    { key: [1, 75], value: 73 },
    { key: [1, 100], value: 96 }
  ]);
});

test('MN M1RENT regression: parser builds row and refund tables with first lower boundary -100000', () => {
  const parsedRows = parseRenterRefundPageRows([
    pdfTextItem('0', 100, 700), pdfTextItem('25', 150, 700), pdfTextItem('50', 200, 700), pdfTextItem('75', 250, 700), pdfTextItem('100', 300, 700), pdfTextItem('125', 350, 700), pdfTextItem('150', 400, 700), pdfTextItem('175', 450, 700), pdfTextItem('200', 500, 700), pdfTextItem('225', 550, 700), pdfTextItem('250', 600, 700),
    pdfTextItem('25', 100, 680), pdfTextItem('50', 150, 680), pdfTextItem('75', 200, 680), pdfTextItem('100', 250, 680), pdfTextItem('125', 300, 680), pdfTextItem('150', 350, 680), pdfTextItem('175', 400, 680), pdfTextItem('200', 450, 680), pdfTextItem('225', 500, 680), pdfTextItem('250', 550, 680), pdfTextItem('275', 600, 680),
    pdfTextItem('0', 100, 640), pdfTextItem('2,210', 150, 640), pdfTextItem('4', 200, 640), pdfTextItem('28', 250, 640), pdfTextItem('52', 300, 640), pdfTextItem('75', 350, 640), pdfTextItem('99', 400, 640), pdfTextItem('123', 450, 640), pdfTextItem('147', 500, 640), pdfTextItem('170', 550, 640), pdfTextItem('194', 600, 640), pdfTextItem('218', 650, 640), pdfTextItem('242', 700, 640),
    pdfTextItem('2,210', 100, 620), pdfTextItem('4,430', 150, 620), pdfTextItem('0', 200, 620), pdfTextItem('4', 250, 620), pdfTextItem('28', 300, 620), pdfTextItem('52', 350, 620), pdfTextItem('75', 400, 620), pdfTextItem('99', 450, 620), pdfTextItem('123', 500, 620), pdfTextItem('147', 550, 620), pdfTextItem('170', 600, 620), pdfTextItem('194', 650, 620), pdfTextItem('218', 700, 620)
  ]);

  const tables = buildRenterRefundTables(parsedRows);

  assert.equal(parsedRows.length, 2);
  assert.deepEqual(tables.rowTableRows, [
    { key: [-100000], value: 1 },
    { key: [2210], value: 2 }
  ]);
  assert.equal(tables.refundRows[0].key[0], 1);
  assert.equal(tables.refundRows[0].key[1], 0);
  assert.equal(tables.refundRows[0].value, 4);
  assert.equal(tables.refundRows.at(-1).key[0], 2);
  assert.equal(tables.refundRows.at(-1).key[1], 250);
  assert.equal(tables.refundRows.at(-1).value, 218);
});

test('MN M1RENT regression: starred 2500 cells normalize to 99999', () => {
  const parsedRows = parseRenterRefundPageRows([
    pdfTextItem('2,300', 100, 700), pdfTextItem('2,325', 150, 700), pdfTextItem('2,350', 200, 700), pdfTextItem('2,375', 250, 700), pdfTextItem('2,400', 300, 700), pdfTextItem('2,425', 350, 700), pdfTextItem('2,450', 400, 700), pdfTextItem('2,475', 450, 700), pdfTextItem('2,500', 500, 700),
    pdfTextItem('2,325', 100, 680), pdfTextItem('2,350', 150, 680), pdfTextItem('2,375', 200, 680), pdfTextItem('2,400', 250, 680), pdfTextItem('2,425', 300, 680), pdfTextItem('2,450', 350, 680), pdfTextItem('2,475', 400, 680), pdfTextItem('2,500', 450, 680), pdfTextItem('& up', 500, 680),
    pdfTextItem('0', 100, 640), pdfTextItem('2,210', 150, 640), pdfTextItem('96', 200, 640), pdfTextItem('120', 250, 640), pdfTextItem('144', 300, 640), pdfTextItem('168', 350, 640), pdfTextItem('191', 400, 640), pdfTextItem('215', 450, 640), pdfTextItem('239', 500, 640), pdfTextItem('263', 550, 640), pdfTextItem('*', 600, 640)
  ]);

  const tables = buildRenterRefundTables(parsedRows);
  const finalCell = tables.refundRows.find(row => row.key[0] === 1 && row.key[1] === 2500);

  assert.equal(finalCell?.value, 99999);
  assert.equal(finalCell?.isStarValue, true);
  assert.deepEqual(normalizeRefundJsonRows([{ key: [1, 2500], value: 0, isStarValue: true }]), [{ key: [1, 2500], value: 99999 }]);
});

test('MN M1RENT regression: full renter table shape builds 36 row entries and 3636 refund entries', () => {
  const amountStarts = Array.from({ length: 101 }, (_, index) => index * 25);
  const parsedRows = Array.from({ length: 36 }, (_, rowIndex) => ({
    rowLower: rowIndex * 2210,
    rowUpper: rowIndex === 35 ? null : (rowIndex + 1) * 2210,
    amountStarts,
    values: amountStarts.map(amount => rowIndex + amount),
    starValueIndices: rowIndex === 0 ? [amountStarts.length - 1] : []
  }));

  const tables = buildRenterRefundTables(parsedRows);

  assert.equal(tables.rowTableRows.length, 36);
  assert.equal(tables.refundRows.length, 3636);
  assert.deepEqual(tables.rowTableRows[0], { key: [-100000], value: 1 });
  assert.deepEqual(tables.refundRows.at(-1).key, [36, 2500]);
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

test('Constants maintenance: year-over-year DateTime preview shifts full dates by one year', () => {
  const review = buildConstantsMaintenanceReview({
    taxYear: '2025',
    entity: 'OH',
    autoMatches: [
      {
        index: 12,
        uid: 'abc',
        name: 'StateExtendedDueDate',
        description: 'State Extended Due Date',
        value: '2026-10-15',
        dataTimeValue: '2026-10-15T00:00:00.000Z'
      }
    ],
    manualMatches: []
  }, 1);

  assert.equal(review.autoRows.length, 1);
  assert.equal(review.manualRows.length, 0);
  assert.equal(review.autoRows[0].currentValue, '2026-10-15');
  assert.equal(review.autoRows[0].proposedValue, '2027-10-15');
  assert.equal(review.autoRows[0].proposedDataTimeValue, '2027-10-15T00:00:00.000Z');
});

test('Constants maintenance: leap-day dates normalize safely when shifting years', () => {
  assert.equal(shiftDateTimeValueByYears('2024-02-29', 1), '2025-03-01');
  assert.equal(shiftDateTimeValueByYears('2024-02-29', -1), '2023-03-01');
});

test('Constants maintenance: suggestion engine shifts plain year values', () => {
  const suggestion = suggestYearOverYearValue('2025', 1);

  assert.equal(suggestion.suggestedValue, '2026');
  assert.equal(suggestion.suggestionType, 'year');
  assert.equal(suggestion.confidence, 'high');
  assert.equal(suggestion.needsManualReview, false);
});

test('Constants maintenance: suggestion engine shifts MMYY values', () => {
  const suggestion = suggestYearOverYearValue('1225', 1);

  assert.equal(suggestion.suggestedValue, '1226');
  assert.equal(suggestion.suggestionType, 'mmyy');
  assert.equal(suggestion.confidence, 'high');
});

test('Constants maintenance: suggestion engine shifts date-like string values with two-digit years', () => {
  const suggestion = suggestYearOverYearValue('04-15-26', 1);

  assert.equal(suggestion.suggestedValue, '04-15-27');
  assert.equal(suggestion.suggestionType, 'date-like-string');
  assert.equal(suggestion.confidence, 'high');
  assert.equal(suggestion.needsManualReview, false);
});

test('Constants maintenance: suggestion engine shifts compact YYYYMMDD date strings', () => {
  const suggestion = suggestYearOverYearValue('20251231', 1);

  assert.equal(suggestion.suggestedValue, '20261231');
  assert.equal(suggestion.suggestionType, 'date-like-string');
  assert.equal(suggestion.confidence, 'high');
  assert.equal(suggestion.needsManualReview, false);
});

test('Constants maintenance: suggestion engine shifts compact MMDDYYYY date strings', () => {
  const suggestion = suggestYearOverYearValue('01012025', 1);

  assert.equal(suggestion.suggestedValue, '01012026');
  assert.equal(suggestion.suggestionType, 'date-like-string');
  assert.equal(suggestion.confidence, 'high');
  assert.equal(suggestion.needsManualReview, false);
});

test('Constants maintenance: suggestion engine shifts contextual two-digit year strings', () => {
  const suggestion = suggestYearOverYearValue('24', 1, {
    name: 'TYBeginningYear',
    description: 'Tax year Beginning year (YY)',
    baseType: 'string'
  });

  assert.equal(suggestion.suggestedValue, '25');
  assert.equal(suggestion.suggestionType, 'contextual-two-digit-year');
  assert.equal(suggestion.confidence, 'medium');
  assert.equal(suggestion.needsManualReview, false);
});

test('Constants maintenance: suggestion engine shifts embedded year text', () => {
  const suggestion = suggestYearOverYearValue('Tax Year 2025 Credit', 1);

  assert.equal(suggestion.suggestedValue, 'Tax Year 2026 Credit');
  assert.equal(suggestion.suggestionType, 'embedded-year');
  assert.equal(suggestion.confidence, 'medium');
});

test('Constants maintenance: suggestion engine shifts trailing year code values', () => {
  const suggestion = suggestYearOverYearValue('SP2025', 1);

  assert.equal(suggestion.suggestedValue, 'SP2026');
  assert.equal(suggestion.suggestionType, 'trailing-year-code');
  assert.equal(suggestion.confidence, 'medium');
  assert.equal(suggestion.needsManualReview, false);
});

test('Constants maintenance: review splits automatic DateTime rows from manual year-over-year suggestions', () => {
  const review = buildConstantsMaintenanceReview({
    taxYear: '2025',
    entity: 'OH',
    autoMatches: [
      {
        index: 1,
        uid: 'auto',
        name: 'StateExtendedDueDate',
        description: 'State Extended Due Date',
        value: '2026-10-15',
        dataTimeValue: '2026-10-15T00:00:00.000Z'
      }
    ],
    manualMatches: [
      {
        index: 2,
        uid: 'year',
        name: 'CurrentTaxYear',
        description: 'Current tax year',
        baseType: 'string',
        value: '2025'
      },
      {
        index: 3,
        uid: 'mmyy',
        name: 'CurrYrReportingPeriodMMYY',
        description: 'Update yearly',
        baseType: 'string',
        value: '1225'
      },
      {
        index: 4,
        uid: 'date-like',
        name: 'ESFirstQtrDueDate',
        description: 'First quarter date',
        baseType: 'string',
        value: '04-15-26'
      },
      {
        index: 5,
        uid: 'suffix-year',
        name: 'ORFormTypeSP',
        description: 'Form SP type code for 2-D',
        baseType: 'string',
        value: 'SP2025'
      },
      {
        index: 6,
        uid: 'compact-date',
        name: 'TaxYearEndOrgAndScanLine',
        description: 'Tax year end for original or amended return voucher',
        baseType: 'string',
        value: '20251231'
      },
      {
        index: 7,
        uid: 'compact-us-date',
        name: 'TaxBeginningDate',
        description: 'Tax year beginning date',
        baseType: 'string',
        value: '01012025'
      },
      {
        index: 8,
        uid: 'contextual-yy-begin',
        name: 'TYBeginningYear',
        description: 'Tax year Beginning year (YY)',
        baseType: 'string',
        value: '24'
      },
      {
        index: 9,
        uid: 'contextual-yy-end',
        name: 'TYEndingYear',
        description: 'Tax year Ending year (YY)',
        baseType: 'string',
        value: '25'
      }
    ]
  }, 1);

  assert.equal(review.autoRows.length, 1);
  assert.equal(review.autoRows[0].autoOverrideText, '2027-10-15');
  assert.equal(review.manualRows.length, 8);
  assert.equal(review.manualRows[0].suggestedValue, '2026');
  assert.equal(review.manualRows[0].description, 'Current tax year');
  assert.equal(review.manualRows[1].suggestedValue, '1226');
  assert.equal(review.manualRows[2].suggestedValue, '04-15-27');
  assert.equal(review.manualRows[2].needsManualReview, false);
  assert.equal(review.manualRows[3].suggestedValue, 'SP2026');
  assert.equal(review.manualRows[3].needsManualReview, false);
  assert.equal(review.manualRows[4].suggestedValue, '20261231');
  assert.equal(review.manualRows[4].needsManualReview, false);
  assert.equal(review.manualRows[5].suggestedValue, '01012026');
  assert.equal(review.manualRows[5].needsManualReview, false);
  assert.equal(review.manualRows[6].suggestedValue, '25');
  assert.equal(review.manualRows[6].needsManualReview, false);
  assert.equal(review.manualRows[7].suggestedValue, '26');
  assert.equal(review.manualRows[7].needsManualReview, false);
});

test('Constants maintenance: auto DateTime rows expose editable reviewed values', () => {
  resetAppState();
  appState.selectedWorkflowKey = 'constants-maintenance';
  appState.constantsMaintenanceUi.activeTab = 'auto';
  appState.constantsMaintenanceReview = buildConstantsMaintenanceReview({
    taxYear: '2025',
    entity: 'CA',
    autoMatches: [
      {
        index: 1,
        uid: 'auto',
        name: 'StateExtendedDueDate',
        description: 'State Extended Due Date',
        value: '2026-10-15',
        dataTimeValue: '2026-10-15T00:00:00.000Z'
      }
    ],
    manualMatches: []
  }, 1);

  const container = {
    style: {},
    innerHTML: '',
    querySelectorAll() {
      return [];
    }
  };
  global.document = {
    getElementById(id) {
      if (id === 'marriageCreditSection') return container;
      return null;
    }
  };

  renderMarriageCreditSection();

  assert.match(container.innerHTML, /Auto Date Updates/);
  assert.match(container.innerHTML, /Reviewed Value/);
  assert.match(container.innerHTML, /constants-auto-input/);
  assert.match(container.innerHTML, /value="2027-10-15"/);
  assert.match(container.innerHTML, /placeholder="2027-10-15"/);
  assert.match(container.innerHTML, /Ready/);
});

test('PDF page range scenario: manual range is required before extraction becomes available', () => {
  resetAppState();
  appState.selectedPdfPath = 'C\\PDFs\\MN_m1-inst-24_final_2-23-26.pdf';
  appState.selectedStateConfig = MN_CONFIG;

  const extractBtn = { disabled: true };
  const updateJsonBtn = { disabled: true };
  const uploadArea = { style: { display: '' } };
  const selectPdfBtn = { style: { display: '' } };
  const pdfSection = { style: { display: '' } };
  const pdfSummary = { textContent: '' };
  const pageStartInput = { value: '' };
  const pageEndInput = { value: '' };

  global.document = {
    getElementById(id) {
      return {
        extractBtn,
        updateJsonBtn,
        uploadArea,
        selectPdfBtn,
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

test('Constants maintenance: preview button uses the constants file path and does not require a PDF', () => {
  resetAppState();
  appState.selectedStateConfig = getState('OH');
  appState.selectedStateCode = 'OH';
  appState.selectedWorkflowKey = 'constants-maintenance';
  appState.filePaths = { CONSTS: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Utils\\OH.consts.json' };

  const extractBtn = { disabled: true };
  const updateJsonBtn = { disabled: true };
  const uploadArea = { style: { display: '' } };
  const selectPdfBtn = { style: { display: '' } };
  const pdfSection = { style: { display: '' } };
  const pdfSummary = { textContent: '' };
  const pageStartInput = { value: '' };
  const pageEndInput = { value: '' };

  global.document = {
    getElementById(id) {
      return {
        extractBtn,
        updateJsonBtn,
        uploadArea,
        selectPdfBtn,
        pdfSelectionSection: pdfSection,
        pdfSelectionSummary: pdfSummary,
        pdfPageStartInput: pageStartInput,
        pdfPageEndInput: pageEndInput
      }[id];
    }
  };

  renderSelectedSource();
  updateActionButtons();

  assert.equal(selectPdfBtn.style.display, 'none');
  assert.equal(pdfSection.style.display, 'none');
  assert.equal(extractBtn.disabled, false);
  assert.equal(updateJsonBtn.disabled, true);
});

test('Constants maintenance: non-Ohio states use the same no-PDF preview flow', () => {
  resetAppState();
  appState.selectedStateConfig = CO_CONFIG;
  appState.selectedStateCode = 'CO';
  appState.selectedWorkflowKey = 'constants-maintenance';
  appState.filePaths = { CONSTS: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\CO\\Utils\\CO.consts.json' };

  const extractBtn = { disabled: true };
  const updateJsonBtn = { disabled: true };
  const uploadArea = { style: { display: '' } };
  const selectPdfBtn = { style: { display: '' } };
  const pdfSection = { style: { display: '' } };
  const pdfSummary = { textContent: '' };
  const pageStartInput = { value: '' };
  const pageEndInput = { value: '' };

  global.document = {
    getElementById(id) {
      return {
        extractBtn,
        updateJsonBtn,
        uploadArea,
        selectPdfBtn,
        pdfSelectionSection: pdfSection,
        pdfSelectionSummary: pdfSummary,
        pdfPageStartInput: pageStartInput,
        pdfPageEndInput: pageEndInput
      }[id];
    }
  };

  renderSelectedSource();
  updateActionButtons();

  assert.equal(selectPdfBtn.style.display, 'none');
  assert.equal(pdfSection.style.display, 'none');
  assert.equal(extractBtn.disabled, false);
});

test('Workflow text reset: switching from unit tests to constants updates the preview button label', () => {
  resetAppState();
  appState.selectedStateConfig = CO_CONFIG;
  appState.selectedStateCode = 'CO';
  const elements = createWorkflowTextDom();

  appState.selectedWorkflowKey = 'unit-test-date-roller';
  renderWorkflowText();
  assert.equal(elements.extractBtn.textContent, 'Preview Unit Test Updates');
  assert.equal(elements.unitTestLogControls.style.display, 'flex');

  appState.selectedWorkflowKey = 'constants-maintenance';
  renderWorkflowText();

  assert.equal(elements.extractBtn.textContent, 'Preview Constant Year Shift');
  assert.equal(elements.updateJsonBtn.textContent, 'Apply Year Shift');
  assert.equal(elements.unitTestLogControls.style.display, 'none');
  assert.equal(elements.constantsShiftControls.style.display, 'flex');
});

test('State switch reset: preserves a valid workflow and clears stale source state', () => {
  resetAppState();
  appState.selectedStateCode = 'OR';
  appState.selectedStateConfig = OR_CONFIG;
  appState.selectedWorkflowKey = 'constants-maintenance';
  appState.filePaths = { CONSTS: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OR\\Utils\\OR.consts.json' };
  appState.selectedPdfPath = 'C:\\PDFs\\or-2025-booklet.pdf';
  appState.pdfPageRangeOverride = { start: '30', end: '40' };
  appState.constantsMaintenanceReview = { autoRows: [], manualRows: [{ index: 1 }] };

  appState.selectedStateCode = 'FD';
  appState.selectedStateConfig = getState('FD');
  resetWorkflowContext('constants-maintenance');

  assert.equal(appState.selectedWorkflowKey, 'constants-maintenance');
  assert.deepEqual(appState.filePaths, {});
  assert.equal(appState.selectedPdfPath, null);
  assert.deepEqual(appState.pdfPageRangeOverride, { start: '', end: '' });
  assert.equal(appState.constantsMaintenanceReview, null);
});

test('Unit test date roller: preview uses the test root path and does not require a PDF', () => {
  resetAppState();
  appState.selectedStateConfig = getState('OH');
  appState.selectedStateCode = 'OH';
  appState.selectedWorkflowKey = 'unit-test-date-roller';
  appState.filePaths = {
    TEST_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Tests\\Unit\\Calc',
    CALC_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Calc',
    CONSTS: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Utils\\OH.consts.json'
  };

  const extractBtn = { disabled: true };
  const updateJsonBtn = { disabled: true };
  const uploadArea = { style: { display: '' } };
  const selectPdfBtn = { style: { display: '' } };
  const pdfSection = { style: { display: '' } };
  const pdfSummary = { textContent: '' };
  const pageStartInput = { value: '' };
  const pageEndInput = { value: '' };

  global.document = {
    getElementById(id) {
      return {
        extractBtn,
        updateJsonBtn,
        uploadArea,
        selectPdfBtn,
        pdfSelectionSection: pdfSection,
        pdfSelectionSummary: pdfSummary,
        pdfPageStartInput: pageStartInput,
        pdfPageEndInput: pageEndInput
      }[id];
    }
  };

  renderSelectedSource();
  updateActionButtons();

  assert.equal(selectPdfBtn.style.display, 'none');
  assert.equal(pdfSection.style.display, 'none');
  assert.equal(extractBtn.disabled, false);
  assert.equal(updateJsonBtn.disabled, true);
});

test('Unit test date roller: review summary preserves calc, file, and ready-update counts', () => {
  resetAppState();
  appState.filePaths = {
    TEST_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Tests\\Unit\\Calc',
    CALC_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Calc',
    CONSTS: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Utils\\OH.consts.json'
  };

  const review = buildUnitTestDateRollerReview({
    rootPath: appState.filePaths.TEST_ROOT,
    calcRootPath: appState.filePaths.CALC_ROOT,
    constantsPath: appState.filePaths.CONSTS,
    calcFileCount: 4,
    fileCount: 2,
    updateCount: 2,
    reviewCount: 1,
    rows: [
      { rowKind: 'input', filePath: 'a.test.json', calcFilePath: 'a.calc.json', calcFieldPath: 'OH/FormA/FieldA', caseName: 'case A', fieldPath: '0.inputs.0', valuePath: '0.inputs.0.value', type: 'DateTime', tomType: 'Date', constantName: 'SomeConstant', currentValue: '2025-04-15', proposedValue: '2026-04-15', canApply: true },
      { rowKind: 'output', filePath: 'b.test.json', calcFilePath: 'b.calc.json', calcFieldPath: 'OH/FormB/FieldB', caseName: 'case B', fieldPath: '0.output', valuePath: '0.output.value.0', type: 'DateTime[]', tomType: 'Date', constantName: 'SomeConstant', currentValue: ['2025-06-15'], proposedValue: ['2026-06-15'], canApply: true },
      { filePath: 'c.test.json', calcFilePath: 'c.calc.json', calcFieldPath: 'OH/FormC/FieldC', caseName: 'case C', fieldPath: '0.output', valuePath: '0.output.value', type: 'DateTime[]', tomType: 'Date', constantName: 'OtherConstant', currentValue: ['2025-09-15', '2025-12-15'], proposedValue: '', canApply: false, reason: 'Manual review', inputCandidates: [{ label: 'PaymentDate', fieldPath: '0.inputs.0', valuePath: '0.inputs.0.value', type: 'DateTime', tomType: 'Date', currentValue: '2025-04-15' }] }
    ]
  });

  assert.equal(review.fileCount, 2);
  assert.equal(review.calcFileCount, 4);
  assert.equal(review.rows.length, 3);
  assert.equal(review.updateCount, 2);
  assert.equal(review.reviewCount, 1);
  assert.equal(review.readyRows.length, 2);
  assert.equal(review.manualRows.length, 1);
  assert.equal(review.caseCount, 3);
  assert.equal(review.rows[0].calcFieldPath, 'OH/FormA/FieldA');
  assert.equal(review.rows[0].readyOverrideText, '2026-04-15');
  assert.equal(review.rows[1].caseName, 'case B');
  assert.deepEqual(review.rows[1].proposedValue, ['2026-06-15']);
  assert.equal(review.rows[1].readyOverrideText, '["2026-06-15"]');
});

test('Unit test date roller: review UI separates ready and manual rows into tabs', () => {
  resetAppState();
  appState.selectedWorkflowKey = 'unit-test-date-roller';
  appState.unitTestDateRollerReview = buildUnitTestDateRollerReview({
    calcFileCount: 4,
    fileCount: 2,
    rows: [
      { rowKind: 'input', filePath: 'a.test.json', calcFilePath: 'a.calc.json', calcFieldPath: 'OH/FormA/FieldA', caseName: 'case A', fieldPath: '0.inputs.0', valuePath: '0.inputs.0.value', type: 'DateTime', tomType: 'Date', constantName: 'SomeConstant', currentValue: '2025-04-15', proposedValue: '2026-04-15', canApply: true },
      { filePath: 'c.test.json', calcFilePath: 'c.calc.json', calcFieldPath: 'OH/FormC/FieldC', caseName: 'case C', fieldPath: '0.output', valuePath: '0.output.value', type: 'DateTime[]', tomType: 'Date', constantName: 'OtherConstant', currentValue: ['2025-09-15', '2025-12-15'], proposedValue: '', canApply: false, reason: 'Manual review', inputCandidates: [{ label: 'PaymentDate', fieldPath: '0.inputs.0', valuePath: '0.inputs.0.value', type: 'DateTime', tomType: 'Date', currentValue: '2025-04-15' }] }
    ]
  });

  const container = {
    style: {},
    innerHTML: '',
    querySelectorAll() {
      return [];
    }
  };
  global.document = {
    getElementById(id) {
      if (id === 'marriageCreditSection') return container;
      return null;
    }
  };

  renderMarriageCreditSection();
  assert.match(container.innerHTML, /Ready for Update/);
  assert.match(container.innerHTML, /Needs Manual Review/);
  assert.match(container.innerHTML, /Impacted cases/);
  assert.match(container.innerHTML, /Case 1: case A/);
  assert.match(container.innerHTML, /Calc Field Path: OH\/FormA\/FieldA/);
  assert.match(container.innerHTML, /Target/);
  assert.match(container.innerHTML, />Input</);
  assert.match(container.innerHTML, /Calc Field Path/);
  assert.match(container.innerHTML, /OH\/FormA\/FieldA/);
  assert.doesNotMatch(container.innerHTML, /Test File/);
  assert.match(container.innerHTML, /Calc File: a\.calc\.json/);
  assert.match(container.innerHTML, /View Calc \/ Unit Test/);
  assert.match(container.innerHTML, /data-calc-file-path="a\.calc\.json"/);
  assert.match(container.innerHTML, /data-test-file-path="a\.test\.json"/);
  assert.match(container.innerHTML, /Ready Unit Test Updates/);
  assert.match(container.innerHTML, /Apply Ready Updates/);
  assert.match(container.innerHTML, /Reviewed Value/);
  assert.match(container.innerHTML, /unit-test-ready-value-input/);
  assert.match(container.innerHTML, /value="2026-04-15"/);
  assert.match(container.innerHTML, /placeholder="2026-04-15"/);
  assert.match(container.innerHTML, /unit-test-panel-ready"><div class="content-section">/);
  assert.match(container.innerHTML, /unit-test-review-panel active" id="unit-test-panel-ready"/);
  assert.doesNotMatch(container.innerHTML, /unit-test-review-panel active" id="unit-test-panel-manual"/);

  appState.unitTestDateRollerUi.activeTab = 'manual';
  renderMarriageCreditSection();
  assert.match(container.innerHTML, /Unit Tests Needing Manual Review/);
  assert.match(container.innerHTML, /Apply Reviewed Manual Values/);
  assert.match(container.innerHTML, /Reviewed Value/);
  assert.match(container.innerHTML, /unit-test-manual-value-input/);
  assert.match(container.innerHTML, /unit-test-manual-input-candidate/);
  assert.match(container.innerHTML, /PaymentDate/);
  assert.match(container.innerHTML, /Calc File: c\.calc\.json/);
  assert.match(container.innerHTML, /data-calc-file-path="c\.calc\.json"/);
  assert.match(container.innerHTML, /data-test-file-path="c\.test\.json"/);
  assert.match(container.innerHTML, /unit-test-review-panel active" id="unit-test-panel-manual"/);
  assert.doesNotMatch(container.innerHTML, /unit-test-review-panel active" id="unit-test-panel-ready"/);
});

test('Unit test log review UI shows calc links and manual reviewed value inputs', () => {
  resetAppState();
  appState.selectedWorkflowKey = 'unit-test-date-roller';
  appState.filePaths = {
    TEST_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Tests\\OH',
    CALC_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Calc'
  };
  appState.unitTestLogReview = buildUnitTestLogReview({
    logPath: 'latest.log',
    failureCount: 2,
    rows: [
      { filePath: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Tests\\OH\\FormA\\FieldA.test.json', calcFieldPath: 'OH/FormA/FieldA', caseName: 'case A', fieldPath: '0.output', valuePath: '0.output.value', type: 'decimal', currentValue: 10, proposedValue: 12, canApply: true, inputCandidates: [{ label: 'ReadyInputDate', fieldPath: '0.inputs.0', valuePath: '0.inputs.0.value', type: 'DateTime', tomType: 'Date', currentValue: '2025-01-15' }] },
      { filePath: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Tests\\OH\\FormB\\FieldB.test.json', calcFieldPath: 'OH/FormB/FieldB', caseName: 'case B', fieldPath: '0.output', valuePath: '0.output.value', type: 'DateTime[]', currentValue: ['2026-05-15'], proposedValue: '', canApply: false, reason: 'Log actual value is null', inputCandidates: [{ label: 'PaymentDate', fieldPath: '0.inputs.0', valuePath: '0.inputs.0.value', type: 'DateTime', tomType: 'Date', currentValue: '2025-04-15' }, { label: 'Amount', fieldPath: '0.inputs.1', valuePath: '0.inputs.1.value', type: 'decimal', tomType: 'USAmount', currentValue: 100 }] }
    ]
  });

  const container = {
    style: {},
    innerHTML: '',
    querySelectorAll() {
      return [];
    }
  };
  global.document = {
    getElementById(id) {
      if (id === 'marriageCreditSection') return container;
      return null;
    }
  };

  renderMarriageCreditSection();
  assert.match(container.innerHTML, /unit-test-log-review-tabs/);
  assert.match(container.innerHTML, /data-unit-test-log-tab="ready"/);
  assert.match(container.innerHTML, /data-unit-test-log-tab="manual"/);
  assert.match(container.innerHTML, /unit-test-log-review-panel active" id="unit-test-log-panel-ready"/);
  assert.match(container.innerHTML, /unit-test-log-panel-manual/);
  assert.match(container.innerHTML, /Apply Ready Failed Outputs/);
  assert.match(container.innerHTML, /Apply Reviewed Failed Outputs/);
  assert.match(container.innerHTML, /Proposed \/ Reviewed/);
  assert.match(container.innerHTML, /unit-test-log-ready-value-input/);
  assert.match(container.innerHTML, /unit-test-log-ready-input-value/);
  assert.match(container.innerHTML, /ReadyInputDate/);
  assert.match(container.innerHTML, /View Calc \/ Unit Test/);
  assert.match(container.innerHTML, /FieldA\.calc\.json/);
  assert.match(container.innerHTML, /FieldB\.calc\.json/);
  assert.match(container.innerHTML, /Reviewed Value/);
  assert.match(container.innerHTML, /unit-test-log-manual-value-input/);
  assert.match(container.innerHTML, /unit-test-log-manual-input-value/);
  assert.match(container.innerHTML, /PaymentDate/);
  assert.match(container.innerHTML, /Amount/);

  appState.unitTestLogUi.activeTab = 'manual';
  renderMarriageCreditSection();
  assert.match(container.innerHTML, /unit-test-log-review-panel active" id="unit-test-log-panel-manual"/);
  assert.doesNotMatch(container.innerHTML, /unit-test-log-review-panel active" id="unit-test-log-panel-ready"/);
});

test('Unit test log ready apply button stays enabled when ready input edits need validation', () => {
  resetAppState();
  appState.selectedWorkflowKey = 'unit-test-date-roller';
  appState.filePaths = {
    TEST_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2026\\Tests\\OHC',
    CALC_ROOT: 'C:\\TaxEngine\\OCE-Regulatory-2026\\Source\\OHC\\Calc',
    CONSTS: 'C:\\TaxEngine\\OCE-Regulatory-2026\\Source\\OHC\\Constants\\OHCConstants.constants.json'
  };
  appState.unitTestLogReview = buildUnitTestLogReview({
    logPath: 'latest.log',
    failureCount: 1,
    rows: [
      {
        filePath: 'C:\\TaxEngine\\OCE-Regulatory-2026\\Tests\\OHC\\ResidentCityInfo\\DaysForSort.test.json',
        calcFieldPath: 'OHC/ResidentCityInfo.ResidentCitiesSP/DaysForSort',
        caseName: 'DaysForSortBeginDateBeforeFirstDay',
        fieldPath: '0.output',
        valuePath: '0.output.value',
        type: 'decimal',
        currentValue: 348,
        proposedValue: -17,
        canApply: true,
        inputCandidates: [
          {
            label: 'ResidentCityInfo.ResidentCitiesSP/BeginDate',
            fieldPath: '0.inputs.0',
            valuePath: '0.inputs.0.value',
            type: 'DateTime[]',
            tomType: 'Date',
            currentValue: ['2025-12-15'],
            manualOverrideText: '2026-12-15'
          }
        ]
      }
    ]
  });

  const elements = {
    extractBtn: { disabled: true },
    updateJsonBtn: { disabled: true },
    previewUnitTestLogBtn: { disabled: true },
    applyUnitTestLogBtn: { disabled: false, style: { display: '' } }
  };
  const readyButton = { disabled: true };
  global.document = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.unit-test-log-apply-ready-btn') return [readyButton];
      return [];
    }
  };

  updateActionButtons();
  assert.equal(readyButton.disabled, false);
});

test('Unit test log ready output override accepts scalar edits for indexed array elements', () => {
  const review = buildUnitTestLogReview({
    logPath: 'latest.log',
    failureCount: 1,
    rows: [
      {
        filePath: 'C:\\TaxEngine\\OCE-Regulatory-2026\\Tests\\OHC\\ResidentCityInfo\\DaysForSort.test.json',
        calcFieldPath: 'OHC/ResidentCityInfo.ResidentCitiesSP/DaysForSort',
        caseName: 'DaysForSortBeginDateBeforeFirstDay',
        fieldPath: '1.output',
        valuePath: '1.output.value.0',
        type: 'decimal[]',
        currentValue: 348,
        proposedValue: -17,
        readyOverrideText: '348',
        canApply: true
      }
    ]
  });

  const result = getUnitTestLogReadyApplyRows(review, { collectErrors: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].proposedValue, 348);
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


test('CO family-affordability regression: page parser expands both AGI columns into five filing statuses', () => {
  const rows = parseCoFamilyAffordabilityPageRows([
    pdfTextItem('Age 5 and Under Family Affordability Tax Credit Table', 200, 700),
    pdfTextItem('$15,000 or less', 120, 650),
    pdfTextItem('$26,000 or less', 320, 650),
    pdfTextItem('$3,273', 500, 650),
    pdfTextItem('$15,001 to $20,000', 120, 630),
    pdfTextItem('$26,001 to $31,000', 320, 630),
    pdfTextItem('$3,048', 500, 630),
    pdfTextItem('$20,001 to $25,000', 120, 610),
    pdfTextItem('$31,001 to $36,000', 320, 610),
    pdfTextItem('$2,823', 500, 610),
    pdfTextItem('$25,001 to $30,000', 120, 590),
    pdfTextItem('$36,001 to $41,000', 320, 590),
    pdfTextItem('$2,598', 500, 590),
    pdfTextItem('$30,001 to $35,000', 120, 570),
    pdfTextItem('$41,001 to $46,000', 320, 570),
    pdfTextItem('$2,373', 500, 570),
    pdfTextItem('$35,001 to $40,000', 120, 550),
    pdfTextItem('$46,001 to $51,000', 320, 550),
    pdfTextItem('$2,148', 500, 550),
    pdfTextItem('$40,001 to $45,000', 120, 530),
    pdfTextItem('$51,001 to $56,000', 320, 530),
    pdfTextItem('$1,923', 500, 530),
    pdfTextItem('$45,001 to $50,000', 120, 510),
    pdfTextItem('$56,001 to $61,000', 320, 510),
    pdfTextItem('$1,698', 500, 510),
    pdfTextItem('$50,001 to $55,000', 120, 490),
    pdfTextItem('$61,001 to $66,000', 320, 490),
    pdfTextItem('$1,473', 500, 490),
    pdfTextItem('$55,001 to $60,000', 120, 470),
    pdfTextItem('$66,001 to $71,000', 320, 470),
    pdfTextItem('$1,248', 500, 470),
    pdfTextItem('$60,001 to $65,000', 120, 450),
    pdfTextItem('$71,001 to $76,000', 320, 450),
    pdfTextItem('$1,023', 500, 450),
    pdfTextItem('$65,001 to $70,000', 120, 430),
    pdfTextItem('$76,001 to $81,000', 320, 430),
    pdfTextItem('$798', 500, 430),
    pdfTextItem('$70,001 to $75,000', 120, 410),
    pdfTextItem('$81,001 to $86,000', 320, 410),
    pdfTextItem('$573', 500, 410),
    pdfTextItem('$75,001 to $80,000', 120, 390),
    pdfTextItem('$86,001 to $91,000', 320, 390),
    pdfTextItem('$348', 500, 390),
    pdfTextItem('$80,001 to $85,000', 120, 370),
    pdfTextItem('$91,001 to $96,000', 320, 370),
    pdfTextItem('$123', 500, 370),
    pdfTextItem('$85,001 or more', 120, 350),
    pdfTextItem('$96,001 or more', 320, 350),
    pdfTextItem('$0', 500, 350),
    pdfTextItem('Line 7 Family Affordability Tax Credit Ages 5 and Under', 120, 320)
  ], { title: 'Age 5 and Under Family Affordability Tax Credit Table' });

  assert.equal(rows.length, 75);
  assert.deepEqual(rows.slice(0, 5), [
    { filingStatus: 'FilingStatus.Single', amount: 15000, value: 3273, source: 'pdf' },
    { filingStatus: 'FilingStatus.Single', amount: 20000, value: 3048, source: 'pdf' },
    { filingStatus: 'FilingStatus.Single', amount: 25000, value: 2823, source: 'pdf' },
    { filingStatus: 'FilingStatus.Single', amount: 30000, value: 2598, source: 'pdf' },
    { filingStatus: 'FilingStatus.Single', amount: 35000, value: 2373, source: 'pdf' }
  ]);
  assert.deepEqual(rows.filter(row => row.filingStatus === 'FilingStatus.MarriedFilingJointly').slice(0, 3), [
    { filingStatus: 'FilingStatus.MarriedFilingJointly', amount: 26000, value: 3273, source: 'pdf' },
    { filingStatus: 'FilingStatus.MarriedFilingJointly', amount: 31000, value: 3048, source: 'pdf' },
    { filingStatus: 'FilingStatus.MarriedFilingJointly', amount: 36000, value: 2823, source: 'pdf' }
  ]);
  assert.deepEqual(rows.filter(row => row.filingStatus === 'FilingStatus.QualifyingWidow').slice(0, 2), [
    { filingStatus: 'FilingStatus.QualifyingWidow', amount: 15000, value: 3273, source: 'pdf' },
    { filingStatus: 'FilingStatus.QualifyingWidow', amount: 20000, value: 3048, source: 'pdf' }
  ]);
});

test('CO family-affordability regression: value column ignores right-margin line numbers on page 4', () => {
  const rows = parseCoFamilyAffordabilityPageRows([
    pdfTextItem('Age 6 to 16 Family Affordability Tax Credit Table', 200, 700),
    pdfTextItem('$15,000 or less', 120, 650),
    pdfTextItem('$26,000 or less', 320, 650),
    pdfTextItem('$2,455', 480, 650),
    pdfTextItem('17', 584, 649),
    pdfTextItem('$15,001 to $20,000', 120, 630),
    pdfTextItem('$26,001 to $31,000', 320, 630),
    pdfTextItem('$2,286', 480, 630),
    pdfTextItem('18', 584, 629),
    pdfTextItem('$20,001 to $25,000', 120, 610),
    pdfTextItem('$31,001 to $36,000', 320, 610),
    pdfTextItem('$2,117', 480, 610),
    pdfTextItem('19', 584, 609),
    pdfTextItem('$25,001 to $30,000', 120, 590),
    pdfTextItem('$36,001 to $41,000', 320, 590),
    pdfTextItem('$1,949', 480, 590),
    pdfTextItem('20', 584, 589),
    pdfTextItem('$30,001 to $35,000', 120, 570),
    pdfTextItem('$41,001 to $46,000', 320, 570),
    pdfTextItem('$1,780', 480, 570),
    pdfTextItem('21', 584, 569),
    pdfTextItem('$35,001 to $40,000', 120, 550),
    pdfTextItem('$46,001 to $51,000', 320, 550),
    pdfTextItem('$1,611', 480, 550),
    pdfTextItem('22', 584, 549),
    pdfTextItem('$40,001 to $45,000', 120, 530),
    pdfTextItem('$51,001 to $56,000', 320, 530),
    pdfTextItem('$1,442', 480, 530),
    pdfTextItem('23', 584, 529),
    pdfTextItem('$45,001 to $50,000', 120, 510),
    pdfTextItem('$56,001 to $61,000', 320, 510),
    pdfTextItem('$1,274', 480, 510),
    pdfTextItem('24', 584, 509),
    pdfTextItem('$50,001 to $55,000', 120, 490),
    pdfTextItem('$61,001 to $66,000', 320, 490),
    pdfTextItem('$1,105', 480, 490),
    pdfTextItem('25', 584, 489),
    pdfTextItem('$55,001 to $60,000', 120, 470),
    pdfTextItem('$66,001 to $71,000', 320, 470),
    pdfTextItem('$936', 485, 470),
    pdfTextItem('26', 584, 469),
    pdfTextItem('$60,001 to $65,000', 120, 450),
    pdfTextItem('$71,001 to $76,000', 320, 450),
    pdfTextItem('$767', 485, 450),
    pdfTextItem('27', 584, 449),
    pdfTextItem('$65,001 to $70,000', 120, 430),
    pdfTextItem('$76,001 to $81,000', 320, 430),
    pdfTextItem('$598', 485, 430),
    pdfTextItem('28', 584, 429),
    pdfTextItem('$70,001 to $75,000', 120, 410),
    pdfTextItem('$81,001 to $86,000', 320, 410),
    pdfTextItem('$430', 485, 410),
    pdfTextItem('29', 584, 409),
    pdfTextItem('$75,001 to $80,000', 120, 390),
    pdfTextItem('$86,001 to $91,000', 320, 390),
    pdfTextItem('$261', 485, 390),
    pdfTextItem('30', 584, 389),
    pdfTextItem('$80,001 to $85,000', 120, 370),
    pdfTextItem('$91,001 to $96,000', 320, 370),
    pdfTextItem('$92', 488, 370),
    pdfTextItem('31', 584, 369),
    pdfTextItem('$85,001 or more', 120, 350),
    pdfTextItem('$96,001 or more', 320, 350),
    pdfTextItem('$0', 492, 350),
    pdfTextItem('Line 10 Family Affordability Tax Credit Ages 6 to 16', 120, 320)
  ], { title: 'Age 6 to 16 Family Affordability Tax Credit Table' });

  assert.equal(rows.find(row => row.filingStatus === 'FilingStatus.Single' && row.amount === 15000)?.value, 2455);
  assert.equal(rows.find(row => row.filingStatus === 'FilingStatus.Single' && row.amount === 25000)?.value, 2117);
  assert.equal(rows.find(row => row.filingStatus === 'FilingStatus.Single' && row.amount === 35000)?.value, 1780);
  assert.equal(rows.find(row => row.filingStatus === 'FilingStatus.MarriedFilingJointly' && row.amount === 26000)?.value, 2455);
});

test('CO family-affordability regression: review compares filing-status plus amount keys against current JSON rows', () => {
  const review = buildCoFamilyReview([
    { filingStatus: 'FilingStatus.Single', amount: 15000, value: 3273 },
    { filingStatus: 'FilingStatus.MarriedFilingJointly', amount: 26000, value: 3273 },
    { filingStatus: 'FilingStatus.QualifyingWidow', amount: 15000, value: 3273 }
  ], {
    success: true,
    year: '2024',
    rows: [
      { filingStatus: 'FilingStatus.Single', amount: 15000, value: 3200 },
      { filingStatus: 'FilingStatus.MarriedFilingJointly', amount: 26000, value: 3273 },
      { filingStatus: 'FilingStatus.QualifyingWidow', amount: 15000, value: 3100 },
      { filingStatus: 'FilingStatus.HeadOfHousehold', amount: 15000, value: 3273 }
    ]
  });

  assert.equal(review.changedCount, 2);
  assert.equal(review.unchangedCount, 1);
  assert.equal(review.missingCount, 1);
  assert.equal(review.currentYear, '2024');
});

test('CO family-affordability scenario: extract and replace stay disabled until both tables and paths are present', () => {
  resetAppState();
  appState.selectedPdfPath = 'C\PDFs\CO_DR0104CN.pdf';
  appState.selectedStateConfig = CO_CONFIG;
  appState.selectedWorkflowKey = 'family-affordability';
  appState.filePaths = { CO_FAMILY_UNDER5: 'under5.json' };

  const extractBtn = { disabled: true };
  const updateJsonBtn = { disabled: true };
  const uploadArea = { style: { display: '' } };
  const selectPdfBtn = { style: { display: '' } };
  const pdfSection = { style: { display: '' } };
  const pdfSummary = { textContent: '' };
  const pageStartInput = { value: '' };
  const pageEndInput = { value: '' };

  global.document = {
    getElementById(id) {
      return {
        extractBtn,
        updateJsonBtn,
        uploadArea,
        selectPdfBtn,
        pdfSelectionSection: pdfSection,
        pdfSelectionSummary: pdfSummary,
        pdfPageStartInput: pageStartInput,
        pdfPageEndInput: pageEndInput
      }[id];
    }
  };

  appState.pdfPageRangeOverride = { start: '3', end: '4' };
  renderSelectedSource();
  updateActionButtons();
  assert.equal(extractBtn.disabled, false);
  assert.equal(updateJsonBtn.disabled, true);

  appState.filePaths.CO_FAMILY_AGE6TO16 = 'age6to16.json';
  appState.coFamilyAffordabilityReview = {
    under5: { rows: [{ filingStatus: 'FilingStatus.Single', amount: 15000, value: 3273 }] },
    age6to16: { rows: [{ filingStatus: 'FilingStatus.Single', amount: 15000, value: 2455 }] }
  };
  updateActionButtons();
  assert.equal(updateJsonBtn.disabled, false);
  assert.match(pdfSummary.textContent, /Family Affordability table pages 3-4/);
});
