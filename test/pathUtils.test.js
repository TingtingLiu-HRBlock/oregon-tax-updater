const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDefaultPaths, normalizeSavedPaths, getMarriageCreditCanonicalPath } = require('../pathUtils');

test('MN M1MA path regression: default path points to TaxEngine marriage credit JSON', () => {
  const paths = buildDefaultPaths('MN', 2025, 'm1ma');

  assert.equal(paths.M1MA, getMarriageCreditCanonicalPath(2025));
});

test('MN M1MA path regression: malformed saved TaxEngine path is normalized before replace', () => {
  const normalized = normalizeSavedPaths('MN', 2025, 'm1ma', {
    M1MA: String.raw`C:\Users\A897115\projects\ORAgents\oregon-tax-updater\oregon-tax-updater\TaxEngineOCE-Regulatory-2025SourceMNUtilsTablesMNMarriageCredit.table.json`
  });

  assert.equal(normalized.M1MA, getMarriageCreditCanonicalPath(2025));
});

test('MN M1MA path regression: screenshot malformed path with mixed separators is normalized before replace', () => {
  const normalized = normalizeSavedPaths('MN', 2025, 'm1ma', {
    M1MA: String.raw`C:\Users\A897115\projects\ORAgents\oregon-tax-updater\oregon-tax-updater\TaxEngine\OCE-Regulatory-2025SourceMNUtilsTablesMNMarriageCredit.table.json`
  });

  assert.equal(normalized.M1MA, getMarriageCreditCanonicalPath(2025));
});
