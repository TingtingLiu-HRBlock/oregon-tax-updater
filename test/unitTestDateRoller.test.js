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

test('Unit test date roller: flags multi-value DateTime[] replacements for manual review', () => {
  const derived = deriveProposedValue({
    type: 'DateTime[]',
    tomType: 'Date',
    value: ['2025-04-15', '2025-06-15']
  }, '2026-04-15');

  assert.equal(derived.supported, false);
  assert.match(derived.reason, /Scalar constant cannot safely replace/);
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
        type: 'DateTime[]',
        tomType: 'Date',
        value: ['2026-04-15']
      }
    }
  ]);

  assert.match(serialized, /"type": "decimal\[\]"/);
  assert.match(serialized, /"value": \[\s*100\.0,\s*0\.0,\s*0\.01,\s*-0\.0\s*\]/);
  assert.match(serialized, /"2026-04-15"/);
});
