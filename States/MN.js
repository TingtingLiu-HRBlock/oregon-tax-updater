module.exports = {
  code: 'MN',
  name: 'Minnesota',
  formName: 'Form M1',
  incomeLineLabel: 'Form M1, line 9',
  filingStatuses: [
    {
      key: 'Single',
      label: 'Single',
      fileLabel: 'Single',
      defaultPathTemplate: 'C:\\TaxEngine\\OCE-Regulatory-{regulatoryYear}\\Source\\MN\\Utils\\Tables\\MNSingleTaxTable.table.json'
    },
    {
      key: 'MFJ',
      label: 'Married Jointly / Qualifying Surviving Spouse',
      fileLabel: 'MFJ & QW',
      defaultPathTemplate: 'C:\\TaxEngine\\OCE-Regulatory-{regulatoryYear}\\Source\\MN\\Utils\\Tables\\MNMFJAndQWTaxTable.table.json'
    },
    {
      key: 'MFS',
      label: 'Married Filing Separately',
      fileLabel: 'MFS',
      defaultPathTemplate: 'C:\\TaxEngine\\OCE-Regulatory-{regulatoryYear}\\Source\\MN\\Utils\\Tables\\MNMFSTaxTable.table.json'
    },
    {
      key: 'HOH',
      label: 'Head of Household',
      fileLabel: 'HOH',
      defaultPathTemplate: 'C:\\TaxEngine\\OCE-Regulatory-{regulatoryYear}\\Source\\MN\\Utils\\Tables\\MNHOHTaxTable.table.json'
    }
  ]
};
