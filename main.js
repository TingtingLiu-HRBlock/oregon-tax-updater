const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
const DEFAULT_SINGLE_PATH = 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OR\\Utils\\Tables\\TaxTableForSingle.table.json';
const DEFAULT_JOINT_PATH = 'C:\\TaxEngine\\OCE-Regulatory-2025\\Source\\OR\\Utils\\Tables\\TaxTableForJoint.table.json';

function getJsonPathsFile() {
  return path.join(app.getPath('userData'), 'json-paths.json');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file selection
ipcMain.handle('select-images', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

// Handle JSON file update
ipcMain.handle('update-json-files', async (event, payload) => {
  const taxData = payload && payload.taxData ? payload.taxData : payload;
  const singlePath = payload && payload.singlePath ? payload.singlePath : DEFAULT_SINGLE_PATH;
  const jointPath = payload && payload.jointPath ? payload.jointPath : DEFAULT_JOINT_PATH;

  try {
    // Update Single file
    await updateJsonFile(singlePath, taxData, 'S');
    
    // Update Joint file
    await updateJsonFile(jointPath, taxData, 'J');

    await saveJsonPaths({
      singlePath,
      jointPath
    });
    
    return { 
      success: true, 
      message: 'Both JSON files updated successfully!' 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Error: ${error.message}` 
    };
  }
});

ipcMain.handle('get-json-file-paths', async () => {
  return loadJsonPaths();
});

ipcMain.handle('save-json-file-paths', async (event, paths) => {
  await saveJsonPaths(paths || {});
  return { success: true };
});

ipcMain.handle('select-json-file', async (event, type, currentPath) => {
  const fallbackPath = type === 'joint' ? DEFAULT_JOINT_PATH : DEFAULT_SINGLE_PATH;
  const defaultPath = currentPath || fallbackPath;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    defaultPath,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

async function updateJsonFile(filePath, taxData, filingStatus) {
  // Read the existing JSON file
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(fileContent);
  
  // Update the Year field
  data.Year = 2024;
  
  // Update the tax values in the Fields array
  let updatedCount = 0;
  for (const field of data.Fields) {
    if (field.Key && field.Value !== undefined) {
      const keyValue = parseInt(field.Key);
      if (taxData[keyValue]) {
        const newValue = taxData[keyValue][filingStatus];
        field.Value = String(newValue);
        updatedCount++;
      }
    }
  }
  
  // Write the updated JSON back to file
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`Updated ${updatedCount} entries in ${filePath}`);
}

// Handle text file export
ipcMain.handle('export-text-file', async (event, textContent) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Tax Table as Text',
    defaultPath: 'oregon_tax_table_2024.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    try {
      await fs.writeFile(result.filePath, textContent, 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  return { success: false, message: 'Save cancelled' };
});

async function loadJsonPaths() {
  try {
    const raw = await fs.readFile(getJsonPathsFile(), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      singlePath: parsed.singlePath || DEFAULT_SINGLE_PATH,
      jointPath: parsed.jointPath || DEFAULT_JOINT_PATH
    };
  } catch (error) {
    return {
      singlePath: DEFAULT_SINGLE_PATH,
      jointPath: DEFAULT_JOINT_PATH
    };
  }
}

async function saveJsonPaths(paths) {
  const existing = await loadJsonPaths();
  const merged = {
    singlePath: paths.singlePath || existing.singlePath || DEFAULT_SINGLE_PATH,
    jointPath: paths.jointPath || existing.jointPath || DEFAULT_JOINT_PATH
  };

  await fs.writeFile(getJsonPathsFile(), JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
