// Preload 脚本（CJS）：通过 contextBridge 向渲染层暴露受控的 IPC 接口
// 只暴露白名单方法，不暴露 ipcRenderer 本身
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('orannote', {
  ping: () => ipcRenderer.invoke('app:ping'),
  exportPdf: (options) => ipcRenderer.invoke('pdf:export', options)
})
