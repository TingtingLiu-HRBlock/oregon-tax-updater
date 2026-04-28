const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // State registry
  getAllStates: () => ipcRenderer.invoke('get-all-states'),
  getStateConfig: (code) => ipcRenderer.invoke('get-state-config', code),

  // File dialogs
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file'),
  selectJsonFile: (type, currentPath) => ipcRenderer.invoke('select-json-file', type, currentPath),

  // JSON file operations
  readJsonFilePaths: (stateCode, regulatoryYear, workflowKey) => ipcRenderer.invoke('read-json-file-paths', stateCode, regulatoryYear, workflowKey),
  saveJsonFilePaths: (stateCode, paths, workflowKey) => ipcRenderer.invoke('save-json-file-paths', stateCode, paths, workflowKey),
  readCurrentJsonValues: (filePath) => ipcRenderer.invoke('read-current-json-values', filePath),
  updateJsonFiles: (payload) => ipcRenderer.invoke('update-json-files', payload),
  readMarriageCreditTable: (filePath) => ipcRenderer.invoke('read-marriage-credit-table', filePath),
  replaceMarriageCreditTable: (payload) => ipcRenderer.invoke('replace-marriage-credit-table', payload),
  readGenericTable: (filePath) => ipcRenderer.invoke('read-generic-table', filePath),
  replaceGenericTable: (payload) => ipcRenderer.invoke('replace-generic-table', payload),
  readCoFamilyAffordabilityTable: (filePath) => ipcRenderer.invoke('read-co-family-affordability-table', filePath),
  replaceCoFamilyAffordabilityTable: (payload) => ipcRenderer.invoke('replace-co-family-affordability-table', payload),
  readConstantsMaintenanceFile: (filePath) => ipcRenderer.invoke('read-constants-maintenance-file', filePath),
  applyConstantsYearShift: (payload) => ipcRenderer.invoke('apply-constants-year-shift', payload),
  applyConstantsManualUpdates: (payload) => ipcRenderer.invoke('apply-constants-manual-updates', payload),
  previewUnitTestDateRoll: (payload) => ipcRenderer.invoke('preview-unit-test-date-roll', payload),
  applyUnitTestDateRoll: (payload) => ipcRenderer.invoke('apply-unit-test-date-roll', payload),
  previewUnitTestLogUpdates: (payload) => ipcRenderer.invoke('preview-unit-test-log-updates', payload),
  applyUnitTestLogUpdates: (payload) => ipcRenderer.invoke('apply-unit-test-log-updates', payload),

  // Export
  exportTextFile: (content) => ipcRenderer.invoke('export-text-file', content),

  // File reading for model pipeline
  readBinaryFileAsBase64: (filePath) => ipcRenderer.invoke('read-binary-file-as-base64', filePath),
});
