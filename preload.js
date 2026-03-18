const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // State registry
  getAllStates: () => ipcRenderer.invoke('get-all-states'),
  getStateConfig: (code) => ipcRenderer.invoke('get-state-config', code),

  // File dialogs
  selectImages: () => ipcRenderer.invoke('select-images'),
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file'),
  selectJsonFile: (type, currentPath) => ipcRenderer.invoke('select-json-file', type, currentPath),

  // JSON file operations
  readJsonFilePaths: (stateCode, regulatoryYear) => ipcRenderer.invoke('read-json-file-paths', stateCode, regulatoryYear),
  saveJsonFilePaths: (stateCode, paths) => ipcRenderer.invoke('save-json-file-paths', stateCode, paths),
  readCurrentJsonValues: (filePath) => ipcRenderer.invoke('read-current-json-values', filePath),
  updateJsonFiles: (payload) => ipcRenderer.invoke('update-json-files', payload),

  // Export
  exportTextFile: (content) => ipcRenderer.invoke('export-text-file', content),

  // Settings (API key)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // File reading for model pipeline
  readBinaryFileAsBase64: (filePath) => ipcRenderer.invoke('read-binary-file-as-base64', filePath),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('read-image-as-base64', filePath),
});
