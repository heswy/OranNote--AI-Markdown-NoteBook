const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const os = require('os')

let win

// 无头验收/自动化专用环境变量：设置后 pdf:export 跳过保存对话框，直接写入该路径。
// 仅用于 CI 与本地脚本验收（见 spike-report.md 第六节），产品运行时不应设置。
const PDF_TEST_PATH_ENV = 'ORAN_TEST_PDF_PATH'

// Chromium 对 data: URL 长度有上限（约 2MB），超长（含内联图片的文档）时退回临时文件加载
const MAX_DATA_URL_LENGTH = 1500000

// 打印参数：纸张与页边距的唯一来源就是这里（CSS 里不写 @page margin，否则会覆盖本选项）
const PDF_PRINT_OPTIONS = {
  pageSize: 'A4',
  landscape: false,
  // 必设项：代码块/表格/引用块底色全靠它，默认 false 会全部丢失
  printBackground: true,
  displayHeaderFooter: true,
  // 页脚模板是独立文档，不继承页面 CSS，样式与字体必须内联（否则中文会回退）
  headerTemplate: '<div style="height:0;margin:0;"></div>',
  footerTemplate: `
    <div style="width:100%;margin:0 1.5cm;font-family:'WenQuanYi Zen Hei','PingFang SC','Noto Sans CJK SC',sans-serif;font-size:9px;color:#66748a;display:flex;justify-content:space-between;">
      <span>Oran记</span>
      <span>第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</span>
    </div>`,
  // 0.59in ≈ 1.5cm
  margins: { top: 0.59, bottom: 0.59, left: 0.59, right: 0.59 },
  preferCSSPageSize: false
}

// 保存对话框的默认文件名：剥掉路径、清掉非法字符、补齐 .pdf
function normalizeSuggestedName(name) {
  const raw = typeof name === 'string' ? name.trim() : ''
  const base = raw.split(/[\\/]/).pop() || 'orannote.pdf'
  const safe = base.replace(/[\\/:*?"<>|]/g, '_')
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`
}

// 等待打印内容真正就绪：字体度量 + 图片解码完成前打印会得到空白图片位或首行字体回退，
// 行宽变化会导致分页漂移（见 spike-report.md 问题 5）
async function waitForPrintReady(webContents) {
  await webContents.executeJavaScript(`
    (async () => {
      try { await document.fonts.ready } catch (error) { /* 忽略：没有 FontFaceSet 时直接继续 */ }
      const images = Array.from(document.images)
      await Promise.all(images.map((img) => img.complete ? null : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true })
        img.addEventListener('error', resolve, { once: true })
      })))
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return { images: images.length }
    })()
  `, true)
}

async function exportPdfToFile(event, options) {
  const html = typeof options?.html === 'string' ? options.html : ''
  if (!html.trim()) {
    return { ok: false, reason: '缺少待打印的 HTML 内容' }
  }

  let targetPath = (process.env[PDF_TEST_PATH_ENV] || '').trim()
  if (targetPath) {
    // 无头验收专用：ORAN_TEST_PDF_PATH 已设置，跳过保存对话框直接落盘
  } else {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const dialogOptions = {
      title: '导出 PDF',
      defaultPath: normalizeSuggestedName(options?.suggestedName),
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
    }
    const { canceled, filePath } = owner
      ? await dialog.showSaveDialog(owner, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)
    if (canceled || !filePath) {
      return { ok: false, reason: 'canceled' }
    }
    targetPath = filePath
  }

  let printWindow = null
  let tempHtmlPath = null
  try {
    // 隐藏窗口专用于打印；这里不追加 --no-sandbox 之类的开关：
    // 沙箱例外只允许出现在 CI/容器的启动命令行上，绝不进产品代码路径（见 spike-report.md 第五节）
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      await printWindow.loadURL(dataUrl)
    } else {
      tempHtmlPath = path.join(os.tmpdir(), `orannote-print-${process.pid}-${Date.now()}.html`)
      await fs.writeFile(tempHtmlPath, html, 'utf8')
      await printWindow.loadFile(tempHtmlPath)
    }

    await waitForPrintReady(printWindow.webContents)
    const pdf = await printWindow.webContents.printToPDF(PDF_PRINT_OPTIONS)

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, pdf)
    return { ok: true, path: targetPath }
  } catch (error) {
    // printToPDF 失败时是 reject 而不是空 buffer，统一转成 reason 交给渲染层提示
    console.error('PDF 导出失败:', error)
    return { ok: false, reason: error?.message || String(error) }
  } finally {
    if (tempHtmlPath) {
      try { await fs.unlink(tempHtmlPath) } catch (error) { console.warn('临时打印文件清理失败:', error) }
    }
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy()
  }
}

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

  ipcMain.handle('pdf:export', (event, options) => exportPdfToFile(event, options))
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
