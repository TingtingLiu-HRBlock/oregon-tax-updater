const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPreviewRows,
  applyPreviewRows,
  getDirectReturnConstant,
  deriveProposedValue,
  serializeTestJson
} = require('../unitTestDateRoller');

test('Unit test date roller: detects a direct constant-return calc dependency', () => {
  const calcJson = {
    Dependencies: [
      { FieldType: 'Calculated', FieldRef: 'OH/FormSD100.Form2210.Part1/Q1EstimatedTax' },
      { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210FirstQuarterDate', Constant: 'Form2210FirstQuarterDate' }
    ],
    Custom: [
      'if ({0} > 0)',
      '{',
      '    return {1};',
      '}',
      'return null;'
    ]
  };

  const directConstant = getDirectReturnConstant(calcJson, {
    Form2210FirstQuarterDate: '2026-04-15'
  });

  assert.equal(directConstant.constantName, 'Form2210FirstQuarterDate');
  assert.equal(directConstant.constantValue, '2026-04-15');
  assert.equal(directConstant.placeholder, '{1}');
});

test('Unit test date roller: previews constant-driven DateTime[] unit test updates', () => {
  const calcJson = {
    Entity: 'OH',
    Form: 'FormSD100.Form2210.Part1',
    Field: 'Q1PaymentDate',
    Type: 'DateTime[]',
    TomType: 'Date',
    Dependencies: [
      { FieldType: 'Calculated', FieldRef: 'OH/FormSD100.Form2210.Part1/Q1EstimatedTax' },
      { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210FirstQuarterDate', Constant: 'Form2210FirstQuarterDate' }
    ],
    Custom: [
      'if ({0} > 0)',
      '{',
      '    return {1};',
      '}',
      'return null;'
    ]
  };

  const testJson = [
    {
      name: 1,
      output: {
        entity: 'OH',
        form: 'FormSD100.Form2210.Part1',
        field: 'Q1PaymentDate',
        type: 'DateTime[]',
        tomType: 'Date',
        value: ['2025-04-15']
      }
    },
    {
      name: 2,
      output: {
        entity: 'OH',
        form: 'FormSD100.Form2210.Part1',
        field: 'Q1PaymentDate',
        type: 'DateTime[]',
        tomType: 'Date',
        value: null
      },
      expectsBlank: true
    }
  ];

  const preview = buildPreviewRows({
    calcJson,
    testJson,
    calcFilePath: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Calc\\FormSD100.Form2210.Part1\\Q1PaymentDate.calc.json',
    testFilePath: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OH\\Tests\\Unit\\Calc\\FormSD100.Form2210.Part1\\Q1PaymentDate.test.json',
    constantsByName: {
      Form2210FirstQuarterDate: '2026-04-15'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].caseName, 1);
  assert.equal(preview.rows[0].constantName, 'Form2210FirstQuarterDate');
  assert.equal(preview.rows[0].calcFieldPath, 'OH/FormSD100.Form2210.Part1/Q1PaymentDate');
  assert.deepEqual(preview.rows[0].currentValue, ['2025-04-15']);
  assert.deepEqual(preview.rows[0].proposedValue, ['2026-04-15']);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: evaluates ternary date variables returned from maintained boundaries', () => {
  const calcJson = {
    Entity: 'CA',
    Form: 'ReturnInformation.EFItems.PrimarySignature',
    Field: 'SignatureDate',
    Type: 'DateTime',
    TomType: 'Date',
    Dependencies: [
      { FieldType: 'Calculated', Entity: 'CA', Form: 'ReturnInformation.EFItems.PrimarySignature', Field: 'PIN', FieldRef: 'CA/ReturnInformation.EFItems.PrimarySignature/PIN' },
      { FieldType: 'Constant', FieldRef: 'CA/Constant/FirstDayNextYear', Constant: 'FirstDayNextYear' },
      { FieldType: 'Calculated', Entity: 'CA', Form: 'Form8879', Field: 'TaxPayer.SignatureDate', FieldRef: 'CA/Form8879/TaxPayer.SignatureDate' },
      { FieldType: 'Input', Entity: 'FD', Form: 'ReturnInformation.EFItems', Field: 'TaxPayer.PinSignatureDate', FieldRef: 'FD/ReturnInformation.EFItems/TaxPayer.PinSignatureDate' }
    ],
    Custom: [
      'var dateF8879 = {2}.IsOnOrBefore({1})? {1} : {2};',
      'var datePin = {3}.IsOnOrBefore({1})? {1} : {3};',
      'if({0} != null)',
      '{',
      '    if ({2} != null)',
      '        return dateF8879;',
      '    return datePin;',
      '}',
      'return null;'
    ]
  };
  const testJson = [
    {
      name: 'F8879Before',
      inputs: [
        { entity: 'CA', form: 'ReturnInformation.EFItems.PrimarySignature', field: 'PIN', type: 'string', tomType: 'String', value: '12345' },
        { entity: 'CA', form: 'Form8879', field: 'TaxPayer.SignatureDate', type: 'DateTime', tomType: 'Date', value: '2025-11-17' },
        { entity: 'FD', form: 'ReturnInformation.EFItems', field: 'TaxPayer.PinSignatureDate', type: 'DateTime', tomType: 'Date', value: null }
      ],
      output: {
        entity: 'CA',
        form: 'ReturnInformation.EFItems.PrimarySignature',
        field: 'SignatureDate',
        type: 'DateTime',
        tomType: 'Date',
        value: '2026-01-01'
      }
    },
    {
      name: 'F8879After',
      inputs: [
        { entity: 'CA', form: 'ReturnInformation.EFItems.PrimarySignature', field: 'PIN', type: 'string', tomType: 'String', value: '12345' },
        { entity: 'CA', form: 'Form8879', field: 'TaxPayer.SignatureDate', type: 'DateTime', tomType: 'Date', value: '2026-11-17' },
        { entity: 'FD', form: 'ReturnInformation.EFItems', field: 'TaxPayer.PinSignatureDate', type: 'DateTime', tomType: 'Date', value: null }
      ],
      output: {
        entity: 'CA',
        form: 'ReturnInformation.EFItems.PrimarySignature',
        field: 'SignatureDate',
        type: 'DateTime',
        tomType: 'Date',
        value: '2026-11-17'
      }
    },
    {
      name: 'PinBefore',
      inputs: [
        { entity: 'CA', form: 'ReturnInformation.EFItems.PrimarySignature', field: 'PIN', type: 'string', tomType: 'String', value: '12345' },
        { entity: 'CA', form: 'Form8879', field: 'TaxPayer.SignatureDate', type: 'DateTime', tomType: 'Date', value: null },
        { entity: 'FD', form: 'ReturnInformation.EFItems', field: 'TaxPayer.PinSignatureDate', type: 'DateTime', tomType: 'Date', value: '2025-11-17' }
      ],
      output: {
        entity: 'CA',
        form: 'ReturnInformation.EFItems.PrimarySignature',
        field: 'SignatureDate',
        type: 'DateTime',
        tomType: 'Date',
        value: '2026-01-01'
      }
    }
  ];

  const preview = buildPreviewRows({
    calcJson,
    testJson,
    calcFilePath: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\CA\\Calc\\ReturnInformation.EFItems.PrimarySignature\\SignatureDate.calc.json',
    testFilePath: 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\CA\\Tests\\Unit\\Calc\\ReturnInformation.EFItems.PrimarySignature\\SignatureDate.test.json',
    constantsByName: {
      FirstDayNextYear: '2027-01-01'
    }
  });

  assert.equal(preview.rows.length, 6);
  assert.equal(preview.rows[0].caseName, 'F8879Before');
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[1].constantName, 'FirstDayNextYear');
  assert.equal(preview.rows[0].currentValue, '2025-11-17');
  assert.equal(preview.rows[0].proposedValue, '2026-11-17');
  assert.equal(preview.rows[1].rowKind, 'output');
  assert.equal(preview.rows[1].currentValue, '2026-01-01');
  assert.equal(preview.rows[1].proposedValue, '2027-01-01');
  assert.equal(preview.rows[2].caseName, 'F8879After');
  assert.equal(preview.rows[2].rowKind, 'input');
  assert.equal(preview.rows[2].currentValue, '2026-11-17');
  assert.equal(preview.rows[2].proposedValue, '2027-11-17');
  assert.equal(preview.rows[3].rowKind, 'output');
  assert.equal(preview.rows[3].currentValue, '2026-11-17');
  assert.equal(preview.rows[3].proposedValue, '2027-11-17');
  assert.equal(preview.rows[4].caseName, 'PinBefore');
  assert.equal(preview.rows[4].rowKind, 'input');
  assert.equal(preview.rows[4].currentValue, '2025-11-17');
  assert.equal(preview.rows[4].proposedValue, '2026-11-17');
  assert.equal(preview.rows[5].rowKind, 'output');
  assert.equal(preview.rows[5].currentValue, '2026-01-01');
  assert.equal(preview.rows[5].proposedValue, '2027-01-01');
});

test('Unit test date roller: updates Year tomType string outputs with numeric year values', () => {
  const calcJson = {
    Entity: 'FD',
    Form: 'Form9465',
    Field: 'TaxYear',
    Type: 'string',
    TomType: 'Year',
    Dependencies: [
      { FieldType: 'Constant', FieldRef: 'FD/Constant/TaxYear', Constant: 'TaxYear' }
    ],
    Custom: [
      '{',
      'return {0};',
      '}'
    ]
  };
  const testJson = [
    {
      name: 'A',
      inputs: [],
      output: {
        entity: 'FD',
        form: 'Form9465',
        field: 'TaxYear',
        type: 'string',
        tomType: 'Year',
        value: 2025,
        multi: false
      }
    }
  ];

  const preview = buildPreviewRows({
    calcJson,
    testJson,
    calcFilePath: 'TaxYear.calc.json',
    testFilePath: 'TaxYear.test.json',
    constantsByName: { TaxYear: 2026 }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'output');
  assert.equal(preview.rows[0].valuePath, '0.output.value');
  assert.equal(preview.rows[0].proposedValue, 2026);
});

test('Unit test date roller: updates computed YYYY and YY string outputs from maintained date constants', () => {
  const yyyyCalc = {
    Entity: 'FD',
    Form: 'Form1040X',
    Field: 'CurrentYear',
    Type: 'string',
    TomType: 'Year',
    Dependencies: [
      { FieldType: 'Constant', FieldRef: 'FD/Constant/CurrentYear', Constant: 'CurrentYear' }
    ],
    Custom: ['return {0}.YYYY();']
  };
  const yyCalc = {
    Entity: 'FD',
    Form: 'Form8867',
    Field: 'CalendarYear',
    Type: 'string[]',
    TomType: 'String',
    Dependencies: [
      { FieldType: 'Constant', FieldRef: 'FD/Constant/CurrentYear', Constant: 'CurrentYear' },
      { FieldType: 'Calculated', Entity: 'FD', Form: 'Form8867', Field: 'GenerateEfileXml', FieldRef: 'FD/Form8867/GenerateEfileXml' }
    ],
    Custom: [
      'if ({1} == true)',
      '{',
      'return ({0}.YY());',
      '}',
      'return null;'
    ]
  };

  const yyyyPreview = buildPreviewRows({
    calcJson: yyyyCalc,
    testJson: [{ name: 'T1', inputs: [], output: { entity: 'FD', form: 'Form1040X', field: 'CurrentYear', type: 'string', tomType: 'Year', value: '2025' } }],
    calcFilePath: 'CurrentYear.calc.json',
    testFilePath: 'CurrentYear.test.json',
    constantsByName: { CurrentYear: '2026-01-01' },
    allConstantsByName: { CurrentYear: '2026-01-01' }
  });
  const yyPreview = buildPreviewRows({
    calcJson: yyCalc,
    testJson: [{
      name: 'GenerateEfileXmlTrueReturnsYear',
      inputs: [{ entity: 'FD', form: 'Form8867', field: 'GenerateEfileXml', type: 'bool[]', value: [true] }],
      output: { entity: 'FD', form: 'Form8867', field: 'CalendarYear', type: 'string[]', tomType: 'String', value: ['25'] }
    }],
    calcFilePath: 'CalendarYear.calc.json',
    testFilePath: 'CalendarYear.test.json',
    constantsByName: { CurrentYear: '2026-01-01' },
    allConstantsByName: { CurrentYear: '2026-01-01' }
  });

  assert.equal(yyyyPreview.rows[0].proposedValue, '2026');
  assert.deepEqual(yyPreview.rows[0].proposedValue, ['26']);
});

test('Unit test date roller: updates computed string outputs from ConcatenateWithSpace', () => {
  const calcJson = {
    Entity: 'FD',
    Form: 'Form3520A',
    Field: 'InstructionsForFiling',
    Type: 'string[]',
    TomType: 'String',
    Dependencies: [
      { FieldType: 'Calculated', Entity: 'FD', Form: 'Form3520A', Field: 'PrintForm', FieldRef: 'FD/Form3520A/PrintForm' },
      { FieldType: 'Constant', FieldRef: 'FD/Constant/FormInstructLTR3520A', Constant: 'FormInstructLTR3520A' },
      { FieldType: 'Constant', FieldRef: 'FD/Constant/CurrentYearCons', Constant: 'CurrentYearCons' },
      { FieldType: 'Calculated', Entity: 'FD', Form: 'Form3520A', Field: 'Form3520AOccurrence', FieldRef: 'FD/Form3520A/Form3520AOccurrence' }
    ],
    Custom: [
      'if ({0} == true)',
      '{',
      '    return Calc.ConcatenateWithSpace({1},{2},{3});',
      '}',
      'return null;'
    ]
  };
  const testJson = [
    {
      name: 'U1',
      inputs: [
        { entity: 'FD', form: 'Form3520A', field: 'PrintForm', type: 'bool[]', value: [true] },
        { entity: 'FD', form: 'Form3520A', field: 'Form3520AOccurrence', type: 'string[]', value: null }
      ],
      output: { entity: 'FD', form: 'Form3520A', field: 'InstructionsForFiling', type: 'string[]', tomType: 'String', value: ['INSTRUCTIONS FOR FILING 2025'] }
    },
    {
      name: 'WithOccurrence',
      inputs: [
        { entity: 'FD', form: 'Form3520A', field: 'PrintForm', type: 'bool[]', value: [true] },
        { entity: 'FD', form: 'Form3520A', field: 'Form3520AOccurrence', type: 'string[]', value: ['Occurrence1'] }
      ],
      output: { entity: 'FD', form: 'Form3520A', field: 'InstructionsForFiling', type: 'string[]', tomType: 'String', value: ['INSTRUCTIONS FOR FILING 2025 Occurrence1'] }
    }
  ];

  const preview = buildPreviewRows({
    calcJson,
    testJson,
    calcFilePath: 'InstructionsForFiling.calc.json',
    testFilePath: 'InstructionsForFiling.test.json',
    constantsByName: { CurrentYearCons: '2026' },
    allConstantsByName: { FormInstructLTR3520A: 'INSTRUCTIONS FOR FILING', CurrentYearCons: '2026' }
  });

  assert.equal(preview.rows.length, 2);
  assert.deepEqual(preview.rows.map(row => row.proposedValue), [
    ['INSTRUCTIONS FOR FILING 2026'],
    ['INSTRUCTIONS FOR FILING 2026 Occurrence1']
  ]);
});

test('Unit test date roller: skips nested concatenate strings that cannot preserve generated C# safely', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'EFileNotes',
      Field: 'AMTAdjustment',
      Type: 'string',
      TomType: 'String500',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/PriorYear', Constant: 'PriorYear' },
        { FieldType: 'Calculated', Entity: 'FD', Form: 'Example', Field: 'Amount', FieldRef: 'FD/Example/Amount' }
      ],
      Custom: [
        'return Calc.ConcatenateWithSpace({0}," ALTERNATIVE MINIMUM TAX ADJUSTMENT", Calc.Concatenate(" (","$",{1},")"));'
      ]
    },
    testJson: [{
      name: 'AE1',
      inputs: [{ entity: 'FD', form: 'Example', field: 'Amount', type: 'decimal[]', value: [900.0] }],
      output: { entity: 'FD', form: 'EFileNotes', field: 'AMTAdjustment', type: 'string', tomType: 'String500', value: '2024 ALTERNATIVE MINIMUM TAX ADJUSTMENT ($900.0)' }
    }],
    calcFilePath: 'AMTAdjustment.calc.json',
    testFilePath: 'AMTAdjustment.test.json',
    constantsByName: { PriorYear: '2025' }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: evaluates maintained year comparisons for boolean outputs', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form6252',
      Field: 'SoldDate',
      Type: 'bool[]',
      TomType: 'Boolean',
      Dependencies: [
        { FieldType: 'Input', Entity: 'FD', Form: 'Form6252', Field: 'SoldDateInput', FieldRef: 'FD/Form6252/SoldDateInput' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/IfYearOfSaleIsCurrentYear', Constant: 'IfYearOfSaleIsCurrentYear' }
      ],
      Custom: [
        'if ({0}.YYYY() == {1}) {',
        '    return true;',
        '}',
        'else',
        '{',
        '    return false;',
        '}'
      ]
    },
    testJson: [{
      name: 'Yeartest1',
      inputs: [{ entity: 'FD', form: 'Form6252', field: 'SoldDateInput', type: 'DateTime', value: '2026-01-01' }],
      output: { entity: 'FD', form: 'Form6252', field: 'SoldDate', type: 'bool[]', tomType: 'Boolean', value: [false] }
    }],
    calcFilePath: 'SoldDate.calc.json',
    testFilePath: 'SoldDate.test.json',
    constantsByName: { IfYearOfSaleIsCurrentYear: '2026' }
  });

  assert.equal(preview.rows.length, 1);
  assert.deepEqual(preview.rows[0].proposedValue, [true]);
});

test('Unit test date roller: supports two-argument Calc.Substring from maintained constants', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form8621',
      Field: 'PFICCalYr',
      Type: 'string[]',
      TomType: 'String',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/IfYearOfSaleIsCurrentYear', Constant: 'IfYearOfSaleIsCurrentYear' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/YearSubstringStart', Constant: 'YearSubstringStart' },
        { FieldType: 'Input', Entity: 'FD', Form: 'Form8621', Field: 'PrintIndicator', FieldRef: 'FD/Form8621/PrintIndicator' }
      ],
      Custom: [
        'if ({2}.IsX())',
        '{',
        'return (Calc.Substring({0}.ToString(),{1}));',
        '}',
        'return null;'
      ]
    },
    testJson: [{
      name: '1',
      inputs: [{ entity: 'FD', form: 'Form8621', field: 'PrintIndicator', type: 'string', value: 'X' }],
      output: { entity: 'FD', form: 'Form8621', field: 'PFICCalYr', type: 'string[]', tomType: 'String', value: ['25'] }
    }],
    calcFilePath: 'PFICCalYr.calc.json',
    testFilePath: 'PFICCalYr.test.json',
    constantsByName: { IfYearOfSaleIsCurrentYear: '2026' },
    allConstantsByName: { IfYearOfSaleIsCurrentYear: '2026', YearSubstringStart: 2 }
  });

  assert.equal(preview.rows.length, 1);
  assert.deepEqual(preview.rows[0].proposedValue, ['26']);
});

test('Unit test date roller: skips calcs whose return expression is not a direct constant', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormX',
      Field: 'DueDate',
      Type: 'DateTime',
      TomType: 'Date',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/QuarterDate', Constant: 'QuarterDate' }
      ],
      Custom: [
        'return AddDays({0}, 10);'
      ]
    },
    testJson: [
      {
        name: 'case',
        output: {
          entity: 'OH',
          form: 'FormX',
          field: 'DueDate',
          type: 'DateTime',
          tomType: 'Date',
          value: '2025-04-25'
        }
      }
    ],
    calcFilePath: 'sample.calc.json',
    testFilePath: 'sample.test.json',
    constantsByName: {
      QuarterDate: '2026-04-15'
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: previews branch-based string[] constant updates from test inputs', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSDOUPCPrint.TwoDBarcode',
      Field: 'ReportingPeriod',
      Type: 'string[]',
      TomType: 'String',
      Dependencies: [
        { Entity: 'OH', Form: 'FormSDOUPCPrint', Field: 'CouponType', FieldType: 'Calculated', FieldRef: 'OH/FormSDOUPCPrint/CouponType' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CouponType54', Constant: 'CouponType54' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CouponType55', Constant: 'CouponType55' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrYrReportingPeriodMMYY', Constant: 'CurrYrReportingPeriodMMYY' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/NextYrReportingPeriodMMYY', Constant: 'NextYrReportingPeriodMMYY' }
      ],
      Custom: [
        'if ({0} == {1})',
        '{',
        '    return {3};',
        '}',
        'else if ({0} == {2})',
        '{',
        '    return {4};',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'CouponTypeIs54ReturnsCurrYrPeriod',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSDOUPCPrint',
            field: 'CouponType',
            type: 'string[]',
            tomType: 'String',
            value: ['54']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSDOUPCPrint.TwoDBarcode',
          field: 'ReportingPeriod',
          type: 'string[]',
          tomType: 'String',
          value: ['1225']
        }
      },
      {
        name: 'CouponTypeIs55ReturnsNextYrPeriod',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSDOUPCPrint',
            field: 'CouponType',
            type: 'string[]',
            tomType: 'String',
            value: ['55']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSDOUPCPrint.TwoDBarcode',
          field: 'ReportingPeriod',
          type: 'string[]',
          tomType: 'String',
          value: ['1226']
        }
      },
      {
        name: 'CouponTypeIsInvalidReturnsNull',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSDOUPCPrint',
            field: 'CouponType',
            type: 'string[]',
            tomType: 'String',
            value: ['99']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSDOUPCPrint.TwoDBarcode',
          field: 'ReportingPeriod',
          type: 'string[]',
          tomType: 'String',
          value: null
        }
      }
    ],
    calcFilePath: 'ReportingPeriod.calc.json',
    testFilePath: 'ReportingPeriod.test.json',
    constantsByName: {
      CouponType54: '54',
      CouponType55: '55',
      CurrYrReportingPeriodMMYY: '1226',
      NextYrReportingPeriodMMYY: '1227'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].calcFieldPath, 'OH/FormSDOUPCPrint.TwoDBarcode/ReportingPeriod');
  assert.equal(preview.rows[0].constantName, 'CurrYrReportingPeriodMMYY');
  assert.deepEqual(preview.rows[0].proposedValue, ['1226']);
  assert.equal(preview.rows[1].constantName, 'NextYrReportingPeriodMMYY');
  assert.deepEqual(preview.rows[1].proposedValue, ['1227']);
});

test('Unit test date roller: branch conditions may use non-maintained constants while returned constants stay YOY-only', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSDOUPCPrint.TwoDBarcode',
      Field: 'ReportingPeriod',
      Type: 'string[]',
      TomType: 'String',
      Dependencies: [
        { Entity: 'OH', Form: 'FormSDOUPCPrint', Field: 'CouponType', FieldType: 'Calculated', FieldRef: 'OH/FormSDOUPCPrint/CouponType' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CouponType54', Constant: 'CouponType54' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CouponType55', Constant: 'CouponType55' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrYrReportingPeriodMMYY', Constant: 'CurrYrReportingPeriodMMYY' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/NextYrReportingPeriodMMYY', Constant: 'NextYrReportingPeriodMMYY' }
      ],
      Custom: [
        'if ({0} == {1})',
        '{',
        '    return {3};',
        '}',
        'else if ({0} == {2})',
        '{',
        '    return {4};',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'CouponTypeIs55ReturnsNextYrPeriod',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSDOUPCPrint',
            field: 'CouponType',
            type: 'string[]',
            tomType: 'String',
            value: ['55']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSDOUPCPrint.TwoDBarcode',
          field: 'ReportingPeriod',
          type: 'string[]',
          tomType: 'String',
          value: ['1226']
        }
      }
    ],
    calcFilePath: 'ReportingPeriod.calc.json',
    testFilePath: 'ReportingPeriod.test.json',
    constantsByName: {
      CurrYrReportingPeriodMMYY: '1226',
      NextYrReportingPeriodMMYY: '1227'
    },
    allConstantsByName: {
      CouponType54: '54',
      CouponType55: '55',
      CurrYrReportingPeriodMMYY: '1226',
      NextYrReportingPeriodMMYY: '1227'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'NextYrReportingPeriodMMYY');
  assert.deepEqual(preview.rows[0].currentValue, ['1226']);
  assert.deepEqual(preview.rows[0].proposedValue, ['1227']);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: branch return uses proposed input values in the same preview', () => {
  const testJson = [
    {
      name: 1,
      inputs: [
        {
          entity: 'OH',
          form: 'FormIT1040.Header.ResidencyStatus',
          field: 'LivedInOhioFrom',
          type: 'DateTime',
          tomType: 'Date',
          value: '2025-02-01'
        }
      ],
      output: {
        entity: 'OH',
        form: 'FormIT1040.Header.ResidencyStatus',
        field: 'NonResFromDatePrint',
        type: 'DateTime',
        tomType: 'Date',
        value: '2025-01-01'
      }
    }
  ];
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormIT1040.Header.ResidencyStatus',
      Field: 'NonResFromDatePrint',
      Type: 'DateTime',
      TomType: 'Date',
      Dependencies: [
        { Entity: 'OH', Form: 'FormIT1040.Header.ResidencyStatus', Field: 'LivedInOhioFrom', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'OH/FormIT1040.Header.ResidencyStatus/LivedInOhioFrom' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/FirstDayOfTheYear', Constant: 'FirstDayOfTheYear' }
      ],
      Custom: [
        'if({0}.IsOnOrBefore({1}))',
        '{',
        '    return {1};',
        '}',
        'else if({0}.IsAfter({1}))',
        '{',
        '    return {0};',
        '}',
        'return {1};'
      ]
    },
    testJson,
    calcFilePath: 'NonResFromDatePrint.calc.json',
    testFilePath: 'NonResFromDatePrint.test.json',
    constantsByName: {
      FirstDayOfTheYear: '2026-01-01'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].currentValue, '2025-02-01');
  assert.equal(preview.rows[0].proposedValue, '2026-02-01');
  assert.equal(preview.rows[1].rowKind, 'output');
  assert.equal(preview.rows[1].constantName, 'Returned input value');
  assert.equal(preview.rows[1].currentValue, '2025-01-01');
  assert.equal(preview.rows[1].proposedValue, '2026-02-01');

  applyPreviewRows(testJson, preview.rows);
  assert.equal(testJson[0].inputs[0].value, '2026-02-01');
  assert.equal(testJson[0].output.value, '2026-02-01');
});

test('Unit test date roller: ignores returned input outputs when the branch has no maintained constant', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormIT1040.FormDetail.FormITNRC.NonResCrtCalculation',
      Field: 'FDDedFromFDAGI',
      Type: 'int',
      TomType: 'Integer',
      Dependencies: [
        { Entity: 'OH', Form: 'FormIT1040.FormDetail.FormITNRC.NonResCrtCalculation', Field: 'FDDedFromFDAGIInput', Type: 'int', TomType: 'Integer', FieldType: 'Input', FieldRef: 'OH/FormIT1040.FormDetail.FormITNRC.NonResCrtCalculation/FDDedFromFDAGIInput' }
      ],
      Custom: [
        'if ({0} > 0)',
        '{',
        '    return {0};',
        '}',
        'return 0;'
      ]
    },
    testJson: [
      {
        name: 2,
        inputs: [
          {
            entity: 'OH',
            form: 'FormIT1040.FormDetail.FormITNRC.NonResCrtCalculation',
            field: 'FDDedFromFDAGIInput',
            type: 'int',
            tomType: 'Integer',
            value: 1000
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormIT1040.FormDetail.FormITNRC.NonResCrtCalculation',
          field: 'FDDedFromFDAGI',
          type: 'int',
          tomType: 'Integer',
          value: 1000
        }
      }
    ],
    calcFilePath: 'FDDedFromFDAGI.calc.json',
    testFilePath: 'FDDedFromFDAGI.test.json',
    constantsByName: {}
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: previews computed integer outputs from maintained CurrentTaxYear', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100.FormDetail.AmendedReasonsAndExplanation',
      Field: 'TaxYear',
      Type: 'int[]',
      TomType: 'Integer',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrentTaxYear', Constant: 'CurrentTaxYear' },
        { Entity: 'OH', Form: 'FormSD100.Header', Field: 'AmendedReturn', FieldType: 'Input', FieldRef: 'OH/FormSD100.Header/AmendedReturn' }
      ],
      Custom: [
        'if ({1} == true)',
        '{',
        '    return Convert.ToInt32({0});',
        '}',
        'return 0;'
      ]
    },
    testJson: [
      {
        name: 'Amended',
        inputs: [
          { entity: 'OH', form: 'FormSD100.Header', field: 'AmendedReturn', type: 'bool[]', tomType: 'Boolean', value: [true] }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.FormDetail.AmendedReasonsAndExplanation',
          field: 'TaxYear',
          type: 'int[]',
          tomType: 'Integer',
          value: [2025]
        }
      },
      {
        name: 'NotAmended',
        inputs: [
          { entity: 'OH', form: 'FormSD100.Header', field: 'AmendedReturn', type: 'bool[]', tomType: 'Boolean', value: [false] }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.FormDetail.AmendedReasonsAndExplanation',
          field: 'TaxYear',
          type: 'int[]',
          tomType: 'Integer',
          value: [0]
        }
      }
    ],
    calcFilePath: 'TaxYear.calc.json',
    testFilePath: 'TaxYear.test.json',
    constantsByName: {
      CurrentTaxYear: '2026'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'CurrentTaxYear');
  assert.deepEqual(preview.rows[0].proposedValue, [2026]);
});

test('Unit test date roller: previews computed difference outputs from maintained CurrentTaxYear and input year', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormIT1040.FormDetail.FormScheduleOfCredits.NonRefundableCredits',
      Field: 'YearsRemaining',
      Type: 'int[]',
      TomType: 'Integer',
      Dependencies: [
        { Entity: 'OH', Form: 'FormIT1040.FormDetail.FormScheduleOfCredits.NonRefundableCredits', Field: 'OriginalYear', FieldType: 'Input', FieldRef: 'OH/FormIT1040.FormDetail.FormScheduleOfCredits.NonRefundableCredits/OriginalYear' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrentTaxYear', Constant: 'CurrentTaxYear' }
      ],
      Custom: [
        'if({0} >0)',
        '{',
        '   return Calc.Difference(Int32.Parse({1}) , {0});',
        '}',
        'return 0;'
      ]
    },
    testJson: [
      {
        name: 'Test1',
        inputs: [
          {
            entity: 'OH',
            form: 'FormIT1040.FormDetail.FormScheduleOfCredits.NonRefundableCredits',
            field: 'OriginalYear',
            type: 'int[]',
            tomType: 'Integer',
            value: [2022]
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormIT1040.FormDetail.FormScheduleOfCredits.NonRefundableCredits',
          field: 'YearsRemaining',
          type: 'int[]',
          tomType: 'Integer',
          value: [3]
        }
      }
    ],
    calcFilePath: 'YearsRemaining.calc.json',
    testFilePath: 'YearsRemaining.test.json',
    constantsByName: {
      CurrentTaxYear: '2026'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'CurrentTaxYear');
  assert.deepEqual(preview.rows[0].currentValue, [3]);
  assert.deepEqual(preview.rows[0].proposedValue, [4]);
});

test('Unit test date roller: evaluates IsPositive and null-check DaysBetween branches', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OR',
      Form: 'Form10.UnderpaymentInterest',
      Field: 'Q1NoDaysReqdInstallment',
      Type: 'int',
      TomType: 'Integer',
      Dependencies: [
        { Entity: 'OR', Form: 'Form10.UnderpaymentInterest', Field: 'Q1RunningBalReqdInstallment', Type: 'decimal', TomType: 'USAmount', FieldType: 'Calculated', FieldRef: 'OR/Form10.UnderpaymentInterest/Q1RunningBalReqdInstallment' },
        { FieldType: 'Constant', FieldRef: 'OR/Constant/FirstQuarterDateUnderpaymentInterest', Constant: 'FirstQuarterDateUnderpaymentInterest' },
        { FieldType: 'Constant', FieldRef: 'OR/Constant/SecondQuarterDateUnderpaymentInterest', Constant: 'SecondQuarterDateUnderpaymentInterest' },
        { Entity: 'OR', Form: 'Form10.UnderpaymentInterest', Field: 'Q1EstPaymntDate1', Type: 'DateTime', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OR/Form10.UnderpaymentInterest/Q1EstPaymntDate1' }
      ],
      Custom: [
        'if ({0}.IsPositive() && {3} != null)',
        '{',
        '    return Calc.DaysBetween({1}, {3});',
        '}',
        'else if ({0}.IsPositive() && {3} == null)',
        '{',
        '    return Calc.DaysBetween({1}, {2});',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'Q1DaysReqInstPositive',
        inputs: [
          { entity: 'OR', form: 'Form10.UnderpaymentInterest', field: 'Q1RunningBalReqdInstallment', type: 'decimal', tomType: 'USAmount', value: 400.0 },
          { entity: 'OR', form: 'Form10.UnderpaymentInterest', field: 'Q1EstPaymntDate1', type: 'DateTime', tomType: 'Date', value: '2025-05-05' }
        ],
        output: {
          entity: 'OR',
          form: 'Form10.UnderpaymentInterest',
          field: 'Q1NoDaysReqdInstallment',
          type: 'int',
          tomType: 'Integer',
          value: 62
        }
      }
    ],
    calcFilePath: 'Q1NoDaysReqdInstallment.calc.json',
    testFilePath: 'Q1NoDaysReqdInstallment.test.json',
    constantsByName: {
      FirstQuarterDateUnderpaymentInterest: '2026-04-15',
      SecondQuarterDateUnderpaymentInterest: '2026-06-16'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].proposedValue, '2026-05-05');
  assert.equal(preview.rows[1].rowKind, 'output');
  assert.equal(preview.rows[1].currentValue, 62);
  assert.equal(preview.rows[1].proposedValue, 20);
});

test('Unit test date roller: evaluates enum helper branch conditions like IsEstimate', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OR',
      Form: 'Form40V',
      Field: 'BeginDate',
      Type: 'DateTime[]',
      TomType: 'Date',
      Dependencies: [
        { Entity: 'OR', Form: 'Form40V', Field: 'VoucherType', Type: 'ORVoucherType[]', TomType: 'ORVoucherType', FieldType: 'Linked', FieldRef: 'OR/Form40V/VoucherType' },
        { FieldType: 'Constant', FieldRef: 'OR/Constant/EstimateTaxYearBeginningDate', Constant: 'EstimateTaxYearBeginningDate' },
        { FieldType: 'Constant', FieldRef: 'OR/Constant/FirstDayOfYear', Constant: 'FirstDayOfYear' },
        { Entity: 'OR', Form: 'Form40V', Field: 'PaymentAmt', Type: 'decimal[]', TomType: 'USAmountNN', FieldType: 'Calculated', FieldRef: 'OR/Form40V/PaymentAmt' }
      ],
      Custom: [
        'if (({0}.IsEstimate()) && ({3} > 0))',
        '{',
        '    return {1};',
        '}',
        'else if ({3} > 0)',
        '{',
        '    return {2};',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 2,
        inputs: [
          { entity: 'OR', form: 'Form40V', field: 'VoucherType', type: 'ORVoucherType[]', tomType: 'ORVoucherType', value: ['Estimate'] },
          { entity: 'OR', form: 'Form40V', field: 'PaymentAmt', type: 'decimal[]', tomType: 'USAmountNN', value: [100.0] }
        ],
        output: {
          entity: 'OR',
          form: 'Form40V',
          field: 'BeginDate',
          type: 'DateTime[]',
          tomType: 'Date',
          value: ['2026-01-01']
        }
      }
    ],
    calcFilePath: 'BeginDate.calc.json',
    testFilePath: 'BeginDate.test.json',
    constantsByName: {
      EstimateTaxYearBeginningDate: '2027-01-01',
      FirstDayOfYear: '2026-01-01'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'EstimateTaxYearBeginningDate');
  assert.deepEqual(preview.rows[0].proposedValue, ['2027-01-01']);
});

test('Unit test date roller: updates string outputs with compatible String tomTypes', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OR',
      Form: 'Form40V.Scanline',
      Field: 'LiabilityPeriod',
      Type: 'string[]',
      TomType: 'String8',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OR/Constant/TaxYearEndOrgAmdScanLine', Constant: 'TaxYearEndOrgAmdScanLine' },
        { FieldType: 'Constant', FieldRef: 'OR/Constant/TaxYearEndEstimateScanLine', Constant: 'TaxYearEndEstimateScanLine' },
        { Entity: 'OR', Form: 'Form40V', Field: 'VoucherType', Type: 'ORVoucherType[]', TomType: 'ORVoucherType', FieldType: 'Linked', FieldRef: 'OR/Form40V/VoucherType' }
      ],
      Custom: [
        'if({2}.IsEstimate())',
        '{',
        '    return {1};',
        '}',
        'return {0};'
      ]
    },
    testJson: [
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
    ],
    calcFilePath: 'LiabilityPeriod.calc.json',
    testFilePath: 'LiabilityPeriod.test.json',
    constantsByName: {
      TaxYearEndOrgAmdScanLine: '20261231',
      TaxYearEndEstimateScanLine: '20271231'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'TaxYearEndOrgAmdScanLine');
  assert.deepEqual(preview.rows[0].currentValue, ['20251231']);
  assert.deepEqual(preview.rows[0].proposedValue, ['20261231']);
});

test('Unit test date roller: shifts AgeAsOf date-boundary inputs', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OR',
      Form: 'SchWFHDC.QualifyingIndividuals.IndividualInformation',
      Field: 'Age',
      Type: 'int[]',
      TomType: 'Integer',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OR/Constant/WFHDCAgeCutOff', Constant: 'WFHDCAgeCutOff' },
        { Entity: 'OR', Form: 'SchWFHDC.QualifyingIndividuals.IndividualInformation', Field: 'IndividualBirthDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Linked', FieldRef: 'OR/SchWFHDC.QualifyingIndividuals.IndividualInformation/IndividualBirthDate' }
      ],
      Custom: [
        'return {1}.AgeAsOf({0});'
      ]
    },
    testJson: [
      {
        name: 'UnderAge3',
        inputs: [
          { entity: 'OR', form: 'SchWFHDC.QualifyingIndividuals.IndividualInformation', field: 'IndividualBirthDate', type: 'DateTime[]', tomType: 'Date', value: ['2022-01-02'] }
        ],
        output: {
          entity: 'OR',
          form: 'SchWFHDC.QualifyingIndividuals.IndividualInformation',
          field: 'Age',
          type: 'int[]',
          tomType: 'Integer',
          value: [2]
        }
      }
    ],
    calcFilePath: 'Age.calc.json',
    testFilePath: 'Age.test.json',
    constantsByName: {
      WFHDCAgeCutOff: '2026-01-01'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.deepEqual(preview.rows[0].proposedValue, ['2023-01-02']);
});

test('Unit test date roller: previews computed string outputs from maintained CurrentTaxYear expressions', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100.FormSD100ES.Scanline',
      Field: 'Q1VoucherYear',
      Type: 'string[]',
      TomType: 'String',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrentTaxYear', Constant: 'CurrentTaxYear' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Q1CheckDigitVoucherAndYear', Constant: 'Q1CheckDigitVoucherAndYear' }
      ],
      Custom: [
        'var ConvertInt = Convert.ToInt32({0});',
        'var NxtYear = Calc.Sum(ConvertInt,1);',
        'var ConvertString = Convert.ToString(NxtYear);',
        'return Calc.Concatenate({1}, Calc.Substring(ConvertString,2,2));'
      ]
    },
    testJson: [
      {
        name: 'T1',
        output: {
          entity: 'OH',
          form: 'FormSD100.FormSD100ES.Scanline',
          field: 'Q1VoucherYear',
          type: 'string[]',
          tomType: 'String',
          value: ['0126']
        }
      }
    ],
    calcFilePath: 'Q1VoucherYear.calc.json',
    testFilePath: 'Q1VoucherYear.test.json',
    constantsByName: {
      CurrentTaxYear: '2026'
    },
    allConstantsByName: {
      CurrentTaxYear: '2026',
      Q1CheckDigitVoucherAndYear: '01'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'CurrentTaxYear');
  assert.deepEqual(preview.rows[0].proposedValue, ['0127']);
});

test('Unit test date roller: previews branch-based string[][] constant updates from matrix inputs', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100.FormSDOUPC.FormSDOUPCPrint',
      Field: 'CouponYear',
      Type: 'string[][]',
      TomType: 'String',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CouponType54', Constant: 'CouponType54' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CouponType55', Constant: 'CouponType55' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrentTaxYear', Constant: 'CurrentTaxYear' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/NextTaxYear', Constant: 'NextTaxYear' },
        { Entity: 'OH', Form: 'FormSD100.FormSDOUPC.FormSDOUPCPrint', Field: 'CouponType', FieldType: 'Calculated', FieldRef: 'OH/FormSD100.FormSDOUPC.FormSDOUPCPrint/CouponType' }
      ],
      Custom: [
        'if ({4} == {0})',
        '{',
        '    return {2};',
        '}',
        'else if ({4} == {1})',
        '{',
        '    return {3};',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'CouponType54ReturnsCurrentTaxYear',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100.FormSDOUPC.FormSDOUPCPrint',
            field: 'CouponType',
            type: 'string[][]',
            tomType: 'String',
            value: [['54']]
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.FormSDOUPC.FormSDOUPCPrint',
          field: 'CouponYear',
          type: 'string[][]',
          tomType: 'String',
          value: [['2025']]
        }
      },
      {
        name: 'CouponType55ReturnsNextTaxYear',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100.FormSDOUPC.FormSDOUPCPrint',
            field: 'CouponType',
            type: 'string[][]',
            tomType: 'String',
            value: [['55']]
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.FormSDOUPC.FormSDOUPCPrint',
          field: 'CouponYear',
          type: 'string[][]',
          tomType: 'String',
          value: [['2026'], ['2026']]
        }
      }
    ],
    calcFilePath: 'CouponYear.calc.json',
    testFilePath: 'CouponYear.test.json',
    constantsByName: {
      CouponType54: '54',
      CouponType55: '55',
      CurrentTaxYear: '2026',
      NextTaxYear: '2027'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].calcFieldPath, 'OH/FormSD100.FormSDOUPC.FormSDOUPCPrint/CouponYear');
  assert.equal(preview.rows[0].constantName, 'CurrentTaxYear');
  assert.deepEqual(preview.rows[0].proposedValue, [['2026']]);
  assert.equal(preview.rows[1].constantName, 'NextTaxYear');
  assert.deepEqual(preview.rows[1].proposedValue, [['2027'], ['2027']]);
  assert.equal(preview.rows[1].canApply, true);
});

test('Unit test date roller: previews input boundary updates for direct YOY constant comparisons', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'ReturnInformation',
      Field: 'DateNoEfile',
      Type: 'bool',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'OH', Form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus', Field: 'PartYearResident.NonResidentFromDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus/PartYearResident.NonResidentFromDate' },
        { Entity: 'OH', Form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus', Field: 'PartYearResident.NonResidentToDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus/PartYearResident.NonResidentToDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/LastDayOfTheYear', Constant: 'LastDayOfTheYear' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/FirstDayOfTheYear', Constant: 'FirstDayOfTheYear' }
      ],
      Custom: [
        'if ({0} == {3} || {1} == {2})',
        '{',
        '    return null;',
        '}',
        'else return true;'
      ]
    },
    testJson: [
      {
        name: 'NonResidentFromDateIsFirstDay',
        inputs: [
          {
            entity: 'OH',
            form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentFromDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-01-01'
          },
          {
            entity: 'OH',
            form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentToDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-05-12'
          }
        ],
        output: {
          entity: 'OH',
          form: 'ReturnInformation',
          field: 'DateNoEfile',
          type: 'bool',
          tomType: 'Boolean',
          value: null
        }
      },
      {
        name: 'NonResidentToDateIsLastDay',
        inputs: [
          {
            entity: 'OH',
            form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentFromDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-05-12'
          },
          {
            entity: 'OH',
            form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentToDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-12-31'
          }
        ],
        output: {
          entity: 'OH',
          form: 'ReturnInformation',
          field: 'DateNoEfile',
          type: 'bool',
          tomType: 'Boolean',
          value: null
        }
      },
      {
        name: 'NonResidentDatesWithinYear',
        inputs: [
          {
            entity: 'OH',
            form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentFromDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-03-15'
          },
          {
            entity: 'OH',
            form: 'FormIT1040.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentToDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-08-20'
          }
        ],
        output: {
          entity: 'OH',
          form: 'ReturnInformation',
          field: 'DateNoEfile',
          type: 'bool',
          tomType: 'Boolean',
          value: true
        }
      }
    ],
    calcFilePath: 'DateNoEfile.calc.json',
    testFilePath: 'DateNoEfile.test.json',
    constantsByName: {
      FirstDayOfTheYear: '2026-01-01',
      LastDayOfTheYear: '2026-12-31'
    }
  });

  assert.equal(preview.rows.length, 6);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].calcFieldPath, 'OH/ReturnInformation/DateNoEfile');
  assert.equal(preview.rows[0].constantName, 'FirstDayOfTheYear');
  assert.equal(preview.rows[0].fieldPath, '0.inputs.0');
  assert.equal(preview.rows[0].valuePath, '0.inputs.0.value');
  assert.equal(preview.rows[0].proposedValue, '2026-01-01');
  assert.equal(preview.rows[1].constantName, 'Same tax-year cycle');
  assert.equal(preview.rows[1].fieldPath, '0.inputs.1');
  assert.equal(preview.rows[1].valuePath, '0.inputs.1.value');
  assert.equal(preview.rows[1].proposedValue, '2026-05-12');
  assert.equal(preview.rows[2].constantName, 'LastDayOfTheYear');
  assert.equal(preview.rows[2].fieldPath, '1.inputs.1');
  assert.equal(preview.rows[2].valuePath, '1.inputs.1.value');
  assert.equal(preview.rows[2].proposedValue, '2026-12-31');
  assert.equal(preview.rows[3].constantName, 'Same tax-year cycle');
  assert.equal(preview.rows[3].fieldPath, '1.inputs.0');
  assert.equal(preview.rows[3].valuePath, '1.inputs.0.value');
  assert.equal(preview.rows[3].proposedValue, '2026-05-12');
  assert.equal(preview.rows[4].constantName, 'Same tax-year cycle');
  assert.equal(preview.rows[4].fieldPath, '2.inputs.0');
  assert.equal(preview.rows[4].valuePath, '2.inputs.0.value');
  assert.equal(preview.rows[4].proposedValue, '2026-03-15');
  assert.equal(preview.rows[5].constantName, 'Same tax-year cycle');
  assert.equal(preview.rows[5].fieldPath, '2.inputs.1');
  assert.equal(preview.rows[5].valuePath, '2.inputs.1.value');
  assert.equal(preview.rows[5].proposedValue, '2026-08-20');
});

test('Unit test date roller: previews date boundary updates through local date aliases', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'CA',
      Form: 'Form5805.UnderPayReCalc.PartIIPenalty.TaxPaidPeriod',
      Field: 'FirstPeriodDaysLate.QuarterOne',
      Type: 'decimal[]',
      TomType: 'USAmount',
      Dependencies: [
        {
          Entity: 'CA',
          Form: 'Form5805.UnderPayReCalc.PartIIPenalty.TaxPaidPeriod',
          Field: 'DatePaid',
          Type: 'DateTime[]',
          TomType: 'Date',
          FieldType: 'Linked',
          FieldRef: 'CA/Form5805.UnderPayReCalc.PartIIPenalty.TaxPaidPeriod/DatePaid'
        },
        { FieldType: 'Constant', FieldRef: 'CA/Constant/Q1EstimateDate', Constant: 'Q1EstimateDate' },
        { FieldType: 'Constant', FieldRef: 'CA/Constant/LastDayOfYear', Constant: 'LastDayOfYear' }
      ],
      Custom: [
        'var startDate = {1};',
        'var endDate = {2};',
        'var paidDate = {0};',
        '',
        'if (paidDate.IsOnOrBefore(startDate)) return 0;',
        'if (paidDate.IsOnOrBefore(endDate))',
        '    return Calc.DaysBetween(startDate, paidDate);',
        'return Calc.DaysBetween(startDate, endDate);'
      ]
    },
    testJson: [
      {
        name: 2,
        inputs: [
          {
            entity: 'CA',
            form: 'Form5805.UnderPayReCalc.PartIIPenalty.TaxPaidPeriod',
            field: 'DatePaid',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2025-07-09']
          }
        ],
        output: {
          entity: 'CA',
          form: 'Form5805.UnderPayReCalc.PartIIPenalty.TaxPaidPeriod',
          field: 'FirstPeriodDaysLate.QuarterOne',
          type: 'decimal[]',
          tomType: 'USAmount',
          value: [85.0]
        }
      }
    ],
    calcFilePath: 'FirstPeriodDaysLate.QuarterOne.calc.json',
    testFilePath: 'FirstPeriodDaysLate.QuarterOne.test.json',
    constantsByName: {
      Q1EstimateDate: '2026-04-15',
      LastDayOfYear: '2026-12-31'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].calcFieldPath, 'CA/Form5805.UnderPayReCalc.PartIIPenalty.TaxPaidPeriod/FirstPeriodDaysLate.QuarterOne');
  assert.equal(preview.rows[0].constantName, 'Q1EstimateDate');
  assert.equal(preview.rows[0].fieldPath, '0.inputs.0');
  assert.equal(preview.rows[0].valuePath, '0.inputs.0.value');
  assert.deepEqual(preview.rows[0].proposedValue, ['2026-07-09']);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: preserves ISO date-time suffixes for between-boundary input returns', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form1040ES.EstTaxPaymentRecord',
      Field: 'Q4FirstPaymentDt',
      Type: 'DateTime',
      TomType: 'Date',
      Dependencies: [
        { Entity: 'FD', Form: 'Form1040.EstimatedTaxPayment', Field: 'ThirdQuarterEstimatedTaxDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'FD/Form1040.EstimatedTaxPayment/ThirdQuarterEstimatedTaxDate' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/Q4StartDate', Constant: 'Q4StartDate' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/Q4EndDate', Constant: 'Q4EndDate' }
      ],
      Custom: [
        'if ({0} >= {1} && {0} <= {2})',
        '{',
        '    return {0};',
        '}',
        'else',
        '{',
        '    return null;',
        '}'
      ]
    },
    testJson: [
      {
        name: 'DateAtStartOfQ4',
        inputs: [
          {
            entity: 'FD',
            form: 'Form1040.EstimatedTaxPayment',
            field: 'ThirdQuarterEstimatedTaxDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-09-16T00:00:00'
          }
        ],
        output: {
          entity: 'FD',
          form: 'Form1040ES.EstTaxPaymentRecord',
          field: 'Q4FirstPaymentDt',
          type: 'DateTime',
          tomType: 'Date',
          value: '2025-09-16T00:00:00'
        }
      }
    ],
    calcFilePath: 'Q4FirstPaymentDt.calc.json',
    testFilePath: 'Q4FirstPaymentDt.test.json',
    constantsByName: {
      Q4StartDate: '2026-09-16',
      Q4EndDate: '2027-01-15'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].fieldPath, '0.inputs.0');
  assert.equal(preview.rows[0].proposedValue, '2026-09-16T00:00:00');
  assert.equal(preview.rows[1].rowKind, 'output');
  assert.equal(preview.rows[1].fieldPath, '0.output');
  assert.equal(preview.rows[1].proposedValue, '2026-09-16T00:00:00');
});

test('Unit test date roller: updates AgeIs AsOf outputs without auto-shifting birthdate inputs', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Filer',
      Field: 'TaxPayer.AgeGreater59Half',
      Type: 'bool',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'FD', Form: 'Filer', Field: 'TaxPayer.DateOfBirth', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'FD/Filer/TaxPayer.DateOfBirth' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/Form5329EarlyDistributionsAgeLimit', Constant: 'Form5329EarlyDistributionsAgeLimit' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/LastDayOfYear', Constant: 'LastDayOfYear' }
      ],
      Custom: [
        'if ({0} != null)',
        '{',
        '    return {0}.AgeIs({1}).AsOf({2});',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'AgeLessThan59HalfOnLastDay',
        inputs: [
          {
            entity: 'FD',
            form: 'Filer',
            field: 'TaxPayer.DateOfBirth',
            type: 'DateTime',
            tomType: 'Date',
            value: '1966-07-01'
          }
        ],
        output: {
          entity: 'FD',
          form: 'Filer',
          field: 'TaxPayer.AgeGreater59Half',
          type: 'bool',
          tomType: 'Boolean',
          value: false
        }
      }
    ],
    calcFilePath: 'AgeGreater59Half.calc.json',
    testFilePath: 'AgeGreater59Half.test.json',
    constantsByName: {
      LastDayOfYear: '2026-12-31'
    },
    allConstantsByName: {
      Form5329EarlyDistributionsAgeLimit: '59.5',
      LastDayOfYear: '2026-12-31'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'output');
  assert.equal(preview.rows[0].fieldPath, '0.output');
  assert.equal(preview.rows[0].proposedValue, true);
});

test('Unit test date roller: preserves DateTime[] offsets for calc date helper comparisons', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100.Form2210.FirstQuarterLatePayments',
      Field: 'DaysLate',
      Type: 'decimal[]',
      TomType: 'USAmount',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210FirstQuarterDate', Constant: 'Form2210FirstQuarterDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210SecondQuarterDate', Constant: 'Form2210SecondQuarterDate' },
        { Entity: 'OH', Form: 'FormSD100.Form2210.Part1', Field: 'Q1PaymentDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100.Form2210.Part1/Q1PaymentDate' }
      ],
      Custom: [
        'if({2}.IsOnOrAfter({1})) return 0;',
        'return Calc.Max(0, Calc.DaysBetween({0}, {2}));'
      ]
    },
    testJson: [
      {
        name: 'LateByTenDays',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100.Form2210.Part1',
            field: 'Q1PaymentDate',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2025-04-25']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.Form2210.FirstQuarterLatePayments',
          field: 'DaysLate',
          type: 'decimal[]',
          tomType: 'USAmount',
          value: [10]
        }
      }
    ],
    calcFilePath: 'DaysLate.calc.json',
    testFilePath: 'DaysLate.test.json',
    constantsByName: {
      Form2210FirstQuarterDate: '2026-04-15',
      Form2210SecondQuarterDate: '2026-06-15'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].constantName, 'Form2210FirstQuarterDate');
  assert.equal(preview.rows[0].fieldPath, '0.inputs.0');
  assert.equal(preview.rows[0].valuePath, '0.inputs.0.value');
  assert.deepEqual(preview.rows[0].currentValue, ['2025-04-25']);
  assert.deepEqual(preview.rows[0].proposedValue, ['2026-04-25']);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: does not shift already-updated date helper inputs a second time', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100.Form2210.ThirdQuarterLatePayments',
      Field: 'DaysLate',
      Type: 'decimal[]',
      TomType: 'USAmount',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210ThirdQuarterDate', Constant: 'Form2210ThirdQuarterDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210FourthQuarterDate', Constant: 'Form2210FourthQuarterDate' },
        { Entity: 'OH', Form: 'FormSD100.Form2210.Part1', Field: 'Q3PaymentDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100.Form2210.Part1/Q3PaymentDate' }
      ],
      Custom: [
        'if({2}.IsOnOrAfter({1})) return 0;',
        'return Calc.Max(0, Calc.DaysBetween({0}, {2}));'
      ]
    },
    testJson: [
      {
        name: 'Q3PaymentDateOneDayLateAlreadyUpdated',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100.Form2210.Part1',
            field: 'Q3PaymentDate',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2026-09-16']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.Form2210.ThirdQuarterLatePayments',
          field: 'DaysLate',
          type: 'decimal[]',
          tomType: 'USAmount',
          value: [1]
        }
      }
    ],
    calcFilePath: 'DaysLate.calc.json',
    testFilePath: 'DaysLate.test.json',
    constantsByName: {
      Form2210ThirdQuarterDate: '2026-09-15',
      Form2210FourthQuarterDate: '2027-01-15'
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: updates computed decimal outputs from maintained date branch literals', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100Single.Form2210.ThirdQuarterLatePayments',
      Field: 'CYDaysLate',
      Type: 'decimal',
      TomType: 'USAmount',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210ThirdQuarterDate', Constant: 'Form2210ThirdQuarterDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210FourthQuarterDate', Constant: 'Form2210FourthQuarterDate' },
        { Entity: 'OH', Form: 'FormSD100Single.Form2210.Part1', Field: 'Q3PaymentDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100Single.Form2210.Part1/Q3PaymentDate' }
      ],
      Custom: [
        'if({2}.IsOnOrAfter({1})) return 0;',
        'return Calc.Max(0, Calc.DaysBetween({0}, {2}));'
      ]
    },
    testJson: [
      {
        name: 'Q3PaymentDateOnQ4Date',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100Single.Form2210.Part1',
            field: 'Q3PaymentDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2026-01-15'
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100Single.Form2210.ThirdQuarterLatePayments',
          field: 'CYDaysLate',
          type: 'decimal',
          tomType: 'USAmount',
          value: 107
        }
      }
    ],
    calcFilePath: 'CYDaysLate.calc.json',
    testFilePath: 'CYDaysLate.test.json',
    constantsByName: {
      Form2210ThirdQuarterDate: '2026-09-15',
      Form2210FourthQuarterDate: '2026-01-15'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].constantName, 'Form2210ThirdQuarterDate');
  assert.equal(preview.rows[0].currentValue, '2026-01-15');
  assert.equal(preview.rows[0].proposedValue, '2027-01-15');
  assert.equal(preview.rows[1].rowKind, 'output');
  assert.equal(preview.rows[1].constantName, 'Form2210FourthQuarterDate');
  assert.equal(preview.rows[1].currentValue, 107);
  assert.equal(preview.rows[1].proposedValue, 0);
});

test('Unit test date roller: shifts next-year spillover inputs for DaysBetween from year-end constants', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100Single.Form2210.ThirdQuarterLatePayments',
      Field: 'NYDaysLate',
      Type: 'decimal',
      TomType: 'USAmount',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/Form2210FourthQuarterDate', Constant: 'Form2210FourthQuarterDate' },
        { Entity: 'OH', Form: 'FormSD100Single.Form2210.Part1', Field: 'Q3PaymentDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100Single.Form2210.Part1/Q3PaymentDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/LastDayOfTheYear', Constant: 'LastDayOfTheYear' }
      ],
      Custom: [
        'if({1}.IsOnOrAfter({0})) return 0;',
        'if({1}.IsAfter({2}))',
        '{',
        '    return Calc.Max(0, Calc.DaysBetween({2}, {1}));',
        '}',
        'return 0;'
      ]
    },
    testJson: [
      {
        name: 'Q3PaymentDateExactlyOneDayLate',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100Single.Form2210.Part1',
            field: 'Q3PaymentDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2026-01-01'
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100Single.Form2210.ThirdQuarterLatePayments',
          field: 'NYDaysLate',
          type: 'decimal',
          tomType: 'USAmount',
          value: 1
        }
      },
      {
        name: 'Q3PaymentDateExactlyTenDaysLate',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100Single.Form2210.Part1',
            field: 'Q3PaymentDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2026-01-10'
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100Single.Form2210.ThirdQuarterLatePayments',
          field: 'NYDaysLate',
          type: 'decimal',
          tomType: 'USAmount',
          value: 10
        }
      }
    ],
    calcFilePath: 'NYDaysLate.calc.json',
    testFilePath: 'NYDaysLate.test.json',
    constantsByName: {
      Form2210FourthQuarterDate: '2027-01-15',
      LastDayOfTheYear: '2026-12-31'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].caseName, 'Q3PaymentDateExactlyOneDayLate');
  assert.equal(preview.rows[0].constantName, 'LastDayOfTheYear');
  assert.equal(preview.rows[0].currentValue, '2026-01-01');
  assert.equal(preview.rows[0].proposedValue, '2027-01-01');
  assert.equal(preview.rows[1].caseName, 'Q3PaymentDateExactlyTenDaysLate');
  assert.equal(preview.rows[1].currentValue, '2026-01-10');
  assert.equal(preview.rows[1].proposedValue, '2027-01-10');
});

test('Unit test date roller: updates computed decimal array outputs from DaysBetween expressions', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsSpouse',
      Field: 'DaysFromStart',
      Type: 'decimal[]',
      TomType: 'USAmount',
      Dependencies: [
        { Entity: 'OH', Form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsSpouse', Field: 'BeginDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsSpouse/BeginDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/FirstDayOfTheYear', Constant: 'FirstDayOfTheYear' }
      ],
      Custom: [
        'return Calc.DaysBetween({1}.SubtractDays(1), {0});'
      ]
    },
    testJson: [
      {
        name: 'DaysFromStartWithBeginDateBeforeYearStart',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsSpouse',
            field: 'BeginDate',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2025-12-31']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsSpouse',
          field: 'DaysFromStart',
          type: 'decimal[]',
          tomType: 'USAmount',
          value: [0]
        }
      }
    ],
    calcFilePath: 'DaysFromStart.calc.json',
    testFilePath: 'DaysFromStart.test.json',
    constantsByName: {
      FirstDayOfTheYear: '2026-01-01'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.deepEqual(preview.rows[0].proposedValue, ['2026-12-31']);
  assert.equal(preview.rows[1].rowKind, 'output');
  assert.equal(preview.rows[1].constantName, 'FirstDayOfTheYear');
  assert.deepEqual(preview.rows[1].currentValue, [0]);
  assert.deepEqual(preview.rows[1].proposedValue, [365]);
});

test('Unit test date roller: preserves offsets when DaysBetween starts from a shifted constant method call', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsTaxpayer',
      Field: 'DaysFromStart',
      Type: 'decimal[]',
      TomType: 'USAmount',
      Dependencies: [
        { Entity: 'OH', Form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsTaxpayer', Field: 'BeginDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsTaxpayer/BeginDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/FirstDayOfTheYear', Constant: 'FirstDayOfTheYear' }
      ],
      Custom: [
        'return Calc.DaysBetween({1}.SubtractDays(1), {0});'
      ]
    },
    testJson: [
      {
        name: 'DaysFromStartWithValidDates',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsTaxpayer',
            field: 'BeginDate',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2025-01-15']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100Single.Header.SDResidencySchedule.ResidencyPeriodsTaxpayer',
          field: 'DaysFromStart',
          type: 'decimal[]',
          tomType: 'USAmount',
          value: [15]
        }
      }
    ],
    calcFilePath: 'DaysFromStart.calc.json',
    testFilePath: 'DaysFromStart.test.json',
    constantsByName: {
      FirstDayOfTheYear: '2026-01-01'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].constantName, 'FirstDayOfTheYear');
  assert.deepEqual(preview.rows[0].currentValue, ['2025-01-15']);
  assert.deepEqual(preview.rows[0].proposedValue, ['2026-01-15']);
});

test('Unit test date roller: shifts DateTime inputs compared by year to maintained CurrentTaxYear', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus',
      Field: 'DateNotInCurrentYrInd',
      Type: 'bool[]',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'OH', Form: 'FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus', Field: 'PartYearResident.NonResidentFromDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus/PartYearResident.NonResidentFromDate' },
        { Entity: 'OH', Form: 'FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus', Field: 'PartYearResident.NonResidentToDate', Type: 'DateTime[]', TomType: 'Date', FieldType: 'Calculated', FieldRef: 'OH/FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus/PartYearResident.NonResidentToDate' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrentTaxYear', Constant: 'CurrentTaxYear' }
      ],
      Custom: [
        'if (DateTimeCalcHelpers.YYYY({0}) != {2} || DateTimeCalcHelpers.YYYY({1}) != {2})',
        '{',
        '    return true;',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'CurrentYearDates',
        inputs: [
          {
            entity: 'OH',
            form: 'FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentFromDate',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2025-11-06']
          },
          {
            entity: 'OH',
            form: 'FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus',
            field: 'PartYearResident.NonResidentToDate',
            type: 'DateTime[]',
            tomType: 'Date',
            value: ['2025-11-30']
          }
        ],
        output: {
          entity: 'OH',
          form: 'FormSD100.Header.ResidencyStatus.PrimaryResidencyStatus',
          field: 'DateNotInCurrentYrInd',
          type: 'bool[]',
          tomType: 'Boolean',
          value: null
        },
        expectsBlank: true
      }
    ],
    calcFilePath: 'DateNotInCurrentYrInd.calc.json',
    testFilePath: 'DateNotInCurrentYrInd.test.json',
    constantsByName: {
      CurrentTaxYear: '2026'
    }
  });

  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].rowKind, 'input');
  assert.equal(preview.rows[0].constantName, 'CurrentTaxYear');
  assert.deepEqual(preview.rows[0].currentValue, ['2025-11-06']);
  assert.deepEqual(preview.rows[0].proposedValue, ['2026-11-06']);
  assert.equal(preview.rows[1].constantName, 'CurrentTaxYear');
  assert.deepEqual(preview.rows[1].currentValue, ['2025-11-30']);
  assert.deepEqual(preview.rows[1].proposedValue, ['2026-11-30']);
});

test('Unit test date roller: preserves prior-year position for CurrentTaxYear date comparisons', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormIT1040.Header.ResidencyStatus',
      Field: 'TaxPayer.DateEntryNotInCYInd',
      Type: 'bool',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'OH', Form: 'FormIT1040.Header.ResidencyStatus', Field: 'LivedInOhioFrom', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'OH/FormIT1040.Header.ResidencyStatus/LivedInOhioFrom' },
        { Entity: 'OH', Form: 'FormIT1040.Header.ResidencyStatus', Field: 'LivedInOhioTo', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'OH/FormIT1040.Header.ResidencyStatus/LivedInOhioTo' },
        { FieldType: 'Constant', FieldRef: 'OH/Constant/CurrentTaxYear', Constant: 'CurrentTaxYear' }
      ],
      Custom: [
        'if (DateTimeCalcHelpers.YYYY({0}) != {2} ||',
        '    DateTimeCalcHelpers.YYYY({1}) != {2})',
        '{',
        '    return true;',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'PriorYear',
        inputs: [
          { entity: 'OH', form: 'FormIT1040.Header.ResidencyStatus', field: 'LivedInOhioFrom', type: 'DateTime', tomType: 'Date', value: '2024-09-01' },
          { entity: 'OH', form: 'FormIT1040.Header.ResidencyStatus', field: 'LivedInOhioTo', type: 'DateTime', tomType: 'Date', value: '2025-11-01' }
        ],
        output: {
          entity: 'OH',
          form: 'FormIT1040.Header.ResidencyStatus',
          field: 'TaxPayer.DateEntryNotInCYInd',
          type: 'bool',
          tomType: 'Boolean',
          value: true
        }
      },
      {
        name: 'AlreadyUpdatedPriorYear',
        inputs: [
          { entity: 'OH', form: 'FormIT1040.Header.ResidencyStatus', field: 'LivedInOhioFrom', type: 'DateTime', tomType: 'Date', value: '2025-09-01' },
          { entity: 'OH', form: 'FormIT1040.Header.ResidencyStatus', field: 'LivedInOhioTo', type: 'DateTime', tomType: 'Date', value: '2026-11-01' }
        ],
        output: {
          entity: 'OH',
          form: 'FormIT1040.Header.ResidencyStatus',
          field: 'TaxPayer.DateEntryNotInCYInd',
          type: 'bool',
          tomType: 'Boolean',
          value: true
        }
      }
    ],
    calcFilePath: 'TaxPayer.DateEntryNotInCYInd.calc.json',
    testFilePath: 'TaxPayer.DateEntryNotInCYInd.test.json',
    constantsByName: {
      CurrentTaxYear: '2026'
    }
  });

  assert.equal(preview.rows.length, 2);
  const fromRow = preview.rows.find(row => row.fieldPath === '0.inputs.0');
  const toRow = preview.rows.find(row => row.fieldPath === '0.inputs.1');
  assert.equal(fromRow.currentValue, '2024-09-01');
  assert.equal(fromRow.proposedValue, '2025-09-01');
  assert.equal(toRow.currentValue, '2025-11-01');
  assert.equal(toRow.proposedValue, '2026-11-01');
});

test('Unit test date roller: shape-preserving DateTime[][] updates fill every matrix cell', () => {
  const derived = deriveProposedValue({
    type: 'DateTime[][]',
    tomType: 'Date',
    value: [['2025-04-15'], ['2025-06-15']]
  }, '2026-04-15');

  assert.equal(derived.supported, true);
  assert.deepEqual(derived.proposedValue, [['2026-04-15'], ['2026-04-15']]);
});

test('Unit test date roller: shape-preserving bool[][] updates fill every matrix cell', () => {
  const derived = deriveProposedValue({
    type: 'bool[][]',
    tomType: 'Boolean',
    value: [[false]]
  }, true);

  assert.equal(derived.supported, true);
  assert.deepEqual(derived.proposedValue, [[true]]);
});

test('Unit test date roller: shape-preserving bool[][][] updates fill every cube cell', () => {
  const derived = deriveProposedValue({
    type: 'bool[][][]',
    tomType: 'Boolean',
    value: [[[false]]]
  }, true);

  assert.equal(derived.supported, true);
  assert.deepEqual(derived.proposedValue, [[[true]]]);
});

test('Unit test date roller: shape-preserving decimal[][] updates fill every matrix cell', () => {
  const zeroDerived = deriveProposedValue({
    type: 'decimal[][]',
    tomType: 'Ratio',
    value: [[0]]
  }, 0);
  const fractionalDerived = deriveProposedValue({
    type: 'decimal[][]',
    tomType: 'Ratio',
    value: [[0.14]]
  }, 0.14);

  assert.equal(zeroDerived.supported, true);
  assert.deepEqual(zeroDerived.proposedValue, [[0]]);
  assert.equal(fractionalDerived.supported, true);
  assert.deepEqual(fractionalDerived.proposedValue, [[0.14]]);
});

test('Unit test date roller: previews enum string matrix outputs from maintained date branches', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form4684.FedDclrDsstrLossElect',
      Field: 'DisasterDesc',
      Type: 'string[][]',
      TomType: 'String',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/FirstDayOfNextYear', Constant: 'FirstDayOfNextYear' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextyearLastDay', Constant: 'NextyearLastDay' }
      ],
      Custom: [
        'if ({0}.IsOnOrBefore({1}))',
        '{',
        '    return DisasterDescription.CCC;',
        '}',
        'return null;'
      ]
    },
    testJson: [
      {
        name: 'T1',
        output: {
          entity: 'FD',
          form: 'Form4684.FedDclrDsstrLossElect',
          field: 'DisasterDesc',
          type: 'string[][]',
          tomType: 'String',
          value: [['DDD']]
        }
      }
    ],
    calcFilePath: 'DisasterDesc.calc.json',
    testFilePath: 'DisasterDesc.test.json',
    constantsByName: {
      FirstDayOfNextYear: '2026-01-01',
      NextyearLastDay: '2026-12-31'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'FirstDayOfNextYear, NextyearLastDay');
  assert.deepEqual(preview.rows[0].proposedValue, [['CCC']]);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: previews bool[][][] outputs from maintained date branches', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form4684.FedDclrDsstrLossElect.USAddress',
      Field: 'USAddressPrint',
      Type: 'bool[][][]',
      TomType: 'Boolean',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/FirstDayOfNextYear', Constant: 'FirstDayOfNextYear' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextyearLastDay', Constant: 'NextyearLastDay' }
      ],
      Custom: [
        'if ({0}.IsOnOrBefore({1}))',
        '{',
        '    return true;',
        '}',
        'return false;'
      ]
    },
    testJson: [
      {
        name: 'T1',
        output: {
          entity: 'FD',
          form: 'Form4684.FedDclrDsstrLossElect.USAddress',
          field: 'USAddressPrint',
          type: 'bool[][][]',
          tomType: 'Boolean',
          value: [[[false]]]
        }
      }
    ],
    calcFilePath: 'USAddressPrint.calc.json',
    testFilePath: 'USAddressPrint.test.json',
    constantsByName: {
      FirstDayOfNextYear: '2026-01-01',
      NextyearLastDay: '2026-12-31'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'FirstDayOfNextYear, NextyearLastDay');
  assert.deepEqual(preview.rows[0].proposedValue, [[[true]]]);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: maps computed boolean outputs onto X/Blank checkbox arrays', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form8839.AdoptedChild',
      Field: 'AdoptionFinalInd',
      Type: 'bool[]',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'FD', Form: 'Form8839.AdoptedChild', Field: 'AdoptionFinalDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'FD/Form8839.AdoptedChild/AdoptionFinalDate' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextYearNumber', Constant: 'NextYearNumber' }
      ],
      Custom: [
        'return DateTimeCalcHelpers.YYYY({0}) == {1};'
      ]
    },
    testJson: [
      {
        name: 'AdptFinalTest3',
        inputs: [
          {
            entity: 'FD',
            form: 'Form8839.AdoptedChild',
            field: 'AdoptionFinalDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-12-31'
          }
        ],
        output: {
          entity: 'FD',
          form: 'Form8839.AdoptedChild',
          field: 'AdoptionFinalInd',
          type: 'bool[]',
          tomType: 'Boolean',
          value: ['X']
        }
      }
    ],
    calcFilePath: 'AdoptionFinalInd.calc.json',
    testFilePath: 'AdoptionFinalInd.test.json',
    constantsByName: {
      NextYearNumber: 2026
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].constantName, 'NextYearNumber');
  assert.deepEqual(preview.rows[0].proposedValue, ['Blank']);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: skips X/Blank checkbox arrays when computed boolean output already matches', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form8839.AdoptedChild',
      Field: 'AdoptionFinalInd',
      Type: 'bool[]',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'FD', Form: 'Form8839.AdoptedChild', Field: 'AdoptionFinalDate', Type: 'DateTime', TomType: 'Date', FieldType: 'Input', FieldRef: 'FD/Form8839.AdoptedChild/AdoptionFinalDate' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextYearNumber', Constant: 'NextYearNumber' }
      ],
      Custom: [
        'return DateTimeCalcHelpers.YYYY({0}) == {1};'
      ]
    },
    testJson: [
      {
        name: 'AdptFinalTest3',
        inputs: [
          {
            entity: 'FD',
            form: 'Form8839.AdoptedChild',
            field: 'AdoptionFinalDate',
            type: 'DateTime',
            tomType: 'Date',
            value: '2025-12-31'
          }
        ],
        output: {
          entity: 'FD',
          form: 'Form8839.AdoptedChild',
          field: 'AdoptionFinalInd',
          type: 'bool[]',
          tomType: 'Boolean',
          value: ['Blank']
        }
      }
    ],
    calcFilePath: 'AdoptionFinalInd.calc.json',
    testFilePath: 'AdoptionFinalInd.test.json',
    constantsByName: {
      NextYearNumber: 2026
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: skips unsupported boolean outputs when the selected value already matches', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form1040',
      Field: 'AmendedReturnInd',
      Type: 'bool',
      TomType: 'Boolean',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/Form1040FilingDueDate', Constant: 'Form1040FilingDueDate' }
      ],
      Custom: [
        'return {0};'
      ]
    },
    testJson: [
      {
        name: 'TR2',
        output: {
          entity: 'FD',
          form: 'Form1040',
          field: 'AmendedReturnInd',
          type: 'bool',
          tomType: 'Boolean',
          value: 'X'
        }
      }
    ],
    calcFilePath: 'AmendedReturnInd.calc.json',
    testFilePath: 'AmendedReturnInd.test.json',
    constantsByName: {
      Form1040FilingDueDate: 'X'
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: skips nullable unsupported boolean outputs when a sibling also expects null', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'VA',
      Form: 'AgeDeductionWkst',
      Field: 'Spouse.AgeDedQualifies',
      Type: 'bool',
      TomType: 'Boolean',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'VA/Constant/AgeDedFullDeductionDate', Constant: 'AgeDedFullDeductionDate' }
      ],
      Custom: [
        'return {0};'
      ]
    },
    testJson: [
      {
        name: 'One',
        output: {
          entity: 'VA',
          form: 'AgeDeductionWkst',
          field: 'Spouse.AgeDedQualifies',
          type: 'bool',
          tomType: 'Boolean',
          value: null
        }
      },
      {
        name: 'Two',
        output: {
          entity: 'VA',
          form: 'AgeDeductionWkst',
          field: 'Spouse.AgeDedQualifies',
          type: 'bool',
          tomType: 'Boolean',
          value: null
        }
      }
    ],
    calcFilePath: 'Spouse.AgeDedQualifies.calc.json',
    testFilePath: 'Spouse.AgeDedQualifies.test.json',
    constantsByName: {
      AgeDedFullDeductionDate: '2026-01-01'
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: skips unsupported custom matrix outputs when the selected value already matches', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form4547DirectInput.Dependents',
      Field: 'TrumpAccountStatus',
      Type: 'Form4547Status[][]',
      TomType: 'Form4547Status',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/BirthYear', Constant: 'BirthYear' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextYear', Constant: 'NextYear' }
      ],
      Custom: [
        'if ({0} < {1})',
        '{',
        '    return Form4547Status.QualifiesAndPilotProgram;',
        '}',
        'return Form4547Status.Qualifies;'
      ]
    },
    testJson: [
      {
        name: 'DependentAgeNegativeDoesNotQualify',
        output: {
          entity: 'FD',
          form: 'Form4547DirectInput.Dependents',
          field: 'TrumpAccountStatus',
          type: 'Form4547Status[][]',
          tomType: 'Form4547Status',
          value: [['QualifiesAndPilotProgram']]
        }
      }
    ],
    calcFilePath: 'TrumpAccountStatus.calc.json',
    testFilePath: 'TrumpAccountStatus.test.json',
    constantsByName: {
      BirthYear: 2025,
      NextYear: 2026
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: skips unsupported custom matrix outputs when no concrete output value can be proposed', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form4547DirectInput.Dependents',
      Field: 'TrumpAccountStatus',
      Type: 'Form4547Status[][]',
      TomType: 'Form4547Status',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/BirthYear', Constant: 'BirthYear' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextYear', Constant: 'NextYear' }
      ],
      Custom: [
        'if ({0} > {1})',
        '{',
        '    return Form4547Status.DoesNotQualify;',
        '}',
        'return Form4547Status.Qualifies;'
      ]
    },
    testJson: [
      {
        name: 'QualifyNoSeed',
        output: {
          entity: 'FD',
          form: 'Form4547DirectInput.Dependents',
          field: 'TrumpAccountStatus',
          type: 'Form4547Status[][]',
          tomType: 'Form4547Status',
          value: [['Qualifies']]
        }
      }
    ],
    calcFilePath: 'TrumpAccountStatus.calc.json',
    testFilePath: 'TrumpAccountStatus.test.json',
    constantsByName: {
      BirthYear: 2026,
      NextYear: 2027
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: skips output rows when selected constant cannot produce a concrete string matrix value', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form4684.FedDclrDsstrLossElect',
      Field: 'DisasterDesc',
      Type: 'string[][]',
      TomType: 'String',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/FirstDayOfNextYear', Constant: 'FirstDayOfNextYear' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextyearLastDay', Constant: 'NextyearLastDay' }
      ],
      Custom: [
        'return {1};'
      ]
    },
    testJson: [
      {
        name: 'T1',
        output: {
          entity: 'FD',
          form: 'Form4684.FedDclrDsstrLossElect',
          field: 'DisasterDesc',
          type: 'string[][]',
          tomType: 'String',
          value: [['CCC']]
        }
      }
    ],
    calcFilePath: 'DisasterDesc.calc.json',
    testFilePath: 'DisasterDesc.test.json',
    constantsByName: {
      FirstDayOfNextYear: '2026-01-01',
      NextyearLastDay: ''
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: skips output rows when selected constant cannot produce a concrete boolean marker value', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form8839.AdoptedChild',
      Field: 'AdoptionFinalInd',
      Type: 'Checkbox[]',
      TomType: 'Checkbox',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'FD/Constant/NextYearNumber', Constant: 'NextYearNumber' }
      ],
      Custom: [
        'return {0};'
      ]
    },
    testJson: [
      {
        name: 'AdptFinalTest3',
        output: {
          entity: 'FD',
          form: 'Form8839.AdoptedChild',
          field: 'AdoptionFinalInd',
          type: 'Checkbox[]',
          tomType: 'Checkbox',
          value: ['Blank']
        }
      }
    ],
    calcFilePath: 'AdoptionFinalInd.calc.json',
    testFilePath: 'AdoptionFinalInd.test.json',
    constantsByName: {
      NextYearNumber: 2026
    }
  });

  assert.equal(preview.rows.length, 0);
});

test('Unit test date roller: previews computed bool[][] outputs from maintained TaxYear comparisons', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates',
      Field: 'DatePaid',
      Type: 'bool[][]',
      TomType: 'Boolean',
      Dependencies: [
        { Entity: 'FD', Form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates', Field: 'Year', Type: 'string[][]', TomType: 'Year', FieldType: 'Calculated', FieldRef: 'FD/Form1040ScheduleA.StateIncomeTaxes.Estimates/Year' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/TaxYear', Constant: 'TaxYear' },
        { Entity: 'FD', Form: 'Form1040ScheduleA.StateIncomeTaxes', Field: 'StateName', Type: 'string[]', TomType: 'String', FieldType: 'Input', FieldRef: 'FD/Form1040ScheduleA.StateIncomeTaxes/StateName' },
        { Entity: 'FD', Form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates', Field: 'PaymentType', Type: 'StatePaymentType[][]', TomType: 'StatePaymentType', FieldType: 'Input', FieldRef: 'FD/Form1040ScheduleA.StateIncomeTaxes.Estimates/PaymentType' }
      ],
      Custom: [
        'if (!{2}.IsBlank() && {3}.IsExtensionPaymentmadein2021() && {0} == {1})',
        '{',
        '    return true;',
        '}',
        'else if ( {0} == null || {0} == "" ||{0} == {1} && !{3}.IsExtensionPaymentmadein2021())',
        '{',
        '    return true;',
        '}',
        'else return false;'
      ]
    },
    testJson: [
      {
        name: 'Test2',
        inputs: [
          { entity: 'FD', form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates', field: 'Year', type: 'string[][]', tomType: 'Year', value: [['2026']] },
          { entity: 'FD', form: 'Form1040ScheduleA.StateIncomeTaxes', field: 'StateName', type: 'string[]', tomType: 'String', value: ['ABC'] },
          { entity: 'FD', form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates', field: 'PaymentType', type: 'StatePaymentType[][]', tomType: 'StatePaymentType', value: [['ExtensionPaymentmadein2021']] }
        ],
        output: {
          entity: 'FD',
          form: 'Form1040ScheduleA.StateIncomeTaxes.Estimates',
          field: 'DatePaid',
          type: 'bool[][]',
          tomType: 'Boolean',
          value: [[false]]
        }
      }
    ],
    calcFilePath: 'DatePaid.calc.json',
    testFilePath: 'DatePaid.test.json',
    constantsByName: {
      TaxYear: '2026'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'output');
  assert.equal(preview.rows[0].fieldPath, '0.output');
  assert.deepEqual(preview.rows[0].currentValue, [[false]]);
  assert.deepEqual(preview.rows[0].proposedValue, [[true]]);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: previews computed int[][] outputs from AgeAsOf expressions', () => {
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'FD',
      Form: 'Form1040ScheduleC.PYStartupCostInformation',
      Field: 'AssetLife',
      Type: 'int[][]',
      TomType: 'Integer',
      Dependencies: [
        { Entity: 'FD', Form: 'Form1040ScheduleC.PYStartupCostInformation', Field: 'DateIncurred', Type: 'DateTime[][]', TomType: 'Date', FieldType: 'Input', FieldRef: 'FD/Form1040ScheduleC.PYStartupCostInformation/DateIncurred' },
        { FieldType: 'Constant', FieldRef: 'FD/Constant/FirstDayOfNextYear', Constant: 'FirstDayOfNextYear' }
      ],
      Custom: [
        'return {0}.AgeAsOf({1});'
      ]
    },
    testJson: [
      {
        name: 'A1',
        inputs: [
          {
            entity: 'FD',
            form: 'Form1040ScheduleC.PYStartupCostInformation',
            field: 'DateIncurred',
            type: 'DateTime[][]',
            tomType: 'Date',
            value: [['2023-12-31']]
          }
        ],
        output: {
          entity: 'FD',
          form: 'Form1040ScheduleC.PYStartupCostInformation',
          field: 'AssetLife',
          type: 'int[][]',
          tomType: 'Integer',
          value: [[2]]
        }
      }
    ],
    calcFilePath: 'AssetLife.calc.json',
    testFilePath: 'AssetLife.test.json',
    constantsByName: {
      FirstDayOfNextYear: '2027-01-01'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].rowKind, 'output');
  assert.equal(preview.rows[0].fieldPath, '0.output');
  assert.deepEqual(preview.rows[0].currentValue, [[2]]);
  assert.deepEqual(preview.rows[0].proposedValue, [[3]]);
  assert.equal(preview.rows[0].canApply, true);
});

test('Unit test date roller: flags multi-value DateTime[] replacements for manual review', () => {
  const derived = deriveProposedValue({
    type: 'DateTime[]',
    tomType: 'Date',
    value: ['2025-04-15', '2025-06-15']
  }, '2026-04-15');

  assert.equal(derived.supported, false);
  assert.match(derived.reason, /Scalar constant cannot safely replace/);
});

test('Unit test date roller: manual review rows expose same-case input and output edits', () => {
  const testJson = [
    {
      name: 'manual',
      inputs: [
        {
          entity: 'OH',
          form: 'FormA',
          field: 'PaymentDate',
          type: 'DateTime',
          tomType: 'Date',
          value: '2025-04-15'
        }
      ],
      output: {
        entity: 'OH',
        form: 'FormA',
        field: 'FieldA',
        type: 'DateTime[]',
        tomType: 'Date',
        value: ['2025-09-15', '2025-12-15']
      }
    }
  ];
  const preview = buildPreviewRows({
    calcJson: {
      Entity: 'OH',
      Form: 'FormA',
      Field: 'FieldA',
      Type: 'DateTime[]',
      TomType: 'Date',
      Dependencies: [
        { FieldType: 'Constant', FieldRef: 'OH/Constant/DateA', Constant: 'DateA' }
      ],
      Custom: [
        'return {0};'
      ]
    },
    testJson,
    calcFilePath: 'FieldA.calc.json',
    testFilePath: 'FieldA.test.json',
    constantsByName: {
      DateA: '2026-09-15'
    }
  });

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].canApply, false);
  assert.equal(preview.rows[0].inputCandidates.length, 1);
  assert.equal(preview.rows[0].inputCandidates[0].valuePath, '0.inputs.0.value');
  assert.equal(preview.rows[0].outputCandidate.valuePath, '0.output.value');

  applyPreviewRows(testJson, [{
    ...preview.rows[0],
    canApply: true,
    updates: [
      { valuePath: preview.rows[0].inputCandidates[0].valuePath, proposedValue: '2026-04-15' },
      { valuePath: preview.rows[0].outputCandidate.valuePath, proposedValue: ['2026-09-15', '2026-12-15'] }
    ]
  }]);

  assert.equal(testJson[0].inputs[0].value, '2026-04-15');
  assert.deepEqual(testJson[0].output.value, ['2026-09-15', '2026-12-15']);
});

test('Unit test date roller: applies only ready preview rows back to the parsed JSON', () => {
  const testJson = [
    {
      name: 1,
      output: {
        type: 'DateTime[]',
        tomType: 'Date',
        value: ['2025-04-15']
      }
    },
    {
      name: 2,
      output: {
        type: 'DateTime',
        tomType: 'Date',
        value: '2025-10-15'
      }
    }
  ];

  const updated = applyPreviewRows(testJson, [
    {
      valuePath: '0.output.value',
      proposedValue: ['2026-04-15'],
      canApply: true
    },
    {
      valuePath: '1.output.value',
      proposedValue: '2026-10-15',
      canApply: false
    }
  ]);

  assert.deepEqual(updated[0].output.value, ['2026-04-15']);
  assert.equal(updated[1].output.value, '2025-10-15');
});

test('Unit test date roller: serializes decimal field values with trailing .0 preserved', () => {
  const serialized = serializeTestJson([
    {
      name: 1,
      inputs: [
        {
          type: 'decimal[]',
          tomType: 'USAmount',
          value: [100, 0, 0.01, -0]
        }
      ],
      output: {
        type: 'decimal[][]',
        tomType: 'Ratio',
        value: [[0, 0.075]]
      }
    }
  ]);

  assert.match(serialized, /"type": "decimal\[\]"/);
  assert.match(serialized, /"value": \[\s*100\.0,\s*0\.0,\s*0\.01,\s*-0\.0\s*\]/);
  assert.match(serialized, /"type": "decimal\[\]\[\]"/);
  assert.match(serialized, /"value": \[\s*\[\s*0\.0,\s*0\.075\s*\]\s*\]/);
});
