const { getState } = require('./States');

function getMarriageCreditCanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\MN\Utils\Tables\MNMarriageCredit.table.json`;
}

function getHomeownerRefundRowCanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\MN\Utils\Tables\M1PRHomeownerRefundRowTable.table.json`;
}

function getHomeownerRefundCanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\MN\Utils\Tables\M1PRHomeownerRefundTable.table.json`;
}

function getRenterRefundRowCanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\MN\Utils\Tables\M1PRRenterRefundRowTable.table.json`;
}

function getRenterRefundCanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\MN\Utils\Tables\M1PRRenterRefundTable.table.json`;
}

function getCoFamilyAffordabilityUnder5CanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\CO\Utils\Tables\FamilyAffordabilityTaxCreditUnderaAge5.table.json`;
}

function getCoFamilyAffordabilityAge6To16CanonicalPath(regulatoryYear) {
  return String.raw`C:\TaxEngine\OCE-Regulatory-${regulatoryYear}\Source\CO\Utils\Tables\FamilyAffordabilityTaxCreditFrmAge6To16.table.json`;
}

function getConstsCanonicalPath(stateCode, regulatoryYear) {
  return `C:\\TaxEngine\\OCE-Regulatory-${regulatoryYear}\\Source\\${stateCode}\\Utils\\${stateCode}.consts.json`;
}

function buildDefaultPaths(stateCode, regulatoryYear, workflowKey = 'standard') {
  if (stateCode === 'MN' && workflowKey === 'm1ma') {
    return {
      M1MA: getMarriageCreditCanonicalPath(regulatoryYear)
    };
  }

  if (stateCode === 'MN' && workflowKey === 'm1pr') {
    return {
      M1PR_ROW: getHomeownerRefundRowCanonicalPath(regulatoryYear),
      M1PR_REFUND: getHomeownerRefundCanonicalPath(regulatoryYear)
    };
  }

  if (stateCode === 'MN' && workflowKey === 'm1rent') {
    return {
      M1PR_ROW: getRenterRefundRowCanonicalPath(regulatoryYear),
      M1PR_REFUND: getRenterRefundCanonicalPath(regulatoryYear)
    };
  }

  if (stateCode === 'CO' && workflowKey === 'family-affordability') {
    return {
      CO_FAMILY_UNDER5: getCoFamilyAffordabilityUnder5CanonicalPath(regulatoryYear),
      CO_FAMILY_AGE6TO16: getCoFamilyAffordabilityAge6To16CanonicalPath(regulatoryYear)
    };
  }

  if (workflowKey === 'constants-maintenance') {
    return {
      CONSTS: getConstsCanonicalPath(stateCode, regulatoryYear)
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
  getHomeownerRefundRowCanonicalPath,
  getHomeownerRefundCanonicalPath,
  getRenterRefundRowCanonicalPath,
  getRenterRefundCanonicalPath,
  getCoFamilyAffordabilityUnder5CanonicalPath,
  getCoFamilyAffordabilityAge6To16CanonicalPath,
  getConstsCanonicalPath,
  buildDefaultPaths,
  buildStorageKey,
  normalizeSavedPaths
};
