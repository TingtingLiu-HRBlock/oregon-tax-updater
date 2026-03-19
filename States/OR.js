module.exports = {
  code: 'OR',
  name: 'Oregon',
  formName: 'Form OR-40',
  incomeLineLabel: 'Form OR-40, line 19',
  filingStatuses: [
    {
      key: 'S',
      label: 'Single / Married Filing Separately',
      fileLabel: 'Single',
      defaultPathTemplate: 'C:\\TaxEngine\\OCE-Regulatory-{regulatoryYear}\\Source\\OR\\Utils\\Tables\\TaxTableForSingle.table.json'
    },
    {
      key: 'J',
      label: 'Married Jointly / Head of Household / Surviving Spouse',
      fileLabel: 'Joint',
      defaultPathTemplate: 'C:\\TaxEngine\\OCE-Regulatory-{regulatoryYear}\\Source\\OR\\Utils\\Tables\\TaxTableForJoint.table.json'
    }
  ]
};

