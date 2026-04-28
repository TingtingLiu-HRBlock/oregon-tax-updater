const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFailureAssertions, buildLogUpdatePreview, applyLogUpdateRows } = require('../unitTestLogUpdater');

test('Unit test log updater: parses latest failed expected/actual assertions only', () => {
  const logText = [
    'Starting test execution',
    'Failed OR_Old_File_Case [< 1 ms]',
    'Assert.AreEqual failed. Expected:<1>. Actual:<2>. Case',
    'Failed!  - Failed:     1, Passed: 0',
    'Starting test execution',
    'Failed OR_Form40V_Scanline_LiabilityPeriod_dude [< 1 ms]',
    'CollectionAssert.AreEqual failed. Expected:<20251231>. Actual:<20261231>. dude(Element at index 0 do not match.)',
    'Failed!  - Failed:     1, Passed: 0'
  ].join('\n');

  const failures = parseFailureAssertions(logText);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].testName, 'OR_Form40V_Scanline_LiabilityPeriod_dude');
  assert.equal(failures[0].expectedRaw, '20251231');
  assert.equal(failures[0].actualRaw, '20261231');
  assert.equal(failures[0].elementIndex, 0);
});

test('Unit test log updater: parses latest failed block for the selected state in combined logs', () => {
  const logText = [
    'Preparing unit tests execution for FD...',
    'Starting test execution',
    'Failed FD_Form1040_TaxYear_A [< 1 ms]',
    'Assert.AreEqual failed. Expected:<2025>. Actual:<2026>. A',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.FD.Tests.Unit.dll (net8.0)',
    'Preparing unit tests execution for CO...',
    'Starting test execution',
    'Failed CO_Form104PN_TaxYear_A [< 1 ms]',
    'Assert.AreEqual failed. Expected:<2025>. Actual:<2026>. A',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.CO.Tests.Unit.dll (net8.0)'
  ].join('\n');

  const failures = parseFailureAssertions(logText, 'FD');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].testName, 'FD_Form1040_TaxYear_A');
});

test('Unit test log updater: previews and applies output-only updates from log failures', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-log-updater-'));
  const testDir = path.join(tempRoot, 'Form40V.Scanline');
  fs.mkdirSync(testDir, { recursive: true });
  const testPath = path.join(testDir, 'LiabilityPeriod.test.json');
  fs.writeFileSync(testPath, JSON.stringify([
    {
      name: 'dude',
      inputs: [
        { entity: 'OR', form: 'Form40V', field: 'VoucherType', type: 'ORVoucherType[]', tomType: 'ORVoucherType', value: ['BalanceDue'] }
      ],
      output: {
        entity: 'OR',
        form: 'Form40V.Scanline',
        field: 'LiabilityPeriod',
        type: 'string[]',
        tomType: 'String4',
        value: ['20251231']
      }
    }
  ], null, 2));
  const logPath = path.join(tempRoot, 'log.txt');
  fs.writeFileSync(logPath, [
    'Starting test execution',
    'Failed OR_Form40V_Scanline_LiabilityPeriod_dude [< 1 ms]',
    'CollectionAssert.AreEqual failed. Expected:<20251231>. Actual:<20261231>. dude(Element at index 0 do not match.)',
    'Failed!  - Failed:     1, Passed: 0'
  ].join('\n'));

  const preview = await buildLogUpdatePreview({ rootPath: tempRoot, stateCode: 'OR', logPath, regulatoryYear: 2025 });
  assert.equal(preview.success, true);
  assert.equal(preview.updateCount, 1);
  assert.equal(preview.rows[0].valuePath, '0.output.value.0');
  assert.equal(preview.rows[0].currentValue, '20251231');
  assert.equal(preview.rows[0].proposedValue, '20261231');

  const result = await applyLogUpdateRows(preview.rows);
  assert.equal(result.updatedValueCount, 1);
  const updated = JSON.parse(fs.readFileSync(testPath, 'utf-8'));
  assert.deepEqual(updated[0].output.value, ['20261231']);
});

test('Unit test log updater: maps log element indexes onto nested array scalar outputs', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-log-updater-nested-'));
  const testDir = path.join(tempRoot, 'Form1040ScheduleA.StateIncomeTaxes.Estimates');
  fs.mkdirSync(testDir, { recursive: true });
  const testPath = path.join(testDir, 'DatePaid.test.json');
  fs.writeFileSync(testPath, JSON.stringify([
    {
      name: 'Test1',
      output: {
        entity: 'FD',
        form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates',
        field: 'DatePaid',
        type: 'Boolean[][]',
        tomType: 'Boolean',
        value: [[true]]
      }
    }
  ], null, 2));
  const logPath = path.join(tempRoot, 'log.txt');
  fs.writeFileSync(logPath, [
    'Preparing unit tests execution for FD...',
    'Starting test execution',
    'Failed FD_Form1040ScheduleA_StateIncomeTaxes_Estimates_DatePaid_Test1 [< 1 ms]',
    'CollectionAssert.AreEqual failed. Expected:<True>. Actual:<False>. Test1(Element at index 0 do not match.)',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.FD.Tests.Unit.dll (net8.0)'
  ].join('\n'));

  const preview = await buildLogUpdatePreview({ rootPath: tempRoot, stateCode: 'FD', logPath, regulatoryYear: 2025 });
  assert.equal(preview.updateCount, 1);
  assert.equal(preview.rows[0].valuePath, '0.output.value.0.0');
  assert.equal(preview.rows[0].currentValue, true);
  assert.equal(preview.rows[0].proposedValue, false);
});

test('Unit test log updater: serializes decimal matrix zero updates with decimal shape', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-log-updater-decimal-matrix-'));
  const testDir = path.join(tempRoot, 'Form2106.DepreciationOfVehicles');
  fs.mkdirSync(testDir, { recursive: true });
  const testPath = path.join(testDir, 'Pct.test.json');
  fs.writeFileSync(testPath, JSON.stringify([
    {
      name: 'Test1',
      output: {
        entity: 'FD',
        form: 'Form2106.DepreciationOfVehicles',
        field: 'Pct',
        type: 'decimal[][]',
        tomType: 'Ratio',
        value: [[0.075]]
      }
    }
  ], null, 2));
  const logPath = path.join(tempRoot, 'log.txt');
  fs.writeFileSync(logPath, [
    'Preparing unit tests execution for FD...',
    'Starting test execution',
    'Failed FD_Form2106_DepreciationOfVehicles_Pct_Test1 [< 1 ms]',
    'CollectionAssert.AreEqual failed. Expected:<0.075>. Actual:<0>. Test1(Element at index 0 do not match.)',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.FD.Tests.Unit.dll (net8.0)'
  ].join('\n'));

  const preview = await buildLogUpdatePreview({ rootPath: tempRoot, stateCode: 'FD', logPath, regulatoryYear: 2025 });
  assert.equal(preview.updateCount, 1);
  assert.equal(preview.rows[0].valuePath, '0.output.value.0.0');

  await applyLogUpdateRows(preview.rows);
  const updatedRaw = fs.readFileSync(testPath, 'utf-8');
  assert.match(updatedRaw, /"type": "decimal\[\]\[\]"/);
  assert.match(updatedRaw, /"value": \[\s*\[\s*0\.0\s*\]\s*\]/);
});

test('Unit test log updater: updates comma-delimited decimal array actuals as numeric arrays', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-log-updater-decimal-list-'));
  const testDir = path.join(tempRoot, 'Form1045.ProUtilizedNOLPY10');
  fs.mkdirSync(testDir, { recursive: true });
  const testPath = path.join(testDir, 'AbsorbedAmt.test.json');
  fs.writeFileSync(testPath, JSON.stringify([
    {
      name: 'T1',
      output: {
        entity: 'FD',
        form: 'Form1045.ProUtilizedNOLPY10',
        field: 'AbsorbedAmt',
        type: 'decimal[]',
        tomType: 'USAmount',
        value: [100.0, 200.0],
        multi: true
      }
    }
  ], null, 2));
  const logPath = path.join(tempRoot, 'log.txt');
  fs.writeFileSync(logPath, [
    'Preparing unit tests execution for FD...',
    'Starting test execution',
    'Failed FD_Form1045_ProUtilizedNOLPY10_AbsorbedAmt_T1 [< 1 ms]',
    'CollectionAssert.AreEqual failed. Expected:<100.0,200.0>. Actual:<100.0,300.0>. T1',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.FD.Tests.Unit.dll (net8.0)'
  ].join('\n'));

  const preview = await buildLogUpdatePreview({ rootPath: tempRoot, stateCode: 'FD', logPath, regulatoryYear: 2025 });
  assert.equal(preview.updateCount, 1);
  assert.equal(preview.rows[0].valuePath, '0.output.value');
  assert.deepEqual(preview.rows[0].proposedValue, [100, 300]);

  await applyLogUpdateRows(preview.rows);
  const updatedRaw = fs.readFileSync(testPath, 'utf-8');
  assert.match(updatedRaw, /"type": "decimal\[\]"/);
  assert.match(updatedRaw, /"value": \[\s*100\.0,\s*300\.0\s*\]/);
});

test('Unit test log updater: expands scalar decimal array expected to comma-delimited actual array', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-log-updater-decimal-expand-'));
  const testDir = path.join(tempRoot, 'Form1045.ProUtilizedNOLPY10');
  fs.mkdirSync(testDir, { recursive: true });
  const testPath = path.join(testDir, 'AbsorbedAmt.test.json');
  fs.writeFileSync(testPath, JSON.stringify([
    {
      name: 'T1',
      output: {
        entity: 'FD',
        form: 'Form1045.ProUtilizedNOLPY10',
        field: 'AbsorbedAmt',
        type: 'decimal[]',
        tomType: 'USAmount',
        value: [300.0],
        multi: true
      }
    }
  ], null, 2));
  const logPath = path.join(tempRoot, 'log.txt');
  fs.writeFileSync(logPath, [
    'Preparing unit tests execution for FD...',
    'Starting test execution',
    'Failed FD_Form1045_ProUtilizedNOLPY10_AbsorbedAmt_T1 [< 1 ms]',
    'CollectionAssert.AreEqual failed. Expected:<300.0>. Actual:<100.0,300.0>. T1(Different number of elements.)',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.FD.Tests.Unit.dll (net8.0)'
  ].join('\n'));

  const preview = await buildLogUpdatePreview({ rootPath: tempRoot, stateCode: 'FD', logPath, regulatoryYear: 2025 });
  assert.equal(preview.updateCount, 1);
  assert.equal(preview.rows[0].valuePath, '0.output.value');
  assert.deepEqual(preview.rows[0].proposedValue, [100, 300]);

  await applyLogUpdateRows(preview.rows);
  const updatedRaw = fs.readFileSync(testPath, 'utf-8');
  assert.match(updatedRaw, /"value": \[\s*100\.0,\s*300\.0\s*\]/);
});

test('Unit test log updater: does not auto-apply null actuals into decimal outputs', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-log-updater-null-decimal-'));
  const testDir = path.join(tempRoot, 'Form2210.PenaltyWorksheet');
  fs.mkdirSync(testDir, { recursive: true });
  const testPath = path.join(testDir, 'AmountQ1R4.test.json');
  fs.writeFileSync(testPath, JSON.stringify([
    {
      name: 'D4086749',
      output: {
        entity: 'FD',
        form: 'Form2210.PenaltyWorksheet',
        field: 'AmountQ1R4',
        type: 'decimal',
        tomType: 'USAmount',
        value: 450.0
      }
    }
  ], null, 2));
  const logPath = path.join(tempRoot, 'log.txt');
  fs.writeFileSync(logPath, [
    'Preparing unit tests execution for FD...',
    'Starting test execution',
    'Failed FD_Form2210_PenaltyWorksheet_AmountQ1R4_D4086749 [< 1 ms]',
    'Assert.AreEqual failed. Expected:<450.0>. Actual:<(null)>. D4086749',
    'Failed!  - Failed:     1, Passed: 0 - HRBlock.Oce.CalcEngine.FD.Tests.Unit.dll (net8.0)'
  ].join('\n'));

  const preview = await buildLogUpdatePreview({ rootPath: tempRoot, stateCode: 'FD', logPath, regulatoryYear: 2025 });
  assert.equal(preview.updateCount, 0);
  assert.equal(preview.reviewCount, 1);
  assert.match(preview.rows[0].reason, /null/);
});
