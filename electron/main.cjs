const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let win

// IPC handler：渲染层通过 preload 暴露的桥调用
function registerIpcHandlers() {
  ipcMain.handle('app:ping', async () => ({
    ok: true,
    name: 'OranNote',
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }))

  ipcMain.handle('pdf:export', async () => ({
    ok: false,
    reason: 'not-implemented'
  }))
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Oran 记',
    show: false,
    backgroundColor: '#111827',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, '../dist/index.html')
    win.loadFile(indexPath)
  } else {
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  }

  win.webContents.on('did-finish-load', () => {
    win.setTitle('Oran 记')
    win.show()
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
