const { getState } = require('./States');

function getMarriageCreditCanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\MN\Utils\Tables\MNMarriageCredit.table.json`;
}

function buildDefaultPaths(stateCode, regulatoryYear, workflowKey = 'standard') {
  if (stateCode === 'MN' && workflowKey === 'm1ma') {
    return {
      M1MA: getMarriageCreditCanonicalPath(regulatoryYear)
    };
  }

  const stateConfig = getState(stateCode);
  if (!stateConfig) return {};

  const result = {};
  for (const status of stateConfig.filingStatuses) {
    result[status.key] = status.defaultPathTemplate.replace('{regulatoryYear}', regulatoryYear);
  }
  return result;
}

function buildStorageKey(stateCode, regulatoryYear, workflowKey = 'standard') {
  return workflowKey && workflowKey !== 'standard'
    ? `${stateCode}-${regulatoryYear}-${workflowKey}`
    : `${stateCode}-${regulatoryYear}`;
}

function isMalformedMarriageCreditPath(currentPath) {
  return /TaxEngine\\?OCE-Regulatory-\d{4}\\?Source\\?MN\\?Utils\\?Tables\\?MNMarriageCredit\.table\.json$/i.test(currentPath)
    || (/TaxEngine/i.test(currentPath) && /MNMarriageCredit\.table\.json$/i.test(currentPath) && /oregon-tax-updater/i.test(currentPath));
}

function normalizeSavedPaths(stateCode, regulatoryYear, workflowKey, filePaths) {
  if (!filePaths || typeof filePaths !== 'object') {
    return filePaths;
  }

  if (stateCode === 'MN' && workflowKey === 'm1ma') {
    const canonicalPath = getMarriageCreditCanonicalPath(regulatoryYear);
    const currentPath = filePaths.M1MA;

    if (!currentPath || currentPath === canonicalPath) {
      return {
        ...filePaths,
        M1MA: currentPath || canonicalPath
      };
    }

    if (isMalformedMarriageCreditPath(currentPath)) {
      return {
        ...filePaths,
        M1MA: canonicalPath
      };
    }
  }

  return filePaths;
}

module.exports = {
  getMarriageCreditCanonicalPath,
  buildDefaultPaths,
  buildStorageKey,
  normalizeSavedPaths
};
