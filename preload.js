const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Storage
  readData: (fileName) => ipcRenderer.invoke('storage:read', fileName),
  writeData: (fileName, data) => ipcRenderer.invoke('storage:write', fileName, data),

  // Notifications
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),

  // File dialogs
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  readFile: (filePath) => ipcRenderer.invoke('dialog:readFile', filePath),
  readFileBinary: (filePath) => ipcRenderer.invoke('dialog:readFileBinary', filePath),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('dialog:writeFile', filePath, data)
});
