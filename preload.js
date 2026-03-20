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

  // Export
  exportTextFile: (content) => ipcRenderer.invoke('export-text-file', content),

  // File reading for model pipeline
  readBinaryFileAsBase64: (filePath) => ipcRenderer.invoke('read-binary-file-as-base64', filePath),
});
