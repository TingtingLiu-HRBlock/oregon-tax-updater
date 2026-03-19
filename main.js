const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getAllStates, getState } = require('./States');
const { buildDefaultPaths, buildStorageKey, normalizeSavedPaths } = require('./pathUtils');

let mainWindow;

function getConfigPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

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

ipcMain.handle('get-all-states', () => {
  return getAllStates().map(s => ({ code: s.code, name: s.name }));
});

ipcMain.handle('get-state-config', (event, code) => {
  return getState(code);
});

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


ipcMain.handle('read-json-file-paths', async (event, stateCode, regulatoryYear, workflowKey = 'standard') => {
  const all = await loadAllJsonPaths();
  const key = buildStorageKey(stateCode, regulatoryYear, workflowKey);
  if (all[key]) return normalizeSavedPaths(stateCode, regulatoryYear, workflowKey, all[key]);
  return normalizeSavedPaths(stateCode, regulatoryYear, workflowKey, buildDefaultPaths(stateCode, regulatoryYear, workflowKey));
});

ipcMain.handle('save-json-file-paths', async (event, stateCode, paths, workflowKey = 'standard') => {
  const all = await loadAllJsonPaths();
  const key = buildStorageKey(paths.stateCode, paths.regulatoryYear, workflowKey);
  all[key] = normalizeSavedPaths(paths.stateCode, paths.regulatoryYear, workflowKey, paths.filePaths);
  await saveAllJsonPaths(all);
  return { success: true };
});

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
      values[parseInt(income, 10)] = field.Value;
    }

    return { success: true, values, year: data.Year, lookUpType: data.LookUpType || 'LowerBoundary' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-json-files', async (event, payload) => {
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

  data.Year = taxYear;

  let updatedCount = 0;
  for (const field of data.Fields) {
    const income = parseInt(Array.isArray(field.Key) ? field.Key[0] : field.Key, 10);
    if (newValues[income] !== undefined) {
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

ipcMain.handle('read-marriage-credit-table', async (event, filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.Fields)) {
      return { success: false, message: 'Invalid JSON structure: missing Fields array' };
    }

    const rows = data.Fields.map((field, index) => {
      if (!Array.isArray(field.Key) || field.Key.length < 2) {
        throw new Error(`Field ${index + 1} is missing a two-part key.`);
      }

      return {
        separateIncome: Number(field.Key[0]),
        jointIncome: Number(field.Key[1]),
        value: Number(field.Value)
      };
    }).sort((a, b) => a.separateIncome - b.separateIncome || a.jointIncome - b.jointIncome);

    return {
      success: true,
      rows,
      year: data.Year,
      metadata: {
        Uid: data.Uid,
        Entity: data.Entity,
        Name: data.Name,
        LookUpType: data.LookUpType,
        LookUpTypeMultiple: data.LookUpTypeMultiple,
        KeyTypes: data.KeyTypes,
        TomKeyTypes: data.TomKeyTypes,
        ValueType: data.ValueType,
        TomValueType: data.TomValueType
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

function normalizeMarriageCreditRows(rows) {
  return rows.map((row, index) => {
    const separateIncome = Number(row.separateIncome);
    const jointIncome = Number(row.jointIncome);
    const value = Number(row.value);

    if (!Number.isFinite(separateIncome) || !Number.isFinite(jointIncome) || !Number.isFinite(value)) {
      throw new Error(`Marriage credit row ${index + 1} contains invalid numeric data.`);
    }

    return { separateIncome, jointIncome, value };
  }).sort((a, b) => a.separateIncome - b.separateIncome || a.jointIncome - b.jointIncome);
}

function buildMarriageCreditFields(rows, existingFields) {
  const valueShouldBeString = Array.isArray(existingFields)
    && existingFields.length > 0
    && typeof existingFields[0].Value === 'string';

  return rows.map(row => ({
    Key: [row.separateIncome, row.jointIncome],
    Value: valueShouldBeString ? String(row.value) : Number(row.value),
    ComplexTypeFields: [],
    ComplexValue: {}
  }));
}


ipcMain.handle('replace-marriage-credit-table', async (event, payload) => {
  try {
    const raw = await fs.readFile(payload.filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.Fields)) {
      throw new Error('Invalid JSON structure: missing Fields array');
    }

    const normalizedRows = normalizeMarriageCreditRows(payload.rows || []);

    data.Year = payload.taxYear;
    data.Fields = buildMarriageCreditFields(normalizedRows, data.Fields);

    await fs.writeFile(payload.filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      updatedCount: normalizedRows.length
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

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

ipcMain.handle('read-binary-file-as-base64', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return { success: true, base64: buffer.toString('base64') };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
