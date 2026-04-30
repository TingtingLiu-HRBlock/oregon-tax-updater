const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getAllStates, getState } = require('./States');
const { buildDefaultPaths, buildStorageKey, normalizeSavedPaths } = require('./pathUtils');
const { buildPreviewRows, applyPreviewRows, serializeTestJson } = require('./unitTestDateRoller');
const { buildLogUpdatePreview, applyLogUpdateRows } = require('./unitTestLogUpdater');
const { parseRelaxedJson } = require('./relaxedJson');
const { buildConstantsByName } = require('./constantsByName');

let mainWindow;
const reviewViewerWindows = new Set();

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

async function readUnitTestReviewFilesPayload(payload) {
  const readRootedFile = async ({ rootPath, filePath, extensionPattern, rootLabel, extensionLabel }) => {
    const resolvedRootPath = path.resolve(rootPath || '');
    const resolvedFilePath = path.resolve(filePath || '');
    const relativePath = path.relative(resolvedRootPath, resolvedFilePath);
    if (!rootPath || !filePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`${rootLabel} file must be inside the selected ${rootLabel.toLowerCase()} root folder.`);
    }
    if (!extensionPattern.test(resolvedFilePath)) {
      throw new Error(`Only ${extensionLabel} files can be opened from this view.`);
    }
    const raw = await fs.readFile(resolvedFilePath, 'utf-8');
    return {
      filePath: resolvedFilePath,
      relativePath,
      content: raw
    };
  };

  const [calc, unitTest] = await Promise.all([
    readRootedFile({
      rootPath: payload?.calcRootPath,
      filePath: payload?.calcFilePath,
      extensionPattern: /\.calc\.json$/i,
      rootLabel: 'Calc',
      extensionLabel: '.calc.json'
    }),
    readRootedFile({
      rootPath: payload?.testRootPath,
      filePath: payload?.testFilePath,
      extensionPattern: /\.test\.json$/i,
      rootLabel: 'Unit test',
      extensionLabel: '.test.json'
    })
  ]);

  return { success: true, calc, unitTest };
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
  const savedPaths = normalizeSavedPaths(stateCode, regulatoryYear, workflowKey, all[key]);
  if (savedPaths && Object.keys(savedPaths).length > 0) return savedPaths;
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
  const directoryTargets = new Set(['TEST_ROOT', 'CALC_ROOT']);
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: directoryTargets.has(type) ? ['openDirectory'] : ['openFile'],
    defaultPath: currentPath || '',
    filters: directoryTargets.has(type)
      ? undefined
      : [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('read-unit-test-calc-file', async (event, payload) => {
  try {
    const calcRootPath = path.resolve(payload?.calcRootPath || '');
    const calcFilePath = path.resolve(payload?.calcFilePath || '');
    const relativePath = path.relative(calcRootPath, calcFilePath);
    if (!calcRootPath || !calcFilePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Calc file must be inside the selected calc root folder.');
    }
    if (!/\.calc\.json$/i.test(calcFilePath)) {
      throw new Error('Only .calc.json files can be opened from this view.');
    }
    const raw = await fs.readFile(calcFilePath, 'utf-8');
    return {
      success: true,
      filePath: calcFilePath,
      relativePath,
      content: raw
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('read-unit-test-review-files', async (event, payload) => {
  try {
    return await readUnitTestReviewFilesPayload(payload);
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('open-unit-test-review-window', async (event, payload) => {
  try {
    const result = await readUnitTestReviewFilesPayload(payload);
    const viewerWindow = new BrowserWindow({
      width: 1100,
      height: 780,
      minWidth: 780,
      minHeight: 520,
      title: 'Calc / Unit Test JSON',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'assets', 'icon.png')
    });

    reviewViewerWindows.add(viewerWindow);
    viewerWindow.on('closed', () => reviewViewerWindows.delete(viewerWindow));
    await viewerWindow.loadFile('calcViewer.html');
    viewerWindow.webContents.send('unit-test-review-files-loaded', result);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
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

function parseIsoDateOnly(value) {
  if (typeof value !== 'string') {
    throw new Error('Expected a date string.');
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid DateTime value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return { year, month, day };
}

function formatIsoDateOnly(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftIsoDateByYears(value, deltaYears) {
  const parsed = parseIsoDateOnly(value);
  const shifted = new Date(Date.UTC(parsed.year + Number(deltaYears), parsed.month - 1, parsed.day));
  return formatIsoDateOnly(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
}

function getYearOverYearDateTimeConstants(constants) {
  if (!Array.isArray(constants)) {
    throw new Error('Invalid JSON structure: missing Constants array');
  }

  return constants
    .map((constant, index) => ({ constant, index }))
    .filter(({ constant }) => constant?.Maintenance === 'Year Over Year' && constant?.BaseType === 'DateTime')
    .map(({ constant, index }) => {
      const currentValue = String(constant.Value || '').trim();
      const currentDateTimeValue = typeof constant.DataTimeValue === 'string' ? constant.DataTimeValue.trim() : '';
      const shiftedValue = shiftIsoDateByYears(currentValue, 0);
      const normalizedDateTimeValue = currentDateTimeValue || `${shiftedValue}T00:00:00.000Z`;

      return {
        index,
        uid: constant.Uid || null,
        name: constant.Name || `Constant ${index + 1}`,
        description: constant.Description || '',
        value: shiftedValue,
        dataTimeValue: normalizedDateTimeValue
      };
    });
}

function getYearOverYearNonDateTimeConstants(constants) {
  if (!Array.isArray(constants)) {
    throw new Error('Invalid JSON structure: missing Constants array');
  }

  return constants
    .map((constant, index) => ({ constant, index }))
    .filter(({ constant }) => constant?.Maintenance === 'Year Over Year' && constant?.BaseType !== 'DateTime')
    .map(({ constant, index }) => ({
      index,
      uid: constant.Uid || null,
      name: constant.Name || `Constant ${index + 1}`,
      description: constant.Description || '',
      baseType: constant.BaseType || '',
      value: constant.Value
    }));
}

function coerceConstantValue(existingValue, nextValue) {
  if (typeof existingValue === 'number') {
    const numericValue = Number(nextValue);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Could not convert "${nextValue}" to a numeric value.`);
    }
    return numericValue;
  }

  if (typeof existingValue === 'boolean') {
    if (typeof nextValue === 'boolean') return nextValue;
    const normalized = String(nextValue).trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    throw new Error(`Could not convert "${nextValue}" to a boolean value.`);
  }

  return String(nextValue);
}

ipcMain.handle('read-constants-maintenance-file', async (event, filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const autoMatches = getYearOverYearDateTimeConstants(data.Constants);
    const manualMatches = getYearOverYearNonDateTimeConstants(data.Constants);

    return {
      success: true,
      taxYear: data.TaxYear || null,
      entity: data.Entity || null,
      autoMatches,
      manualMatches
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('apply-constants-year-shift', async (event, payload) => {
  try {
    const deltaYears = Number(payload?.deltaYears);
    if (!Number.isInteger(deltaYears) || ![-1, 1].includes(deltaYears)) {
      throw new Error('deltaYears must be either 1 or -1.');
    }

    const raw = await fs.readFile(payload.filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.Constants)) {
      throw new Error('Invalid JSON structure: missing Constants array');
    }

    if (Array.isArray(payload?.updates) && payload.updates.length > 0) {
      let updatedCount = 0;
      for (const update of payload.updates) {
        const index = Number(update?.index);
        if (!Number.isInteger(index) || index < 0 || index >= data.Constants.length) {
          throw new Error(`Invalid constant index: ${update?.index}`);
        }
        const constant = data.Constants[index];
        if (constant?.Maintenance !== 'Year Over Year' || constant?.BaseType !== 'DateTime') {
          throw new Error(`Constant at index ${index} is not a Year Over Year DateTime constant.`);
        }
        const finalValue = shiftIsoDateByYears(String(update.finalValue || '').trim(), 0);
        constant.Value = finalValue;
        constant.DataTimeValue = `${finalValue}T00:00:00.000Z`;
        updatedCount += 1;
      }

      await fs.writeFile(payload.filePath, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        updatedCount
      };
    }

    const matches = getYearOverYearDateTimeConstants(data.Constants);

    for (const match of matches) {
      const constant = data.Constants[match.index];
      const shiftedValue = shiftIsoDateByYears(match.value, deltaYears);
      constant.Value = shiftedValue;
      constant.DataTimeValue = `${shiftedValue}T00:00:00.000Z`;
    }

    await fs.writeFile(payload.filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      updatedCount: matches.length
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('apply-constants-manual-updates', async (event, payload) => {
  try {
    if (!Array.isArray(payload?.updates) || payload.updates.length === 0) {
      throw new Error('updates must contain at least one manual constants update.');
    }

    const raw = await fs.readFile(payload.filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.Constants)) {
      throw new Error('Invalid JSON structure: missing Constants array');
    }

    let updatedCount = 0;
    for (const update of payload.updates) {
      const index = Number(update?.index);
      if (!Number.isInteger(index) || index < 0 || index >= data.Constants.length) {
        throw new Error(`Invalid constant index: ${update?.index}`);
      }

      const constant = data.Constants[index];
      if (!constant || constant.Maintenance !== 'Year Over Year' || constant.BaseType === 'DateTime') {
        throw new Error(`Constant at index ${index} is not an editable manual Year Over Year entry.`);
      }

      constant.Value = coerceConstantValue(constant.Value, update.finalValue);
      updatedCount++;
    }

    await fs.writeFile(payload.filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      updatedCount
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

async function collectTestJsonFiles(rootPath) {
  const found = [];

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (['bin', 'obj', 'node_modules', '.git'].includes(entry.name)) continue;
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.test.json')) {
        found.push(fullPath);
      }
    }
  }

  await walk(rootPath);
  return found;
}

async function collectCalcJsonFiles(rootPath) {
  const found = [];

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (['bin', 'obj', 'node_modules', '.git'].includes(entry.name)) continue;
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.calc.json')) {
        found.push(fullPath);
      }
    }
  }

  await walk(rootPath);
  return found;
}

ipcMain.handle('preview-unit-test-date-roll', async (event, payload) => {
  try {
    const stat = await fs.stat(payload.rootPath);
    if (!stat.isDirectory()) {
      throw new Error('The test root path is not a directory.');
    }

    const calcStat = await fs.stat(payload.calcRootPath);
    if (!calcStat.isDirectory()) {
      throw new Error('The calc root path is not a directory.');
    }

    const constantsRaw = await fs.readFile(payload.constantsPath, 'utf-8');
    const constantsData = parseRelaxedJson(constantsRaw);
    const constantsByName = buildConstantsByName(constantsData, { yearOverYearOnly: true });
    const allConstantsByName = buildConstantsByName(constantsData);

    const files = await collectCalcJsonFiles(payload.calcRootPath);
    const previewRows = [];
    let matchedTestFileCount = 0;
    for (const calcFilePath of files) {
      try {
        const relativePath = path.relative(payload.calcRootPath, calcFilePath);
        const testFilePath = path.join(payload.rootPath, relativePath).replace(/\.calc\.json$/i, '.test.json');
        let testStat;
        try {
          testStat = await fs.stat(testFilePath);
        } catch {
          continue;
        }
        if (!testStat.isFile()) {
          continue;
        }

        matchedTestFileCount++;
        const calcRaw = await fs.readFile(calcFilePath, 'utf-8');
        const testRaw = await fs.readFile(testFilePath, 'utf-8');
        const calcJson = parseRelaxedJson(calcRaw);
        const testJson = parseRelaxedJson(testRaw);
        const preview = buildPreviewRows({
          calcJson,
          testJson,
          calcFilePath,
          testFilePath,
          constantsByName,
          allConstantsByName
        });
        previewRows.push(...preview.rows);
      } catch (error) {
        throw new Error(`Failed to preview ${calcFilePath}: ${error.message}`);
      }
    }

    return {
      success: true,
      rootPath: payload.rootPath,
      calcRootPath: payload.calcRootPath,
      constantsPath: payload.constantsPath,
      calcFileCount: files.length,
      fileCount: matchedTestFileCount,
      updateCount: previewRows.filter(row => row.canApply !== false).length,
      reviewCount: previewRows.filter(row => row.canApply === false).length,
      rows: previewRows
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('apply-unit-test-date-roll', async (event, payload) => {
  try {
    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
      throw new Error('rows must contain at least one unit test date update.');
    }

    const rowsByFile = new Map();
    for (const row of payload.rows.filter(candidate => candidate?.canApply !== false)) {
      if (!rowsByFile.has(row.filePath)) rowsByFile.set(row.filePath, []);
      rowsByFile.get(row.filePath).push(row);
    }
    if (rowsByFile.size === 0) {
      throw new Error('No unit test rows were eligible for automatic update.');
    }

    let updatedFileCount = 0;
    let updatedValueCount = 0;
    for (const [filePath, rows] of rowsByFile.entries()) {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = parseRelaxedJson(raw);
        applyPreviewRows(parsed, rows);
        await fs.writeFile(filePath, serializeTestJson(parsed), 'utf-8');
        updatedFileCount++;
        updatedValueCount += rows.reduce((total, row) => total + (Array.isArray(row.updates) && row.updates.length ? row.updates.length : 1), 0);
      } catch (error) {
        throw new Error(`Failed to update ${filePath}: ${error.message}`);
      }
    }

    return {
      success: true,
      updatedFileCount,
      updatedValueCount
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('preview-unit-test-log-updates', async (event, payload) => {
  try {
    const stat = await fs.stat(payload.rootPath);
    if (!stat.isDirectory()) {
      throw new Error('The test root path is not a directory.');
    }
    return await buildLogUpdatePreview({
      rootPath: payload.rootPath,
      stateCode: payload.stateCode,
      logPath: payload.logPath,
      regulatoryYear: payload.regulatoryYear
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('apply-unit-test-log-updates', async (event, payload) => {
  try {
    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
      throw new Error('rows must contain at least one log-derived output update.');
    }
    return await applyLogUpdateRows(payload.rows);
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

function normalizeGenericTableRows(rows) {
  return rows.map((row, index) => {
    const key = Array.isArray(row.key) ? row.key : [row.key];
    const normalizedKey = key.map((part, keyIndex) => {
      const numericPart = Number(part);
      if (!Number.isFinite(numericPart)) {
        throw new Error(`Generic table row ${index + 1} key part ${keyIndex + 1} is not numeric.`);
      }
      return numericPart;
    });
    const value = Number(row.value);
    if (!Number.isFinite(value)) {
      throw new Error(`Generic table row ${index + 1} contains a non-numeric value.`);
    }
    return { key: normalizedKey, value };
  }).sort((a, b) => {
    const maxLength = Math.max(a.key.length, b.key.length);
    for (let index = 0; index < maxLength; index++) {
      const left = a.key[index] ?? Number.NEGATIVE_INFINITY;
      const right = b.key[index] ?? Number.NEGATIVE_INFINITY;
      if (left !== right) return left - right;
    }
    return a.value - b.value;
  });
}

function buildGenericTableFields(rows, existingFields) {
  const valueShouldBeString = Array.isArray(existingFields)
    && existingFields.length > 0
    && typeof existingFields[0].Value === 'string';

  return rows.map(row => ({
    Key: row.key,
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

ipcMain.handle('read-generic-table', async (event, filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.Fields)) {
      return { success: false, message: 'Invalid JSON structure: missing Fields array' };
    }

    const rows = data.Fields.map((field, index) => {
      const key = Array.isArray(field.Key) ? field.Key : [field.Key];
      if (key.length === 0) {
        throw new Error(`Field ${index + 1} is missing a key.`);
      }
      const normalizedKey = key.map((part, keyIndex) => {
        const numericPart = Number(part);
        if (!Number.isFinite(numericPart)) {
          throw new Error(`Field ${index + 1} key part ${keyIndex + 1} is not numeric.`);
        }
        return numericPart;
      });
      const value = Number(field.Value);
      if (!Number.isFinite(value)) {
        throw new Error(`Field ${index + 1} has a non-numeric value.`);
      }
      return { key: normalizedKey, value };
    }).sort((a, b) => {
      const maxLength = Math.max(a.key.length, b.key.length);
      for (let index = 0; index < maxLength; index++) {
        const left = a.key[index] ?? Number.NEGATIVE_INFINITY;
        const right = b.key[index] ?? Number.NEGATIVE_INFINITY;
        if (left !== right) return left - right;
      }
      return a.value - b.value;
    });

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

ipcMain.handle('replace-generic-table', async (event, payload) => {
  try {
    const raw = await fs.readFile(payload.filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.Fields)) {
      throw new Error('Invalid JSON structure: missing Fields array');
    }

    const normalizedRows = normalizeGenericTableRows(payload.rows || []);

    data.Year = payload.taxYear;
    data.Fields = buildGenericTableFields(normalizedRows, data.Fields);

    await fs.writeFile(payload.filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      updatedCount: normalizedRows.length
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

function getCoFamilyStatusSortIndex(status) {
  return {
    'FilingStatus.Single': 0,
    'FilingStatus.MarriedFilingJointly': 1,
    'FilingStatus.MarriedFilingSeparately': 2,
    'FilingStatus.HeadOfHousehold': 3,
    'FilingStatus.QualifyingWidow': 4
  }[status] ?? 999;
}

function normalizeCoFamilyAffordabilityRows(rows) {
  return rows.map((row, index) => {
    const filingStatus = String(row.filingStatus || '').trim();
    const amount = Number(row.amount);
    const value = Number(row.value);

    if (!filingStatus) {
      throw new Error(`Colorado family-affordability row ${index + 1} is missing a filing status.`);
    }
    if (!Number.isFinite(amount) || !Number.isFinite(value)) {
      throw new Error(`Colorado family-affordability row ${index + 1} contains invalid numeric data.`);
    }

    return { filingStatus, amount, value };
  }).sort((a, b) => getCoFamilyStatusSortIndex(a.filingStatus) - getCoFamilyStatusSortIndex(b.filingStatus) || a.amount - b.amount || a.value - b.value);
}

function buildCoFamilyAffordabilityFields(rows, existingFields) {
  const valueShouldBeString = Array.isArray(existingFields)
    && existingFields.length > 0
    && typeof existingFields[0].Value === 'string';
  const amountShouldBeString = Array.isArray(existingFields)
    && existingFields.length > 0
    && Array.isArray(existingFields[0].Key)
    && typeof existingFields[0].Key[1] === 'string';

  return rows.map(row => ({
    Key: [row.filingStatus, amountShouldBeString ? String(row.amount) : Number(row.amount)],
    Value: valueShouldBeString ? String(row.value) : Number(row.value),
    ComplexTypeFields: [],
    ComplexValue: {}
  }));
}

ipcMain.handle('read-co-family-affordability-table', async (event, filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.Fields)) {
      return { success: false, message: 'Invalid JSON structure: missing Fields array' };
    }

    const rows = data.Fields.map((field, index) => {
      if (!Array.isArray(field.Key) || field.Key.length < 2) {
        throw new Error(`Field ${index + 1} is missing the expected filing-status plus amount key.`);
      }
      const filingStatus = String(field.Key[0] || '').trim();
      const amount = Number(field.Key[1]);
      const value = Number(field.Value);
      if (!filingStatus || !Number.isFinite(amount) || !Number.isFinite(value)) {
        throw new Error(`Field ${index + 1} contains invalid Colorado family-affordability data.`);
      }
      return { filingStatus, amount, value };
    }).sort((a, b) => getCoFamilyStatusSortIndex(a.filingStatus) - getCoFamilyStatusSortIndex(b.filingStatus) || a.amount - b.amount || a.value - b.value);

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

ipcMain.handle('replace-co-family-affordability-table', async (event, payload) => {
  try {
    const raw = await fs.readFile(payload.filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.Fields)) {
      throw new Error('Invalid JSON structure: missing Fields array');
    }

    const normalizedRows = normalizeCoFamilyAffordabilityRows(payload.rows || []);

    data.Year = payload.taxYear;
    data.Fields = buildCoFamilyAffordabilityFields(normalizedRows, data.Fields);

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
