import React, { useState, useEffect, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { useAppStore } from '@/stores/appStore'
import { markdown } from '@codemirror/lang-markdown'

import { Eye, Edit3, Columns, Save, FileDown } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { FileSystemService } from '@/services/fileSystem'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { toast } from 'sonner'

// 自定义Markdown预览样式
const markdownStyles = `
  .markdown-preview h1 { font-size: 2rem; font-weight: 700; color: #10b981; margin: 1.5rem 0 1rem 0; border-bottom: 2px solid #374151; padding-bottom: 0.5rem; }
  .markdown-preview h2 { font-size: 1.5rem; font-weight: 600; color: #34d399; margin: 1.25rem 0 0.75rem 0; border-bottom: 1px solid #374151; padding-bottom: 0.25rem; }
  .markdown-preview h3 { font-size: 1.25rem; font-weight: 600; color: #6ee7b7; margin: 1rem 0 0.5rem 0; }
  .markdown-preview h4 { font-size: 1.125rem; font-weight: 600; color: #9ca3af; margin: 0.75rem 0 0.5rem 0; }
  .markdown-preview h5 { font-size: 1rem; font-weight: 600; color: #d1d5db; margin: 0.5rem 0 0.25rem 0; }
  .markdown-preview h6 { font-size: 0.875rem; font-weight: 600; color: #9ca3af; margin: 0.5rem 0 0.25rem 0; }
  .markdown-preview p { color: #e5e7eb; line-height: 1.7; margin-bottom: 1rem; }
  .markdown-preview ul { list-style-type: disc; color: #e5e7eb; margin: 0.5rem 0; padding-left: 1.5rem; }
  .markdown-preview ol { list-style-type: decimal; color: #e5e7eb; margin: 0.5rem 0; padding-left: 1.5rem; }
  .markdown-preview li { margin: 0.25rem 0; line-height: 1.6; }
  .markdown-preview a { color: #60a5fa; text-decoration: underline; }
  .markdown-preview a:hover { color: #3b82f6; }
  .markdown-preview strong { color: #fb923c; font-weight: 700; }
  .markdown-preview em { color: #c084fc; font-style: italic; }
  .markdown-preview code { background-color: #1f2937; color: #fdba74; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.875rem; }
  .markdown-preview pre { background-color: #111827; border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
  .markdown-preview pre code { background-color: transparent; color: #e5e7eb; padding: 0; border-radius: 0; }
  .markdown-preview blockquote { border-left: 4px solid #6b7280; background-color: #1f2937; padding: 0.75rem 1rem; margin: 1rem 0; border-radius: 0 0.375rem 0.375rem 0; font-style: italic; color: #d1d5db; }
  .markdown-preview table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  .markdown-preview th { background-color: #374151; color: #e5e7eb; padding: 0.75rem; border: 1px solid #4b5563; text-align: left; font-weight: 600; }
  .markdown-preview td { background-color: #1f2937; color: #e5e7eb; padding: 0.75rem; border: 1px solid #4b5563; }
  .markdown-preview tr:nth-child(even) td { background-color: #111827; }
  .markdown-preview img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; }
  .markdown-preview hr { border: none; border-top: 1px solid #374151; margin: 2rem 0; }
`

export const MarkdownEditor: React.FC = () => {
  const { 
    activeFile, 
    fileContents, 
    editorMode, 
    setEditorMode, 
    setFileContent, 
    markUnsaved, 
    markSaved,
    unsavedChanges,
    workspace,
    workspaceHandle,
    setFileTree,
    setActiveFile,
    addOpenFile
  } = useAppStore()
  const { addPendingSnippet } = useAppStore()
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [overlayEdit, setOverlayEdit] = useState<{ show: boolean, top: number, left: number, text: string, lineStart?: number, lineEnd?: number }>({ show: false, top: 0, left: 0, text: '' })
  const [overlayPreview, setOverlayPreview] = useState<{ show: boolean, top: number, left: number, text: string, lineStart?: number, lineEnd?: number }>({ show: false, top: 0, left: 0, text: '' })
  
  const [content, setContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const objectUrlCacheRef = useRef<Map<string, string>>(new Map())

  const ensureImagesFolder = async () => {
    if (workspace && workspaceHandle) {
      try {
        await FileSystemService.createFolder(`${workspace}/images`, workspaceHandle as any, workspace)
      } catch {}
    }
  }

  const saveClipboardImages = async (e: React.ClipboardEvent) => {
    const dt = e.clipboardData
    const items = dt?.items
    const filesList = dt?.files
    if (!items && !filesList) return
    let imageFiles: File[] = []
    if (items) {
      imageFiles = Array.from(items).map(it => it.getAsFile()).filter((f): f is File => !!f && f.type.startsWith('image/'))
    }
    if (imageFiles.length === 0 && filesList) {
      imageFiles = Array.from(filesList).filter(f => f.type.startsWith('image/'))
    }
    const hasImage = imageFiles.length > 0
    if (hasImage && (!workspace || !workspaceHandle)) {
      toast.error('请先通过“选择目录”授权工作区后再粘贴图片')
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!workspace || !workspaceHandle) return
    const inserts: string[] = []
    await ensureImagesFolder()
    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        const ext = file.type.includes('png') ? '.png' : file.type.includes('jpeg') ? '.jpg' : file.type.includes('gif') ? '.gif' : file.type.includes('webp') ? '.webp' : '.png'
        const name = `pasted_${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`
        const path = `${workspace}/images/${name}`
        try {
          await FileSystemService.writeFile(path, file, workspaceHandle as any, workspace)
          inserts.push(`![${name}](images/${name})`)
        } catch (err) {
          console.error('保存粘贴图片失败:', err)
        }
      }
    } else if (dt) {
      const html = dt.getData('text/html')
      const plain = dt.getData('text/plain')
      const imgSrcMatch = html && html.match(/<img[^>]*src=["']([^"']+)["']/i)
      const src = imgSrcMatch ? imgSrcMatch[1] : (plain && /^https?:.*\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(plain) ? plain : '')
      if (src) {
        try {
          const resp = await fetch(src)
          const blob = await resp.blob()
          const mime = blob.type || ''
          const ext = mime.includes('png') ? '.png' : mime.includes('jpeg') ? '.jpg' : mime.includes('gif') ? '.gif' : mime.includes('webp') ? '.webp' : '.png'
          const name = `pasted_${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`
          const path = `${workspace}/images/${name}`
          await FileSystemService.writeFile(path, blob, workspaceHandle as any, workspace)
          inserts.push(`![${name}](images/${name})`)
        } catch (err) {
          console.error('保存粘贴图片失败:', err)
        }
      }
    }
    if (inserts.length > 0) {
      const next = content ? `${content}\n\n${inserts.join('\n')}` : inserts.join('\n')
      setContent(next)
      if (activeFile) {
        setFileContent(activeFile, next)
        markUnsaved(activeFile)
      }
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // 渲染Markdown
  const renderMarkdown = (markdownText: string) => {
    const renderer = new marked.Renderer()
    
    // 自定义代码块渲染
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const validLanguage = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        const highlighted = hljs.highlight(text, { language: validLanguage }).value
        return `<pre class="code-block"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`
      } catch (error) {
        // 如果高亮失败，返回普通代码块
        return `<pre class="code-block"><code class="language-${validLanguage}">${text}</code></pre>`
      }
    }
    // 图片渲染保持原始路径，渲染后替换为Blob URL
    renderer.image = ({ href, text }: any) => {
      const src = href || ''
      const alt = text || ''
      return `<img data-origin-src="${src}" alt="${alt}" />`
    }
    
    // 使用marked的默认渲染，但通过CSS样式来美化
    marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: false,
      pedantic: false
    })
    
    const html = marked.parse(markdownText)
    return { __html: html }
  }

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)

  const markdownToPlainText = (md: string) => {
    const html = marked.parse(md) as string
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  const blobToDataURL = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })

  const resolveLocalImage = async (src: string): Promise<string | null> => {
    if (!workspace || !workspaceHandle || !activeFile) return null
    const baseDir = activeFile.slice(0, activeFile.lastIndexOf('/'))
    const normalize = (p: string) => {
      const parts = p.split('/').filter(Boolean)
      const out: string[] = []
      for (const part of parts) {
        if (part === '.') continue
        if (part === '..') out.pop()
        else out.push(part)
      }
      return '/' + out.join('/')
    }
    if (src.startsWith('http') || src.startsWith('data:')) return null
    let filePath = ''
    if (src.startsWith('/')) {
      filePath = `${workspace}/${src.slice(1)}`
    } else if (src.startsWith('images/')) {
      filePath = `${workspace}/${src}`
    } else {
      const activeRel = activeFile.startsWith(workspace)
        ? activeFile.slice(workspace.length + 1)
        : activeFile
      const dirRel = activeRel.split('/').slice(0, -1).join('/')
      const rel = dirRel ? `${dirRel}/${src}` : src
      filePath = `${workspace}/${rel}`
    }
    try {
      const blob = await FileSystemService.readFileBlob(filePath, workspace, workspaceHandle as any)
      if (blob) return await blobToDataURL(blob)
    } catch {}
    try {
      const base = src.split('/').pop() || src
      const altPath = `${workspace}/images/${base}`
      const blob2 = await FileSystemService.readFileBlob(altPath, workspace, workspaceHandle as any)
      if (blob2) return await blobToDataURL(blob2)
    } catch {}
    return null
  }

  const sanitizeHtmlForCanvas = async (html: string): Promise<string> => {
    const container = document.createElement('div')
    container.innerHTML = html
    const imgs = Array.from(container.querySelectorAll('img'))
    for (const img of imgs) {
      const src = img.getAttribute('src') || img.getAttribute('data-origin-src') || ''
      if (!src) continue
      try {
        if (src.startsWith('data:')) continue
        if (src.startsWith('http')) {
          const resp = await fetch(src, { mode: 'cors' })
          if (resp.ok) {
            const b = await resp.blob()
            const data = await blobToDataURL(b)
            img.setAttribute('src', data)
          } else {
            img.removeAttribute('src')
          }
        } else {
          const data = await resolveLocalImage(src)
          if (data) img.setAttribute('src', data)
          else img.removeAttribute('src')
        }
      } catch {
        img.removeAttribute('src')
      }
    }
    container.querySelectorAll('iframe,video').forEach(el => el.parentElement?.removeChild(el))
    return container.innerHTML
  }

  const handleExportPdfStyled = async () => {
    if (!activeFile || !activeFile.toLowerCase().endsWith('.md')) return
    const raw = marked.parse(content || '') as string
    const html = await sanitizeHtmlForCanvas(raw)
    const printCss = `
      ${markdownStyles}
      html, body { background: #ffffff; color: #000; }
      .markdown-preview { color: #000; }
      .markdown-preview h1, .markdown-preview h2, .markdown-preview h3 { color: #000; }
      .markdown-preview p, .markdown-preview li { color: #000; }
      .markdown-preview strong, .markdown-preview em, .markdown-preview a { color: #000 !important; }
      .markdown-preview code { background-color: #f3f4f6; color: #111827; }
      .markdown-preview pre { background-color: #f9fafb; border-color: #e5e7eb; }
      img { page-break-inside: avoid; }
      @page { size: A4; margin: 20mm; }
    `
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Export</title><style>${printCss}</style></head><body><div class="markdown-preview">${html}</div><script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script><script>(function(){function onRendered(){setTimeout(function(){try{window.print()}catch(e){}},200)};document.addEventListener('DOMContentLoaded',function(){try{if(window.PagedPolyfill){new window.PagedPolyfill();document.addEventListener('pagedjs:rendered',onRendered)} else {onRendered()}}catch(e){onRendered()}})})();</script></body></html>`
    const blobUrl = URL.createObjectURL(new Blob([doc], { type: 'text/html' }))
    const w = window.open(blobUrl, '_blank')
    if (!w) { toast.error('请允许浏览器弹窗以导出 PDF'); URL.revokeObjectURL(blobUrl); return }
  }
  const handleExportPdfWithPdfLib = async () => {
    if (!activeFile || !activeFile.toLowerCase().endsWith('.md')) { toast.error('仅支持将 Markdown 文件导出为 PDF'); return }
    if (!workspace || !workspaceHandle) { toast.error('请先选择工作区目录'); return }
    try {
      const text = markdownToPlainText(content || '')
      const pdfDoc = await PDFDocument.create()
      pdfDoc.registerFontkit(fontkit)
      let font = null as any
      // 1) 优先读取本地工作区字体 /.oran/fonts/NotoSansSC-Regular.ttf
      try {
        const localFontPath = `${workspace}/.oran/fonts/NotoSansSC-Regular.ttf`
        const blob = await FileSystemService.readFileBlob(localFontPath, workspace, workspaceHandle as any)
        if (blob) {
          const buf = new Uint8Array(await blob.arrayBuffer())
          font = await pdfDoc.embedFont(buf)
        }
      } catch {}
      // 2) 远程拉取字体
      if (!font) {
        try {
          const fontResp = await fetch('https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/TTF/SimplifiedChinese/NotoSansSC-Regular.ttf')
          const fontBytes = await fontResp.arrayBuffer()
          font = await pdfDoc.embedFont(new Uint8Array(fontBytes))
        } catch {}
      }
      // 3) 如果仍无自定义字体，则使用内置 Helvetica，文本包含中文时将自动走图像化备选
      if (!font) {
        font = await pdfDoc.embedStandardFont(StandardFonts.Helvetica)
      }
      const pageWidth = 595
      const pageHeight = 842
      const margin = 40
      const fontSize = 12
      const lineGap = 16
      const maxWidth = pageWidth - margin * 2
      let textEncodeError = false
      let textDrawn = false
      const wrapText = (s: string): string[] => {
        const out: string[] = []
        let cur = ''
        for (const ch of s) {
          const next = cur + ch
          try {
            if (font.widthOfTextAtSize(next, fontSize) > maxWidth) {
              out.push(cur)
              cur = ch
            } else {
              cur = next
            }
          } catch {
            // 字体无法编码该字符，标记为需要图像化备选
            textEncodeError = true
            cur = next
          }
        }
        if (cur) out.push(cur)
        return out
      }
      // 1) 优先尝试保留 Markdown 样式的导出（HTML→SVG foreignObject→JPEG→PDF）
      try {
        const rawHtml = marked.parse(content || '') as string
        const sanitized = await sanitizeHtmlForCanvas(rawHtml)
        const pageWidth = 595
        const pageHeight = 842
        const widthPx = 1240
        const heightPxPerPage = Math.round(widthPx * (pageHeight / pageWidth))
        const overrideCss = `
          .markdown-preview { color: #000; }
          .markdown-preview p, .markdown-preview li { color: #000; }
          .markdown-preview code { color: #000; background-color: #f3f4f6; }
          .markdown-preview pre { background-color: #f9fafb; border-color: #e5e7eb; }
        `
        const svgTpl = (innerHtml: string, w: number, h: number) => `<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;color:#000;width:${w}px;height:${h}px;overflow:hidden;padding:32px;box-sizing:border-box"><style>${markdownStyles}${overrideCss}</style><div class="markdown-preview" style="max-width:100%">${innerHtml}</div></div></foreignObject></svg>`
        const measureHeight = (() => {
          const tmp = document.createElement('div')
          tmp.style.position = 'fixed'; tmp.style.left = '-9999px'; tmp.style.top = '-9999px'; tmp.style.width = `${widthPx}px`
          tmp.innerHTML = `<style>${markdownStyles}${overrideCss}</style><div class="markdown-preview" style="padding:32px">${sanitized}</div>`
          document.body.appendChild(tmp)
          const h = Math.max(tmp.scrollHeight, heightPxPerPage)
          document.body.removeChild(tmp)
          return h
        })()
        const svg = svgTpl(sanitized, widthPx, measureHeight)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = url
        await img.decode()
        URL.revokeObjectURL(url)
        const pages: Uint8Array[] = []
        const canvas = document.createElement('canvas')
        canvas.width = widthPx; canvas.height = heightPxPerPage
        const ctx = canvas.getContext('2d')!
        let yCut = 0
        while (yCut < img.height) {
          ctx.clearRect(0, 0, widthPx, heightPxPerPage)
          ctx.drawImage(img, 0, yCut, widthPx, heightPxPerPage, 0, 0, widthPx, heightPxPerPage)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
          const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
          pages.push(bytes)
          yCut += heightPxPerPage
        }
        for (const pg of pages) {
          const jpg = await pdfDoc.embedJpg(pg)
          const p = pdfDoc.addPage([pageWidth, pageHeight])
          p.drawImage(jpg, { x: 0, y: 0, width: pageWidth, height: pageHeight })
        }
        const pdfBytesStyled = await pdfDoc.save()
        const styledBuf = pdfBytesStyled.buffer.slice(pdfBytesStyled.byteOffset, pdfBytesStyled.byteOffset + pdfBytesStyled.byteLength)
        const blobStyled = new Blob([styledBuf], { type: 'application/pdf' })
        const pdfPathStyled = activeFile!.replace(/\.md$/i, '.pdf')
        await FileSystemService.writeFile(pdfPathStyled, blobStyled, workspaceHandle as any, workspace)
        const filesStyled = await FileSystemService.getWorkspaceFiles(workspace!, workspaceHandle as any)
        setFileTree(filesStyled)
        setActiveFile(pdfPathStyled)
        addOpenFile(pdfPathStyled)
        toast.success('已导出为 PDF，并已打开预览')
        return
      } catch {}

      // 2) 若样式导出失败，回退为文字绘制+图片嵌入
      const lines = text.split('\n').flatMap(wrapText)
      let page = pdfDoc.addPage([pageWidth, pageHeight])
      let y = pageHeight - margin
      try {
        for (const ln of lines) {
          if (y < margin + fontSize) {
            page = pdfDoc.addPage([pageWidth, pageHeight])
            y = pageHeight - margin
          }
          page.drawText(ln, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0, 0, 0) })
          textDrawn = true
          y -= lineGap
        }
      } catch (e) {
        textEncodeError = true
      }
      // 追加图片：提取 Markdown 图片并嵌入到页面底部（按宽度适配）
      const imageSrcs: string[] = []
      const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
      for (const m of content.matchAll(imgRegex)) {
        const src = (m[1] || '').trim()
        if (src) imageSrcs.push(src)
      }
      const fetchImageBytes = async (src: string): Promise<{ bytes: Uint8Array, kind: 'jpg' | 'png' } | null> => {
        try {
          if (src.startsWith('data:')) {
            const base64 = src.split(',')[1] || ''
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const kind = src.includes('png') ? 'png' : 'jpg'
            return { bytes, kind }
          }
          if (src.startsWith('http')) {
            const resp = await fetch(src, { mode: 'cors' })
            const ab = await resp.arrayBuffer()
            const bytes = new Uint8Array(ab)
            const kind = src.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
            return { bytes, kind }
          }
          // 本地相对路径
          const baseDir = activeFile.slice(0, activeFile.lastIndexOf('/'))
          const baseRel = baseDir.startsWith(`${workspace}/`) ? baseDir.slice(workspace.length + 1) : baseDir
          const rel = src.startsWith('/') ? src.slice(1) : `${baseRel}/${src}`
          const abs = `${workspace}/${rel}`
          const blob = await FileSystemService.readFileBlob(abs, workspace, workspaceHandle as any)
          if (!blob) return null
          const ab = await blob.arrayBuffer()
          const bytes = new Uint8Array(ab)
          const kind = (blob.type && blob.type.includes('png')) || src.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
          return { bytes, kind }
        } catch { return null }
      }
      const drawImages = async () => {
        for (const src of imageSrcs) {
          const data = await fetchImageBytes(src)
          if (!data) continue
          const img = data.kind === 'png' ? await pdfDoc.embedPng(data.bytes) : await pdfDoc.embedJpg(data.bytes)
          const scale = img.width > maxWidth ? maxWidth / img.width : 1
          const drawW = img.width * scale
          const drawH = img.height * scale
          if (y < margin + drawH) {
            page = pdfDoc.addPage([pageWidth, pageHeight])
            y = pageHeight - margin
          }
          page.drawImage(img, { x: margin, y: y - drawH, width: drawW, height: drawH })
          y -= (drawH + 12)
        }
      }
      await drawImages()

      // 如文本编码失败（缺中文字体），切换到图像化渲染备选：将文本按页渲染为SVG图片再嵌入PDF
      if (textEncodeError) {
        if (!textDrawn && pdfDoc.getPageCount() > 0) {
          pdfDoc.removePage(0)
        }
        const widthPx = 1240
        const heightPxPerPage = Math.round(widthPx * (pageHeight / pageWidth))
        const usablePx = widthPx - 80
        const imgFontSize = 32
        const imgLineGap = 42
        const charLimit = Math.max(1, Math.floor(usablePx / imgFontSize))
        const sanitize = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        const wrapByLimit = (s: string): string[] => {
          const chars = Array.from(s)
          const out: string[] = []
          for (let i = 0; i < chars.length; i += charLimit) {
            out.push(chars.slice(i, i + charLimit).join(''))
          }
          return out.length ? out : ['']
        }
        const rawLines = text.split('\n')
        const wrapped = rawLines.flatMap(wrapByLimit)
        const svgWrap = (pageLines: string[]) => {
          const y0 = 40 + imgFontSize
          const items = pageLines.map((ln, i) => `<text x="40" y="${y0 + i * imgLineGap}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="${imgFontSize}" fill="#000000" xml:space="preserve">${sanitize(ln)}</text>`).join('\n')
          return `<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPxPerPage}"><rect x="0" y="0" width="${widthPx}" height="${heightPxPerPage}" fill="#ffffff"/>${items}</svg>`
        }
        const maxLines = Math.floor((heightPxPerPage - 80) / imgLineGap)
        const makeJpeg = async (svg: string) => {
          const blob = new Blob([svg], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(blob)
          const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode(); URL.revokeObjectURL(url)
          const canvas = document.createElement('canvas'); canvas.width = widthPx; canvas.height = heightPxPerPage
          const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
          return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
        }
        for (let i = 0; i < wrapped.length; i += maxLines) {
          const svg = svgWrap(wrapped.slice(i, i + maxLines))
          const bytes = await makeJpeg(svg)
          const jpg = await pdfDoc.embedJpg(bytes)
          const p = pdfDoc.addPage([pageWidth, pageHeight])
          p.drawImage(jpg, { x: 0, y: 0, width: pageWidth, height: pageHeight })
        }
      }
      const pdfBytes = await pdfDoc.save()
      const plainBuf = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
      const blob = new Blob([plainBuf], { type: 'application/pdf' })
      const pdfPath = activeFile.replace(/\.md$/i, '.pdf')
      await FileSystemService.writeFile(pdfPath, blob, workspaceHandle as any, workspace)
      const files = await FileSystemService.getWorkspaceFiles(workspace, workspaceHandle as any)
      setFileTree(files)
      setActiveFile(pdfPath)
      addOpenFile(pdfPath)
      toast.success('已导出为 PDF，并已打开预览')
    } catch (e) {
      console.error(e)
      toast.error('导出失败')
    }
  }

  const escapePdfText = (s: string) => s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/\t/g, '    ')
    .replace(/\u0000/g, '')

  const buildPdf = (text: string): Blob => {
    const pageW = 595
    const pageH = 842
    const marginX = 40
    const marginY = 40
    const fontSize = 12
    const leading = 16
    const maxChars = 80
    const wrap = (line: string) => {
      const out: string[] = []
      let s = line
      while (s.length > maxChars) {
        let idx = s.lastIndexOf(' ', maxChars)
        if (idx <= 0) idx = maxChars
        out.push(s.slice(0, idx))
        s = s.slice(idx + 1)
      }
      out.push(s)
      return out
    }
    const lines = text.split('\n').flatMap(wrap)
    const linesPerPage = Math.floor((pageH - marginY * 2) / leading)
    const pages: string[][] = []
    for (let i = 0; i < lines.length; i += linesPerPage) {
      pages.push(lines.slice(i, i + linesPerPage))
    }
    const objects: string[] = []
    const add = (s: string) => { objects.push(s) }
    const fontObjNum = 3
    add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
    // Pages node lists page objects inside an array
    const pageObjNums: number[] = pages.map((_, i) => 4 + i * 2)
    add('2 0 obj\n<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pageObjNums.map(n => n + ' 0 R').join(' ') + '] >>\nendobj\n')
    add('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
    pages.forEach((pageLines, idx) => {
      const content = ['BT','/F1 ' + fontSize + ' Tf', leading + ' TL', (marginX) + ' ' + (pageH - marginY - fontSize) + ' Td']
      for (const ln of pageLines) {
        content.push('(' + escapePdfText(ln) + ') Tj')
        content.push('T*')
      }
      content.push('ET')
      const stream = content.join('\n') + '\n'
      const contentObjNum = 5 + idx * 2
      add(contentObjNum + ' 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream\nendobj\n')
      const pageObjNum = 4 + idx * 2
      add(pageObjNum + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /Font << /F1 ' + fontObjNum + ' 0 R >> >> /Contents ' + contentObjNum + ' 0 R >>\nendobj\n')
    })
    const header = '%PDF-1.4\n'
    let body = ''
    const offsets: number[] = [0]
    let pos = header.length
    for (const obj of objects) {
      offsets.push(pos)
      body += obj
      pos += obj.length
    }
    let xref = 'xref\n0 ' + (objects.length + 1) + '\n'
    xref += '0000000000 65535 f \n'
    for (let i = 1; i <= objects.length; i++) {
      const off = offsets[i]
      xref += (off.toString().padStart(10, '0')) + ' 00000 n \n'
    }
    const trailer = 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + (header.length + body.length) + '\n%%EOF'
    const pdf = header + body + xref + trailer
    return new Blob([pdf], { type: 'application/pdf' })
  }

  const handleExportPdf = async () => {
    if (!activeFile || !activeFile.toLowerCase().endsWith('.md')) { toast.error('仅支持将 Markdown 文件导出为 PDF'); return }
    if (!workspace || !workspaceHandle) { toast.error('请先选择工作区目录'); return }
    const textPlain = markdownToPlainText(content || '')
    const pageW = 595, pageH = 842
    const widthPx = 1240
    const heightPxPerPage = Math.round(widthPx * (pageH / pageW))
    const margin = 40
    const fontSize = 32
    const lineH = Math.round(fontSize * 1.3)
    const maxChars = 50
    const escapeXML = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
    const wrap = (line: string) => {
      const out: string[] = []
      let s = line
      while (s.length > maxChars) {
        let idx = s.lastIndexOf(' ', maxChars)
        if (idx <= 0) idx = maxChars
        out.push(s.slice(0, idx))
        s = s.slice(idx + 1)
      }
      out.push(s)
      return out
    }
    const lines = textPlain.split('\n').flatMap(wrap)
    const linesPerPage = Math.floor((heightPxPerPage - margin * 2) / lineH)
    const svgForPage = (pageLines: string[]) => {
      const y0 = margin + fontSize
      const items = pageLines.map((ln, i) => `<text x="${margin}" y="${y0 + i * lineH}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="${fontSize}" fill="#e5e7eb" xml:space="preserve">${escapeXML(ln)}</text>`).join('\n')
      return `<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPxPerPage}"><rect x="0" y="0" width="${widthPx}" height="${heightPxPerPage}" fill="#111827"/>${items}</svg>`
    }
    const pages: Uint8Array[] = []
    for (let i = 0; i < lines.length; i += linesPerPage) {
      const pageLines = lines.slice(i, i + linesPerPage)
      const svg = svgForPage(pageLines)
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = widthPx; canvas.height = heightPxPerPage
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
        pages.push(bytes)
      } catch (e) {
        // 兜底：使用文本方式生成PDF（ASCII优先）
        const blobFallback = buildPdf(textPlain)
        const pdfPath = activeFile.replace(/\.md$/i, '.pdf')
        await FileSystemService.writeFile(pdfPath, blobFallback, workspaceHandle as any, workspace)
        const files = await FileSystemService.getWorkspaceFiles(workspace, workspaceHandle as any)
        setFileTree(files)
        setActiveFile(pdfPath)
        addOpenFile(pdfPath)
        toast.success('已导出为 PDF，并已打开预览')
        return
      }
    }
    const buildPdfFromJpegs = (jpegPages: Uint8Array[]): Blob => {
      const objects: string[] = []
      const binaries: Uint8Array[] = []
      const add = (s: string, bin?: Uint8Array) => { objects.push(s); if (bin) binaries.push(bin) }
      // Catalog & Pages
      add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
      const pageNums = jpegPages.map((_, i) => 3 + i * 2)
      add('2 0 obj\n<< /Type /Pages /Count ' + jpegPages.length + ' /Kids [' + pageNums.map(n => n + ' 0 R').join(' ') + '] >>\nendobj\n')
      // Pages: for each page add Image and Page + Contents
      jpegPages.forEach((bin, i) => {
        const imgObjNum = 4 + i * 2
        add(imgObjNum + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + widthPx + ' /Height ' + heightPxPerPage + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bin.length + ' >>\nstream\n', bin)
        objects.push('endstream\nendobj\n')
        const contentObjNum = imgObjNum + 1
        const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im${i} Do\nQ\n`
        add(contentObjNum + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n')
        const pageObjNum = pageNums[i]
        add(pageObjNum + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im' + i + ' ' + imgObjNum + ' 0 R >> >> /Contents ' + contentObjNum + ' 0 R >>\nendobj\n')
      })
      const header = '%PDF-1.4\n'
      let body = ''
      const offsets: number[] = [0]
      let pos = header.length
      let binIndex = 0
      const parts: Array<{ text?: string, bin?: Uint8Array }> = []
      for (let k = 0, j = 0; k < objects.length; k++) {
        const part = objects[k]
        if (part.startsWith('endstream')) { parts.push({ text: part }) ; continue }
        offsets.push(pos)
        parts.push({ text: part })
        pos += part.length
        if (part.includes('stream\n') && binIndex < binaries.length) {
          const b = binaries[binIndex++]
          parts.push({ bin: b })
          pos += b.length
        }
      }
      for (const p of parts) {
        if (p.text) body += p.text
      }
      // Construct final with binaries interleaved
      const encoder = (chunks: Array<{ text?: string, bin?: Uint8Array }>) => {
        const arrs: Uint8Array[] = []
        arrs.push(new TextEncoder().encode(header))
        for (const c of chunks) {
          if (c.text) arrs.push(new TextEncoder().encode(c.text))
          if (c.bin) arrs.push(c.bin)
        }
        const totalLen = arrs.reduce((s, a) => s + a.length, 0)
        const out = new Uint8Array(totalLen)
        let p = 0
        for (const a of arrs) { out.set(a, p); p += a.length }
        return out
      }
      const beforeXrefBytes = encoder(parts)
      const xrefStart = beforeXrefBytes.length
      let xref = 'xref\n0 ' + (offsets.length) + '\n'
      xref += '0000000000 65535 f \n'
      for (let i = 1; i < offsets.length; i++) {
        xref += offsets[i].toString().padStart(10, '0') + ' 00000 n \n'
      }
      const trailer = 'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF'
      const final = encoder(parts.concat([{ text: xref + trailer }]))
      return new Blob([final], { type: 'application/pdf' })
    }
    const blob = buildPdfFromJpegs(pages)
    const pdfPath = activeFile.replace(/\.md$/i, '.pdf')
    try {
      await FileSystemService.writeFile(pdfPath, blob, workspaceHandle as any, workspace)
      const files = await FileSystemService.getWorkspaceFiles(workspace, workspaceHandle as any)
      setFileTree(files)
      setActiveFile(pdfPath)
      addOpenFile(pdfPath)
      toast.success('已导出为 PDF，并已打开预览')
    } catch (e) {
      toast.error('导出失败')
    }
  }

  // 加载文件内容（仅在 activeFile 变化时触发，避免编辑中被覆盖）
  useEffect(() => {
    const loadFileContent = async () => {
      if (!activeFile) { setContent(''); return }
      if (fileContents[activeFile]) { setContent(fileContents[activeFile]); return }
      try {
        const fileContent = await FileSystemService.readFile(activeFile, workspace, workspaceHandle as any)
        setContent(fileContent)
        setFileContent(activeFile, fileContent)
      } catch (error) {
        console.error('读取文件失败:', error)
        // 保留现有内容，避免清空编辑区
      }
    }
    loadFileContent()
    // 仅依赖 activeFile 变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile])

  // 为 PDF 文件生成预览 URL
  useEffect(() => {
    const setupPdf = async () => {
      if (!activeFile) {
        if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null }
        setPdfUrl(null)
        return
      }
      const isPdf = activeFile.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null }
        setPdfUrl(null)
        return
      }
      try {
        const blob = await FileSystemService.readFileBlob(activeFile, workspace, workspaceHandle as any)
        if (blob) {
          const url = URL.createObjectURL(blob)
          if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
          pdfUrlRef.current = url
          setPdfUrl(url)
        } else {
          setPdfUrl(null)
        }
      } catch {
        setPdfUrl(null)
      }
    }
    setupPdf()
    return () => {}
  }, [activeFile, workspace, workspaceHandle])

  // 预览中将本地图片路径替换为Blob URL
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const container = previewRef.current
      if (!container || cancelled) return
      const imgs = container.querySelectorAll('img[data-origin-src]')
      for (const img of Array.from(imgs)) {
        if (cancelled) return
        const el = img as HTMLImageElement
        const origin = el.getAttribute('data-origin-src') || ''
        if (!origin || origin.startsWith('http') || origin.startsWith('data:')) continue
        const cached = objectUrlCacheRef.current.get(origin)
        if (cached) {
          if (el.src !== cached) {
            const prev = el.getAttribute('data-current-blob')
            el.onload = () => { if (prev) URL.revokeObjectURL(prev) }
            el.onerror = () => {}
            el.setAttribute('data-current-blob', cached)
            el.src = cached
          }
          continue
        }
        const relative = origin.replace(/^\//, '')
        const filePath = workspace ? `${workspace}/${relative}` : relative
        const blob = await FileSystemService.readFileBlob(filePath, workspace, workspaceHandle as any)
        if (cancelled) return
        if (blob) {
          const url = URL.createObjectURL(blob)
          objectUrlCacheRef.current.set(origin, url)
          const prev = el.getAttribute('data-current-blob')
          el.onload = () => { if (prev) URL.revokeObjectURL(prev) }
          el.onerror = () => {}
          el.setAttribute('data-current-blob', url)
          el.src = url
        }
      }
    }
    const raf = requestAnimationFrame(() => { run() })
    const tid = setTimeout(run, 0)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(tid)
    }
  }, [content, workspace, workspaceHandle, editorMode])

  useEffect(() => {
    return () => {
      objectUrlCacheRef.current.forEach(url => URL.revokeObjectURL(url))
      objectUrlCacheRef.current.clear()
    }
  }, [])

  // 内容变化处理
  const handleContentChange = (value: string) => {
    setContent(value)
    setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
    if (activeFile) {
      setFileContent(activeFile, value)
      markUnsaved(activeFile)
      
      // 实时保存（防抖）
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        handleAutoSave(value)
      }, 300)
    }
  }

  // 自动保存
  const handleAutoSave = async (content: string) => {
    if (activeFile && content) {
      try {
        await FileSystemService.writeFile(activeFile, content, workspaceHandle as any, workspace)
        markSaved(activeFile)
      } catch (error) {
        console.error('自动保存失败:', error)
        toast.error('自动保存失败')
      }
    }
  }

  // 保存文件
  const handleSave = async () => {
    if (activeFile && content) {
      try {
        await FileSystemService.writeFile(activeFile, content, workspaceHandle as any, workspace)
        markSaved(activeFile)
        toast.success('文件保存成功')
      } catch (error) {
        console.error('保存文件失败:', error)
        toast.error('文件保存失败')
      }
    }
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // 根据模式渲染编辑器
  const renderEditor = () => {
    const isPdf = !!activeFile && activeFile.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      return (
        <div className="flex-1 overflow-auto bg-gray-900">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title="PDF预览" />
          ) : (
            <div className="h-full grid place-items-center">
              <div className="text-center text-gray-400">
                <p className="text-sm">无法读取 PDF 文件，请授权工作区或稍后重试。</p>
                <p className="text-xs mt-1">也可右键文件使用系统阅读器打开。</p>
              </div>
            </div>
          )}
        </div>
      )
    }
    switch (editorMode) {
      case 'edit':
        const domHandlers = EditorView.domEventHandlers({
          mouseup: (_e, view) => {
            if (!editorContainerRef.current) return
            const sel = view.state.selection.main
            if (sel.empty) { setOverlayEdit({ show: false, top: 0, left: 0, text: '' }); return }
            const text = view.state.doc.sliceString(sel.from, sel.to)
            const rect = view.coordsAtPos(sel.to)
            const box = editorContainerRef.current.getBoundingClientRect()
            const scroller = editorContainerRef.current
            const scrollTop = scroller.scrollTop || 0
            const scrollLeft = scroller.scrollLeft || 0
            const top = Math.max(rect.top - box.top + scrollTop - 30, scrollTop + 6)
            const left = Math.min(
              Math.max(rect.left - box.left + scrollLeft + 6, scrollLeft + 6),
              scrollLeft + box.width - 120
            )
            const lineStart = view.state.doc.lineAt(sel.from).number
            const lineEnd = view.state.doc.lineAt(sel.to).number
            setOverlayEdit({ show: true, top, left, text, lineStart, lineEnd })
          },
          keyup: (_e, view) => {
            if (!editorContainerRef.current) return
            const sel = view.state.selection.main
            if (sel.empty) { setOverlayEdit({ show: false, top: 0, left: 0, text: '' }); return }
            const text = view.state.doc.sliceString(sel.from, sel.to)
            const rect = view.coordsAtPos(sel.to)
            const box = editorContainerRef.current.getBoundingClientRect()
            const scroller = editorContainerRef.current
            const scrollTop = scroller.scrollTop || 0
            const scrollLeft = scroller.scrollLeft || 0
            const top = Math.max(rect.top - box.top + scrollTop - 30, scrollTop + 6)
            const left = Math.min(
              Math.max(rect.left - box.left + scrollLeft + 6, scrollLeft + 6),
              scrollLeft + box.width - 120
            )
            const lineStart = view.state.doc.lineAt(sel.from).number
            const lineEnd = view.state.doc.lineAt(sel.to).number
            setOverlayEdit({ show: true, top, left, text, lineStart, lineEnd })
          },
          blur: () => { setOverlayEdit({ show: false, top: 0, left: 0, text: '' }) }
        })
        return (
          <div ref={editorContainerRef} className="relative flex-1 min-h-0 h-full overflow-auto custom-scrollbar" onPasteCapture={saveClipboardImages}>
            <CodeMirror
              value={content}
              height="100%"
              extensions={[
                markdown(),
                EditorView.lineWrapping,
                EditorView.updateListener.of((update) => {
                  if (update.selectionSet || update.docChanged) {
                    const sel = update.state.selection.main
                    if (sel.empty) {
                      setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
                    }
                  }
                }),
                domHandlers
              ]}
              theme="dark"
              basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false }}
              onChange={handleContentChange}
              placeholder="开始编写你的Markdown内容..."
            />
            {overlayEdit.show && (
              <div style={{ position: 'absolute', top: overlayEdit.top, left: overlayEdit.left }} className="z-50">
                <button
                  onClick={() => {
                    if (overlayEdit.text && activeFile) {
                      addPendingSnippet(activeFile, overlayEdit.text, overlayEdit.lineStart, overlayEdit.lineEnd)
                      setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
                    }
                  }}
                  className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 hover:bg-gray-600"
                >
                  添加到AI对话
                </button>
              </div>
            )}
          </div>
        )
      
      case 'preview':
        return (
          <div className="flex-1 overflow-auto bg-gray-900 custom-scrollbar" ref={previewRef}>
            <div className="p-6 relative max-w-4xl mx-auto" onMouseUp={() => {
              const sel = window.getSelection()
              const container = previewContentRef.current
              if (!sel || sel.isCollapsed || !container) { setOverlayPreview({ show: false, top: 0, left: 0, text: '' }); return }
              const text = sel.toString()
              if (!text.trim()) { setOverlayPreview({ show: false, top: 0, left: 0, text: '' }); return }
              const range = sel.getRangeAt(0)
              const rect = range.getBoundingClientRect()
              const box = container.getBoundingClientRect()
              const top = Math.max(rect.top - box.top - 30, 6)
              const left = Math.min(Math.max(rect.left - box.left + 6, 6), box.width - 120)
              let lineStart = undefined
              let lineEnd = undefined
              const idx = content.indexOf(text)
              if (idx >= 0) {
                lineStart = content.slice(0, idx).split('\n').length
                const linesSel = text.split('\n').length
                lineEnd = lineStart + linesSel - 1
              }
              setOverlayPreview({ show: true, top, left, text, lineStart, lineEnd })
            }} ref={previewContentRef}>
              {content ? (
                <div 
                  className="markdown-preview text-base leading-relaxed"
                  dangerouslySetInnerHTML={renderMarkdown(content)}
                  style={{
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    lineHeight: '1.7'
                  }}
                />
              ) : (
                <div className="text-gray-500 text-center mt-16">
                  <Edit3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">预览区域</p>
                  <p className="text-sm mt-2">在编辑模式下输入内容以查看预览</p>
                </div>
              )}
              {overlayPreview.show ? (
                <div style={{ position: 'absolute', top: overlayPreview.top, left: overlayPreview.left }} className="z-50">
                <button
                  onClick={() => {
                    if (overlayPreview.text && activeFile) {
                      addPendingSnippet(activeFile, overlayPreview.text, overlayPreview.lineStart, overlayPreview.lineEnd)
                      setOverlayPreview({ show: false, top: 0, left: 0, text: '' })
                    }
                  }}
                    className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 hover:bg-gray-600"
                  >
                    添加到AI对话
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )
      
      case 'split':
        return (
          <div className="flex flex-1 min-h-0">
            <div ref={editorContainerRef} className="w-1/2 border-r border-gray-700 min-h-0 h-full overflow-auto custom-scrollbar relative" onPasteCapture={saveClipboardImages}>
              <CodeMirror
                value={content}
                height="100%"
              extensions={[
                markdown(),
                EditorView.lineWrapping,
                EditorView.domEventHandlers({
                  mouseup: (_e, view) => {
                    if (!editorContainerRef.current) return
                    const sel = view.state.selection.main
                    if (sel.empty) { setOverlayEdit({ show: false, top: 0, left: 0, text: '' }); return }
                    const text = view.state.doc.sliceString(sel.from, sel.to)
                    const rect = view.coordsAtPos(sel.to)
                    const box = editorContainerRef.current.getBoundingClientRect()
                    const scroller = editorContainerRef.current
                    const scrollTop = scroller.scrollTop || 0
                    const scrollLeft = scroller.scrollLeft || 0
                    const top = Math.max(rect.top - box.top + scrollTop - 20, scrollTop + 6)
                    const left = Math.min(
                      Math.max(rect.left - box.left + scrollLeft + 8, scrollLeft + 8),
                      scrollLeft + box.width - 140
                    )
                    const lineStart = view.state.doc.lineAt(sel.from).number
                    const lineEnd = view.state.doc.lineAt(sel.to).number
                    setOverlayEdit({ show: true, top, left, text, lineStart, lineEnd })
                  },
                  blur: () => { setOverlayEdit({ show: false, top: 0, left: 0, text: '' }) }
                })
              ]}
              theme="dark"
              basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false }}
              onChange={handleContentChange}
                placeholder="开始编写你的Markdown内容..."
              />
              {overlayEdit.show && (
                <div style={{ position: 'absolute', top: overlayEdit.top, left: overlayEdit.left }} className="z-50">
                  <button
                    onClick={() => {
                      if (overlayEdit.text && activeFile) {
                        addPendingSnippet(activeFile, overlayEdit.text, overlayEdit.lineStart, overlayEdit.lineEnd)
                        setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
                      }
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 hover:bg-gray-600"
                  >
                    添加到AI对话
                  </button>
                </div>
              )}
            </div>
            <div className="w-1/2 overflow-auto bg-gray-900 custom-scrollbar" ref={previewRef}>
              <div className="p-6 relative" onMouseUp={() => {
                const sel = window.getSelection()
                const container = previewContentRef.current
                if (!sel || sel.isCollapsed || !container) {
                  setOverlayPreview({ show: false, top: 0, left: 0, text: '' })
                  return
                }
                const text = sel.toString()
                if (!text.trim()) { setOverlayPreview({ show: false, top: 0, left: 0, text: '' }); return }
                const range = sel.getRangeAt(0)
                const rect = range.getBoundingClientRect()
                const box = container.getBoundingClientRect()
                const top = Math.max(rect.top - box.top - 20, 6)
                const left = Math.min(Math.max(rect.left - box.left + 8, 8), box.width - 140)
                let lineStart = undefined
                let lineEnd = undefined
                const idx = content.indexOf(text)
                if (idx >= 0) {
                  lineStart = content.slice(0, idx).split('\n').length
                  const linesSel = text.split('\n').length
                  lineEnd = lineStart + linesSel - 1
                }
                setOverlayPreview({ show: true, top, left, text, lineStart, lineEnd })
              }} ref={previewContentRef}>
                {content ? (
                  <div 
                    className="markdown-preview text-base leading-relaxed"
                    dangerouslySetInnerHTML={renderMarkdown(content)}
                    style={{
                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      lineHeight: '1.7'
                    }}
                  />
                  ) : (
                    <div className="text-gray-500 text-center mt-16">
                      <Edit3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">预览区域</p>
                      <p className="text-sm mt-2">在左侧编辑模式下输入内容以查看预览</p>
                    </div>
                  )}
                  {overlayPreview.show ? (
                    <div style={{ position: 'absolute', top: overlayPreview.top, left: overlayPreview.left }} className="z-50">
                      <button
                        onClick={() => {
                          if (overlayPreview.text && activeFile) {
                            addPendingSnippet(activeFile, overlayPreview.text, overlayPreview.lineStart, overlayPreview.lineEnd)
                            setOverlayPreview({ show: false, top: 0, left: 0, text: '' })
                          }
                        }}
                        className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 hover:bg-gray-600"
                      >
                        添加到AI对话
                      </button>
                    </div>
                  ) : null}
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  if (!activeFile) {
    return (
      <div className="flex-1 grid place-items-center bg-gray-900">
        <div className="text-center">
          <Edit3 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-400">选择一个文件开始编辑</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      <div className="flex flex-col h-full bg-gray-900">
        {/* 工具栏 */}
      <div className="flex items-center justify-between h-10 px-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-300 truncate max-w-md">
            {activeFile.split('/').pop()}
          </span>
          {activeFile && (
          <span className={`text-xs px-2 py-1 rounded opacity-70 ${
              unsavedChanges.has(activeFile) 
                ? 'bg-yellow-600 text-yellow-100' 
                : 'bg-green-600 text-green-100'
            }`}>
              {unsavedChanges.has(activeFile) ? '未保存' : '已保存'}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 模式切换按钮 */}
          <div className="flex bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setEditorMode('edit')}
              className={`h-7 w-7 p-0 rounded flex items-center justify-center ${editorMode === 'edit' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="编辑模式"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditorMode('split')}
              className={`h-7 w-7 p-0 rounded flex items-center justify-center ${editorMode === 'split' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="分屏模式"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditorMode('preview')}
              className={`h-7 w-7 p-0 rounded flex items-center justify-center ${editorMode === 'preview' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="预览模式"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
          
          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={activeFile?.toLowerCase().endsWith('.pdf')}
            className={`h-7 w-7 p-0 rounded flex items-center justify-center ${activeFile?.toLowerCase().endsWith('.pdf') ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-500' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="保存文件"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPdfStyled}
            disabled={!activeFile?.toLowerCase().endsWith('.md')}
            className={`h-7 w-7 p-0 rounded flex items-center justify-center ${!activeFile?.toLowerCase().endsWith('.md') ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-500' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="导出为 PDF"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      </div>

        {/* 编辑器内容 */}
        {renderEditor()}
      </div>
      {editorMode !== 'split' && (
        <></>
      )}
    </>
  )
}
