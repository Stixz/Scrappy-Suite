const { app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const mammoth = require('mammoth');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

let htmlToDocxModule = null;
let launcherWin = null;
let mainWindow = null;
let closeConfirmationRequestId = 0;
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icons', 'scrappy-suite-icon.ico');
const CACHE_DIR = path.join(app.getPath('temp'), 'scrappy-suite-cache');
const PANEL_STATE_FILE = path.join(app.getPath('userData'), 'panel-state.json');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disk-cache-dir', CACHE_DIR);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

// Persist window state (size and position)
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

async function loadWindowState() {
  try {
    const data = await fs.readFile(WINDOW_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveWindowState(win) {
  if (!win) return;
  try {
    const bounds = win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized()
    };
    await fs.writeFile(WINDOW_STATE_FILE, JSON.stringify(state), 'utf8');
  } catch (err) {
    console.error('Failed saving window state:', err);
  }
}

async function loadPanelState() {
  try {
    const data = await fs.readFile(PANEL_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function savePanelStateFile(state) {
  try {
    await fs.writeFile(PANEL_STATE_FILE, JSON.stringify(Array.isArray(state) ? state : []), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Failed saving panel state:', error);
    return { success: false, error: error.message };
  }
}

const OPEN_DOCUMENT_FILTERS = [
  { name: 'Supported Documents', extensions: ['docx', 'html', 'htm', 'txt', 'md', 'markdown', 'doc'] },
  { name: 'Word Documents', extensions: ['docx', 'doc'] },
  { name: 'Markdown Files', extensions: ['md', 'markdown'] },
  { name: 'HTML Documents', extensions: ['html', 'htm'] },
  { name: 'Text Files', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] }
];

const SAVE_DOCUMENT_FILTERS = [
  { name: 'Word Documents', extensions: ['docx'] },
  { name: 'Markdown Files', extensions: ['md'] },
  { name: 'HTML Documents', extensions: ['html'] },
  { name: 'Text Files', extensions: ['txt'] }
];

async function createWindow() {
  const saved = await loadWindowState();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#111827',
    frame: false,
	scrollbar: false,
    icon: APP_ICON_PATH,
    titleBarStyle: 'hidden',
    title: 'Scrappy Suite',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  // Restore window position/size if available
  if (saved) {
    try {
      if (typeof saved.x === 'number') win.setBounds({ x: saved.x, y: saved.y, width: saved.width, height: saved.height });
      if (typeof saved.isMaximized === 'boolean' && saved.isMaximized) {
        win.maximize();
      }
    } catch (err) {
      console.warn('Could not restore window bounds:', err);
    }
  }

  win.documentState = {
    dirty: false
  };
  win.closeRequestState = {
    approved: false,
    pendingRequestId: null
  };

  const sendWindowState = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:state-changed', win.isMaximized());
    }
  };

  win.on('close', (event) => {
    if (win.closeRequestState?.approved) {
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.destroy();
      }
      return;
    }

    if (!win.documentState?.dirty) {
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.destroy();
      }
      return;
    }

    event.preventDefault();

    if (win.closeRequestState?.pendingRequestId) {
      return;
    }

    const requestId = `close-${++closeConfirmationRequestId}`;
    win.closeRequestState.pendingRequestId = requestId;

    if (!win.webContents.isDestroyed()) {
      win.webContents.send('window:request-close-confirmation', { requestId });
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.on('maximize', sendWindowState);
  win.on('unmaximize', sendWindowState);
  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) {
      return;
    }

    const template = [];

    // Add dictionary suggestions
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions) {
        template.push({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion)
        });
      }
      template.push({ type: 'separator' });
    }

    template.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    );

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.once('did-finish-load', sendWindowState);

  // Persist window state on close
  win.on('close', (event) => {
    // If the close is cancelled by the app, do not persist state
    try {
      // If unsaved changes are present, do not block persistence here; the existing close flow handles user prompts.
      saveWindowState(win);
    } catch (e) {
      console.error('Error saving window state on close:', e);
    }
  });

  mainWindow = win;
  return win;
}

function getWindowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function replaceFileExtension(filePath, extension) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.${extension}`);
}

function getDocumentExtension(filePath) {
  return path.extname(filePath ?? '').toLowerCase();
}

function quotePowerShellValue(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

async function runPowerShell(command) {
  const { stdout, stderr } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  if (stderr?.trim()) {
    console.warn('PowerShell stderr:', stderr.trim());
  }

  return stdout;
}

function getDefaultSavePath(filePath, title = 'Untitled Document', preferredExtension = 'docx') {
  if (filePath) {
    return filePath;
  }

  // Remove illegal filename characters but keep casing and spaces
  const safeName = title
    .replace(/[<>:"/\\|?*]/g, '')
    .trim() || 'Untitled Document';

  return path.join(app.getPath('documents'), `${safeName}.${preferredExtension}`);
}

function buildHtmlDocument(title, bodyHtml) {
  const safeTitle = (title || 'Untitled Document')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${safeTitle}</title>`,
    '</head>',
    `<body>${bodyHtml ?? ''}</body>`,
    '</html>',
    ''
  ].join('\n');
}

async function openDocxDocument(filePath) {
  const result = await convertDocxFileToHtml(filePath);

  return {
    canceled: false,
    filePath,
    format: 'docx',
    title: path.parse(filePath).name,
    content: result.value,
    notices: result.messages.map((message) => message.message)
  };
}

async function openTextDocument(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const extension = getDocumentExtension(filePath);

  return {
    canceled: false,
    filePath,
    format: extension === '.txt' ? 'txt' : (extension === '.md' || extension === '.markdown' ? 'markdown' : 'html'),
    content
  };
}

async function writeDocument(targetPath, payload = {}) {
  const extension = getDocumentExtension(targetPath);
  const htmlDocument = payload.serializedHtml ?? buildHtmlDocument(payload.title, payload.contentHtml);

  if (extension === '.docx') {
    if (!htmlToDocxModule) {
      htmlToDocxModule = require('html-to-docx');
    }

    const buffer = await htmlToDocxModule(htmlDocument, null, {
      title: payload.title || 'Untitled Document',
      creator: 'Scrappy Suite',
      lastModifiedBy: 'Scrappy Suite'
    });
    await fs.writeFile(targetPath, buffer);
    return;
  }

  if (extension === '.txt' || extension === '.md' || extension === '.markdown') {
    await fs.writeFile(targetPath, payload.plainText ?? '', 'utf8');
    return;
  }

  await fs.writeFile(targetPath, htmlDocument, 'utf8');
}

async function handleOpenDocument(event) {
  const window = getWindowFromEvent(event);
  if (!window) {
    return { canceled: true };
  }

  const result = await dialog.showOpenDialog(window, {
    title: 'Open Document',
    properties: ['openFile'],
    filters: OPEN_DOCUMENT_FILTERS
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const extension = getDocumentExtension(filePath);

  if (extension === '.doc') {
    return {
      canceled: true,
      errorCode: 'legacy-doc-unsupported',
      message: 'Legacy .doc files are not supported directly. Open the file in Word or LibreOffice, save it as .docx, then import the .docx file.'
    };
  }

  if (extension === '.docx') {
    return openDocxDocument(filePath);
  }

  return openTextDocument(filePath);
}

async function saveDocument(window, payload = {}, saveAs = false) {
  const { filePath, title, preferredExtension } = payload;
  let targetPath = filePath;

  if (!targetPath || saveAs) {
    const defaultPath = saveAs && filePath && preferredExtension
      ? replaceFileExtension(filePath, preferredExtension)
      : getDefaultSavePath(filePath, title, preferredExtension);
    const result = await dialog.showSaveDialog(window, {
      title: saveAs ? 'Save Document As' : 'Save Document',
      defaultPath,
      filters: SAVE_DOCUMENT_FILTERS
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    targetPath = result.filePath;
  }

  await writeDocument(targetPath, payload);

  return {
    canceled: false,
    filePath: targetPath,
    format: getDocumentExtension(targetPath).slice(1) || 'html'
  };
}

async function handleSaveDocument(event, payload) {
  const window = getWindowFromEvent(event);
  if (!window) {
    return { canceled: true };
  }

  return saveDocument(window, payload, false);
}

async function handleSaveDocumentAs(event, payload) {
  const window = getWindowFromEvent(event);
  if (!window) {
    return { canceled: true };
  }

  return saveDocument(window, payload, true);
}

function handleDocumentDirtyState(event, dirty) {
  const window = getWindowFromEvent(event);
  if (!window) {
    return;
  }

  window.documentState = {
    ...(window.documentState ?? {}),
    dirty: Boolean(dirty)
  };
}

function handleCloseConfirmationResponse(event, payload = {}) {
  const window = getWindowFromEvent(event);
  if (!window || !window.closeRequestState) {
    return;
  }

  const { requestId, approved } = payload;
  if (!requestId || window.closeRequestState.pendingRequestId !== requestId) {
    return;
  }

  window.closeRequestState.pendingRequestId = null;

  if (!approved) {
    return;
  }

  window.documentState = {
    ...(window.documentState ?? {}),
    dirty: false
  };
  window.closeRequestState.approved = true;

  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.destroy();
  }

  window.close();
}

async function handleListDir(event, dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name)
    }));
  } catch (error) {
    console.error('ListDir Error:', error);
    throw error;
  }
}

async function handleGetHomeDir() {
  return app.getPath('documents'); 
}

async function handleGetSpecialPaths() {
  return {
    documents: app.getPath('documents'),
    downloads: app.getPath('downloads'),
    home: app.getPath('home'),
    desktop: app.getPath('desktop')
  };
}

async function handleGetDrives() {
  if (process.platform !== 'win32') return [];
  try {
    const drives = [];
    for (let code = 67; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      try {
        await fs.access(drive);
        drives.push(drive);
      } catch {
        // Ignore missing drives.
      }
    }
    return drives.length ? drives : ['C:\\'];
  } catch (error) {
    console.error('Error listing drives:', error);
    return ['C:\\']; // Fallback
  }
}

async function handleShellOpenPath(event, targetPath) {
  try {
    const error = await shell.openPath(targetPath);
    return error ? { success: false, error } : { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleShellOpenExternal(event, targetUrl) {
  try {
    const url = new URL(targetUrl);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return { success: false, error: 'Unsupported URL protocol.' };
    }

    await shell.openExternal(url.toString());
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Invalid URL.' };
  }
}

function createLauncherWindow() {
  if (launcherWin) {
    if (launcherWin.isVisible()) {
      launcherWin.hide();
    } else {
      launcherWin.show();
      launcherWin.focus();
    }
    return;
  }

  // Position it top-center or similar
  const mainWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  let x = undefined, y = undefined;
  if (mainWin) {
    const bounds = mainWin.getBounds();
    x = Math.round(bounds.x + (bounds.width - 450) / 2);
    y = bounds.y + 70;
  }

  launcherWin = new BrowserWindow({
    width: 450,
    height: 600,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    parent: mainWin || undefined,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  launcherWin.loadFile(path.join(__dirname, 'launcher_window.html'));

  launcherWin.on('closed', () => {
    launcherWin = null;
  });
}

async function handleReadFile(event, filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function handleReadDocument(event, filePath) {
  const extension = getDocumentExtension(filePath);

  if (extension === '.doc') {
    throw new Error('Legacy .doc files are not supported directly. Save the file as .docx first.');
  }

  if (extension === '.docx') {
    return openDocxDocument(filePath);
  }

  return openTextDocument(filePath);
}

async function handleReadDocxAsHtml(event, filePath) {
  const result = await convertDocxFileToHtml(filePath);

  return {
    html: result.value,
    notices: result.messages.map((message) => message.message)
  };
}

async function convertDocxFileToHtml(filePath) {
  const buffer = await fs.readFile(filePath);
  if (!buffer || buffer.length === 0) {
    throw new Error('This .docx file is empty or unreadable.');
  }

  return mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        'u => u',
        'strike => s'
      ]
    }
  );
}

async function handleDeleteFile(event, filePath) {
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    return fs.rm(filePath, { recursive: true, force: false });
  }

  return fs.unlink(filePath);
}

async function handleCreateFile(event, filePath) {
  return fs.writeFile(filePath, '');
}

async function handleCreateFolder(event, dirPath) {
  return fs.mkdir(dirPath, { recursive: true });
}

async function handleCopyFile(event, srcPath, destPath) {
  return fs.copyFile(srcPath, destPath);
}

async function handleMoveFile(event, srcPath, destPath) {
  return fs.rename(srcPath, destPath);
}

async function handleFileExists(event, filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function handleSelectFile(event, options = {}) {
  const window = getWindowFromEvent(event);
  if (!window) return { canceled: true };

  const selectionMode = options.mode === 'folder' ? 'folder' : 'file';
  const properties = selectionMode === 'folder' ? ['openDirectory'] : ['openFile'];
  const result = await dialog.showOpenDialog(window, {
    title: options.title || (selectionMode === 'folder' ? 'Select Folder' : 'Select File'),
    defaultPath: options.defaultPath || undefined,
    properties,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
}

async function handleReadZipContents(event, filePath) {
  const script = [
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `$zip = [System.IO.Compression.ZipFile]::OpenRead(${quotePowerShellValue(filePath)})`,
    'try {',
    '  $entries = @(',
    '    $zip.Entries | ForEach-Object {',
    '      [PSCustomObject]@{',
    '        fullName = $_.FullName',
    '        length = [int64]$_.Length',
    '        compressedLength = [int64]$_.CompressedLength',
    "        lastWriteTime = $_.LastWriteTime.UtcDateTime.ToString('o')",
    '        isDirectory = [string]::IsNullOrEmpty($_.Name)',
    '      }',
    '    }',
    '  )',
    '  $entries | ConvertTo-Json -Compress',
    '} finally {',
    '  $zip.Dispose()',
    '}'
  ].join('\n');

  const stdout = await runPowerShell(script);
  const parsed = stdout?.trim() ? JSON.parse(stdout) : [];
  const entries = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);

  return {
    entries,
    totalEntries: entries.length,
    directoryCount: entries.filter((entry) => entry.isDirectory).length,
    fileCount: entries.filter((entry) => !entry.isDirectory).length
  };
}

async function handleExtractZip(event, zipPath, destinationPath, overwrite = false) {
  const quotedZipPath = quotePowerShellValue(zipPath);
  const quotedDestination = quotePowerShellValue(destinationPath);
  const forceFlag = overwrite ? '-Force' : '';
  const script = [
    `if (-not (Test-Path -LiteralPath ${quotedZipPath})) { throw 'ZIP file not found.' }`,
    `if ((Test-Path -LiteralPath ${quotedDestination}) -and -not ${overwrite ? '$true' : '$false'}) { throw 'Destination already exists.' }`,
    `Expand-Archive -LiteralPath ${quotedZipPath} -DestinationPath ${quotedDestination} ${forceFlag}`
  ].join('; ');

  await runPowerShell(script);
  return { success: true, destinationPath };
}

async function handleCreateZip(event, sourcePath, destinationZipPath, overwrite = false) {
  const quotedSource = quotePowerShellValue(sourcePath);
  const quotedDestination = quotePowerShellValue(destinationZipPath);
  const forceFlag = overwrite ? '-Force' : '';
  const script = [
    `if (-not (Test-Path -LiteralPath ${quotedSource})) { throw 'Source path not found.' }`,
    `if ((Test-Path -LiteralPath ${quotedDestination}) -and -not ${overwrite ? '$true' : '$false'}) { throw 'ZIP file already exists.' }`,
    `Compress-Archive -LiteralPath ${quotedSource} -DestinationPath ${quotedDestination} ${forceFlag}`
  ].join('; ');

  await runPowerShell(script);
  return { success: true, destinationZipPath };
}

async function handleLoadPanelsState() {
  return loadPanelState();
}

async function handleSavePanelsState(event, state) {
  return savePanelStateFile(state);
}

async function handleGenerateThought(event, prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'missing-api-key'
    };
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return {
      success: false,
      error: 'missing-prompt'
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt.trim() }]
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || `request-failed-${response.status}`
      };
    }

    const text = data?.content?.find((item) => item?.type === 'text')?.text?.trim();

    if (!text) {
      return {
        success: false,
        error: 'empty-response'
      };
    }

    return {
      success: true,
      text
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'request-failed'
    };
  }
}

app.whenReady().then(async () => {
  ipcMain.on('launcher:open', () => {
    createLauncherWindow();
  });

  ipcMain.handle('launcher:action', async (_event, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: 'Main window is not available.' };
    }

    mainWindow.webContents.send('launcher:action', payload);
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    return { success: true };
  });

  ipcMain.on('window:minimize', (event) => {
    getWindowFromEvent(event)?.minimize();
  });

  ipcMain.on('window:maximize', (event) => {
    const window = getWindowFromEvent(event);
    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  ipcMain.on('window:close', (event) => {
    const window = getWindowFromEvent(event);
    if (!window) {
      return;
    }

    window.close();
  });

  ipcMain.on('launcher:hide', () => {
    if (launcherWin) {
      launcherWin.hide();
    }
  });

  ipcMain.handle('document:open', handleOpenDocument);
  ipcMain.handle('document:save', handleSaveDocument);
  ipcMain.handle('document:save-as', handleSaveDocumentAs);
  ipcMain.on('document:set-dirty', handleDocumentDirtyState);
  ipcMain.on('window:close-confirmation-response', handleCloseConfirmationResponse);

  ipcMain.handle('file:list-dir', handleListDir);
  ipcMain.handle('file:get-home-dir', handleGetHomeDir);
  ipcMain.handle('file:get-special-paths', handleGetSpecialPaths);
  ipcMain.handle('file:get-drives', handleGetDrives);
  ipcMain.handle('file:read-file', handleReadFile);
  ipcMain.handle('file:read-document', handleReadDocument);
  ipcMain.handle('file:read-docx-as-html', handleReadDocxAsHtml);
  ipcMain.handle('file:delete-file', handleDeleteFile);
  ipcMain.handle('file:create-file', handleCreateFile);
  ipcMain.handle('file:create-folder', handleCreateFolder);
  ipcMain.handle('file:copy-file', handleCopyFile);
  ipcMain.handle('file:move-file', handleMoveFile);
  ipcMain.handle('file:exists', handleFileExists);
  ipcMain.handle('file:select', handleSelectFile);
  ipcMain.handle('file:read-zip-contents', handleReadZipContents);
  ipcMain.handle('file:extract-zip', handleExtractZip);
  ipcMain.handle('file:create-zip', handleCreateZip);

  ipcMain.handle('app-state:load-panels', handleLoadPanelsState);
  ipcMain.handle('app-state:save-panels', handleSavePanelsState);
  ipcMain.handle('thoughts:generate', handleGenerateThought);

  ipcMain.handle('shell:open-path', handleShellOpenPath);
  ipcMain.handle('shell:open-external', handleShellOpenExternal);

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.destroy();
  }
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (launcherWin && !launcherWin.isDestroyed()) {
      launcherWin.destroy();
    }
    app.quit();
  }
});
