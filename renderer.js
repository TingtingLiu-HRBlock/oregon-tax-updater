
const STANDARD_WORKFLOW_KEY = 'standard';
const MARRIAGE_CREDIT_WORKFLOW_KEY = 'm1ma';
const HOMEOWNER_REFUND_WORKFLOW_KEY = 'm1pr';
const RENTER_REFUND_WORKFLOW_KEY = 'm1rent';
const CO_FAMILY_AFFORDABILITY_WORKFLOW_KEY = 'family-affordability';
const CONSTANTS_MAINTENANCE_WORKFLOW_KEY = 'constants-maintenance';
const UNIT_TEST_DATE_ROLLER_WORKFLOW_KEY = 'unit-test-date-roller';
const MARRIAGE_CREDIT_FILE_TARGET = {
  key: 'M1MA',
  label: 'Marriage Credit',
  fileLabel: 'M1MA'
};
const HOMEOWNER_REFUND_FILE_TARGETS = [
  { key: 'M1PR_ROW', label: 'Homeowner Refund Row Table', fileLabel: 'M1PR Row' },
  { key: 'M1PR_REFUND', label: 'Homeowner Refund Table', fileLabel: 'M1PR Refund' }
];
const RENTER_REFUND_FILE_TARGETS = [
  { key: 'M1PR_ROW', label: 'Renter Refund Row Table', fileLabel: 'M1RENT Row' },
  { key: 'M1PR_REFUND', label: 'Renter Refund Table', fileLabel: 'M1RENT Refund' }
];
const CO_FAMILY_AFFORDABILITY_FILE_TARGETS = [
  { key: 'CO_FAMILY_UNDER5', label: 'Age 5 and Under Family Affordability Tax Credit Table', fileLabel: 'Under Age 5' },
  { key: 'CO_FAMILY_AGE6TO16', label: 'Age 6 to 16 Family Affordability Tax Credit Table', fileLabel: 'Age 6 to 16' }
];
const CONSTANTS_MAINTENANCE_FILE_TARGET = {
  key: 'CONSTS',
  label: 'State constants JSON',
  fileLabel: 'Consts'
};
const UNIT_TEST_DATE_ROLLER_FILE_TARGETS = [
  { key: 'TEST_ROOT', label: 'Unit test root folder', fileLabel: 'Tests' },
  { key: 'CALC_ROOT', label: 'Calc root folder', fileLabel: 'Calc' },
  { key: 'CONSTS', label: 'State constants JSON', fileLabel: 'Consts' }
];
const CO_FAMILY_STATUS_ORDER = [
  'FilingStatus.Single',
  'FilingStatus.MarriedFilingJointly',
  'FilingStatus.MarriedFilingSeparately',
  'FilingStatus.HeadOfHousehold',
  'FilingStatus.QualifyingWidow'
];
const CO_FAMILY_NON_JOINT_STATUSES = [
  'FilingStatus.Single',
  'FilingStatus.MarriedFilingSeparately',
  'FilingStatus.HeadOfHousehold',
  'FilingStatus.QualifyingWidow'
];

let appState = {
  selectedStateCode: null,
  selectedStateConfig: null,
  selectedWorkflowKey: STANDARD_WORKFLOW_KEY,
  taxYear: new Date().getFullYear(),
  filePaths: {},
  selectedPdfPath: null,
  pdfPageRangeOverride: { start: '', end: '' },
  extractedData: null,
  diffResults: null,
  marriageCreditReview: null,
  homeownerRefundReview: null,
  coFamilyAffordabilityReview: null,
  constantsMaintenanceReview: null,
  unitTestDateRollerReview: null,
  unitTestLogReview: null,
  constantsShiftDeltaYears: 1,
  constantsMaintenanceUi: {
    activeTab: 'auto'
  },
  unitTestDateRollerUi: {
    activeTab: 'ready'
  },
  unitTestLogUi: {
    activeTab: 'ready'
  },
  coFamilyAffordabilityUi: {
    activeTab: 'under5',
    statusFilters: {
      under5: 'all',
      age6to16: 'all'
    }
  },
  homeownerRefundUi: {
    activeTab: 'rowTable',
    statusFilters: {
      rowTable: 'all',
      refundTable: 'all'
    }
  },
};

async function init() {
  const states = await window.api.getAllStates();
  populateStateDropdown(states);
  populateYearDropdowns();
  bindEvents();
  if (states.length > 0) {
    document.getElementById('stateSelect').value = states[0].code;
    await onStateChange(states[0].code);
  }
}

function populateStateDropdown(states) {
  document.getElementById('stateSelect').innerHTML = states.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('');
}

function populateYearDropdowns() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 3; y--) years.push(y);
  document.getElementById('taxYearSelect').innerHTML = years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('');
  appState.taxYear = currentYear;
}

function resetExtractedState() {
  appState.extractedData = null;
  appState.diffResults = null;
  appState.marriageCreditReview = null;
  appState.homeownerRefundReview = null;
  appState.coFamilyAffordabilityReview = null;
  appState.constantsMaintenanceReview = null;
  appState.unitTestDateRollerReview = null;
  appState.unitTestLogReview = null;
  appState.constantsMaintenanceUi = {
    activeTab: 'auto'
  };
  appState.unitTestDateRollerUi = {
    activeTab: 'ready'
  };
  appState.unitTestLogUi = {
    activeTab: 'ready'
  };
  appState.coFamilyAffordabilityUi = {
    activeTab: 'under5',
    statusFilters: {
      under5: 'all',
      age6to16: 'all'
    }
  };
  appState.homeownerRefundUi = {
    activeTab: 'rowTable',
    statusFilters: {
      rowTable: 'all',
      refundTable: 'all'
    }
  };
}

function getWorkflowOptions() {
  const options = [];
  if ((appState.selectedStateConfig?.filingStatuses || []).length > 0) {
    options.push({ key: STANDARD_WORKFLOW_KEY, label: 'Standard Tax Tables', hint: 'Built-in PDF extraction for the configured tax tables.' });
  }
  if (appState.selectedStateConfig?.code === 'MN') {
    return [
      { key: STANDARD_WORKFLOW_KEY, label: 'Standard Tax Tables', hint: 'Minnesota M1 filing-status tables with diff review.' },
      { key: MARRIAGE_CREDIT_WORKFLOW_KEY, label: 'M1MA Marriage Credit', hint: 'Extract the two-key marriage-credit table, preview the full grid, then replace one JSON file.' },
      { key: HOMEOWNER_REFUND_WORKFLOW_KEY, label: 'M1PR Homeowner Refund', hint: 'Extract the row-table and refund-table grids, review both, then replace two JSON files.' },
      { key: RENTER_REFUND_WORKFLOW_KEY, label: "SchM1RENT Renter's Credit", hint: 'Extract the renter row-table and refund-table grids, review both, then replace two JSON files.' },
      { key: CONSTANTS_MAINTENANCE_WORKFLOW_KEY, label: 'Constants Maintenance', hint: 'Preview and shift all Year Over Year DateTime constants in the state constants JSON file by +1 or -1 year.' },
      { key: UNIT_TEST_DATE_ROLLER_WORKFLOW_KEY, label: 'Unit Test Date Roller', hint: 'Preview and shift DateTime and DateTime[] test values under the state unit-test folder by +1 or -1 year.' }
    ];
  }
  if (appState.selectedStateConfig?.code === 'CO') {
    return [
      { key: CO_FAMILY_AFFORDABILITY_WORKFLOW_KEY, label: 'Family Affordability Tax Credit', hint: 'Extract the two Colorado per-child credit tables, review both full grids, then replace both JSON files.' },
      { key: CONSTANTS_MAINTENANCE_WORKFLOW_KEY, label: 'Constants Maintenance', hint: 'Preview and shift all Year Over Year DateTime constants in the state constants JSON file by +1 or -1 year.' },
      { key: UNIT_TEST_DATE_ROLLER_WORKFLOW_KEY, label: 'Unit Test Date Roller', hint: 'Preview and shift DateTime and DateTime[] test values under the state unit-test folder by +1 or -1 year.' }
    ];
  }
  return [
    ...options,
    { key: CONSTANTS_MAINTENANCE_WORKFLOW_KEY, label: 'Constants Maintenance', hint: 'Preview and shift all Year Over Year DateTime constants in the state constants JSON file by +1 or -1 year.' },
    { key: UNIT_TEST_DATE_ROLLER_WORKFLOW_KEY, label: 'Unit Test Date Roller', hint: 'Preview and shift DateTime and DateTime[] test values under the state unit-test folder by +1 or -1 year.' }
  ];
}

function normalizeSelectedWorkflowKey(preferredWorkflowKey = appState.selectedWorkflowKey) {
  const options = getWorkflowOptions();
  const fallbackWorkflowKey = options[0]?.key || STANDARD_WORKFLOW_KEY;
  appState.selectedWorkflowKey = options.some(option => option.key === preferredWorkflowKey)
    ? preferredWorkflowKey
    : fallbackWorkflowKey;
  return options;
}

function isMarriageCreditWorkflow() {
  return appState.selectedStateConfig?.code === 'MN' && appState.selectedWorkflowKey === MARRIAGE_CREDIT_WORKFLOW_KEY;
}

function isHomeownerRefundWorkflow() {
  return appState.selectedStateConfig?.code === 'MN' && appState.selectedWorkflowKey === HOMEOWNER_REFUND_WORKFLOW_KEY;
}

function isRenterRefundWorkflow() {
  return appState.selectedStateConfig?.code === 'MN' && appState.selectedWorkflowKey === RENTER_REFUND_WORKFLOW_KEY;
}

function isCoFamilyAffordabilityWorkflow() {
  return appState.selectedStateConfig?.code === 'CO' && appState.selectedWorkflowKey === CO_FAMILY_AFFORDABILITY_WORKFLOW_KEY;
}

function isConstantsMaintenanceWorkflow() {
  return appState.selectedWorkflowKey === CONSTANTS_MAINTENANCE_WORKFLOW_KEY;
}

function isUnitTestDateRollerWorkflow() {
  return appState.selectedWorkflowKey === UNIT_TEST_DATE_ROLLER_WORKFLOW_KEY;
}

function getExtractButtonText(active = false) {
  if (active) {
    return isMarriageCreditWorkflow()
      ? 'Extracting Marriage Credit...'
      : isHomeownerRefundWorkflow()
        ? 'Extracting Homeowner Refund...'
        : isRenterRefundWorkflow()
          ? 'Extracting Renter Refund...'
          : isCoFamilyAffordabilityWorkflow()
            ? 'Extracting Family Affordability...'
            : (isUnitTestDateRollerWorkflow() || isConstantsMaintenanceWorkflow())
              ? 'Preparing Preview...'
              : 'Extracting...';
  }
  return isMarriageCreditWorkflow()
    ? 'Extract Marriage Credit Table'
    : isHomeownerRefundWorkflow()
      ? 'Extract Homeowner Refund Tables'
      : isRenterRefundWorkflow()
        ? 'Extract Renter Refund Tables'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Extract Family Affordability Tables'
          : isUnitTestDateRollerWorkflow()
            ? 'Preview Unit Test Updates'
            : isConstantsMaintenanceWorkflow()
              ? 'Preview Constant Year Shift'
              : 'Extract Data from PDF';
}

function getUpdateButtonText(active = false) {
  const constantsManualTab = isConstantsMaintenanceWorkflow() && appState.constantsMaintenanceUi?.activeTab === 'manual';
  if (active) {
    return isMarriageCreditWorkflow() || isHomeownerRefundWorkflow() || isRenterRefundWorkflow() || isCoFamilyAffordabilityWorkflow()
      ? 'Replacing...'
      : isUnitTestDateRollerWorkflow()
        ? 'Applying Unit Test Updates...'
        : isConstantsMaintenanceWorkflow()
          ? 'Applying Year Shift...'
          : 'Updating...';
  }
  return isMarriageCreditWorkflow()
    ? 'Replace Marriage Credit JSON'
    : isHomeownerRefundWorkflow()
      ? 'Replace Homeowner Refund JSON'
      : isRenterRefundWorkflow()
        ? 'Replace Renter Refund JSON'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Replace Family Affordability JSON'
          : isUnitTestDateRollerWorkflow()
            ? 'Apply Unit Test Updates'
            : isConstantsMaintenanceWorkflow()
              ? (constantsManualTab ? 'Apply Manual Updates' : 'Apply Year Shift')
              : 'Update JSON Files';
}

function getWorkflowStorageKey() {
  if (isMarriageCreditWorkflow()) return MARRIAGE_CREDIT_WORKFLOW_KEY;
  if (isHomeownerRefundWorkflow()) return HOMEOWNER_REFUND_WORKFLOW_KEY;
  if (isRenterRefundWorkflow()) return RENTER_REFUND_WORKFLOW_KEY;
  if (isCoFamilyAffordabilityWorkflow()) return CO_FAMILY_AFFORDABILITY_WORKFLOW_KEY;
  if (isConstantsMaintenanceWorkflow()) return CONSTANTS_MAINTENANCE_WORKFLOW_KEY;
  if (isUnitTestDateRollerWorkflow()) return UNIT_TEST_DATE_ROLLER_WORKFLOW_KEY;
  return STANDARD_WORKFLOW_KEY;
}

function getActiveFileTargets() {
  if (isMarriageCreditWorkflow()) return [MARRIAGE_CREDIT_FILE_TARGET];
  if (isHomeownerRefundWorkflow()) return HOMEOWNER_REFUND_FILE_TARGETS;
  if (isRenterRefundWorkflow()) return RENTER_REFUND_FILE_TARGETS;
  if (isCoFamilyAffordabilityWorkflow()) return CO_FAMILY_AFFORDABILITY_FILE_TARGETS;
  if (isConstantsMaintenanceWorkflow()) return [CONSTANTS_MAINTENANCE_FILE_TARGET];
  if (isUnitTestDateRollerWorkflow()) return UNIT_TEST_DATE_ROLLER_FILE_TARGETS;
  return appState.selectedStateConfig?.filingStatuses || [];
}

function renderWorkflowPicker() {
  const group = document.getElementById('workflowGroup');
  const select = document.getElementById('workflowSelect');
  const hint = document.getElementById('workflowHint');
  const options = normalizeSelectedWorkflowKey();
  if (options.length <= 1) {
    group.style.display = 'none';
    select.innerHTML = '';
    hint.textContent = '';
    select.value = appState.selectedWorkflowKey;
    return;
  }
  group.style.display = 'flex';
  select.innerHTML = options.map(option => `<option value="${option.key}" ${option.key === appState.selectedWorkflowKey ? 'selected' : ''}>${option.label}</option>`).join('');
  select.value = appState.selectedWorkflowKey;
  hint.textContent = (options.find(option => option.key === appState.selectedWorkflowKey) || options[0]).hint;
}

function renderWorkflowText() {
  const constantsWorkflow = isConstantsMaintenanceWorkflow();
  const unitTestWorkflow = isUnitTestDateRollerWorkflow();
  const constantsManualTab = constantsWorkflow && appState.constantsMaintenanceUi?.activeTab === 'manual';
  document.getElementById('constantsShiftDirectionSelect').value = String(appState.constantsShiftDeltaYears);
  document.getElementById('sourceSubtitle').textContent = isMarriageCreditWorkflow()
    ? 'Select the Minnesota Schedule M1MA instruction PDF and the page range that contains the marriage-credit table.'
    : isHomeownerRefundWorkflow()
      ? 'Select the Minnesota M1PR instruction PDF and the page range that contains the Homestead Credit Refund Table.'
      : isRenterRefundWorkflow()
        ? 'Select the Minnesota M1 instruction PDF and the page range that contains the renter credit refund tables.'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Select the Colorado DR 0104CN instruction PDF and the page range that contains the Age 5 and Under and Age 6 to 16 credit tables.'
          : unitTestWorkflow
            ? 'Review the calc root, matching unit test root, and state constants JSON for the selected year, then preview only the unit tests affected by direct constant-return calcs.'
          : constantsWorkflow
            ? 'Review the state constants JSON for the selected year, then preview both the automatic DateTime updates and the suggested manual year-over-year updates.'
            : 'Select an instruction PDF for the selected state and year.';
  document.getElementById('uploadHint').textContent = isMarriageCreditWorkflow()
    ? 'PDF only - use the page range that contains the marriage-credit table'
    : isHomeownerRefundWorkflow()
      ? 'PDF only - use the page range that contains the Homestead Credit Refund Table'
      : isRenterRefundWorkflow()
        ? 'PDF only - use the page range that contains the renter credit refund tables'
        : isCoFamilyAffordabilityWorkflow()
          ? 'PDF only - use the page range that contains both Colorado Family Affordability credit tables'
          : unitTestWorkflow
            ? 'No PDF required - use the calc root, unit test root, and constants file shown in the JSON Files list'
          : constantsWorkflow
            ? 'No PDF required - use the constants file shown in the JSON Files list'
            : 'PDF only - enter the start and end tax-table pages manually';
  document.getElementById('pageRangeHint').textContent = isMarriageCreditWorkflow()
    ? 'Enter the exact PDF pages that contain the Schedule M1MA marriage-credit table before extracting.'
    : isHomeownerRefundWorkflow()
      ? 'Enter the exact PDF pages that contain the Homestead Credit Refund Table before extracting.'
      : isRenterRefundWorkflow()
        ? 'Enter the exact PDF pages that contain the renter credit refund tables before extracting.'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Enter the exact PDF pages that contain both Colorado Family Affordability tables before extracting.'
          : unitTestWorkflow
            ? 'No PDF page range is needed for the constant-aware unit test updater.'
          : constantsWorkflow
            ? 'No PDF page range is needed for constants maintenance.'
            : 'Enter the exact tax-table pages from the selected PDF before running extraction.';
  document.getElementById('extractSectionTitle').textContent = isMarriageCreditWorkflow()
    ? 'Extract Marriage Credit Table'
    : isHomeownerRefundWorkflow()
      ? 'Extract Homeowner Refund Tables'
      : isRenterRefundWorkflow()
        ? 'Extract Renter Refund Tables'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Extract Family Affordability Tables'
          : unitTestWorkflow
          ? 'Preview Unit Test Updates'
          : constantsWorkflow
            ? 'Preview Constant Year Shift'
            : 'Extract Data';
  document.getElementById('extractSectionSubtitle').textContent = isMarriageCreditWorkflow()
    ? 'The built-in parser reads the M1MA table and prepares a full two-key preview for review.'
    : isHomeownerRefundWorkflow()
      ? 'The built-in parser reads the M1PR Homestead Credit Refund Table and prepares both review tables.'
      : isRenterRefundWorkflow()
        ? 'The built-in parser reads the M1RENT renter-credit tables and prepares both review tables.'
        : isCoFamilyAffordabilityWorkflow()
          ? 'The built-in parser reads both Colorado credit tables and prepares full review grids for each one.'
          : unitTestWorkflow
            ? 'The tool scans calc files for direct constant-return date outputs, matches them to unit tests, and proposes only the expected-value changes implied by the current constants file.'
          : constantsWorkflow
            ? 'The tool scans the constants file, auto-shifts Year Over Year DateTime values, and proposes editable updates for the other year-over-year constants.'
            : 'The built-in parser reads the selected PDF pages and extracts all income brackets.';
  document.getElementById('extractBtn').textContent = getExtractButtonText(false);
  document.getElementById('updateSectionTitle').textContent = isMarriageCreditWorkflow()
    ? 'Replace Marriage Credit JSON'
    : isHomeownerRefundWorkflow()
      ? 'Replace Homeowner Refund JSON'
      : isRenterRefundWorkflow()
        ? 'Replace Renter Refund JSON'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Replace Family Affordability JSON'
          : unitTestWorkflow
            ? 'Apply Unit Test Updates'
          : constantsWorkflow
            ? (constantsManualTab ? 'Apply Manual Updates' : 'Apply Year Shift')
            : 'Update JSON Files';
  document.getElementById('updateSectionSubtitle').textContent = isMarriageCreditWorkflow()
    ? 'Writes a full replacement MNMarriageCredit table after you review the extracted grid.'
    : isHomeownerRefundWorkflow()
      ? 'Writes full replacement M1PR row and refund tables after you review both extracted grids.'
      : isRenterRefundWorkflow()
        ? 'Writes full replacement M1PR renter row and refund tables after you review both extracted grids.'
        : isCoFamilyAffordabilityWorkflow()
          ? 'Writes full replacement Colorado Family Affordability tables after you review both extracted grids.'
          : unitTestWorkflow
            ? 'Writes only the previewed unit test expectation updates that were derived safely from direct constant-return calc dependencies.'
          : constantsWorkflow
            ? (constantsManualTab
              ? 'Writes the reviewed final values from the manual year-over-year constants tab.'
              : 'Writes the selected +1 or -1 year shift to every matching Year Over Year DateTime constant in the automatic updates tab.')
            : 'Writes new values to all filing status files. Review the diff above before proceeding.';
  document.getElementById('updateJsonBtn').textContent = getUpdateButtonText(false);
  document.getElementById('constantsShiftControls').style.display = constantsWorkflow ? 'flex' : 'none';
  const unitTestLogControls = document.getElementById('unitTestLogControls');
  if (unitTestLogControls) unitTestLogControls.style.display = unitTestWorkflow ? 'flex' : 'none';
  document.getElementById('constantsShiftHint').textContent = `Auto-updates all Year Over Year DateTime constants and proposes editable values for the other year-over-year constants. Current action: ${appState.constantsShiftDeltaYears > 0 ? 'increase year by 1' : 'decrease year by 1'}.`;
}

async function onStateChange(stateCode) {
  const previousWorkflowKey = appState.selectedWorkflowKey;
  appState.selectedStateCode = stateCode;
  appState.selectedStateConfig = await window.api.getStateConfig(stateCode);
  resetWorkflowContext(previousWorkflowKey);
  renderWorkflowPicker();
  renderWorkflowText();
  renderSelectedSource();
  await loadFilePaths();
  renderFilePickers();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
}

async function onWorkflowChange(workflowKey) {
  resetWorkflowContext(workflowKey);
  renderWorkflowPicker();
  renderWorkflowText();
  renderSelectedSource();
  await loadFilePaths();
  renderFilePickers();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
}

async function loadFilePaths() {
  appState.filePaths = await window.api.readJsonFilePaths(appState.selectedStateCode, appState.taxYear, getWorkflowStorageKey()) || {};
}

function resetWorkflowContext(preferredWorkflowKey = appState.selectedWorkflowKey) {
  normalizeSelectedWorkflowKey(preferredWorkflowKey);
  appState.filePaths = {};
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  resetExtractedState();
}

function clearTransientData() {
  appState.selectedPdfPath = null;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  resetExtractedState();
  renderWorkflowText();
  renderSelectedSource();
  renderFilePickers();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
  const extractionProgress = document.getElementById('extractionProgress');
  if (extractionProgress) extractionProgress.style.display = 'none';
  updateProgress(0, '');
  showToast('Cleared preview data for the current workflow.', 'info');
}

function renderFilePickers() {
  const targets = getActiveFileTargets();
  document.getElementById('filePickersContainer').innerHTML = targets.map(target => {
    const currentPath = appState.filePaths[target.key] || '';
    return `<div class="file-picker-row" data-key="${target.key}"><div class="file-picker-label"><span class="status-badge">${target.fileLabel}</span><span class="status-desc">${target.label}</span></div><div class="file-picker-input"><code class="path-display" id="path-${target.key}">${currentPath || 'Not selected'}</code></div></div>`;
  }).join('');
}

async function persistFilePaths() {
  await window.api.saveJsonFilePaths(appState.selectedStateCode, { stateCode: appState.selectedStateCode, regulatoryYear: appState.taxYear, filePaths: appState.filePaths }, getWorkflowStorageKey());
}

async function selectPdf() {
  const selected = await window.api.selectPdfFile();
  if (!selected) return;
  appState.selectedPdfPath = selected;
  appState.pdfPageRangeOverride = { start: '', end: '' };
  resetExtractedState();
  renderSelectedSource();
  renderExtractedDataSection();
  renderDiffSection();
  renderMarriageCreditSection();
  updateActionButtons();
}

function getEffectivePdfPageRange() {
  const start = parseInt(appState.pdfPageRangeOverride.start, 10);
  const end = parseInt(appState.pdfPageRangeOverride.end, 10);
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start ? { start, end } : null;
}

function syncPdfPageInputs() {
  document.getElementById('pdfPageStartInput').value = appState.pdfPageRangeOverride.start;
  document.getElementById('pdfPageEndInput').value = appState.pdfPageRangeOverride.end;
}

function getWorkflowPageRangeLabel() {
  if (isMarriageCreditWorkflow()) return 'Schedule M1MA pages';
  if (isHomeownerRefundWorkflow()) return 'M1PR refund-table pages';
  if (isRenterRefundWorkflow()) return 'M1RENT refund-table pages';
  if (isCoFamilyAffordabilityWorkflow()) return 'Family Affordability table pages';
  return 'Tax table pages';
}

function getPendingWorkflowPageRangeLabel() {
  if (isMarriageCreditWorkflow()) return 'Enter the Schedule M1MA table page range';
  if (isHomeownerRefundWorkflow()) return 'Enter the M1PR refund-table page range';
  if (isRenterRefundWorkflow()) return 'Enter the M1RENT refund-table page range';
  if (isCoFamilyAffordabilityWorkflow()) return 'Enter the Colorado Family Affordability table page range';
  return `Enter required PDF start/end pages for tax year ${appState.taxYear}`;
}

function renderSelectedSource() {
  const uploadArea = document.getElementById('uploadArea');
  const selectPdfBtn = document.getElementById('selectPdfBtn');
  const pdfSection = document.getElementById('pdfSelectionSection');
  const pdfSummary = document.getElementById('pdfSelectionSummary');
  if (isConstantsMaintenanceWorkflow() || isUnitTestDateRollerWorkflow()) {
    uploadArea.style.display = 'block';
    selectPdfBtn.style.display = 'none';
    pdfSection.style.display = 'none';
    pdfSummary.textContent = '';
    syncPdfPageInputs();
    return;
  }
  uploadArea.style.display = 'block';
  selectPdfBtn.style.display = '';
  if (appState.selectedPdfPath) {
    const effective = getEffectivePdfPageRange();
    pdfSection.style.display = 'block';
    syncPdfPageInputs();
    const fileName = appState.selectedPdfPath.split(/[\/\\]/).pop();
    pdfSummary.textContent = effective
      ? `PDF selected: ${fileName} | ${getWorkflowPageRangeLabel()} ${effective.start}-${effective.end}`
      : `PDF selected: ${fileName} | ${getPendingWorkflowPageRangeLabel()}`;
    return;
  }
  pdfSection.style.display = 'none';
  pdfSummary.textContent = '';
  syncPdfPageInputs();
}

function syncWideTableScrollbars(scope = document) {
  const wrappers = scope.querySelectorAll ? scope.querySelectorAll('.diff-table-wrapper') : [];
  wrappers.forEach(wrapper => {
    const table = wrapper.querySelector('table');
    if (!table) {
      return;
    }

    let mirror = wrapper.previousElementSibling;
    if (!mirror || !mirror.classList?.contains('table-scroll-sync')) {
      mirror = document.createElement('div');
      mirror.className = 'table-scroll-sync';
      mirror.innerHTML = '<div class="table-scroll-sync-inner"></div>';
      wrapper.parentNode?.insertBefore(mirror, wrapper);
    }

    const mirrorInner = mirror.firstElementChild;
    if (!mirrorInner) {
      return;
    }

    const hasHorizontalOverflow = wrapper.scrollWidth > wrapper.clientWidth + 1;
    mirror.classList.toggle('is-visible', hasHorizontalOverflow);
    mirrorInner.style.width = `${wrapper.scrollWidth}px`;

    if (wrapper.dataset.scrollSyncBound !== 'true') {
      let syncingFromWrapper = false;
      let syncingFromMirror = false;

      wrapper.addEventListener('scroll', () => {
        if (syncingFromMirror) {
          syncingFromMirror = false;
          return;
        }
        syncingFromWrapper = true;
        mirror.scrollLeft = wrapper.scrollLeft;
      });

      mirror.addEventListener('scroll', () => {
        if (syncingFromWrapper) {
          syncingFromWrapper = false;
          return;
        }
        syncingFromMirror = true;
        wrapper.scrollLeft = mirror.scrollLeft;
      });

      wrapper.dataset.scrollSyncBound = 'true';
    }

    if (!hasHorizontalOverflow) {
      wrapper.scrollLeft = 0;
      mirror.scrollLeft = 0;
    } else {
      mirror.scrollLeft = wrapper.scrollLeft;
    }
  });
}

function mergeExtractedData(existing, incoming, config, pageLabel) {
  const merged = { ...existing };
  for (const status of config.filingStatuses) {
    const currentValues = merged[status.key] ? { ...merged[status.key] } : {};
    const incomingValues = incoming[status.key] || {};
    for (const [incomeKey, value] of Object.entries(incomingValues)) {
      if (currentValues[incomeKey] !== undefined && currentValues[incomeKey] !== value) throw new Error(`Conflicting value for ${status.label} at income ${incomeKey} on ${pageLabel}. Existing value: ${currentValues[incomeKey]}, new value: ${value}.`);
      if (currentValues[incomeKey] === value) continue;
      currentValues[incomeKey] = value;
    }
    merged[status.key] = currentValues;
  }
  return merged;
}

let pdfJsLibPromise;
async function getPdfJsLib() {
  if (!pdfJsLibPromise) pdfJsLibPromise = import('./node_modules/pdfjs-dist/build/pdf.mjs');
  const pdfjsLib = await pdfJsLibPromise;
  pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs';
  return pdfjsLib;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseIntegerText(str) {
  if (typeof str !== 'string') return null;
  const clean = str.trim();
  if (!/^\d[\d,]*$/.test(clean)) return null;
  const value = parseInt(clean.replace(/,/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

function groupPdfTextItemsByRow(items, tolerance = 1.5) {
  const sorted = items.filter(item => Number.isFinite(item.x) && Number.isFinite(item.y) && item.str && item.str.trim()).sort((a, b) => Math.abs(b.y - a.y) < tolerance ? a.x - b.x : b.y - a.y);
  const rows = [];
  for (const item of sorted) {
    const row = rows.find(existing => Math.abs(existing.y - item.y) <= tolerance);
    if (row) { row.items.push(item); row.y = (row.y + item.y) / 2; } else rows.push({ y: item.y, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

function getMinnesotaPdfBlockColumnRanges(pageWidth) {
  const byRatio = (start, end) => [pageWidth * start, pageWidth * end];
  return [byRatio(0.08, 0.535), byRatio(0.53, 0.99)];
}

function findNumericItemsInRange(items, range) {
  return items.filter(item => item.x >= range[0] && item.x <= range[1]).map(item => ({ ...item, numericValue: parseIntegerText(item.str) })).filter(item => item.numericValue !== null).sort((a, b) => a.x - b.x);
}

function findMinnesotaValueWindow(numericItems) {
  for (let i = 0; i <= numericItems.length - 6; i++) {
    const window = numericItems.slice(i, i + 6);
    const [lower, upper, single, mfj, mfs, hoh] = window;
    if (lower.numericValue >= upper.numericValue) continue;
    if (window.some(item => !Number.isFinite(item.numericValue))) continue;
    return { lower, upper, single, mfj, mfs, hoh };
  }
  return null;
}

function parseMinnesotaPdfRows(textItems, pageWidth) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const parsed = [];
  for (const row of rows) for (const range of getMinnesotaPdfBlockColumnRanges(pageWidth)) {
    const numericItems = findNumericItemsInRange(row.items, range);
    if (numericItems.length < 6) continue;
    const valueWindow = findMinnesotaValueWindow(numericItems);
    if (!valueWindow) continue;
    const { lower, upper, single, mfj, mfs, hoh } = valueWindow;
    parsed.push({ income: lower.numericValue, upperIncome: upper.numericValue, values: { Single: single.numericValue, MFJ: mfj.numericValue, MFS: mfs.numericValue, HOH: hoh.numericValue } });
  }
  return parsed;
}

function normalizeDeterministicRowsToData(rows, config, lookUpTypes, pageLabel) {
  const normalized = {};
  for (const status of config.filingStatuses) normalized[status.key] = {};
  for (const row of rows) for (const status of config.filingStatuses) {
    const lookUpType = lookUpTypes[status.key] || 'LowerBoundary';
    const key = lookUpType === 'UpperBoundary' ? row.upperIncome : row.income;
    const value = row.values[status.key];
    if (!Number.isFinite(key) || !Number.isFinite(value)) throw new Error(`Deterministic parser produced invalid numeric data for ${status.label} on ${pageLabel}.`);
    if (normalized[status.key][key] !== undefined && normalized[status.key][key] !== value) throw new Error(`Deterministic parser produced conflicting ${status.label} values at income ${key} on ${pageLabel}.`);
    normalized[status.key][key] = value;
  }
  return normalized;
}

function parseOrPdfRows(textItems, pageWidth) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const blockRanges = [[pageWidth * 0.09, pageWidth * 0.29], [pageWidth * 0.30, pageWidth * 0.50], [pageWidth * 0.51, pageWidth * 0.71], [pageWidth * 0.72, pageWidth * 0.93]];
  const parsed = [];
  for (const row of rows) for (const range of blockRanges) {
    const rowText = row.items.filter(item => item.x >= range[0] && item.x <= range[1]).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!rowText) continue;
    const numbers = Array.from(rowText.matchAll(/\d[\d,]*/g)).map(match => parseInt(match[0].replace(/,/g, ''), 10));
    if (numbers.length !== 4) continue;
    const [income, upperIncome, sValue, jValue] = numbers;
    if (!(income < upperIncome)) continue;
    parsed.push({ income, upperIncome, values: { S: sValue, J: jValue } });
  }
  return parsed;
}
function getCoFamilyStatusSortIndex(status) {
  const index = CO_FAMILY_STATUS_ORDER.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortCoFamilyRows(rows) {
  return [...rows].sort((a, b) => getCoFamilyStatusSortIndex(a.filingStatus) - getCoFamilyStatusSortIndex(b.filingStatus) || a.amount - b.amount || a.value - b.value);
}

function buildCoFamilyRowKey(row) {
  return `${row.filingStatus}|${row.amount}`;
}

function parseCurrencyAmountFromText(str) {
  if (typeof str !== 'string') return null;
  const numbers = Array.from(str.matchAll(/\$?\s*(\d[\d,]*)/g)).map(match => Number(match[1].replace(/,/g, '')));
  if (numbers.length === 0) return null;
  return numbers[numbers.length - 1];
}

function parseCoFamilyAffordabilityPageRows(textItems, options) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const titleIndex = rows.findIndex(row => getRowText(row).toLowerCase().includes(options.title.toLowerCase()));
  if (titleIndex === -1) {
    return [];
  }

  const parsedRows = [];
  for (let index = titleIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    const rowText = getRowText(row);
    if (/^Line\s+\d+/i.test(rowText) && parsedRows.length > 0) break;

    const leftText = row.items.filter(item => item.x < 230).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    const jointText = row.items.filter(item => item.x >= 230 && item.x < 430).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    // Ignore the right-margin page line numbers that sit beyond the actual credit-value column.
    const valueText = row.items.filter(item => item.x >= 430 && item.x < 540).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();

    if (!leftText || !jointText || !valueText) continue;
    const value = parseCurrencyAmountFromText(valueText);
    const nonJointUpper = parseCurrencyAmountFromText(leftText);
    const jointUpper = parseCurrencyAmountFromText(jointText);
    if (!Number.isFinite(value) || !Number.isFinite(nonJointUpper) || !Number.isFinite(jointUpper)) continue;
    if (/or more/i.test(leftText) || /or more/i.test(jointText) || value === 0) continue;

    for (const filingStatus of CO_FAMILY_NON_JOINT_STATUSES) {
      parsedRows.push({ filingStatus, amount: nonJointUpper, value, source: options.source || 'pdf' });
    }
    parsedRows.push({ filingStatus: 'FilingStatus.MarriedFilingJointly', amount: jointUpper, value, source: options.source || 'pdf' });
  }

  if (parsedRows.length === 0) {
    throw new Error(`Could not parse any rows for the ${options.title} table.`);
  }

  const expectedRowCount = 15 * CO_FAMILY_STATUS_ORDER.length;
  if (parsedRows.length !== expectedRowCount) {
    throw new Error(`Expected ${expectedRowCount} rows for the ${options.title} table, found ${parsedRows.length}.`);
  }

  return sortCoFamilyRows(parsedRows);
}

function buildCoFamilyReview(extractedRows, currentTableResult = null) {
  const normalizedExtractedRows = sortCoFamilyRows(extractedRows.map(row => ({
    filingStatus: row.filingStatus,
    amount: Number(row.amount),
    value: Number(row.value),
    source: row.source || 'pdf'
  })));
  const currentRows = currentTableResult?.success ? sortCoFamilyRows(currentTableResult.rows.map(row => ({
    filingStatus: row.filingStatus,
    amount: Number(row.amount),
    value: Number(row.value)
  }))) : [];
  const currentByKey = new Map(currentRows.map(row => [buildCoFamilyRowKey(row), row]));
  let changedCount = 0;
  let unchangedCount = 0;
  let newCount = 0;

  const reviewRows = normalizedExtractedRows.map(row => {
    const current = currentByKey.get(buildCoFamilyRowKey(row));
    let reviewStatus = 'new';
    if (current) {
      if (Number(current.value) === Number(row.value)) { reviewStatus = 'match'; unchangedCount++; }
      else { reviewStatus = 'changed'; changedCount++; }
    } else newCount++;
    return { ...row, currentValue: current ? Number(current.value) : null, reviewStatus };
  });

  const combinedKeys = new Set(reviewRows.map(buildCoFamilyRowKey));
  const missingCount = currentRows.filter(row => !combinedKeys.has(buildCoFamilyRowKey(row))).length;

  return {
    rows: reviewRows,
    extractedCount: normalizedExtractedRows.length,
    currentCount: currentRows.length,
    changedCount,
    unchangedCount,
    newCount,
    missingCount,
    currentYear: currentTableResult?.year || null
  };
}

function getCoFamilyReviewRows(review, statusFilter) {
  if (!review?.rows) return [];
  if (!statusFilter || statusFilter === 'all') return review.rows;
  return review.rows.filter(row => row.reviewStatus === statusFilter);
}

function ensureCoFamilyUiState() {
  if (appState.coFamilyAffordabilityUi) return;
  appState.coFamilyAffordabilityUi = {
    activeTab: 'under5',
    statusFilters: {
      under5: 'all',
      age6to16: 'all'
    }
  };
}

function showCoFamilyReviewTab(tabKey) {
  ensureCoFamilyUiState();
  appState.coFamilyAffordabilityUi.activeTab = tabKey;
  renderMarriageCreditSection();
}

function getCoFamilyReviewStatusLabel(row) {
  if (row.reviewStatus === 'changed') return 'Changed';
  if (row.reviewStatus === 'match') return 'Match';
  return 'New';
}

function getCoFamilyReviewStatusClass(row) {
  if (row.reviewStatus === 'changed') return 'badge-changed';
  if (row.reviewStatus === 'match') return 'badge-ok';
  return 'badge-accent';
}

function renderCoFamilyReviewTable(review, options) {
  ensureCoFamilyUiState();
  const activeFilter = appState.coFamilyAffordabilityUi.statusFilters[options.filterKey] || 'all';
  const filteredRows = getCoFamilyReviewRows(review, activeFilter);
  const rowsHtml = filteredRows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.filingStatus}</td><td>${row.amount.toLocaleString()}</td><td>${row.value.toLocaleString()}</td><td><span class="diff-badge ${getCoFamilyReviewStatusClass(row)}">${getCoFamilyReviewStatusLabel(row)}</span></td></tr>`).join('');
  const emptyHtml = `<div class="diff-empty">No rows match the current status filter.</div>`;
  return `<div class="content-section"><div class="section-header"><div><h2 class="section-title">${options.title}</h2><p class="section-subtitle">${options.subtitle}</p></div><div class="review-toolbar">${renderGenericStatusFilter(options.filterKey, activeFilter)}</div></div><div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${filteredRows.length}</span><span class="diff-stat-label">Visible rows</span></div><div class="diff-stat"><span class="diff-stat-value">${review.rows.length}</span><span class="diff-stat-label">Preview rows</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.extractedCount}</span><span class="diff-stat-label">Extracted from PDF</span></div><div class="diff-stat"><span class="diff-stat-value ${review.changedCount > 0 ? 'changed' : 'ok'}">${review.changedCount}</span><span class="diff-stat-label">Changed vs file</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.unchangedCount}</span><span class="diff-stat-label">Unchanged vs file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.missingCount > 0 ? 'warn' : 'ok'}">${review.missingCount}</span><span class="diff-stat-label">Still missing</span></div>${review.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${review.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div>${filteredRows.length === 0 ? emptyHtml : `<div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th><th>FilingStatus</th><th>USAmount</th><th>Value</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`}</div>`;
}
function getRowText(row) {
  return row.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
}

function getRowNumericValues(row) {
  return row.items.map(item => parseIntegerText(item.str)).filter(value => value !== null);
}

function isStrictlyAscending(values) {
  for (let i = 1; i < values.length; i++) if (values[i] <= values[i - 1]) return false;
  return true;
}

function flattenMarriageCreditRows(jointLowerBounds, matrixRows) {
  const rowsFlat = [];
  for (const matrixRow of matrixRows) {
    jointLowerBounds.forEach((jointLower, index) => {
      rowsFlat.push({
        separateIncome: matrixRow.separateLower,
        jointIncome: jointLower,
        value: matrixRow.values[index],
        source: 'pdf'
      });
    });
  }
  return { jointLowerBounds, matrixRows, rows: rowsFlat };
}

function parseMarriageCreditPdfRows(textItems) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));

  const amountLabelIndex = rows.findIndex(row => {
    const rowText = getRowText(row).toLowerCase();
    return rowText.includes('credit') && rowText.includes('amount');
  });

  if (amountLabelIndex === -1) {
    throw new Error('Could not locate the start of the marriage-credit data rows.');
  }

  let lowerHeaderIndex = -1;
  for (let index = amountLabelIndex - 1; index >= 0; index--) {
    const numbers = getRowNumericValues(rows[index]);
    if (numbers.length >= 15 && isStrictlyAscending(numbers.slice(0, 15)) && numbers[0] >= 40000) {
      lowerHeaderIndex = index;
      break;
    }
  }

  if (lowerHeaderIndex === -1) {
    throw new Error('Could not locate the marriage-credit joint-income header row.');
  }

  const jointLowerBounds = getRowNumericValues(rows[lowerHeaderIndex]).slice(0, 15);
  if (jointLowerBounds.length !== 15) {
    throw new Error(`Expected 15 joint-income brackets, found ${jointLowerBounds.length}.`);
  }

  const matrixRows = [];
  for (let index = amountLabelIndex + 1; index < rows.length; index++) {
    const numbers = getRowNumericValues(rows[index]);
    if (numbers.length < jointLowerBounds.length + 2) continue;

    const separateLower = numbers[0];
    const separateUpper = numbers[1];
    const values = numbers.slice(2, 2 + jointLowerBounds.length);

    if (!(separateLower < separateUpper) || values.length !== jointLowerBounds.length) continue;

    matrixRows.push({ separateLower, separateUpper, values });
  }

  if (matrixRows.length === 0) {
    throw new Error('Deterministic parser found no marriage-credit data rows.');
  }

  return flattenMarriageCreditRows(jointLowerBounds, matrixRows);
}

function parseMarriageCreditFromFullText(textItems) {
  const joinedText = textItems
    .map(item => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const anchorMatch = joinedText.match(/and line 7 is at least:\s*(.*?)\s*your credit amount is:/i);
  if (!anchorMatch) {
    throw new Error('Could not locate the marriage-credit header text block.');
  }

  const headerNumbers = Array.from(anchorMatch[1].matchAll(/\d[\d,]*/g))
    .map(match => parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite);
  const jointLowerBounds = headerNumbers.slice(0, 15);

  if (jointLowerBounds.length !== 15) {
    throw new Error(`Expected 15 joint-income brackets in full text, found ${jointLowerBounds.length}.`);
  }

  const bodyMatch = joinedText.match(/your credit amount is:\s*(.*?)(?:202\d\s+Schedule\s+M1MA\s+Instructions|$)/i);
  if (!bodyMatch) {
    throw new Error('Could not locate the marriage-credit table body text.');
  }

  const bodyNumbers = Array.from(bodyMatch[1].matchAll(/\d[\d,]*/g))
    .map(match => parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite);

  const matrixRows = [];
  const rowWidth = 17;
  for (let index = 0; index + rowWidth <= bodyNumbers.length; index += rowWidth) {
    const slice = bodyNumbers.slice(index, index + rowWidth);
    const separateLower = slice[0];
    const separateUpper = slice[1];
    const values = slice.slice(2);

    if (!(separateLower < separateUpper) || values.length !== 15) {
      break;
    }

    matrixRows.push({ separateLower, separateUpper, values });
  }

  if (matrixRows.length === 0) {
    throw new Error('Deterministic parser found no marriage-credit rows in the full text stream.');
  }

  return flattenMarriageCreditRows(jointLowerBounds, matrixRows);
}

function isSequentialStep(values, step) {
  if (values.length < 2) return false;
  for (let index = 1; index < values.length; index++) if (values[index] - values[index - 1] !== step) return false;
  return true;
}

function looksLikeRefundAmountHeader(values, options = {}) {
  const minAmountColumns = Number.isFinite(options.minAmountColumns) ? options.minAmountColumns : 5;
  const maxAmountColumns = Number.isFinite(options.maxAmountColumns) ? options.maxAmountColumns : 12;
  return values.length >= minAmountColumns && values.length <= maxAmountColumns && values[0] >= 0 && isSequentialStep(values, 25);
}

function parseRefundPageRows(textItems, options = {}) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const parsedRows = [];
  const finalStarAmount = Number(options.finalStarAmount);
  const errorLabel = options.errorLabel || 'refund';

  for (let index = 0; index < rows.length; index++) {
    const amountStarts = getRowNumericValues(rows[index]);
    if (!looksLikeRefundAmountHeader(amountStarts, options)) continue;

    let upperHeaderIndex = -1;
    for (let candidate = index + 1; candidate <= Math.min(rows.length - 1, index + 8); candidate++) {
      const amountEnds = getRowNumericValues(rows[candidate]);
      const rowText = getRowText(rows[candidate]).toLowerCase();
      const matchingNumericValues = amountEnds.length === amountStarts.length || amountEnds.length === amountStarts.length - 1;
      if (!matchingNumericValues) continue;
      if (!amountEnds.every((value, amountIndex) => value === amountStarts[amountIndex] + 25)) continue;
      if (amountEnds.length !== amountStarts.length && !rowText.includes('&') && !rowText.includes('and up')) continue;
      upperHeaderIndex = candidate;
      break;
    }

    if (upperHeaderIndex === -1) continue;

    let lastDataIndex = upperHeaderIndex;
    for (let rowIndex = upperHeaderIndex + 1; rowIndex < rows.length; rowIndex++) {
      const rowText = getRowText(rows[rowIndex]);
      const rowTextLower = rowText.toLowerCase();
      const numericValues = getRowNumericValues(rows[rowIndex]);

      if (looksLikeRefundAmountHeader(numericValues, options)) break;
      if (rowTextLower.includes('refund worksheet')) break;
      if (rowTextLower.includes('refund table') && numericValues.length === 0) {
        if (parsedRows.length > 0) break;
        continue;
      }
      if (numericValues.length < amountStarts.length + 1) continue;

      const rowLower = numericValues[0];
      const truncatedByWorksheetMarker = rowText.includes('*');
      let hasNumericUpper = numericValues.length >= amountStarts.length + 2 || (truncatedByWorksheetMarker && numericValues.length >= amountStarts.length + 1);
      let rowUpper = hasNumericUpper ? numericValues[1] : null;
      const values = numericValues.slice(hasNumericUpper ? 2 : 1, (hasNumericUpper ? 2 : 1) + amountStarts.length);
      const isFinalAmountSegment = Number.isFinite(finalStarAmount) && amountStarts[amountStarts.length - 1] === finalStarAmount;
      const hasSuspiciousTrailingValue = isFinalAmountSegment && values.length === amountStarts.length && values.length > 1 && values[values.length - 1] < values[values.length - 2];
      const hasImplausiblyLargeTrailingValue = isFinalAmountSegment && values.length === amountStarts.length && values.length > 1 && values[values.length - 1] > values[values.length - 2] + 500;
      const misreadUpperLooksLikeFirstRefund = hasSuspiciousTrailingValue && hasNumericUpper && Number.isFinite(rowUpper) && values.length > 0 && Math.abs(values[0] - rowUpper - 22) <= 3;
      let alignedValues = truncatedByWorksheetMarker && values.length === amountStarts.length - 1
        ? [...values, 99999]
        : values;
      let starValueIndices = truncatedByWorksheetMarker && values.length === amountStarts.length - 1
        ? [amountStarts.length - 1]
        : [];

      if (misreadUpperLooksLikeFirstRefund) {
        alignedValues = [rowUpper, ...values.slice(0, -1), 99999];
        starValueIndices = [amountStarts.length - 1];
        hasNumericUpper = false;
        rowUpper = null;
      } else if (hasSuspiciousTrailingValue || hasImplausiblyLargeTrailingValue) {
        alignedValues = [...values.slice(0, -1), 99999];
        starValueIndices = [amountStarts.length - 1];
      }

      if (alignedValues.length !== amountStarts.length) continue;
      if (hasNumericUpper && !(rowLower < rowUpper)) continue;

      parsedRows.push({ rowLower, rowUpper, amountStarts, values: alignedValues, starValueIndices });
      lastDataIndex = rowIndex;
    }

    index = lastDataIndex;
  }

  if (parsedRows.length === 0) {
    throw new Error('Deterministic parser found no ' + errorLabel + ' rows in the selected page.');
  }

  return parsedRows;
}

function parseHomeownerRefundPageRows(textItems) {
  return parseRefundPageRows(textItems, {
    finalStarAmount: 3500,
    errorLabel: 'homeowner-refund'
  });
}

function parseRenterRefundPageRows(textItems) {
  const rows = groupPdfTextItemsByRow(textItems.map(item => ({ str: 'str' in item ? item.str : '', x: item.transform?.[4], y: item.transform?.[5] })));
  const parsedRows = [];
  const finalStarAmount = 2500;

  function parseRenterHeaderAmount(str) {
    if (typeof str !== 'string') return null;
    const clean = str.trim();
    if (!/^\$\s*\d[\d,]*$/.test(clean) && !/^\d[\d,]*$/.test(clean)) return null;
    const value = parseInt(clean.replace(/[\$,\s]/g, ''), 10);
    return Number.isFinite(value) ? value : null;
  }

  function getRenterHeaderValues(row) {
    return row.items.map(item => parseRenterHeaderAmount(item.str)).filter(value => value !== null);
  }

  function findRenterAmountHeaderWindow(values, options = {}) {
    const minLength = options.minLength || 3;
    let bestWindow = null;

    for (let start = 0; start < values.length; start++) {
      let end = start;
      while (end + 1 < values.length && values[end + 1] - values[end] === 25 && values[end + 1] <= finalStarAmount) end++;
      const window = values.slice(start, end + 1);
      if (window.length < minLength) continue;
      const candidate = { values: window, score: (window[0] === 0 ? 1000 : 0) + window.length };
      if (!bestWindow || candidate.score > bestWindow.score) bestWindow = candidate;
    }

    return bestWindow?.values || null;
  }

  for (let index = 0; index < rows.length; index++) {
    const rowHeaderValues = getRenterHeaderValues(rows[index]);
    const amountStarts = findRenterAmountHeaderWindow(rowHeaderValues, { minLength: 3 });
    if (!amountStarts) continue;

    let upperHeaderIndex = -1;
    for (let candidate = index + 1; candidate <= Math.min(rows.length - 1, index + 8); candidate++) {
      const amountEnds = findRenterAmountHeaderWindow(getRenterHeaderValues(rows[candidate]), { minLength: Math.max(3, amountStarts.length - 1) });
      const rowText = getRowText(rows[candidate]).toLowerCase();
      if (!amountEnds) continue;
      const matchingNumericValues = amountEnds.length === amountStarts.length || amountEnds.length === amountStarts.length - 1;
      if (!matchingNumericValues) continue;
      if (!amountEnds.every((value, amountIndex) => value === amountStarts[amountIndex] + 25)) continue;
      if (amountEnds.length !== amountStarts.length && !rowText.includes('&') && !rowText.includes('and up')) continue;
      upperHeaderIndex = candidate;
      break;
    }

    let lastDataIndex = upperHeaderIndex >= 0 ? upperHeaderIndex : index;
    for (let rowIndex = (upperHeaderIndex >= 0 ? upperHeaderIndex + 1 : index + 1); rowIndex < rows.length; rowIndex++) {
      const rowText = getRowText(rows[rowIndex]);
      const rowTextLower = rowText.toLowerCase();
      const numericValues = getRowNumericValues(rows[rowIndex]);

      if (findRenterAmountHeaderWindow(getRenterHeaderValues(rows[rowIndex]), { minLength: Math.max(3, amountStarts.length - 1) })) break;
      if (rowTextLower.includes('refund worksheet')) break;
      if ((rowTextLower.includes("renter's credit") || rowTextLower.includes('renter refund') || rowTextLower.includes('refund table')) && numericValues.length === 0) {
        if (parsedRows.length > 0) break;
        continue;
      }
      if (numericValues.length < amountStarts.length + 1) continue;

      const truncatedByWorksheetMarker = rowText.includes('*');
      const tryCandidate = (offset, requireUpper) => {
        const rowLower = numericValues[0];
        const rowUpper = requireUpper ? numericValues[1] : null;
        let values = numericValues.slice(offset, offset + amountStarts.length);
        let starValueIndices = [];
        if (truncatedByWorksheetMarker && values.length === amountStarts.length - 1) {
          values = [...values, 99999];
          starValueIndices = [amountStarts.length - 1];
        }
        if (values.length !== amountStarts.length) return null;

        const isFinalAmountSegment = amountStarts[amountStarts.length - 1] === finalStarAmount;
        const hasSuspiciousTrailingValue = isFinalAmountSegment && values.length > 1 && values[values.length - 1] < values[values.length - 2];
        const hasImplausiblyLargeTrailingValue = isFinalAmountSegment && values.length > 1 && values[values.length - 1] > values[values.length - 2] + 500;
        if (hasSuspiciousTrailingValue || hasImplausiblyLargeTrailingValue) {
          values = [...values.slice(0, -1), 99999];
          starValueIndices = [amountStarts.length - 1];
        }

        if (requireUpper && !(rowLower < rowUpper)) return null;
        return { rowLower, rowUpper, amountStarts, values, starValueIndices };
      };

      const hasPotentialUpper = numericValues.length >= amountStarts.length + 1 && numericValues.length > 1 && numericValues[0] < numericValues[1];
      const withUpper = hasPotentialUpper ? tryCandidate(2, true) : null;
      const withoutUpper = tryCandidate(1, false);
      const chosen = withUpper || withoutUpper;
      if (!chosen) continue;

      parsedRows.push(chosen);
      lastDataIndex = rowIndex;
    }

    index = lastDataIndex;
  }

  if (parsedRows.length === 0) {
    throw new Error('Deterministic parser found no renter-refund rows in the selected page.');
  }

  return parsedRows;
}

function sortGenericTableRows(rows) {
  return [...rows].sort((a, b) => {
    const maxLength = Math.max(a.key.length, b.key.length);
    for (let index = 0; index < maxLength; index++) {
      const left = a.key[index] ?? Number.NEGATIVE_INFINITY;
      const right = b.key[index] ?? Number.NEGATIVE_INFINITY;
      if (left !== right) return left - right;
    }
    return Number(a.value) - Number(b.value);
  });
}

function buildGenericTableKey(row) {
  return row.key.join('|');
}

function buildGenericTableReview(extractedRows, currentTableResult = null, options = {}) {
  const normalizedExtractedRows = sortGenericTableRows(extractedRows.map(row => ({
    ...row,
    key: row.key.map(part => Number(part)),
    value: Number(row.value),
    source: row.source || 'pdf'
  })));
  const currentRows = currentTableResult?.success ? sortGenericTableRows(currentTableResult.rows.map(row => ({ key: row.key.map(part => Number(part)), value: Number(row.value) }))) : [];
  const currentByKey = new Map(currentRows.map(row => [buildGenericTableKey(row), row]));
  let changedCount = 0;
  let unchangedCount = 0;
  let newCount = 0;

  const reviewRows = normalizedExtractedRows.map(row => {
    const current = currentByKey.get(buildGenericTableKey(row));
    let reviewStatus = 'new';
    if (current) {
      if (Number(current.value) === Number(row.value)) { reviewStatus = 'match'; unchangedCount++; }
      else { reviewStatus = 'changed'; changedCount++; }
    } else newCount++;
    return { ...row, currentValue: current ? Number(current.value) : null, reviewStatus };
  });

  const combinedKeys = new Set(reviewRows.map(buildGenericTableKey));
  const missingCount = currentRows.filter(row => !combinedKeys.has(buildGenericTableKey(row))).length;

  return {
    rows: reviewRows,
    extractedCount: options.extractedCountOverride ?? normalizedExtractedRows.length,
    currentCount: currentRows.length,
    changedCount,
    unchangedCount,
    newCount,
    missingCount,
    currentYear: currentTableResult?.year || null
  };
}

function overlayGenericTableRows(currentRows, extractedRows) {
  const rowMap = new Map((currentRows || []).map(row => [buildGenericTableKey(row), { ...row, key: [...row.key], value: Number(row.value) }]));
  for (const row of extractedRows) rowMap.set(buildGenericTableKey(row), { ...row, key: [...row.key], value: Number(row.value) });
  return sortGenericTableRows([...rowMap.values()]);
}

function normalizeRefundJsonRows(rows) {
  return rows.map(row => ({
    key: [...row.key],
    value: row.isStarValue ? 99999 : Number(row.value)
  }));
}

function normalizeHomeownerRefundJsonRows(rows) {
  return normalizeRefundJsonRows(rows);
}

function buildRefundTables(parsedRows, options = {}) {
  const rowNumberByLower = new Map();
  const rowLowers = [];
  const firstRowLowerBoundary = Number(options.firstRowLowerBoundary);
  const finalStarAmount = Number(options.finalStarAmount);

  for (const parsedRow of parsedRows) {
    if (!rowNumberByLower.has(parsedRow.rowLower)) {
      rowNumberByLower.set(parsedRow.rowLower, rowNumberByLower.size + 1);
      rowLowers.push(parsedRow.rowLower);
    }
  }

  const rowTableRows = rowLowers.map((rowLower, index) => ({
    key: [index === 0 ? firstRowLowerBoundary : rowLower],
    value: index + 1
  }));

  const refundRows = [];
  for (let parsedRowIndex = 0; parsedRowIndex < parsedRows.length; parsedRowIndex++) {
    const parsedRow = parsedRows[parsedRowIndex];
    const nextParsedRow = parsedRows[parsedRowIndex + 1] || null;
    const rowNumber = rowNumberByLower.get(parsedRow.rowLower);
    parsedRow.amountStarts.forEach((amountStart, amountIndex) => {
      const isLastAmountColumn = amountIndex === parsedRow.amountStarts.length - 1;
      const leaksNextRowBoundary = isLastAmountColumn && amountStart === finalStarAmount && nextParsedRow && Number(parsedRow.values[amountIndex]) === Number(nextParsedRow.rowLower);
      const isStarValue = parsedRow.starValueIndices?.includes(amountIndex)
        || Number(parsedRow.values[amountIndex]) === 99999
        || leaksNextRowBoundary;
      refundRows.push({
        key: [rowNumber, amountStart],
        value: isStarValue ? 99999 : parsedRow.values[amountIndex],
        isStarValue
      });
    });
  }

  return {
    rowTableRows: sortGenericTableRows(rowTableRows),
    refundRows: sortGenericTableRows(refundRows)
  };
}

function buildHomeownerRefundTables(parsedRows) {
  return buildRefundTables(parsedRows, {
    firstRowLowerBoundary: -1000000,
    finalStarAmount: 3500
  });
}

function buildRenterRefundTables(parsedRows) {
  return buildRefundTables(parsedRows, {
    firstRowLowerBoundary: -100000,
    finalStarAmount: 2500
  });
}

async function extractRefundFromPdf(filePath, pageRange, options = {}) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let parsedRows = [];
  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error('Configured PDF page ' + pageNo + ' is outside the document range (1-' + pdf.numPages + ').');
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), 'Parsing ' + (options.progressLabel || 'refund') + ' page ' + pageNo + '...');
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    parsedRows = parsedRows.concat(options.parseRows(textContent.items));
  }
  if (parsedRows.length === 0) throw new Error('Deterministic parser found no ' + (options.errorLabel || 'refund') + ' rows in the selected page range.');
  return options.buildTables(parsedRows);
}

async function extractHomeownerRefundFromPdf(filePath, pageRange) {
  return extractRefundFromPdf(filePath, pageRange, {
    progressLabel: 'M1PR homeowner',
    errorLabel: 'homeowner-refund',
    parseRows: parseHomeownerRefundPageRows,
    buildTables: buildHomeownerRefundTables
  });
}

async function extractRenterRefundFromPdf(filePath, pageRange) {
  return extractRefundFromPdf(filePath, pageRange, {
    progressLabel: 'M1RENT renter',
    errorLabel: 'renter-refund',
    parseRows: parseRenterRefundPageRows,
    buildTables: buildRenterRefundTables
  });
}

async function extractCoFamilyAffordabilityFromPdf(filePath, pageRange) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let under5Rows = [];
  let age6to16Rows = [];

  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), `Parsing Colorado Family Affordability page ${pageNo}...`);
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    under5Rows = under5Rows.concat(parseCoFamilyAffordabilityPageRows(textContent.items, { title: 'Age 5 and Under Family Affordability Tax Credit Table' }));
    age6to16Rows = age6to16Rows.concat(parseCoFamilyAffordabilityPageRows(textContent.items, { title: 'Age 6 to 16 Family Affordability Tax Credit Table' }));
  }

  if (under5Rows.length === 0) throw new Error('Deterministic parser found no Age 5 and Under Family Affordability rows in the selected page range.');
  if (age6to16Rows.length === 0) throw new Error('Deterministic parser found no Age 6 to 16 Family Affordability rows in the selected page range.');

  return {
    under5Rows: sortCoFamilyRows(under5Rows),
    age6to16Rows: sortCoFamilyRows(age6to16Rows)
  };
}
async function extractPdfDeterministically(filePath, pageRange, config, lookUpTypes) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let mergedData = {};
  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), `Parsing ${config.name} PDF page ${pageNo}...`);
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const rows = config.code === 'MN' ? parseMinnesotaPdfRows(textContent.items, viewport.width) : parseOrPdfRows(textContent.items, viewport.width);
    if (rows.length === 0) throw new Error(`Deterministic parser found no tax table rows on page ${pageNo}.`);
    mergedData = mergeExtractedData(mergedData, normalizeDeterministicRowsToData(rows, config, lookUpTypes, `page ${pageNo}`), config, `page ${pageNo}`);
  }
  return mergedData;
}

async function extractMarriageCreditFromPdf(filePath, pageRange) {
  const fileResult = await window.api.readBinaryFileAsBase64(filePath);
  if (!fileResult.success) throw new Error(fileResult.message || 'Failed to read selected PDF.');
  const pdfjsLib = await getPdfJsLib();
  const pdf = await pdfjsLib.getDocument({ data: base64ToUint8Array(fileResult.base64) }).promise;
  let extractedRows = [];
  for (let pageNo = pageRange.start; pageNo <= pageRange.end; pageNo++) {
    if (pageNo < 1 || pageNo > pdf.numPages) throw new Error(`Configured PDF page ${pageNo} is outside the document range (1-${pdf.numPages}).`);
    updateProgress(20 + Math.floor(((pageNo - pageRange.start) / Math.max(1, pageRange.end - pageRange.start + 1)) * 55), `Parsing Schedule M1MA page ${pageNo}...`);
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    let parsedPage;
    try {
      parsedPage = parseMarriageCreditPdfRows(textContent.items);
    } catch (rowError) {
      parsedPage = parseMarriageCreditFromFullText(textContent.items);
    }
    extractedRows = extractedRows.concat(parsedPage.rows);
  }
  if (extractedRows.length === 0) throw new Error('Deterministic parser found no marriage-credit rows in the selected page range.');
  return { rows: sortMarriageCreditRows(extractedRows) };
}

function sortMarriageCreditRows(rows) {
  return [...rows].sort((a, b) => a.separateIncome - b.separateIncome || a.jointIncome - b.jointIncome);
}

function buildMarriageCreditKey(row) {
  return `${row.separateIncome}|${row.jointIncome}`;
}

function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function buildMarriageCreditReview(extractedRows, currentTableResult = null) {
  const extractedOnlyRows = sortMarriageCreditRows(extractedRows.map(row => ({ separateIncome: Number(row.separateIncome), jointIncome: Number(row.jointIncome), value: Number(row.value), source: row.source || 'pdf' })));
  const extractedByKey = new Map(extractedOnlyRows.map(row => [buildMarriageCreditKey(row), row]));
  const currentRows = currentTableResult?.success ? sortMarriageCreditRows(currentTableResult.rows) : [];
  const currentByKey = new Map(currentRows.map(row => [buildMarriageCreditKey(row), row]));
  const warnings = [];
  const carriedRows = [];
  const missingCurrentRows = currentRows.filter(row => !extractedByKey.has(buildMarriageCreditKey(row)));

  if (missingCurrentRows.length > 0) {
    const currentSeparateBrackets = getUniqueSorted(currentRows.map(row => row.separateIncome));
    const highestSeparateIncome = currentSeparateBrackets[currentSeparateBrackets.length - 1];
    const topBracketRows = currentRows.filter(row => row.separateIncome === highestSeparateIncome);
    const missingOnlyTopBracket = missingCurrentRows.length === topBracketRows.length && missingCurrentRows.every(row => row.separateIncome === highestSeparateIncome);
    if (missingOnlyTopBracket) {
      carriedRows.push(...topBracketRows.map(row => ({ ...row, source: 'existing-file' })));
      warnings.push(`PDF text extraction did not return the ${highestSeparateIncome.toLocaleString()} separate-income bracket. The preview carries forward ${topBracketRows.length} row(s) from the current JSON so you can review the final table before replace.`);
    } else {
      warnings.push(`PDF extraction missed ${missingCurrentRows.length} row(s) that exist in the current JSON. Those rows were not auto-filled because the missing pattern was not limited to the final bracket.`);
    }
  }

  const rows = sortMarriageCreditRows([...extractedOnlyRows, ...carriedRows]);
  let changedCount = 0;
  let unchangedCount = 0;
  let newCount = 0;
  const reviewRows = rows.map(row => {
    const current = currentByKey.get(buildMarriageCreditKey(row));
    let reviewStatus = 'new';
    if (current) {
      if (Number(current.value) === Number(row.value)) { reviewStatus = 'match'; unchangedCount++; }
      else { reviewStatus = 'changed'; changedCount++; }
    } else newCount++;
    return { ...row, currentValue: current ? Number(current.value) : null, reviewStatus };
  });
  const combinedKeys = new Set(reviewRows.map(buildMarriageCreditKey));
  const missingCount = currentRows.filter(row => !combinedKeys.has(buildMarriageCreditKey(row))).length;
  return { rows: reviewRows, extractedCount: extractedOnlyRows.length, carriedCount: carriedRows.length, currentCount: currentRows.length, changedCount, unchangedCount, newCount, missingCount, warnings, currentYear: currentTableResult?.year || null };
}

function getMarriageCreditStatusLabel(row) {
  if (row.source === 'existing-file') return 'Carried';
  if (row.reviewStatus === 'changed') return 'Changed';
  if (row.reviewStatus === 'match') return 'Match';
  return 'New';
}

function getMarriageCreditStatusClass(row) {
  if (row.source === 'existing-file') return 'badge-warn';
  if (row.reviewStatus === 'changed') return 'badge-changed';
  if (row.reviewStatus === 'match') return 'badge-ok';
  return 'badge-accent';
}

function shiftDateTimeValueByYears(dateValue, deltaYears) {
  if (typeof dateValue !== 'string') {
    throw new Error('Expected a DateTime string value.');
  }

  const match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid DateTime value: ${dateValue}`);
  }

  const shifted = new Date(Date.UTC(Number(match[1]) + Number(deltaYears), Number(match[2]) - 1, Number(match[3])));
  return [
    String(shifted.getUTCFullYear()).padStart(4, '0'),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function shiftCompactMonthYear(value, deltaYears) {
  const match = String(value).trim().match(/^(0[1-9]|1[0-2])(\d{2})$/);
  if (!match) return null;
  const shiftedYear = Number(match[2]) + Number(deltaYears);
  if (shiftedYear < 0 || shiftedYear > 99) return null;
  return `${match[1]}${String(shiftedYear).padStart(2, '0')}`;
}

function shiftEmbeddedYearText(value, deltaYears) {
  const matches = String(value).match(/\b\d{4}\b/g);
  if (!matches || matches.length !== 1) return null;
  return String(value).replace(/\b\d{4}\b/, String(Number(matches[0]) + Number(deltaYears)));
}

function shiftTrailingYearCode(value, deltaYears) {
  const text = String(value).trim();
  const match = text.match(/^([A-Za-z][A-Za-z0-9_-]*?)(\d{4})$/);
  if (!match) return null;
  return `${match[1]}${String(Number(match[2]) + Number(deltaYears))}`;
}

function shiftContextualTwoDigitYear(value, deltaYears, context = {}) {
  const text = String(value ?? '').trim();
  if (!/^\d{2}$/.test(text)) {
    return null;
  }

  const contextText = `${context.name || ''} ${context.description || ''}`.toLowerCase();
  const looksLikeYearField = /\byear\b/.test(contextText) || /\(yy\)/.test(contextText) || /\byy\b/.test(contextText);
  if (!looksLikeYearField) {
    return null;
  }

  const shiftedYear = Number(text) + Number(deltaYears);
  if (shiftedYear < 0 || shiftedYear > 99) {
    return null;
  }

  return String(shiftedYear).padStart(2, '0');
}

function shiftSlashMonthYear(value, deltaYears) {
  const match = String(value).trim().match(/^(0?[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return null;
  const shiftedYear = Number(match[2]) + Number(deltaYears);
  if (shiftedYear < 0 || shiftedYear > 99) return null;
  return `${match[1]}/${String(shiftedYear).padStart(2, '0')}`;
}

function shiftDateLikeStringByYears(value, deltaYears) {
  const text = String(value).trim();
  const patterns = [
    { regex: /^(\d{4})(\d{2})(\d{2})$/, format: 'compact-iso-date' },
    { regex: /^(\d{2})(\d{2})(\d{4})$/, format: 'compact-us-date' },
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'iso-date' },
    { regex: /^(\d{4})-(\d{2})-(\d{2})(T.+)$/, format: 'iso-datetime' },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: 'slash-date' },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{2})$/, format: 'dash-short-year' },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, format: 'slash-short-year' }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) {
      continue;
    }

    let year;
    let month;
    let day;
    let suffix = '';

    if (pattern.format === 'compact-iso-date') {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else if (pattern.format === 'compact-us-date') {
      month = Number(match[1]);
      day = Number(match[2]);
      year = Number(match[3]);
    } else if (pattern.format === 'iso-date' || pattern.format === 'iso-datetime') {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
      suffix = pattern.format === 'iso-datetime' ? (match[4] || '') : '';
    } else if (pattern.format === 'slash-date') {
      month = Number(match[1]);
      day = Number(match[2]);
      year = Number(match[3]);
    } else {
      month = Number(match[1]);
      day = Number(match[2]);
      year = 2000 + Number(match[3]);
    }

    const shifted = new Date(Date.UTC(year + Number(deltaYears), month - 1, day));
    if (
      shifted.getUTCMonth() !== month - 1
      || shifted.getUTCDate() !== day
    ) {
      continue;
    }

    if (pattern.format === 'compact-iso-date') {
      return [
        String(shifted.getUTCFullYear()).padStart(4, '0'),
        String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        String(shifted.getUTCDate()).padStart(2, '0')
      ].join('');
    }

    if (pattern.format === 'compact-us-date') {
      return [
        String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        String(shifted.getUTCDate()).padStart(2, '0'),
        String(shifted.getUTCFullYear()).padStart(4, '0')
      ].join('');
    }

    if (pattern.format === 'iso-date') {
      return [
        String(shifted.getUTCFullYear()).padStart(4, '0'),
        String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        String(shifted.getUTCDate()).padStart(2, '0')
      ].join('-');
    }

    if (pattern.format === 'iso-datetime') {
      return [
        String(shifted.getUTCFullYear()).padStart(4, '0'),
        String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        String(shifted.getUTCDate()).padStart(2, '0')
      ].join('-') + suffix;
    }

    if (pattern.format === 'slash-date') {
      return [
        String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        String(shifted.getUTCDate()).padStart(2, '0'),
        String(shifted.getUTCFullYear()).padStart(4, '0')
      ].join('/');
    }

    const separator = pattern.format === 'slash-short-year' ? '/' : '-';
    return [
      String(shifted.getUTCMonth() + 1).padStart(2, '0'),
      String(shifted.getUTCDate()).padStart(2, '0'),
      String(shifted.getUTCFullYear() % 100).padStart(2, '0')
    ].join(separator);
  }

  return null;
}

function suggestYearOverYearValue(currentValue, deltaYears, context = {}) {
  const text = String(currentValue ?? '').trim();
  if (!text) {
    return { suggestedValue: '', suggestionType: 'unknown', confidence: 'low', needsManualReview: true };
  }

  const compactMonthYear = shiftCompactMonthYear(text, deltaYears);
  if (compactMonthYear !== null) {
    return {
      suggestedValue: compactMonthYear,
      suggestionType: 'mmyy',
      confidence: 'high',
      needsManualReview: false
    };
  }

  if (/^\d{4}$/.test(text)) {
    return {
      suggestedValue: String(Number(text) + Number(deltaYears)),
      suggestionType: 'year',
      confidence: 'high',
      needsManualReview: false
    };
  }

  const slashMonthYear = shiftSlashMonthYear(text, deltaYears);
  if (slashMonthYear !== null) {
    return {
      suggestedValue: slashMonthYear,
      suggestionType: 'month-year-text',
      confidence: 'medium',
      needsManualReview: false
    };
  }

  const dateLikeValue = shiftDateLikeStringByYears(text, deltaYears);
  if (dateLikeValue !== null) {
    return {
      suggestedValue: dateLikeValue,
      suggestionType: 'date-like-string',
      confidence: 'high',
      needsManualReview: false
    };
  }

  const embeddedYear = shiftEmbeddedYearText(text, deltaYears);
  if (embeddedYear !== null) {
    return {
      suggestedValue: embeddedYear,
      suggestionType: 'embedded-year',
      confidence: 'medium',
      needsManualReview: false
    };
  }

  const trailingYearCode = shiftTrailingYearCode(text, deltaYears);
  if (trailingYearCode !== null) {
    return {
      suggestedValue: trailingYearCode,
      suggestionType: 'trailing-year-code',
      confidence: 'medium',
      needsManualReview: false
    };
  }

  const contextualTwoDigitYear = shiftContextualTwoDigitYear(text, deltaYears, context);
  if (contextualTwoDigitYear !== null) {
    return {
      suggestedValue: contextualTwoDigitYear,
      suggestionType: 'contextual-two-digit-year',
      confidence: 'medium',
      needsManualReview: false
    };
  }

  return {
    suggestedValue: '',
    suggestionType: 'unknown',
    confidence: 'low',
    needsManualReview: true
  };
}

function ensureConstantsMaintenanceUiState() {
  if (!appState.constantsMaintenanceUi) {
    appState.constantsMaintenanceUi = { activeTab: 'auto' };
  }
  if (!appState.constantsMaintenanceUi.activeTab) {
    appState.constantsMaintenanceUi.activeTab = 'auto';
  }
}

function getDefaultConstantsTab(review) {
  if (review?.autoRows?.length) return 'auto';
  if (review?.manualRows?.length) return 'manual';
  return 'auto';
}

function ensureUnitTestDateRollerUiState() {
  if (!appState.unitTestDateRollerUi) {
    appState.unitTestDateRollerUi = { activeTab: 'ready' };
  }
  if (!appState.unitTestDateRollerUi.activeTab) {
    appState.unitTestDateRollerUi.activeTab = 'ready';
  }
}

function getDefaultUnitTestDateRollerTab(review) {
  if (review?.readyRows?.length) return 'ready';
  if (review?.manualRows?.length) return 'manual';
  return 'ready';
}

function ensureUnitTestLogUiState() {
  if (!appState.unitTestLogUi) {
    appState.unitTestLogUi = { activeTab: 'ready' };
  }
  if (!appState.unitTestLogUi.activeTab) {
    appState.unitTestLogUi.activeTab = 'ready';
  }
}

function getDefaultUnitTestLogTab(readyRows, manualRows) {
  if (readyRows?.length) return 'ready';
  if (manualRows?.length) return 'manual';
  return 'ready';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUnitTestReviewValue(value) {
  if (value === undefined) return '';
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value);
  return String(value);
}

function parseUnitTestManualValue(row, rawValue) {
  const text = String(rawValue ?? '').trim();
  const type = String(row?.type || '').trim().toLowerCase();
  if (!text) {
    return { success: false, message: 'Enter a value before applying.' };
  }

  if (type.includes('[]')) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return { success: false, message: 'Array values must be valid JSON arrays.' };
      }
      return { success: true, value: parsed };
    } catch {
      return { success: false, message: 'Array values must be valid JSON arrays.' };
    }
  }

  if (['bool', 'boolean', 'checkbox'].includes(type)) {
    if (/^true$/i.test(text)) return { success: true, value: true };
    if (/^false$/i.test(text)) return { success: true, value: false };
    return { success: false, message: 'Use true or false.' };
  }

  if (['int', 'integer'].includes(type)) {
    if (!/^-?\d+$/.test(text)) return { success: false, message: 'Use a whole number.' };
    return { success: true, value: Number.parseInt(text, 10) };
  }

  if (type === 'decimal') {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return { success: false, message: 'Use a numeric value.' };
    return { success: true, value: parsed };
  }

  return { success: true, value: text };
}

function getUnitTestManualOverrideRows(review, options = {}) {
  const collectErrors = options.collectErrors === true;
  const rows = [];
  const errors = [];
  for (const row of review?.manualRows || []) {
    if (!String(row.manualOverrideText ?? '').trim()) {
      continue;
    }
    const parsed = parseUnitTestManualValue(row, row.manualOverrideText);
    if (!parsed.success) {
      if (collectErrors) {
        errors.push(`${row.caseName || 'Case'} ${row.fieldPath || row.valuePath}: ${parsed.message}`);
      }
      continue;
    }
    rows.push({
      ...row,
      canApply: true,
      proposedValue: parsed.value,
      reason: 'User-entered manual review value'
    });
  }
  return collectErrors ? { rows, errors } : rows;
}

function getUnitTestDateRollerApplyRows(review) {
  if (!review?.rows?.length) return [];
  return [
    ...review.rows.filter(row => row.canApply),
    ...getUnitTestManualOverrideRows(review)
  ];
}

function deriveUnitTestCalcFilePath(testFilePath) {
  const testRoot = appState.filePaths.TEST_ROOT;
  const calcRoot = appState.filePaths.CALC_ROOT;
  if (!testFilePath || !testRoot || !calcRoot) return '';
  const normalize = value => String(value || '').replace(/\\/g, '/').replace(/\/+$/g, '');
  const normalizedTestFile = normalize(testFilePath);
  const normalizedTestRoot = normalize(testRoot);
  if (!normalizedTestFile.toLowerCase().startsWith(`${normalizedTestRoot.toLowerCase()}/`)) return '';
  const relativePath = normalizedTestFile.slice(normalizedTestRoot.length + 1).replace(/\.test\.json$/i, '.calc.json');
  const separator = String(calcRoot).includes('\\') ? '\\' : '/';
  return `${String(calcRoot).replace(/[\\/]+$/g, '')}${separator}${relativePath.replace(/\//g, separator)}`;
}

function getUnitTestLogManualOverrideRows(review, options = {}) {
  const collectErrors = options.collectErrors === true;
  const rows = [];
  const errors = [];
  for (const row of review?.rows || []) {
    if (row.canApply || !String(row.manualOverrideText ?? '').trim()) continue;
    if (!row.filePath || !row.valuePath) {
      if (collectErrors) errors.push(`${row.caseName || 'Case'} cannot be manually applied because it was not mapped to a writable output value.`);
      continue;
    }
    const parsed = parseUnitTestManualValue(row, row.manualOverrideText);
    if (!parsed.success) {
      if (collectErrors) errors.push(`${row.caseName || 'Case'} ${row.fieldPath || row.valuePath}: ${parsed.message}`);
      continue;
    }
    rows.push({
      ...row,
      canApply: true,
      proposedValue: parsed.value,
      reason: 'User-entered failed-output review value'
    });
  }
  return collectErrors ? { rows, errors } : rows;
}

function getUnitTestLogApplyRows(review) {
  if (!review?.rows?.length) return [];
  return [
    ...review.rows.filter(row => row.canApply),
    ...getUnitTestLogManualOverrideRows(review)
  ];
}

function formatCalcModalContent(content) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content || '';
  }
}

function closeCalcModal() {
  const overlay = document.getElementById('calcModalOverlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  document.getElementById('calcModalCalcContent').textContent = '';
  document.getElementById('calcModalTestContent').textContent = '';
  const pathEl = document.getElementById('calcModalPath');
  if (pathEl) {
    pathEl.textContent = '';
    pathEl.dataset.calcPath = '';
    pathEl.dataset.unitTestPath = '';
  }
  setCalcModalTab('calc');
}

function setCalcModalTab(tabKey) {
  const normalizedTabKey = tabKey === 'unitTest' ? 'unitTest' : 'calc';
  const pathEl = document.getElementById('calcModalPath');
  document.querySelectorAll('.calc-modal-tab').forEach(tab => {
    const isActive = tab.dataset.calcModalTab === normalizedTabKey;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.calc-modal-pane').forEach(pane => {
    const isActive = normalizedTabKey === 'calc'
      ? pane.id === 'calcModalCalcContent'
      : pane.id === 'calcModalTestContent';
    pane.classList.toggle('active', isActive);
  });
  if (pathEl) pathEl.textContent = normalizedTabKey === 'calc' ? pathEl.dataset.calcPath || '' : pathEl.dataset.unitTestPath || '';
}

async function openUnitTestReviewFilesModal(calcFilePath, testFilePath) {
  if (!calcFilePath) return showToast('No calc file path is available for this row.', 'error');
  if (!testFilePath) return showToast('No unit test file path is available for this row.', 'error');
  const overlay = document.getElementById('calcModalOverlay');
  const calcContentEl = document.getElementById('calcModalCalcContent');
  const testContentEl = document.getElementById('calcModalTestContent');
  const pathEl = document.getElementById('calcModalPath');
  if (!overlay || !calcContentEl || !testContentEl || !pathEl) return;

  overlay.style.display = 'flex';
  pathEl.dataset.calcPath = calcFilePath;
  pathEl.dataset.unitTestPath = testFilePath;
  calcContentEl.textContent = 'Loading calc file...';
  testContentEl.textContent = 'Loading unit test file...';
  setCalcModalTab('calc');

  try {
    const result = await window.api.readUnitTestReviewFiles({
      calcRootPath: appState.filePaths.CALC_ROOT,
      testRootPath: appState.filePaths.TEST_ROOT,
      calcFilePath,
      testFilePath
    });
    if (!result.success) throw new Error(result.message);
    pathEl.dataset.calcPath = result.calc?.relativePath || result.calc?.filePath || calcFilePath;
    pathEl.dataset.unitTestPath = result.unitTest?.relativePath || result.unitTest?.filePath || testFilePath;
    calcContentEl.textContent = formatCalcModalContent(result.calc?.content);
    testContentEl.textContent = formatCalcModalContent(result.unitTest?.content);
    setCalcModalTab('calc');
  } catch (error) {
    calcContentEl.textContent = '';
    testContentEl.textContent = '';
    closeCalcModal();
    showToast(`Could not open review files: ${error.message}`, 'error');
  }
}

function buildConstantsMaintenanceReview(readResult, deltaYears) {
  const autoRows = (readResult?.autoMatches || []).map((entry, index) => {
    const currentValue = String(entry.value || '').trim();
    const proposedValue = shiftDateTimeValueByYears(currentValue, deltaYears);
    return {
      index: Number.isFinite(entry.index) ? entry.index : index,
      uid: entry.uid || null,
      name: entry.name || `Constant ${index + 1}`,
      description: entry.description || '',
      currentValue,
      proposedValue,
      currentDataTimeValue: entry.dataTimeValue || `${currentValue}T00:00:00.000Z`,
      proposedDataTimeValue: `${proposedValue}T00:00:00.000Z`,
      deltaYears
    };
  });

  const manualRows = (readResult?.manualMatches || []).map((entry, index) => {
    const suggestion = suggestYearOverYearValue(entry.value, deltaYears, {
      name: entry.name,
      description: entry.description,
      baseType: entry.baseType
    });
    return {
      index: Number.isFinite(entry.index) ? entry.index : index,
      uid: entry.uid || null,
      name: entry.name || `Constant ${index + 1}`,
      description: entry.description || '',
      baseType: entry.baseType || '',
      currentValue: entry.value === undefined || entry.value === null ? '' : String(entry.value),
      suggestedValue: suggestion.suggestedValue,
      finalValue: suggestion.suggestedValue || (entry.value === undefined || entry.value === null ? '' : String(entry.value)),
      suggestionType: suggestion.suggestionType,
      confidence: suggestion.confidence,
      needsManualReview: suggestion.needsManualReview
    };
  });

  return {
    autoRows,
    manualRows,
    matchedCount: autoRows.length + manualRows.length,
    taxYear: readResult?.taxYear || null,
    entity: readResult?.entity || null,
    deltaYears
  };
}

function buildUnitTestDateRollerReview(previewResult) {
  const rows = (previewResult?.rows || []).map((row, index) => ({
    index,
    rowKind: row.rowKind || 'output',
    filePath: row.filePath,
    calcFilePath: row.calcFilePath,
    calcFieldPath: row.calcFieldPath || '',
    caseName: row.caseName || '-',
    fieldPath: row.fieldPath || '-',
    valuePath: row.valuePath,
    type: row.type || '',
    tomType: row.tomType || '',
    currentValue: row.currentValue,
    proposedValue: row.proposedValue,
    manualOverrideText: row.manualOverrideText || '',
    constantName: row.constantName || '',
    canApply: row.canApply !== false,
    reason: row.reason || ''
  }));
  const readyRows = rows.filter(row => row.canApply);
  const manualRows = rows.filter(row => !row.canApply);

  const uniqueFiles = new Set(rows.map(row => row.filePath));
  const uniqueCases = new Set(rows.map(row => `${row.filePath}::${row.caseName}`));
  return {
    rows,
    readyRows,
    manualRows,
    fileCount: previewResult?.fileCount || uniqueFiles.size,
    caseCount: uniqueCases.size,
    calcFileCount: previewResult?.calcFileCount || 0,
    updateCount: previewResult?.updateCount || readyRows.length,
    reviewCount: previewResult?.reviewCount || manualRows.length,
    rootPath: previewResult?.rootPath || appState.filePaths.TEST_ROOT || '',
    calcRootPath: previewResult?.calcRootPath || appState.filePaths.CALC_ROOT || '',
    constantsPath: previewResult?.constantsPath || appState.filePaths.CONSTS || ''
  };
}

async function extractData() {
  clearToast();
  if (isConstantsMaintenanceWorkflow()) {
    const filePath = appState.filePaths.CONSTS;
    if (!filePath) return showToast('Please configure the state constants JSON path first.', 'error');
    setExtracting(true);
    try {
      updateProgress(10, 'Reading state constants JSON...');
      const result = await window.api.readConstantsMaintenanceFile(filePath);
      if (!result.success) throw new Error(result.message);
      updateProgress(70, 'Preparing year-shift preview...');
      appState.constantsMaintenanceReview = buildConstantsMaintenanceReview(result, appState.constantsShiftDeltaYears);
      appState.constantsMaintenanceUi.activeTab = getDefaultConstantsTab(appState.constantsMaintenanceReview);
      appState.unitTestDateRollerReview = null;
      appState.homeownerRefundReview = null;
      appState.marriageCreditReview = null;
      appState.coFamilyAffordabilityReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderWorkflowText();
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 400);
    } catch (error) {
      setExtracting(false);
      showToast(`Preview failed: ${error.message}`, 'error');
      console.error('Constants maintenance preview error:', error);
      return;
    }
  }
  if (isUnitTestDateRollerWorkflow()) {
    const rootPath = appState.filePaths.TEST_ROOT;
    const calcRootPath = appState.filePaths.CALC_ROOT;
    const constantsPath = appState.filePaths.CONSTS;
    if (!rootPath || !calcRootPath || !constantsPath) return showToast('Please configure the unit test root, calc root, and constants path first.', 'error');
    setExtracting(true);
    try {
      updateProgress(10, 'Scanning calc and unit test folders...');
      const result = await window.api.previewUnitTestDateRoll({
        rootPath,
        calcRootPath,
        constantsPath
      });
      if (!result.success) throw new Error(result.message);
      updateProgress(70, 'Preparing constant-aware unit test preview...');
      appState.unitTestDateRollerReview = buildUnitTestDateRollerReview(result);
      appState.unitTestLogReview = null;
      appState.constantsMaintenanceReview = null;
      appState.homeownerRefundReview = null;
      appState.marriageCreditReview = null;
      appState.coFamilyAffordabilityReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderWorkflowText();
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 400);
    } catch (error) {
      setExtracting(false);
      showToast(`Preview failed: ${error.message}`, 'error');
      console.error('Unit test date roller preview error:', error);
      return;
    }
  }
  if (!appState.selectedPdfPath) return showToast('Please select a PDF first.', 'error');
  const pageRange = getEffectivePdfPageRange();
  if (!pageRange) return showToast('Please enter valid PDF start and end pages first.', 'error');
  setExtracting(true);
  try {
    if (isMarriageCreditWorkflow()) {
      const target = getActiveFileTargets()[0];
      const currentPath = appState.filePaths[target.key];
      updateProgress(10, 'Reading current marriage-credit JSON...');
      const currentTable = currentPath ? await window.api.readMarriageCreditTable(currentPath) : null;
      updateProgress(20, 'Parsing Schedule M1MA PDF text directly...');
      appState.marriageCreditReview = buildMarriageCreditReview((await extractMarriageCreditFromPdf(appState.selectedPdfPath, pageRange)).rows, currentTable && currentTable.success ? currentTable : null);
      appState.homeownerRefundReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 800);
    }

    if (isHomeownerRefundWorkflow() || isRenterRefundWorkflow()) {
      const targets = getActiveFileTargets();
      const rowPath = appState.filePaths[targets[0].key];
      const refundPath = appState.filePaths[targets[1].key];
      updateProgress(10, isRenterRefundWorkflow() ? 'Reading current renter-refund JSON files...' : 'Reading current homeowner-refund JSON files...');
      const currentRowTable = rowPath ? await window.api.readGenericTable(rowPath) : null;
      const currentRefundTable = refundPath ? await window.api.readGenericTable(refundPath) : null;
      updateProgress(20, isRenterRefundWorkflow() ? 'Parsing M1RENT Renter Refund Table...' : 'Parsing M1PR Homestead Credit Refund Table...');
      const extractedTables = await (isRenterRefundWorkflow() ? extractRenterRefundFromPdf(appState.selectedPdfPath, pageRange) : extractHomeownerRefundFromPdf(appState.selectedPdfPath, pageRange));
      const currentRefundRows = currentRefundTable && currentRefundTable.success ? currentRefundTable.rows : [];
      appState.homeownerRefundUi = {
        activeTab: appState.homeownerRefundUi?.activeTab || 'rowTable',
        statusFilters: {
          rowTable: appState.homeownerRefundUi?.statusFilters?.rowTable || 'all',
          refundTable: appState.homeownerRefundUi?.statusFilters?.refundTable || 'all'
        }
      };
      appState.homeownerRefundReview = {
        rowTable: buildGenericTableReview(extractedTables.rowTableRows, currentRowTable && currentRowTable.success ? currentRowTable : null),
        refundTable: buildGenericTableReview(overlayGenericTableRows(currentRefundRows, extractedTables.refundRows), currentRefundTable && currentRefundTable.success ? currentRefundTable : null, { extractedCountOverride: extractedTables.refundRows.length })
      };
      appState.marriageCreditReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 800);
    }

    if (isCoFamilyAffordabilityWorkflow()) {
      updateProgress(10, 'Reading current Colorado Family Affordability JSON files...');
      const under5Path = appState.filePaths.CO_FAMILY_UNDER5;
      const age6to16Path = appState.filePaths.CO_FAMILY_AGE6TO16;
      const currentUnder5 = under5Path ? await window.api.readCoFamilyAffordabilityTable(under5Path) : null;
      const currentAge6to16 = age6to16Path ? await window.api.readCoFamilyAffordabilityTable(age6to16Path) : null;
      updateProgress(20, 'Parsing Colorado Family Affordability tables...');
      const extractedTables = await extractCoFamilyAffordabilityFromPdf(appState.selectedPdfPath, pageRange);
      appState.coFamilyAffordabilityReview = {
        under5: buildCoFamilyReview(extractedTables.under5Rows, currentUnder5 && currentUnder5.success ? currentUnder5 : null),
        age6to16: buildCoFamilyReview(extractedTables.age6to16Rows, currentAge6to16 && currentAge6to16.success ? currentAge6to16 : null)
      };
      appState.homeownerRefundReview = null;
      appState.marriageCreditReview = null;
      appState.extractedData = null;
      appState.diffResults = null;
      renderExtractedDataSection();
      renderDiffSection();
      renderMarriageCreditSection();
      updateActionButtons();
      updateProgress(100, 'Complete!');
      return setTimeout(() => setExtracting(false), 800);
    }

    const config = appState.selectedStateConfig;
    if (!['MN', 'OR'].includes(config?.code)) throw new Error('Only Oregon and Minnesota are supported.');
    updateProgress(10, 'Reading JSON file metadata...');
    const lookUpTypes = {};
    for (const status of config.filingStatuses) {
      const filePath = appState.filePaths[status.key];
      const result = filePath ? await window.api.readCurrentJsonValues(filePath) : null;
      lookUpTypes[status.key] = result?.success ? (result.lookUpType || 'LowerBoundary') : 'LowerBoundary';
    }
    updateProgress(20, `Parsing ${config.name} PDF text directly...`);
    appState.extractedData = await extractPdfDeterministically(appState.selectedPdfPath, pageRange, config, lookUpTypes);
    updateProgress(85, 'Comparing with current JSON files...');
    await buildDiff();
    updateProgress(100, 'Complete!');
    setTimeout(() => setExtracting(false), 800);
  } catch (error) {
    setExtracting(false);
    showToast(`Extraction failed: ${error.message}`, 'error');
    console.error('Extraction error:', error);
  }
}

async function buildDiff() {
  const config = appState.selectedStateConfig;
  const diffResults = {};
  for (const status of config.filingStatuses) {
    const filePath = appState.filePaths[status.key];
    const newValues = appState.extractedData[status.key];
    if (!filePath) { diffResults[status.key] = { error: 'No file path configured', changed: [], matched: 0, missing: 0 }; continue; }
    const currentResult = await window.api.readCurrentJsonValues(filePath);
    if (!currentResult.success) { diffResults[status.key] = { error: currentResult.message, changed: [], matched: 0, missing: 0 }; continue; }
    const currentValues = currentResult.values;
    const changed = [];
    let matched = 0; let missing = 0; let missingFromExtraction = 0;
    const missingExtractedIncomes = [];
    let minExtractedIncome = null; let maxExtractedIncome = null;
    for (const [incomeStr, newVal] of Object.entries(newValues)) {
      const income = parseInt(incomeStr, 10);
      const currentVal = currentValues[income];
      minExtractedIncome = minExtractedIncome === null ? income : Math.min(minExtractedIncome, income);
      maxExtractedIncome = maxExtractedIncome === null ? income : Math.max(maxExtractedIncome, income);
      if (currentVal === undefined) missing++;
      else if (Number(currentVal) !== Number(newVal)) changed.push({ income, currentVal: Number(currentVal), newVal: Number(newVal), delta: Number(newVal) - Number(currentVal) });
      else matched++;
    }
    for (const incomeStr of Object.keys(currentValues)) if (newValues[incomeStr] === undefined) { missingFromExtraction++; missingExtractedIncomes.push(Number(incomeStr)); }
    diffResults[status.key] = { changed, matched, missing, missingFromExtraction, missingExtractedIncomes, totalExtracted: Object.keys(newValues).length, totalCurrent: Object.keys(currentValues).length, minExtractedIncome, maxExtractedIncome, currentYear: currentResult.year, lookUpType: currentResult.lookUpType };
  }
  appState.diffResults = diffResults;
  renderDiffSection();
  updateActionButtons();
}

function renderDiffSection() {
  const container = document.getElementById('diffSection');
  const config = appState.selectedStateConfig;
  if (isMarriageCreditWorkflow() || isHomeownerRefundWorkflow() || isRenterRefundWorkflow() || isConstantsMaintenanceWorkflow() || isUnitTestDateRollerWorkflow() || !appState.diffResults || !config) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const tabsHtml = config.filingStatuses.map((status, i) => {
    const diff = appState.diffResults[status.key];
    const changedCount = diff?.changed?.length || 0;
    const hasError = diff?.error;
    const badge = hasError ? '!' : changedCount;
    const badgeClass = hasError ? 'badge-error' : changedCount > 0 ? 'badge-changed' : 'badge-ok';
    return `<button class="diff-tab ${i === 0 ? 'active' : ''}" data-status-key="${status.key}">${status.fileLabel}<span class="diff-badge ${badgeClass}">${badge}</span></button>`;
  }).join('');
  const panelsHtml = config.filingStatuses.map((status, i) => `<div class="diff-panel ${i === 0 ? 'active' : ''}" id="diff-panel-${status.key}">${renderDiffPanel(status, appState.diffResults[status.key])}</div>`).join('');
  container.innerHTML = `<div class="section-header"><h2 class="section-title">Review Changes</h2><p class="section-subtitle">Only rows with changed values are shown. Verify before updating.</p></div><div class="diff-tabs">${tabsHtml}</div><div class="diff-panels">${panelsHtml}</div>`;
  container.querySelectorAll('.diff-tab').forEach(tab => tab.addEventListener('click', () => showDiffTab(tab.dataset.statusKey)));
  syncWideTableScrollbars(container);
}

function renderDiffPanel(status, diff) {
  if (!diff) return '<p class="diff-empty">No data available.</p>';
  if (diff.error) return `<div class="diff-error">Warning: ${diff.error}</div>`;
  const summaryHtml = `<div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value ${diff.changed.length > 0 ? 'changed' : 'ok'}">${diff.changed.length}</span><span class="diff-stat-label">Changed</span></div><div class="diff-stat"><span class="diff-stat-value ok">${diff.matched}</span><span class="diff-stat-label">Unchanged</span></div><div class="diff-stat"><span class="diff-stat-value ${diff.missing > 0 ? 'warn' : 'ok'}">${diff.missing}</span><span class="diff-stat-label">Not in file</span></div><div class="diff-stat"><span class="diff-stat-value ${diff.missingFromExtraction > 0 ? 'warn' : 'ok'}">${diff.missingFromExtraction}</span><span class="diff-stat-label">Missed by extraction</span></div><div class="diff-stat"><span class="diff-stat-value">${diff.totalExtracted} / ${diff.totalCurrent}</span><span class="diff-stat-label">Extracted vs file</span></div>${diff.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${diff.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div>`;
  const missingIncomeDebug = diff.missingExtractedIncomes?.length ? ` Missing incomes: ${diff.missingExtractedIncomes.map(income => `${income.toLocaleString()}`).join(', ')}.` : '';
  const extractionWarning = diff.missingFromExtraction > 0 ? `<div class="diff-error">Warning: ${diff.missingFromExtraction} file rows were not returned by extraction.${diff.minExtractedIncome !== null ? ` Extracted range: ${diff.minExtractedIncome.toLocaleString()} to ${diff.maxExtractedIncome.toLocaleString()}.` : ''}${missingIncomeDebug}</div>` : '';
  if (diff.changed.length === 0) return summaryHtml + extractionWarning + '<div class="diff-empty">No value changes detected for this filing status.</div>';
  const rowsHtml = diff.changed.map(row => `<tr><td class="income-col">$${row.income.toLocaleString()}</td><td class="current-col">${row.currentVal.toLocaleString()}</td><td class="new-col">${row.newVal.toLocaleString()}</td><td class="delta-col ${row.delta > 0 ? 'delta-up' : 'delta-down'}">${row.delta > 0 ? '+' : ''}${row.delta.toLocaleString()}</td></tr>`).join('');
  return summaryHtml + extractionWarning + `<div class="diff-table-wrapper"><table class="diff-table"><thead><tr><th>Income</th><th>Current Value</th><th>New Value</th><th>Change</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function showDiffTab(statusKey) {
  document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.diff-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.diff-tab[data-status-key="${statusKey}"]`)?.classList.add('active');
  document.getElementById(`diff-panel-${statusKey}`)?.classList.add('active');
}

function getGenericReviewStatusLabel(row) {
  if (row.reviewStatus === 'changed') return 'Changed';
  if (row.reviewStatus === 'match') return 'Match';
  return 'New';
}

function getGenericReviewStatusClass(row) {
  if (row.reviewStatus === 'changed') return 'badge-changed';
  if (row.reviewStatus === 'match') return 'badge-ok';
  return 'badge-accent';
}

function ensureHomeownerRefundUiState() {
  if (!appState.homeownerRefundUi) {
    appState.homeownerRefundUi = {
      activeTab: 'rowTable',
      statusFilters: { rowTable: 'all', refundTable: 'all' }
    };
  }
  if (!appState.homeownerRefundUi.statusFilters) appState.homeownerRefundUi.statusFilters = { rowTable: 'all', refundTable: 'all' };
  if (!appState.homeownerRefundUi.activeTab) appState.homeownerRefundUi.activeTab = 'rowTable';
}

function getFilteredGenericReviewRows(review, statusFilter) {
  if (!review?.rows) return [];
  if (!statusFilter || statusFilter === 'all') return review.rows;
  return review.rows.filter(row => row.reviewStatus === statusFilter);
}

function renderGenericStatusFilter(filterKey, currentValue) {
  return `<label class="review-filter-label">Status<select class="review-filter homeowner-refund-status-filter" data-filter-key="${filterKey}"><option value="all" ${currentValue === 'all' ? 'selected' : ''}>All</option><option value="changed" ${currentValue === 'changed' ? 'selected' : ''}>Changed</option><option value="match" ${currentValue === 'match' ? 'selected' : ''}>Match</option><option value="new" ${currentValue === 'new' ? 'selected' : ''}>New</option></select></label>`;
}

function showHomeownerRefundReviewTab(tabKey) {
  ensureHomeownerRefundUiState();
  appState.homeownerRefundUi.activeTab = tabKey;
  renderMarriageCreditSection();
}

function renderHomeownerRefundReviewTable(review, options) {
  ensureHomeownerRefundUiState();
  const activeFilter = appState.homeownerRefundUi.statusFilters[options.filterKey] || 'all';
  const filteredRows = getFilteredGenericReviewRows(review, activeFilter);
  const rowsHtml = filteredRows.map((row, index) => `<tr><td>${index + 1}</td>${options.renderCells(row)}<td><span class="diff-badge ${getGenericReviewStatusClass(row)}">${getGenericReviewStatusLabel(row)}</span></td></tr>`).join('');
  const emptyHtml = `<div class="diff-empty">No rows match the current status filter.</div>`;
  return `<div class="content-section"><div class="section-header"><div><h2 class="section-title">${options.title}</h2><p class="section-subtitle">${options.subtitle}</p></div><div class="review-toolbar">${renderGenericStatusFilter(options.filterKey, activeFilter)}</div></div><div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${filteredRows.length}</span><span class="diff-stat-label">Visible rows</span></div><div class="diff-stat"><span class="diff-stat-value">${review.rows.length}</span><span class="diff-stat-label">Preview rows</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.extractedCount}</span><span class="diff-stat-label">Extracted from PDF</span></div><div class="diff-stat"><span class="diff-stat-value ${review.changedCount > 0 ? 'changed' : 'ok'}">${review.changedCount}</span><span class="diff-stat-label">Changed vs file</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.unchangedCount}</span><span class="diff-stat-label">Unchanged vs file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.missingCount > 0 ? 'warn' : 'ok'}">${review.missingCount}</span><span class="diff-stat-label">Still missing</span></div>${review.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${review.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div>${filteredRows.length === 0 ? emptyHtml : `<div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th>${options.headerHtml}<th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`}</div>`;
}

function renderMarriageCreditSection() {
  const container = document.getElementById('marriageCreditSection');

  if (isUnitTestDateRollerWorkflow()) {
    const logReview = appState.unitTestLogReview;
    if (logReview?.rows?.length) {
      ensureUnitTestLogUiState();
      const readyRows = logReview.rows.filter(row => row.canApply);
      const manualRows = logReview.rows.filter(row => !row.canApply);
      const tabs = [
        { key: 'ready', label: 'Ready From Log', badge: readyRows.length, badgeClass: 'badge-ok' },
        { key: 'manual', label: 'Needs Review From Log', badge: manualRows.length, badgeClass: manualRows.length > 0 ? 'badge-warn' : 'badge-ok' }
      ].filter(tab => tab.key === 'ready' ? readyRows.length > 0 : manualRows.length > 0);
      const activeTab = tabs.some(tab => tab.key === appState.unitTestLogUi.activeTab)
        ? appState.unitTestLogUi.activeTab
        : getDefaultUnitTestLogTab(readyRows, manualRows);
      appState.unitTestLogUi.activeTab = activeTab;
      const tabsHtml = tabs.map(tab => `<button class="diff-tab unit-test-log-review-tab ${activeTab === tab.key ? 'active' : ''}" data-unit-test-log-tab="${tab.key}">${tab.label}<span class="diff-badge ${tab.badgeClass}">${tab.badge}</span></button>`).join('');
      const renderLogRows = rows => {
        if (!rows.length) return '<div class="diff-empty">No rows in this group.</div>';
        const hasManualRows = rows.some(row => !row.canApply);
        const rowsHtml = rows.map((row, index) => {
          const currentValue = escapeHtml(formatUnitTestReviewValue(row.currentValue));
          const nextValue = row.canApply
            ? escapeHtml(formatUnitTestReviewValue(row.proposedValue))
            : row.filePath && row.valuePath
              ? `<input class="text-input unit-test-log-manual-value-input" data-log-row-index="${row.index}" value="${escapeHtml(row.manualOverrideText || '')}" placeholder="${escapeHtml(formatUnitTestReviewValue(row.currentValue))}" />`
              : '<span class="diff-empty">Needs review</span>';
          const calcButton = row.calcFilePath
            ? `<button class="btn btn-outline btn-sm unit-test-view-calc-btn" type="button" data-calc-file-path="${escapeHtml(row.calcFilePath)}" data-test-file-path="${escapeHtml(row.filePath || '')}">View Calc / Unit Test</button>`
            : '<span class="diff-empty">-</span>';
          const reasonHtml = !row.canApply && row.reason
            ? `<div class="unit-test-manual-reason">${escapeHtml(row.reason)}</div>`
            : '';
          const statusHtml = row.canApply
            ? '<span class="diff-badge badge-ok">Ready</span>'
            : `<span class="diff-badge badge-warn" title="${escapeHtml(row.reason)}">Manual review</span>${row.manualOverrideText ? '<span class="diff-badge badge-accent unit-test-override-badge">Reviewed</span>' : ''}`;
          return `<tr><td>${index + 1}</td><td>${escapeHtml(row.caseName || '-')}</td><td>${escapeHtml(row.calcFieldPath || '-')}</td><td>${escapeHtml(row.fieldPath || '-')}</td><td>${currentValue}</td><td>${nextValue}${reasonHtml}</td><td>${calcButton}</td><td>${statusHtml}</td></tr>`;
        }).join('');
        return `<div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table unit-test-review-table"><thead><tr><th>#</th><th>Case</th><th>Output Field</th><th>Field Path</th><th>Current Expected</th><th>${hasManualRows ? 'Reviewed Value' : 'Runtime Actual'}</th><th>Calc</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
      };
      const readyPanelHtml = readyRows.length
        ? `<div class="diff-panel unit-test-log-review-panel ${activeTab === 'ready' ? 'active' : ''}" id="unit-test-log-panel-ready"><div class="content-section"><div class="section-header"><div><h2 class="section-title">Ready From Log</h2><p class="section-subtitle">${escapeHtml(logReview.logPath || '')}</p></div></div>${renderLogRows(readyRows)}</div></div>`
        : '';
      const manualPanelHtml = manualRows.length
        ? `<div class="diff-panel unit-test-log-review-panel ${activeTab === 'manual' ? 'active' : ''}" id="unit-test-log-panel-manual"><div class="content-section"><div class="section-header"><div><h2 class="section-title">Needs Review From Log</h2><p class="section-subtitle">Review the calc, enter only the values you want to override, then apply failed output updates.</p></div></div>${renderLogRows(manualRows)}</div></div>`
        : '';
      container.style.display = 'block';
      container.innerHTML = `<div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Failed Output Updates</h2><p class="section-subtitle">These rows were parsed from the latest Omnistudio unit-test log. Applying writes ready rows and any reviewed manual values back to output.value fields.</p></div></div><div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${logReview.failureCount}</span><span class="diff-stat-label">Log failures</span></div><div class="diff-stat"><span class="diff-stat-value ok">${readyRows.length}</span><span class="diff-stat-label">Ready output updates</span></div><div class="diff-stat"><span class="diff-stat-value ${manualRows.length > 0 ? 'warn' : 'ok'}">${manualRows.length}</span><span class="diff-stat-label">Manual review rows</span></div><div class="diff-stat"><span class="diff-stat-value">${appState.taxYear}</span><span class="diff-stat-label">Tax year</span></div></div>${tabsHtml ? `<div class="diff-tabs unit-test-log-review-tabs">${tabsHtml}</div>` : ''}<div class="diff-panels unit-test-log-review-panels">${readyPanelHtml}${manualPanelHtml}</div></div>`;
      container.querySelectorAll('.unit-test-log-review-tab').forEach(tab => tab.addEventListener('click', () => {
        appState.unitTestLogUi.activeTab = tab.dataset.unitTestLogTab;
        renderMarriageCreditSection();
        updateActionButtons();
      }));
      container.querySelectorAll('.unit-test-view-calc-btn').forEach(button => button.addEventListener('click', () => {
        openUnitTestReviewFilesModal(button.dataset.calcFilePath, button.dataset.testFilePath);
      }));
      container.querySelectorAll('.unit-test-log-manual-value-input').forEach(input => input.addEventListener('input', event => {
        const rowIndex = Number(event.target.dataset.logRowIndex);
        const row = appState.unitTestLogReview?.rows?.find(candidate => candidate.index === rowIndex);
        if (!row) return;
        row.manualOverrideText = event.target.value;
        updateActionButtons();
      }));
      syncWideTableScrollbars(container);
      return;
    }
    ensureUnitTestDateRollerUiState();
    const review = appState.unitTestDateRollerReview;
    if (!review?.rows?.length) { container.style.display = 'none'; container.innerHTML = ''; return; }
    const tabs = [
      { key: 'ready', label: 'Ready for Update', badge: review.readyRows.length, badgeClass: 'badge-ok' },
      { key: 'manual', label: 'Needs Manual Review', badge: review.manualRows.length, badgeClass: review.manualRows.length > 0 ? 'badge-warn' : 'badge-ok' }
    ].filter(tab => {
      if (tab.key === 'ready') return review.readyRows.length > 0;
      return review.manualRows.length > 0;
    });
    const activeTab = tabs.some(tab => tab.key === appState.unitTestDateRollerUi.activeTab)
      ? appState.unitTestDateRollerUi.activeTab
      : getDefaultUnitTestDateRollerTab(review);
    appState.unitTestDateRollerUi.activeTab = activeTab;
    const tabsHtml = tabs.map(tab => `<button class="diff-tab unit-test-review-tab ${activeTab === tab.key ? 'active' : ''}" data-unit-test-tab="${tab.key}">${tab.label}<span class="diff-badge ${tab.badgeClass}">${tab.badge}</span></button>`).join('');
    const renderUnitTestRows = (rows, emptyMessage) => {
      if (!rows.length) {
        return `<div class="diff-empty">${emptyMessage}</div>`;
      }
      const groups = new Map();
      rows.forEach(row => {
        const key = `${row.filePath}::${row.caseName}`;
        if (!groups.has(key)) {
          groups.set(key, {
            filePath: row.filePath,
            calcFieldPath: row.calcFieldPath || '-',
            caseName: row.caseName || '-',
            rows: []
          });
        }
        groups.get(key).rows.push(row);
      });
      const groupCardsHtml = Array.from(groups.values()).map((group, groupIndex) => {
        const hasManualRows = group.rows.some(row => !row.canApply);
        const itemRowsHtml = group.rows.map((row, rowIndex) => {
          const currentValue = escapeHtml(formatUnitTestReviewValue(row.currentValue));
          const proposedValue = row.canApply
            ? escapeHtml(formatUnitTestReviewValue(row.proposedValue))
            : `<input class="text-input unit-test-manual-value-input" data-unit-test-row-index="${row.index}" value="${escapeHtml(row.manualOverrideText || '')}" placeholder="${escapeHtml(formatUnitTestReviewValue(row.currentValue))}" />`;
          const statusHtml = row.canApply
            ? '<span class="diff-badge badge-ok">Ready</span>'
            : `<span class="diff-badge badge-warn" title="${escapeHtml(row.reason)}">Manual review</span>${row.manualOverrideText ? '<span class="diff-badge badge-accent unit-test-override-badge">Reviewed</span>' : ''}`;
          const detailHtml = !row.canApply && row.reason
            ? `<div class="unit-test-manual-reason">${escapeHtml(row.reason)}</div>`
            : '';
          return `<tr><td>${rowIndex + 1}</td><td>${row.rowKind === 'input' ? 'Input' : 'Output'}</td><td>${escapeHtml(row.fieldPath)}</td><td>${escapeHtml(row.constantName || '-')}</td><td>${currentValue}</td><td>${proposedValue}${detailHtml}</td><td>${statusHtml}</td></tr>`;
        }).join('');
        const calcFileHtml = group.rows[0]?.calcFilePath ? `<p class="unit-test-review-group-subtitle">Calc File: ${escapeHtml(group.rows[0].calcFilePath)}</p>` : '';
        const valueHeader = hasManualRows ? 'Reviewed Value' : 'Proposed Value';
        const viewCalcButton = group.rows[0]?.calcFilePath ? `<button class="btn btn-outline btn-sm unit-test-view-calc-btn" type="button" data-calc-file-path="${escapeHtml(group.rows[0].calcFilePath)}" data-test-file-path="${escapeHtml(group.filePath || '')}">View Calc / Unit Test</button>` : '';
        return `<div class="unit-test-review-group"><div class="unit-test-review-group-header"><div><h3 class="unit-test-review-group-title">Case ${groupIndex + 1}: ${escapeHtml(group.caseName)}</h3><p class="unit-test-review-group-subtitle">Calc Field Path: ${escapeHtml(group.calcFieldPath)}</p>${calcFileHtml}</div><div class="unit-test-review-group-meta">${viewCalcButton}<span class="diff-badge ${group.rows.every(row => row.canApply) ? 'badge-ok' : 'badge-warn'}">${group.rows.length} ${group.rows.length === 1 ? 'row' : 'rows'}</span></div></div><div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table unit-test-review-table"><thead><tr><th>#</th><th>Target</th><th>Field Path</th><th>Constant</th><th>Current Value</th><th>${valueHeader}</th><th>Status</th></tr></thead><tbody>${itemRowsHtml}</tbody></table></div></div>`;
      }).join('');
      return `<div class="unit-test-review-groups">${groupCardsHtml}</div>`;
    };
    const readyPanelHtml = review.readyRows.length > 0
      ? `<div class="diff-panel unit-test-review-panel ${activeTab === 'ready' ? 'active' : ''}" id="unit-test-panel-ready"><div class="content-section"><div class="section-header"><div><h2 class="section-title">Ready Unit Test Updates</h2><p class="section-subtitle">These rows were resolved from maintained-constant dependencies and can be written back automatically.</p></div></div>${renderUnitTestRows(review.readyRows, 'No unit test rows are ready for automatic update.')}</div></div>`
      : '';
    const manualPanelHtml = review.manualRows.length > 0
      ? `<div class="diff-panel unit-test-review-panel ${activeTab === 'manual' ? 'active' : ''}" id="unit-test-panel-manual"><div class="content-section"><div class="section-header"><div><h2 class="section-title">Unit Tests Needing Manual Review</h2><p class="section-subtitle">Review the calc context, enter only the values you want to override, then apply to write those reviewed values back to the test JSON.</p></div></div>${renderUnitTestRows(review.manualRows, 'No unit test rows need manual review.')}</div></div>`
      : '';
    container.style.display = 'block';
    container.innerHTML = `<div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Unit Test Constant Updates</h2><p class="section-subtitle">These rows were derived from calc files that return, branch to, or compare against maintained constants. Applying will write only the ready rows back into each matching test JSON file.</p></div></div><div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${review.calcFileCount}</span><span class="diff-stat-label">Calc files scanned</span></div><div class="diff-stat"><span class="diff-stat-value">${review.fileCount}</span><span class="diff-stat-label">Matched test files</span></div><div class="diff-stat"><span class="diff-stat-value">${review.caseCount}</span><span class="diff-stat-label">Impacted cases</span></div><div class="diff-stat"><span class="diff-stat-value ${review.updateCount > 0 ? 'ok' : 'ok'}">${review.updateCount}</span><span class="diff-stat-label">Ready updates</span></div><div class="diff-stat"><span class="diff-stat-value ${review.reviewCount > 0 ? 'warn' : 'ok'}">${review.reviewCount}</span><span class="diff-stat-label">Manual review rows</span></div></div>${tabsHtml ? `<div class="diff-tabs unit-test-review-tabs">${tabsHtml}</div>` : ''}<div class="diff-panels unit-test-review-panels">${readyPanelHtml}${manualPanelHtml}</div></div>`;
    container.querySelectorAll('.unit-test-review-tab').forEach(tab => tab.addEventListener('click', () => {
      appState.unitTestDateRollerUi.activeTab = tab.dataset.unitTestTab;
      renderMarriageCreditSection();
      updateActionButtons();
    }));
    container.querySelectorAll('.unit-test-view-calc-btn').forEach(button => button.addEventListener('click', () => {
      openUnitTestReviewFilesModal(button.dataset.calcFilePath, button.dataset.testFilePath);
    }));
    container.querySelectorAll('.unit-test-manual-value-input').forEach(input => input.addEventListener('input', event => {
      const rowIndex = Number(event.target.dataset.unitTestRowIndex);
      const row = appState.unitTestDateRollerReview?.rows?.find(candidate => candidate.index === rowIndex);
      if (!row) return;
      row.manualOverrideText = event.target.value;
      const manualRow = appState.unitTestDateRollerReview?.manualRows?.find(candidate => candidate.index === rowIndex);
      if (manualRow) manualRow.manualOverrideText = event.target.value;
      updateActionButtons();
    }));
    syncWideTableScrollbars(container);
    return;
  }

  if (isConstantsMaintenanceWorkflow()) {
    ensureConstantsMaintenanceUiState();
    const review = appState.constantsMaintenanceReview;
    if (!review?.autoRows?.length && !review?.manualRows?.length) { container.style.display = 'none'; container.innerHTML = ''; return; }
    const autoRowsHtml = review.autoRows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.name}</td><td>${row.currentValue}</td><td>${row.proposedValue}</td></tr>`).join('');
    const manualRowsHtml = review.manualRows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.name}</td><td>${row.description || '-'}</td><td>${row.baseType || '-'}</td><td>${row.currentValue}</td><td>${row.suggestedValue || '<span class="diff-empty">Needs manual review</span>'}</td><td><input class="text-input constants-manual-input" data-constant-index="${row.index}" value="${String(row.finalValue).replace(/"/g, '&quot;')}" /></td></tr>`).join('');
    const tabs = [
      { key: 'auto', label: 'Auto Date Updates', badge: review.autoRows.length },
      { key: 'manual', label: 'Suggested Manual Updates', badge: review.manualRows.length }
    ].filter(tab => tab.key === 'auto' ? review.autoRows.length > 0 : review.manualRows.length > 0);
    const activeTab = tabs.some(tab => tab.key === appState.constantsMaintenanceUi.activeTab)
      ? appState.constantsMaintenanceUi.activeTab
      : getDefaultConstantsTab(review);
    appState.constantsMaintenanceUi.activeTab = activeTab;
    const tabsHtml = tabs.map(tab => `<button class="diff-tab constants-review-tab ${activeTab === tab.key ? 'active' : ''}" data-constants-tab="${tab.key}">${tab.label}<span class="diff-badge badge-ok">${tab.badge}</span></button>`).join('');
    const autoPanelHtml = review.autoRows.length > 0
      ? `<div class="diff-panel constants-review-panel ${activeTab === 'auto' ? 'active' : ''}" id="constants-panel-auto"><div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Automatic Date Updates</h2><p class="section-subtitle">These Year Over Year DateTime constants will be shifted automatically by ${review.deltaYears > 0 ? '+1' : '-1'} year.</p></div></div><div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th><th>Name</th><th>Current Value</th><th>Proposed Value</th></tr></thead><tbody>${autoRowsHtml}</tbody></table></div></div></div>`
      : '';
    const manualPanelHtml = review.manualRows.length > 0
      ? `<div class="diff-panel constants-review-panel ${activeTab === 'manual' ? 'active' : ''}" id="constants-panel-manual"><div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Suggested Manual Updates</h2><p class="section-subtitle">These Year Over Year constants are not DateTime values. Review the suggested values, use the description for context, and edit them before applying.</p></div></div>${review.manualRows.length === 0 ? '<div class="diff-empty">No manual year-over-year constants were found.</div>' : `<div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th><th>Name</th><th>Description</th><th>BaseType</th><th>Current Value</th><th>Suggested Value</th><th>Final Value</th></tr></thead><tbody>${manualRowsHtml}</tbody></table></div>`}</div></div>`
      : '';
    container.style.display = 'block';
    container.innerHTML = `<div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Constants Maintenance</h2><p class="section-subtitle">Preview automatic DateTime updates and the suggested manual year-over-year updates before applying changes to the constants file.</p></div></div><div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${review.matchedCount}</span><span class="diff-stat-label">Matched constants</span></div><div class="diff-stat"><span class="diff-stat-value">${review.autoRows.length}</span><span class="diff-stat-label">Auto date updates</span></div><div class="diff-stat"><span class="diff-stat-value">${review.manualRows.length}</span><span class="diff-stat-label">Manual review rows</span></div><div class="diff-stat"><span class="diff-stat-value">${review.deltaYears > 0 ? '+1' : '-1'}</span><span class="diff-stat-label">Year shift</span></div>${review.taxYear ? `<div class="diff-stat"><span class="diff-stat-value">${review.taxYear}</span><span class="diff-stat-label">File tax year</span></div>` : ''}${review.entity ? `<div class="diff-stat"><span class="diff-stat-value">${review.entity}</span><span class="diff-stat-label">Entity</span></div>` : ''}</div>${tabsHtml ? `<div class="diff-tabs constants-review-tabs">${tabsHtml}</div>` : ''}<div class="diff-panels constants-review-panels">${autoPanelHtml}${manualPanelHtml}</div></div>`;
    container.querySelectorAll('.constants-review-tab').forEach(tab => tab.addEventListener('click', () => {
      appState.constantsMaintenanceUi.activeTab = tab.dataset.constantsTab;
      renderWorkflowText();
      renderMarriageCreditSection();
      updateActionButtons();
    }));
    container.querySelectorAll('.constants-manual-input').forEach(input => input.addEventListener('input', event => {
      const targetIndex = Number(event.target.dataset.constantIndex);
      const row = appState.constantsMaintenanceReview?.manualRows?.find(candidate => candidate.index === targetIndex);
      if (!row) return;
      row.finalValue = event.target.value;
    }));
    syncWideTableScrollbars(container);
    return;
  }

  if (isHomeownerRefundWorkflow() || isRenterRefundWorkflow()) {
    const review = appState.homeownerRefundReview;
    if (!review) { container.style.display = 'none'; container.innerHTML = ''; return; }
    ensureHomeownerRefundUiState();
    const isRenterRefund = isRenterRefundWorkflow();
    const rowTitle = isRenterRefund ? 'Review M1PRRenterRefundRowTable' : 'Review Homeowner Refund Row Table';
    const rowSubtitle = isRenterRefund
      ? 'Generated row lookup for the renter-credit table. The first extracted row is remapped to lower boundary -100000.'
      : 'Generated row lookup for the Homestead Credit Refund Table. The first extracted row is remapped to lower boundary -1000000.';
    const rowHeaderHtml = isRenterRefund
      ? '<th>MNAmtDecNN (Line 9 of M1RENT)</th><th>Value</th>'
      : '<th>MNAmtDecNN (Row Lower Boundary)</th><th>Value</th>';
    const refundTitle = isRenterRefund ? 'Review M1PRRenterRefundTable' : 'Review Homeowner Refund Table';
    const refundSubtitle = isRenterRefund
      ? 'Generated two-key refund grid for M1RENT using row number plus line 11 amount. Cells marked with * are normalized to 99999.'
      : 'Generated two-key refund grid for M1PR using row number plus property-tax amount.';
    const refundHeaderHtml = isRenterRefund
      ? '<th>Integer (Row Number)</th><th>MNAmtDecNN (Line 11 from M1RENT)</th><th>Value</th>'
      : '<th>Integer (Row Number)</th><th>MNAmtDecNN (Amount)</th><th>Value</th>';
    const reviewTitle = isRenterRefund ? 'Review M1PR Renter Refund Tables' : 'Review Homeowner Refund Tables';
    const reviewSubtitle = isRenterRefund
      ? 'Switch between the generated renter row lookup and refund grid, then use the status filter to jump to changed rows quickly.'
      : 'Switch between the generated row lookup and refund grid, then use the status filter to jump to changed rows quickly.';
    container.style.display = 'block';
    const tabs = [
      { key: 'rowTable', label: 'Row Table', badge: review.rowTable.changedCount },
      { key: 'refundTable', label: 'Refund Table', badge: review.refundTable.changedCount }
    ];
    const tabsHtml = tabs.map(tab => `<button class="diff-tab homeowner-refund-tab ${appState.homeownerRefundUi.activeTab === tab.key ? 'active' : ''}" data-homeowner-tab="${tab.key}">${tab.label}<span class="diff-badge ${tab.badge > 0 ? 'badge-changed' : 'badge-ok'}">${tab.badge}</span></button>`).join('');
    const rowPanelHtml = `<div class="diff-panel homeowner-refund-panel ${appState.homeownerRefundUi.activeTab === 'rowTable' ? 'active' : ''}" id="homeowner-refund-panel-rowTable">${renderHomeownerRefundReviewTable(review.rowTable, { title: rowTitle, subtitle: rowSubtitle, headerHtml: rowHeaderHtml, filterKey: 'rowTable', renderCells: row => `<td>${row.key[0].toLocaleString()}</td><td>${row.value.toLocaleString()}</td>` })}</div>`;
    const refundPanelHtml = `<div class="diff-panel homeowner-refund-panel ${appState.homeownerRefundUi.activeTab === 'refundTable' ? 'active' : ''}" id="homeowner-refund-panel-refundTable">${renderHomeownerRefundReviewTable(review.refundTable, { title: refundTitle, subtitle: refundSubtitle, headerHtml: refundHeaderHtml, filterKey: 'refundTable', renderCells: row => `<td>${row.key[0].toLocaleString()}</td><td>${row.key[1].toLocaleString()}</td><td>${row.value.toLocaleString()}</td>` })}</div>`;
    container.innerHTML = `<div class="section-header"><h2 class="section-title">${reviewTitle}</h2><p class="section-subtitle">${reviewSubtitle}</p></div><div class="diff-tabs homeowner-refund-tabs">${tabsHtml}</div><div class="diff-panels homeowner-refund-panels">${rowPanelHtml}${refundPanelHtml}</div>`;
    container.querySelectorAll('.homeowner-refund-tab').forEach(tab => tab.addEventListener('click', () => showHomeownerRefundReviewTab(tab.dataset.homeownerTab)));
    container.querySelectorAll('.homeowner-refund-status-filter').forEach(select => select.addEventListener('change', event => {
      ensureHomeownerRefundUiState();
      appState.homeownerRefundUi.statusFilters[event.target.dataset.filterKey] = event.target.value;
      renderMarriageCreditSection();
    }));
    syncWideTableScrollbars(container);
    return;
  }

  if (isCoFamilyAffordabilityWorkflow()) {
    const review = appState.coFamilyAffordabilityReview;
    if (!review?.under5 || !review?.age6to16) { container.style.display = 'none'; container.innerHTML = ''; return; }
    ensureCoFamilyUiState();
    const tabs = [
      { key: 'under5', label: 'Under Age 5', badge: review.under5.changedCount },
      { key: 'age6to16', label: 'Age 6 to 16', badge: review.age6to16.changedCount }
    ];
    const tabsHtml = tabs.map(tab => `<button class="diff-tab co-family-tab ${appState.coFamilyAffordabilityUi.activeTab === tab.key ? 'active' : ''}" data-co-family-tab="${tab.key}">${tab.label}<span class="diff-badge ${tab.badge > 0 ? 'badge-changed' : 'badge-ok'}">${tab.badge}</span></button>`).join('');
    const under5PanelHtml = `<div class="diff-panel co-family-panel ${appState.coFamilyAffordabilityUi.activeTab === 'under5' ? 'active' : ''}" id="co-family-panel-under5">${renderCoFamilyReviewTable(review.under5, { title: 'Review Age 5 and Under Family Affordability Table', subtitle: 'Full extracted grid for the Colorado Age 5 and Under per-child credit table. QualifyingWidow is populated with the Single / HOH / MFS column values for review before replace.', filterKey: 'under5' })}</div>`;
    const age6to16PanelHtml = `<div class="diff-panel co-family-panel ${appState.coFamilyAffordabilityUi.activeTab === 'age6to16' ? 'active' : ''}" id="co-family-panel-age6to16">${renderCoFamilyReviewTable(review.age6to16, { title: 'Review Age 6 to 16 Family Affordability Table', subtitle: 'Full extracted grid for the Colorado Age 6 to 16 per-child credit table. QualifyingWidow is populated with the Single / HOH / MFS column values for review before replace.', filterKey: 'age6to16' })}</div>`;
    container.style.display = 'block';
    container.innerHTML = `<div class="section-header"><h2 class="section-title">Review Colorado Family Affordability Tables</h2><p class="section-subtitle">Switch between the two Colorado credit tables, then use the status filter to jump to changed rows quickly.</p></div><div class="diff-tabs co-family-tabs">${tabsHtml}</div><div class="diff-panels co-family-panels">${under5PanelHtml}${age6to16PanelHtml}</div>`;
    container.querySelectorAll('.co-family-tab').forEach(tab => tab.addEventListener('click', () => showCoFamilyReviewTab(tab.dataset.coFamilyTab)));
    container.querySelectorAll('.homeowner-refund-status-filter').forEach(select => select.addEventListener('change', event => {
      ensureCoFamilyUiState();
      appState.coFamilyAffordabilityUi.statusFilters[event.target.dataset.filterKey] = event.target.value;
      renderMarriageCreditSection();
    }));
    syncWideTableScrollbars(container);
    return;
  }

  const review = appState.marriageCreditReview;
  if (!isMarriageCreditWorkflow() || !review) { container.style.display = 'none'; container.innerHTML = ''; return; }
  const warningHtml = review.warnings.map(message => `<div class="review-alert warn">${message}</div>`).join('');
  const rowsHtml = review.rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.separateIncome.toLocaleString()}</td><td>${row.jointIncome.toLocaleString()}</td><td>${row.value.toLocaleString()}</td><td><span class="diff-badge ${getMarriageCreditStatusClass(row)}">${getMarriageCreditStatusLabel(row)}</span></td></tr>`).join('');
  container.style.display = 'block';
  container.innerHTML = `<div class="content-section"><div class="section-header"><div><h2 class="section-title">Review Marriage Credit Table</h2><p class="section-subtitle">Full extracted grid for MN Schedule M1MA. Approve this preview before replacing the JSON file.</p></div></div>${warningHtml}<div class="diff-summary"><div class="diff-stat"><span class="diff-stat-value">${review.rows.length}</span><span class="diff-stat-label">Preview rows</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.extractedCount}</span><span class="diff-stat-label">Extracted from PDF</span></div><div class="diff-stat"><span class="diff-stat-value ${review.carriedCount > 0 ? 'warn' : 'ok'}">${review.carriedCount}</span><span class="diff-stat-label">Carried from file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.changedCount > 0 ? 'changed' : 'ok'}">${review.changedCount}</span><span class="diff-stat-label">Changed vs file</span></div><div class="diff-stat"><span class="diff-stat-value ok">${review.unchangedCount}</span><span class="diff-stat-label">Unchanged vs file</span></div><div class="diff-stat"><span class="diff-stat-value ${review.missingCount > 0 ? 'warn' : 'ok'}">${review.missingCount}</span><span class="diff-stat-label">Still missing</span></div>${review.currentYear ? `<div class="diff-stat"><span class="diff-stat-value">${review.currentYear} -> ${appState.taxYear}</span><span class="diff-stat-label">Year update</span></div>` : ''}</div><div class="diff-table-wrapper marriage-credit-table-wrapper"><table class="diff-table marriage-credit-table"><thead><tr><th>#</th><th>MNAmtDec (SeparateIncome)</th><th>MNAmtDecNN (JointIncome)</th><th>Value</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></div>`;
  syncWideTableScrollbars(container);
}
async function updateJsonFiles() {
  if (isUnitTestDateRollerWorkflow()) return applyUnitTestDateRoller();
  if (isConstantsMaintenanceWorkflow()) return applyConstantsMaintenanceYearShift();
  if (isMarriageCreditWorkflow()) return replaceMarriageCreditJson();
  if (isHomeownerRefundWorkflow() || isRenterRefundWorkflow()) return replaceRefundJson();
  if (isCoFamilyAffordabilityWorkflow()) return replaceCoFamilyAffordabilityJson();
  const config = appState.selectedStateConfig;
  if (!config.filingStatuses.every(s => appState.filePaths[s.key])) return showToast('Please select all JSON file paths before updating.', 'error');
  setUpdating(true);
  const results = await window.api.updateJsonFiles({ taxYear: appState.taxYear, updates: config.filingStatuses.map(status => ({ statusKey: status.key, filePath: appState.filePaths[status.key], newValues: appState.extractedData[status.key] })) });
  setUpdating(false);
  if (results.every(r => r.success)) { showToast(`All ${results.length} JSON files updated successfully for tax year ${appState.taxYear}.`, 'success'); return buildDiff(); }
  showToast(`Some files failed to update:
${results.filter(r => !r.success).map(f => `${f.statusKey}: ${f.message}`).join('\n')}`, 'error');
}

async function applyUnitTestDateRoller() {
  const rootPath = appState.filePaths.TEST_ROOT;
  const calcRootPath = appState.filePaths.CALC_ROOT;
  const constantsPath = appState.filePaths.CONSTS;
  const review = appState.unitTestDateRollerReview;
  const maxApplyPasses = 5;
  if (!rootPath || !calcRootPath || !constantsPath) return showToast('Please configure the unit test root, calc root, and constants path before applying updates.', 'error');
  if (!review?.rows?.length) return showToast('Please preview the unit test updates first.', 'error');
  const manualOverrides = getUnitTestManualOverrideRows(review, { collectErrors: true });
  if (manualOverrides.errors.length) return showToast(`Manual review value needs attention:\n${manualOverrides.errors[0]}`, 'error');
  if (!getUnitTestDateRollerApplyRows(review).length) return showToast('There are no unit test rows eligible for update. Enter a reviewed value on the manual tab or re-preview.', 'error');

  setUpdating(true);
  let currentReview = review;
  let updatedValueCount = 0;
  let applyPassCount = 0;
  const updatedFilePaths = new Set();
  const updatedValuePaths = new Set();
  const getRowUpdateKey = row => `${row.filePath || ''}::${row.valuePath || ''}`;
  const suppressPreviouslyAppliedRows = nextReview => {
    const rows = nextReview.rows.filter(row => !updatedValuePaths.has(getRowUpdateKey(row)));
    const readyRows = rows.filter(row => row.canApply);
    const manualRows = rows.filter(row => !row.canApply);
    const uniqueCases = new Set(rows.map(row => `${row.filePath}::${row.caseName}`));
    return {
      ...nextReview,
      rows,
      readyRows,
      manualRows,
      caseCount: uniqueCases.size,
      updateCount: readyRows.length,
      reviewCount: manualRows.length
    };
  };

  for (let passIndex = 0; passIndex < maxApplyPasses; passIndex++) {
    const readyRows = getUnitTestDateRollerApplyRows(currentReview).filter(row => !updatedValuePaths.has(getRowUpdateKey(row)));
    if (!readyRows.length) {
      break;
    }

    readyRows.forEach(row => updatedFilePaths.add(row.filePath));
    const result = await window.api.applyUnitTestDateRoll({
      rootPath,
      rows: readyRows.map(row => ({
        filePath: row.filePath,
        valuePath: row.valuePath,
        proposedValue: row.proposedValue,
        canApply: true
      }))
    });

    if (!result.success) {
      setUpdating(false);
      return showToast(`Unit test update failed: ${result.message}`, 'error');
    }

    applyPassCount++;
    updatedValueCount += result.updatedValueCount || readyRows.length;
    readyRows.forEach(row => updatedValuePaths.add(getRowUpdateKey(row)));

    const refreshed = await window.api.previewUnitTestDateRoll({
      rootPath,
      calcRootPath,
      constantsPath
    });
    if (!refreshed.success) {
      setUpdating(false);
      return showToast(`Unit test update succeeded, but refresh failed: ${refreshed.message}`, 'error');
    }

    currentReview = suppressPreviouslyAppliedRows(buildUnitTestDateRollerReview(refreshed));
  }

  setUpdating(false);
  appState.unitTestDateRollerReview = currentReview;
  renderWorkflowText();
  renderExtractedDataSection();
  renderMarriageCreditSection();
  updateActionButtons();
  if (getUnitTestDateRollerApplyRows(currentReview).some(row => !updatedValuePaths.has(getRowUpdateKey(row)))) {
    return showToast(`Updated ${updatedValueCount} unit test values across ${updatedFilePaths.size} files. Additional ready updates remain after ${applyPassCount} passes; review before applying again.`, 'error');
  }
  showToast(`Updated ${updatedValueCount} unit test values across ${updatedFilePaths.size} files${applyPassCount > 1 ? ` in ${applyPassCount} passes` : ''}.`, 'success');
}

function buildUnitTestLogReview(result) {
  const rows = (result?.rows || []).map((row, index) => ({
    index,
    rowKind: row.rowKind || 'logOutput',
    filePath: row.filePath || '',
    calcFilePath: row.calcFilePath || deriveUnitTestCalcFilePath(row.filePath),
    calcFieldPath: row.calcFieldPath || '',
    caseName: row.caseName || '',
    fieldPath: row.fieldPath || '',
    valuePath: row.valuePath || '',
    type: row.type || '',
    tomType: row.tomType || '',
    currentValue: row.currentValue,
    proposedValue: row.proposedValue,
    manualOverrideText: row.manualOverrideText || '',
    constantName: row.constantName || 'Runtime actual from unit test log',
    canApply: row.canApply === true,
    reason: row.reason || ''
  }));
  return {
    rows,
    logPath: result?.logPath || '',
    failureCount: result?.failureCount || rows.length,
    updateCount: result?.updateCount || rows.filter(row => row.canApply).length,
    reviewCount: result?.reviewCount || rows.filter(row => !row.canApply).length
  };
}

async function previewUnitTestLogUpdates() {
  const rootPath = appState.filePaths.TEST_ROOT;
  if (!rootPath) return showToast('Please configure the unit test root before previewing failed output updates.', 'error');
  const regulatoryYearMatch = String(rootPath).match(/OCE-Regulatory-(\d{4})/i);
  const regulatoryYear = regulatoryYearMatch ? parseInt(regulatoryYearMatch[1], 10) : appState.taxYear;
  setExtracting(true);
  try {
    updateProgress(10, 'Reading latest Omnistudio unit-test log...');
    const result = await window.api.previewUnitTestLogUpdates({
      rootPath,
      stateCode: appState.selectedStateCode,
      regulatoryYear
    });
    if (!result.success) throw new Error(result.message);
    appState.unitTestLogReview = buildUnitTestLogReview(result);
    appState.unitTestDateRollerReview = null;
    updateProgress(100, 'Complete!');
    renderExtractedDataSection();
    renderMarriageCreditSection();
    updateActionButtons();
    showToast(`Parsed ${appState.unitTestLogReview.failureCount} failed assertions from the latest log.`, 'success');
    return setTimeout(() => setExtracting(false), 400);
  } catch (error) {
    setExtracting(false);
    showToast(`Log preview failed: ${error.message}`, 'error');
  }
}

async function applyUnitTestLogUpdates() {
  const review = appState.unitTestLogReview;
  if (!review?.rows?.length) return showToast('Please preview failed output updates first.', 'error');
  const manualOverrides = getUnitTestLogManualOverrideRows(review, { collectErrors: true });
  if (manualOverrides.errors.length) return showToast(`Manual failed-output value needs attention:\n${manualOverrides.errors[0]}`, 'error');
  const applyRows = getUnitTestLogApplyRows(review);
  if (!applyRows.length) return showToast('There are no failed-output rows eligible for update. Enter a reviewed value or re-preview.', 'error');
  setUpdating(true);
  const result = await window.api.applyUnitTestLogUpdates({
    rows: applyRows.map(row => ({
      filePath: row.filePath,
      valuePath: row.valuePath,
      proposedValue: row.proposedValue,
      canApply: true
    }))
  });
  setUpdating(false);
  if (!result.success) return showToast(`Failed output update failed: ${result.message}`, 'error');
  appState.unitTestLogReview = null;
  renderExtractedDataSection();
  renderMarriageCreditSection();
  updateActionButtons();
  showToast(`Updated ${result.updatedValueCount} expected output values across ${result.updatedFileCount} files.`, 'success');
}

async function applyConstantsMaintenanceYearShift() {
  const filePath = appState.filePaths.CONSTS;
  const review = appState.constantsMaintenanceReview;
  if (!filePath) return showToast('Please configure the state constants JSON path before applying the year shift.', 'error');
  if (!review?.autoRows?.length && !review?.manualRows?.length) return showToast('Please preview the constants year shift first.', 'error');
  ensureConstantsMaintenanceUiState();

  if (appState.constantsMaintenanceUi.activeTab === 'manual') {
    if (!review.manualRows.length) return showToast('There are no manual year-over-year constants to update.', 'error');
    setUpdating(true);
    const result = await window.api.applyConstantsManualUpdates({
      filePath,
      updates: review.manualRows.map(row => ({ index: row.index, finalValue: row.finalValue }))
    });
    setUpdating(false);

    if (!result.success) return showToast(`Constants update failed: ${result.message}`, 'error');

    const refreshed = await window.api.readConstantsMaintenanceFile(filePath);
    if (!refreshed.success) return showToast(`Constants update succeeded, but refresh failed: ${refreshed.message}`, 'error');
    appState.constantsMaintenanceReview = buildConstantsMaintenanceReview(refreshed, appState.constantsShiftDeltaYears);
    appState.constantsMaintenanceUi.activeTab = review.manualRows.length > 0 ? 'manual' : getDefaultConstantsTab(appState.constantsMaintenanceReview);
    renderWorkflowText();
    renderExtractedDataSection();
    renderMarriageCreditSection();
    updateActionButtons();
    showToast(`Updated ${result.updatedCount} manual year-over-year constants.`, 'success');
    return;
  }

  if (!review.autoRows.length) return showToast('There are no automatic DateTime year shifts to apply for this file.', 'error');

  setUpdating(true);
  const result = await window.api.applyConstantsYearShift({ filePath, deltaYears: appState.constantsShiftDeltaYears });
  setUpdating(false);

  if (!result.success) return showToast(`Constants update failed: ${result.message}`, 'error');

  const refreshed = await window.api.readConstantsMaintenanceFile(filePath);
  if (!refreshed.success) return showToast(`Constants update succeeded, but refresh failed: ${refreshed.message}`, 'error');

  appState.constantsMaintenanceReview = buildConstantsMaintenanceReview(refreshed, appState.constantsShiftDeltaYears);
  appState.constantsMaintenanceUi.activeTab = review.manualRows.length > 0 ? 'auto' : getDefaultConstantsTab(appState.constantsMaintenanceReview);
  renderWorkflowText();
  renderExtractedDataSection();
  renderMarriageCreditSection();
  updateActionButtons();
  showToast(`Updated ${result.updatedCount} automatic DateTime constants by ${appState.constantsShiftDeltaYears > 0 ? '+1' : '-1'} year.`, 'success');
}

async function replaceCoFamilyAffordabilityJson() {
  const review = appState.coFamilyAffordabilityReview;
  const under5Path = appState.filePaths.CO_FAMILY_UNDER5;
  const age6to16Path = appState.filePaths.CO_FAMILY_AGE6TO16;
  if (!under5Path || !age6to16Path) return showToast('Please configure both Colorado Family Affordability JSON paths before replacing.', 'error');
  if (!review?.under5?.rows?.length || !review?.age6to16?.rows?.length) return showToast('Please extract and review both Colorado Family Affordability tables first.', 'error');

  setUpdating(true);
  const [under5Result, age6to16Result] = await Promise.all([
    window.api.replaceCoFamilyAffordabilityTable({ filePath: under5Path, taxYear: appState.taxYear, rows: review.under5.rows.map(row => ({ filingStatus: row.filingStatus, amount: row.amount, value: row.value })) }),
    window.api.replaceCoFamilyAffordabilityTable({ filePath: age6to16Path, taxYear: appState.taxYear, rows: review.age6to16.rows.map(row => ({ filingStatus: row.filingStatus, amount: row.amount, value: row.value })) })
  ]);
  setUpdating(false);

  if (!under5Result.success || !age6to16Result.success) {
    const errorMessage = [under5Result, age6to16Result].filter(result => !result.success).map(result => result.message).join('\n');
    return showToast('Colorado Family Affordability replace failed:\n' + errorMessage, 'error');
  }

  const [refreshedUnder5, refreshedAge6to16] = await Promise.all([
    window.api.readCoFamilyAffordabilityTable(under5Path),
    window.api.readCoFamilyAffordabilityTable(age6to16Path)
  ]);

  appState.coFamilyAffordabilityReview = {
    under5: buildCoFamilyReview(review.under5.rows, refreshedUnder5.success ? refreshedUnder5 : null),
    age6to16: buildCoFamilyReview(review.age6to16.rows, refreshedAge6to16.success ? refreshedAge6to16 : null)
  };
  renderMarriageCreditSection();
  updateActionButtons();
  showToast('Colorado Family Affordability JSON replaced with ' + (under5Result.updatedCount + age6to16Result.updatedCount) + ' rows across both files.', 'success');
}
async function replaceMarriageCreditJson() {
  const filePath = appState.filePaths[getActiveFileTargets()[0].key];
  const review = appState.marriageCreditReview;
  if (!filePath) return showToast('Please select the MNMarriageCredit JSON path before replacing.', 'error');
  if (!review?.rows?.length) return showToast('Please extract and review the marriage-credit table first.', 'error');
  setUpdating(true);
  const result = await window.api.replaceMarriageCreditTable({ filePath, taxYear: appState.taxYear, rows: review.rows.map(row => ({ separateIncome: row.separateIncome, jointIncome: row.jointIncome, value: row.value })) });
  setUpdating(false);
  if (!result.success) return showToast(`Marriage credit replace failed: ${result.message}`, 'error');
  const refreshed = await window.api.readMarriageCreditTable(filePath);
  appState.marriageCreditReview = buildMarriageCreditReview(review.rows, refreshed.success ? refreshed : null);
  renderMarriageCreditSection();
  updateActionButtons();
  showToast(`Marriage credit JSON replaced with ${result.updatedCount} rows.`, 'success');
}


async function replaceRefundJson() {
  const review = appState.homeownerRefundReview;
  const rowPath = appState.filePaths.M1PR_ROW;
  const refundPath = appState.filePaths.M1PR_REFUND;
  const workflowLabel = isRenterRefundWorkflow() ? 'renter' : 'homeowner';
  if (!rowPath || !refundPath) return showToast('Please configure both M1PR JSON paths before replacing.', 'error');
  if (!review?.rowTable?.rows?.length || !review?.refundTable?.rows?.length) return showToast('Please extract and review the ' + workflowLabel + '-refund tables first.', 'error');

  setUpdating(true);
  const [rowResult, refundResult] = await Promise.all([
    window.api.replaceGenericTable({ filePath: rowPath, taxYear: appState.taxYear, rows: review.rowTable.rows.map(row => ({ key: row.key, value: row.value })) }),
    window.api.replaceGenericTable({ filePath: refundPath, taxYear: appState.taxYear, rows: normalizeRefundJsonRows(review.refundTable.rows) })
  ]);
  setUpdating(false);

  if (!rowResult.success || !refundResult.success) {
    const errorMessage = [rowResult, refundResult].filter(result => !result.success).map(result => result.message).join('\n');
    return showToast((isRenterRefundWorkflow() ? 'Renter refund replace failed:\n' : 'Homeowner refund replace failed:\n') + errorMessage, 'error');
  }

  const [refreshedRowTable, refreshedRefundTable] = await Promise.all([
    window.api.readGenericTable(rowPath),
    window.api.readGenericTable(refundPath)
  ]);

  appState.homeownerRefundReview = {
    rowTable: buildGenericTableReview(review.rowTable.rows, refreshedRowTable.success ? refreshedRowTable : null),
    refundTable: buildGenericTableReview(review.refundTable.rows, refreshedRefundTable.success ? refreshedRefundTable : null, { extractedCountOverride: review.refundTable.extractedCount })
  };
  renderMarriageCreditSection();
  updateActionButtons();
  showToast((isRenterRefundWorkflow() ? 'Renter refund JSON replaced with ' : 'Homeowner refund JSON replaced with ') + (rowResult.updatedCount + refundResult.updatedCount) + ' rows across both files.', 'success');
}

function renderExtractedDataSection() {
  const section = document.getElementById('extractedDataSection');
  if (isUnitTestDateRollerWorkflow()) {
    const logReview = appState.unitTestLogReview;
    if (logReview?.rows?.length) {
      section.style.display = 'block';
      document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${logReview.failureCount}</span><label>Log failures</label></div><div class="extraction-stat"><span>${logReview.updateCount}</span><label>Ready outputs</label></div><div class="extraction-stat"><span>${logReview.reviewCount}</span><label>Manual review rows</label></div><div class="extraction-stat"><span>${appState.taxYear}</span><label>Tax year</label></div>`;
      return;
    }
    const review = appState.unitTestDateRollerReview;
    if (!review?.rows?.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${review.calcFileCount}</span><label>Calc files scanned</label></div><div class="extraction-stat"><span>${review.fileCount}</span><label>Matched test files</label></div><div class="extraction-stat"><span>${review.updateCount}</span><label>Ready updates</label></div><div class="extraction-stat"><span>${review.reviewCount}</span><label>Manual review rows</label></div><div class="extraction-stat"><span>${appState.taxYear}</span><label>Tax year</label></div>`;
    return;
  }
  if (isConstantsMaintenanceWorkflow()) {
    const review = appState.constantsMaintenanceReview;
    if (!review?.autoRows?.length && !review?.manualRows?.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${review.matchedCount}</span><label>Matched constants</label></div><div class="extraction-stat"><span>${review.autoRows.length}</span><label>Auto date rows</label></div><div class="extraction-stat"><span>${review.manualRows.length}</span><label>Manual review rows</label></div><div class="extraction-stat"><span>${review.deltaYears > 0 ? '+1' : '-1'}</span><label>Year shift</label></div>`;
    return;
  }
  if (isCoFamilyAffordabilityWorkflow()) {
    if (!appState.coFamilyAffordabilityReview?.under5 || !appState.coFamilyAffordabilityReview?.age6to16) { section.style.display = 'none'; return; }
    const under5Review = appState.coFamilyAffordabilityReview.under5;
    const age6to16Review = appState.coFamilyAffordabilityReview.age6to16;
    const combinedRows = [...under5Review.rows, ...age6to16Review.rows];
    const maxValue = Math.max(...combinedRows.map(row => row.value));
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${under5Review.rows.length}</span><label>Under 5 rows</label></div><div class="extraction-stat"><span>${age6to16Review.rows.length}</span><label>Age 6 to 16 rows</label></div><div class="extraction-stat"><span>${CO_FAMILY_STATUS_ORDER.length}</span><label>Filing statuses</label></div><div class="extraction-stat"><span>${maxValue.toLocaleString()}</span><label>Max credit</label></div>`;
    return;
  }
  if (isMarriageCreditWorkflow()) {
    if (!appState.marriageCreditReview) { section.style.display = 'none'; return; }
    const review = appState.marriageCreditReview;
    const separateBrackets = getUniqueSorted(review.rows.map(row => row.separateIncome));
    const jointBrackets = getUniqueSorted(review.rows.map(row => row.jointIncome));
    const maxValue = Math.max(...review.rows.map(row => row.value));
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${review.extractedCount}</span><label>PDF rows</label></div><div class="extraction-stat"><span>${separateBrackets.length}</span><label>Separate-income brackets</label></div><div class="extraction-stat"><span>${jointBrackets.length}</span><label>Joint-income brackets</label></div><div class="extraction-stat"><span>${maxValue.toLocaleString()}</span><label>Max credit</label></div>`;
    return;
  }
  if (isHomeownerRefundWorkflow() || isRenterRefundWorkflow()) {
    if (!appState.homeownerRefundReview) { section.style.display = 'none'; return; }
    const review = appState.homeownerRefundReview;
    const rowCount = review.rowTable.rows.length;
    const refundCount = review.refundTable.rows.length;
    const amountColumns = getUniqueSorted(review.refundTable.rows.map(row => row.key[1]));
    const maxRefund = Math.max(...review.refundTable.rows.map(row => row.value));
    section.style.display = 'block';
    document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${rowCount}</span><label>Row-table entries</label></div><div class="extraction-stat"><span>${refundCount}</span><label>Refund entries</label></div><div class="extraction-stat"><span>${amountColumns.length}</span><label>Amount columns</label></div><div class="extraction-stat"><span>${maxRefund.toLocaleString()}</span><label>Max refund</label></div>`;
    return;
  }
  if (!appState.extractedData) { section.style.display = 'none'; return; }
  const maxIncome = Math.max(...Object.values(appState.extractedData).flatMap(v => Object.keys(v).map(Number)));
  const totalEntries = Math.max(...Object.values(appState.extractedData).map(vals => Object.keys(vals).length));
  section.style.display = 'block';
  document.getElementById('extractionSummary').innerHTML = `<div class="extraction-stat"><span>${totalEntries}</span><label>Income brackets</label></div><div class="extraction-stat"><span>${appState.selectedStateConfig.filingStatuses.length}</span><label>Filing statuses</label></div><div class="extraction-stat"><span>$${maxIncome.toLocaleString()}</span><label>Max income</label></div><div class="extraction-stat"><span>${appState.taxYear}</span><label>Tax year</label></div>`;
}


function setExtracting(active) {
  document.getElementById('extractBtn').disabled = active;
  const previewUnitTestLogBtn = document.getElementById('previewUnitTestLogBtn');
  if (previewUnitTestLogBtn) previewUnitTestLogBtn.disabled = active;
  document.getElementById('extractBtn').textContent = getExtractButtonText(active);
  document.getElementById('extractionProgress').style.display = active ? 'block' : 'none';
  if (!active) updateProgress(0, '');
}

function setUpdating(active) {
  document.getElementById('updateJsonBtn').disabled = active;
  const applyUnitTestLogBtn = document.getElementById('applyUnitTestLogBtn');
  if (applyUnitTestLogBtn) applyUnitTestLogBtn.disabled = active;
  document.getElementById('updateJsonBtn').textContent = getUpdateButtonText(active);
}

function updateProgress(pct, msg) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = msg;
}

function updateActionButtons() {
  const hasSource = isUnitTestDateRollerWorkflow()
    ? Boolean(appState.filePaths.TEST_ROOT && appState.filePaths.CALC_ROOT && appState.filePaths.CONSTS)
    : isConstantsMaintenanceWorkflow()
      ? Boolean(appState.filePaths.CONSTS)
      : Boolean(appState.selectedPdfPath) && Boolean(getEffectivePdfPageRange());
  const allPathsSet = getActiveFileTargets().length > 0 && getActiveFileTargets().every(target => appState.filePaths[target.key]);
  const hasExtracted = isMarriageCreditWorkflow()
    ? Boolean(appState.marriageCreditReview?.rows?.length)
    : (isHomeownerRefundWorkflow() || isRenterRefundWorkflow())
      ? Boolean(appState.homeownerRefundReview?.rowTable?.rows?.length && appState.homeownerRefundReview?.refundTable?.rows?.length)
      : isCoFamilyAffordabilityWorkflow()
        ? Boolean(appState.coFamilyAffordabilityReview?.under5?.rows?.length && appState.coFamilyAffordabilityReview?.age6to16?.rows?.length)
        : isUnitTestDateRollerWorkflow()
          ? Boolean(getUnitTestDateRollerApplyRows(appState.unitTestDateRollerReview).length)
        : isConstantsMaintenanceWorkflow()
          ? Boolean(appState.constantsMaintenanceReview?.autoRows?.length || appState.constantsMaintenanceReview?.manualRows?.length)
          : Boolean(appState.extractedData);
  document.getElementById('extractBtn').disabled = !hasSource;
  document.getElementById('updateJsonBtn').disabled = !(hasExtracted && allPathsSet);
  const previewUnitTestLogBtn = document.getElementById('previewUnitTestLogBtn');
  if (previewUnitTestLogBtn) previewUnitTestLogBtn.disabled = !isUnitTestDateRollerWorkflow() || !appState.filePaths.TEST_ROOT;
  const applyUnitTestLogBtn = document.getElementById('applyUnitTestLogBtn');
  if (applyUnitTestLogBtn) applyUnitTestLogBtn.disabled = !isUnitTestDateRollerWorkflow() || !getUnitTestLogApplyRows(appState.unitTestLogReview).length;
}
let toastTimeout;
function clearToast() {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimeout);
  toast.classList.remove('show');
  toast.className = 'toast';
  toast.textContent = '';
}
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimeout);
  const timeoutMs = type === 'error' ? 8000 : 4000;
  toastTimeout = setTimeout(() => toast.classList.remove('show'), timeoutMs);
}

function bindEvents() {
  document.getElementById('stateSelect').addEventListener('change', e => onStateChange(e.target.value));
  document.getElementById('taxYearSelect').addEventListener('change', async e => {
    appState.taxYear = parseInt(e.target.value, 10); resetWorkflowContext(); renderSelectedSource(); await loadFilePaths(); renderFilePickers(); renderExtractedDataSection(); renderDiffSection(); renderMarriageCreditSection(); updateActionButtons();
  });
  document.getElementById('workflowSelect').addEventListener('change', e => onWorkflowChange(e.target.value));
  document.getElementById('selectPdfBtn').addEventListener('click', selectPdf);
  document.getElementById('pdfPageStartInput').addEventListener('input', e => { clearToast(); appState.pdfPageRangeOverride.start = e.target.value.trim(); renderSelectedSource(); updateActionButtons(); });
  document.getElementById('pdfPageEndInput').addEventListener('input', e => { clearToast(); appState.pdfPageRangeOverride.end = e.target.value.trim(); renderSelectedSource(); updateActionButtons(); });
  document.getElementById('constantsShiftDirectionSelect').addEventListener('change', async e => {
    appState.constantsShiftDeltaYears = parseInt(e.target.value, 10) === -1 ? -1 : 1;
    if (appState.constantsMaintenanceReview?.autoRows?.length || appState.constantsMaintenanceReview?.manualRows?.length) {
      appState.constantsMaintenanceReview = buildConstantsMaintenanceReview({
        autoMatches: appState.constantsMaintenanceReview.autoRows.map(row => ({
          index: row.index,
          uid: row.uid,
          name: row.name,
          description: row.description,
          value: row.currentValue,
          dataTimeValue: row.currentDataTimeValue
        })),
        manualMatches: appState.constantsMaintenanceReview.manualRows.map(row => ({
          index: row.index,
          uid: row.uid,
          name: row.name,
          description: row.description,
          baseType: row.baseType,
          value: row.currentValue
        })),
        taxYear: appState.constantsMaintenanceReview.taxYear,
        entity: appState.constantsMaintenanceReview.entity
      }, appState.constantsShiftDeltaYears);
      renderExtractedDataSection();
      renderMarriageCreditSection();
    }
    renderWorkflowText();
    updateActionButtons();
  });
  document.getElementById('extractBtn').addEventListener('click', extractData);
  document.getElementById('updateJsonBtn').addEventListener('click', updateJsonFiles);
  document.getElementById('clearDataBtn').addEventListener('click', clearTransientData);
  const previewUnitTestLogBtn = document.getElementById('previewUnitTestLogBtn');
  if (previewUnitTestLogBtn) previewUnitTestLogBtn.addEventListener('click', previewUnitTestLogUpdates);
  const applyUnitTestLogBtn = document.getElementById('applyUnitTestLogBtn');
  if (applyUnitTestLogBtn) applyUnitTestLogBtn.addEventListener('click', applyUnitTestLogUpdates);
  const calcModalCloseBtn = document.getElementById('calcModalCloseBtn');
  if (calcModalCloseBtn) calcModalCloseBtn.addEventListener('click', closeCalcModal);
  document.querySelectorAll('.calc-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => setCalcModalTab(tab.dataset.calcModalTab));
  });
  const calcModalOverlay = document.getElementById('calcModalOverlay');
  if (calcModalOverlay) calcModalOverlay.addEventListener('click', event => {
    if (event.target === calcModalOverlay) closeCalcModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCalcModal();
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { appState, parseIntegerText, groupPdfTextItemsByRow, findNumericItemsInRange, findMinnesotaValueWindow, parseMinnesotaPdfRows, parseMarriageCreditPdfRows, parseMarriageCreditFromFullText, parseHomeownerRefundPageRows, parseRenterRefundPageRows, buildHomeownerRefundTables, buildRenterRefundTables, overlayGenericTableRows, normalizeRefundJsonRows, normalizeHomeownerRefundJsonRows, parseOrPdfRows, parseCoFamilyAffordabilityPageRows, buildCoFamilyReview, normalizeDeterministicRowsToData, mergeExtractedData, sortMarriageCreditRows, buildMarriageCreditReview, buildGenericTableReview, shiftDateTimeValueByYears, suggestYearOverYearValue, buildConstantsMaintenanceReview, buildUnitTestDateRollerReview, buildUnitTestLogReview, getEffectivePdfPageRange, renderWorkflowText, renderSelectedSource, renderMarriageCreditSection, updateActionButtons, showDiffTab, resetWorkflowContext, clearTransientData };
if (typeof window !== 'undefined' && typeof document !== 'undefined') init();







