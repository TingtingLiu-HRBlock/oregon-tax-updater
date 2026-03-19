const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getAllStates, getState } = require('./States');

let mainWindow;

// ─── Config file paths ───────────────────────────────────────────────────────

function getConfigPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── State registry handlers ─────────────────────────────────────────────────

ipcMain.handle('get-all-states', () => {
  return getAllStates().map(s => ({ code: s.code, name: s.name }));
});

ipcMain.handle('get-state-config', (event, code) => {
  return getState(code);
});

// ─── JSON file path persistence ──────────────────────────────────────────────

async function loadAllJsonPaths() {
  try {
    const raw = await fs.readFile(getConfigPath('json-paths.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveAllJsonPaths(allPaths) {
  await fs.writeFile(getConfigPath('json-paths.json'), JSON.stringify(allPaths, null, 2), 'utf-8');
}

// Build default paths for a state + regulatory year
function buildDefaultPaths(stateCode, regulatoryYear) {
  const stateConfig = getState(stateCode);
  if (!stateConfig) return {};
  const result = {};
  for (const status of stateConfig.filingStatuses) {
    result[status.key] = status.defaultPathTemplate.replace('{regulatoryYear}', regulatoryYear);
  }
  return result;
}

ipcMain.handle('read-json-file-paths', async (event, stateCode, regulatoryYear) => {
  const all = await loadAllJsonPaths();
  const key = `${stateCode}-${regulatoryYear}`;
  if (all[key]) return all[key];
  // Return defaults if no saved paths
  return buildDefaultPaths(stateCode, regulatoryYear);
});

ipcMain.handle('save-json-file-paths', async (event, stateCode, paths) => {
  const all = await loadAllJsonPaths();
  // paths contains { stateCode, regulatoryYear, filePaths: { [statusKey]: path } }
  const key = `${paths.stateCode}-${paths.regulatoryYear}`;
  all[key] = paths.filePaths;
  await saveAllJsonPaths(all);
  return { success: true };
});

// ─── File dialogs ─────────────────────────────────────────────────────────────


ipcMain.handle('select-pdf-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-json-file', async (event, type, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    defaultPath: currentPath || '',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── Read current JSON values for diff ───────────────────────────────────────

ipcMain.handle('read-current-json-values', async (event, filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.Fields || !Array.isArray(data.Fields)) {
      return { success: false, message: 'Invalid JSON structure: missing Fields array' };
    }

    const values = {};
    for (const field of data.Fields) {
      const income = Array.isArray(field.Key) ? field.Key[0] : field.Key;
      values[parseInt(income)] = field.Value;
    }

    return { success: true, values, year: data.Year, lookUpType: data.LookUpType || 'LowerBoundary' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// ─── Update JSON files ────────────────────────────────────────────────────────

ipcMain.handle('update-json-files', async (event, payload) => {
  // payload: { taxYear, updates: [{ statusKey, filePath, newValues: { [income]: value } }] }
  const results = [];

  for (const update of payload.updates) {
    try {
      await updateJsonFile(update.filePath, update.newValues, payload.taxYear);
      results.push({ statusKey: update.statusKey, success: true });
    } catch (error) {
      results.push({ statusKey: update.statusKey, success: false, message: error.message });
    }
  }

  return results;
});

async function updateJsonFile(filePath, newValues, taxYear) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);

  if (!data.Fields || !Array.isArray(data.Fields)) {
    throw new Error(`Invalid JSON structure in ${filePath}`);
  }

  // Update year
  data.Year = taxYear;

  let updatedCount = 0;
  for (const field of data.Fields) {
    const income = parseInt(Array.isArray(field.Key) ? field.Key[0] : field.Key);
    if (newValues[income] !== undefined) {
      // Preserve existing value type (string vs number)
      const existingValue = field.Value;
      const newVal = newValues[income];
      field.Value = typeof existingValue === 'string' ? String(newVal) : Number(newVal);
      updatedCount++;
    }
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Updated ${updatedCount} entries in ${path.basename(filePath)}`);
  return updatedCount;
}

// ─── Export text file ─────────────────────────────────────────────────────────

ipcMain.handle('export-text-file', async (event, textContent) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Tax Table',
    defaultPath: 'tax_table_export.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, message: 'Cancelled' };
  }

  try {
    await fs.writeFile(result.filePath, textContent, 'utf-8');
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// ─── Read image as base64 (for model API) ────────────────────────────────────

ipcMain.handle('read-binary-file-as-base64', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return { success: true, base64: buffer.toString('base64') };
  } catch (error) {
    return { success: false, message: error.message };
  }
});





