const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConstantsByName } = require('../constantsByName');

test('Unit test date roller regression: YOY-only constants exclude non-maintained constants like TrueConstantForOutput', () => {
  const constantsByName = buildConstantsByName({
    Constants: [
      {
        Name: 'TrueConstantForOutput',
        Value: true,
        Maintenance: ''
      },
      {
        Name: 'CurrentTaxYear',
        Value: '2026',
        Maintenance: 'Year Over Year'
      },
      {
        Name: 'NextTaxYear',
        Value: '2027',
        Maintenance: 'Year Over Year'
      }
    ]
  }, { yearOverYearOnly: true });

  assert.deepEqual(constantsByName, {
    CurrentTaxYear: '2026',
    NextTaxYear: '2027'
  });
  assert.equal('TrueConstantForOutput' in constantsByName, false);
});
