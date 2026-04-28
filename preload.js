const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onStateChange: (callback) => {
    ipcRenderer.on('window:state-changed', (_event, isMaximized) => callback(isMaximized));
  }
});

contextBridge.exposeInMainWorld('unsavedChangesApi', {
  onRequestCloseConfirmation: (callback) => {
    ipcRenderer.on('window:request-close-confirmation', (_event, payload) => callback(payload));
  },
  respondCloseConfirmation: (payload) => ipcRenderer.send('window:close-confirmation-response', payload)
});

contextBridge.exposeInMainWorld('documentApi', {
  open: () => ipcRenderer.invoke('document:open'),
  save: (payload) => ipcRenderer.invoke('document:save', payload),
  saveAs: (payload) => ipcRenderer.invoke('document:save-as', payload),
  print: (payload) => ipcRenderer.invoke('document:print', payload),
  savePdf: (payload) => ipcRenderer.invoke('document:save-pdf', payload),
  setDirty: (dirty) => ipcRenderer.send('document:set-dirty', dirty)
});

contextBridge.exposeInMainWorld('fileApi', {
  listDir: (dirPath) => ipcRenderer.invoke('file:list-dir', dirPath),
  getHomeDir: () => ipcRenderer.invoke('file:get-home-dir'),
  getSpecialPaths: () => ipcRenderer.invoke('file:get-special-paths'),
  getDrives: () => ipcRenderer.invoke('file:get-drives'),
  readFile: (filePath) => ipcRenderer.invoke('file:read-file', filePath),
  readDocument: (filePath) => ipcRenderer.invoke('file:read-document', filePath),
  readDocxAsHtml: (filePath) => ipcRenderer.invoke('file:read-docx-as-html', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete-file', filePath),
  createFile: (filePath) => ipcRenderer.invoke('file:create-file', filePath),
  createFolder: (dirPath) => ipcRenderer.invoke('file:create-folder', dirPath),
  copyFile: (srcPath, destPath) => ipcRenderer.invoke('file:copy-file', srcPath, destPath),
  moveFile: (srcPath, destPath) => ipcRenderer.invoke('file:move-file', srcPath, destPath),
  exists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  select: (options) => ipcRenderer.invoke('file:select', options),
  readZipContents: (filePath) => ipcRenderer.invoke('file:read-zip-contents', filePath),
  extractZip: (zipPath, destinationPath, overwrite = false) => ipcRenderer.invoke('file:extract-zip', zipPath, destinationPath, overwrite),
  createZip: (sourcePath, destinationZipPath, overwrite = false) => ipcRenderer.invoke('file:create-zip', sourcePath, destinationZipPath, overwrite)
});

contextBridge.exposeInMainWorld('shellApi', {
  openPath: (path) => ipcRenderer.invoke('shell:open-path', path),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
});

contextBridge.exposeInMainWorld('launcherApi', {
  open: () => ipcRenderer.send('launcher:open'),
  hide: () => ipcRenderer.send('launcher:hide'),
  requestAction: (payload) => ipcRenderer.invoke('launcher:action', payload),
  respondActionResult: (payload) => ipcRenderer.send('launcher:action-result', payload),
  onActionRequested: (callback) => {
    ipcRenderer.on('launcher:action', (_event, payload) => callback(payload));
  }
});

contextBridge.exposeInMainWorld('appStateApi', {
  loadPanelState: () => ipcRenderer.invoke('app-state:load-panels'),
  savePanelState: (state) => ipcRenderer.invoke('app-state:save-panels', state)
});

contextBridge.exposeInMainWorld('thoughtApi', {
  generate: (prompt) => ipcRenderer.invoke('thoughts:generate', prompt)
});

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (updates) => ipcRenderer.invoke('settings:update', updates),
  onChanged: (callback) => {
    ipcRenderer.on('settings:changed', (_event, payload) => callback(payload));
  }
});
