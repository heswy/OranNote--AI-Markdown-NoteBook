import React, { useState, useEffect, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { useAppStore } from '@/stores/appStore'
import { markdown } from '@codemirror/lang-markdown'
import { 
  Eye, 
  Edit3, 
  Columns, 
  Save, 
  FileDown, 
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { FileSystemService } from '@/services/fileSystem'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { toast } from 'sonner'

// Markdown 预览样式
const markdownStyles = `
  .markdown-preview { 
    color: var(--color-text-primary);
    line-height: 1.7;
  }
  .markdown-preview h1 { 
    font-size: 1.75rem; 
    font-weight: 700; 
    color: var(--color-text-primary);
    margin: 1.5rem 0 1rem 0; 
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }
  .markdown-preview h2 { 
    font-size: 1.375rem; 
    font-weight: 600; 
    color: var(--color-text-primary);
    margin: 1.25rem 0 0.75rem 0; 
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--color-border);
  }
  .markdown-preview h3 { 
    font-size: 1.125rem; 
    font-weight: 600; 
    color: var(--color-text-secondary);
    margin: 1rem 0 0.5rem 0; 
  }
  .markdown-preview h4 { 
    font-size: 1rem; 
    font-weight: 600; 
    color: var(--color-text-secondary);
    margin: 0.75rem 0 0.5rem 0; 
  }
  .markdown-preview p { 
    color: var(--color-text-secondary); 
    line-height: 1.8; 
    margin-bottom: 1rem; 
  }
  .markdown-preview ul, .markdown-preview ol { 
    margin: 0.75rem 0; 
    padding-left: 1.5rem; 
    color: var(--color-text-secondary);
  }
  .markdown-preview li { 
    margin: 0.375rem 0; 
    line-height: 1.7; 
  }
  .markdown-preview a { 
    color: var(--color-primary-500); 
    text-decoration: none;
    transition: color 0.15s;
  }
  .markdown-preview a:hover { 
    color: var(--color-primary-400);
    text-decoration: underline;
  }
  .markdown-preview strong { 
    color: var(--color-text-primary); 
    font-weight: 600; 
  }
  .markdown-preview em { 
    color: var(--color-text-secondary); 
    font-style: italic; 
  }
  .markdown-preview code { 
    background-color: var(--color-bg-surface); 
    color: var(--color-primary-400); 
    padding: 0.125rem 0.375rem; 
    border-radius: 4px; 
    font-family: var(--font-mono); 
    font-size: 0.85em;
    border: 1px solid var(--color-border);
  }
  .markdown-preview pre { 
    background-color: var(--color-bg-elevated); 
    border: 1px solid var(--color-border); 
    border-radius: var(--radius-lg); 
    padding: 1rem; 
    margin: 1rem 0; 
    overflow-x: auto;
    position: relative;
  }
  .markdown-preview pre code { 
    background-color: transparent; 
    color: var(--color-text-primary); 
    padding: 0; 
    border-radius: 0;
    border: none;
    font-size: 0.8125rem;
    line-height: 1.6;
  }
  .markdown-preview blockquote { 
    border-left: 3px solid var(--color-primary-500); 
    background-color: var(--color-bg-elevated); 
    padding: 0.75rem 1rem; 
    margin: 1rem 0; 
    border-radius: 0 var(--radius-md) var(--radius-md) 0; 
    color: var(--color-text-secondary);
  }
  .markdown-preview blockquote p:last-child {
    margin-bottom: 0;
  }
  .markdown-preview table { 
    border-collapse: collapse; 
    width: 100%; 
    margin: 1rem 0; 
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .markdown-preview th { 
    background-color: var(--color-bg-surface); 
    color: var(--color-text-primary); 
    padding: 0.625rem; 
    border: 1px solid var(--color-border); 
    text-align: left; 
    font-weight: 600;
    font-size: 0.875rem;
  }
  .markdown-preview td { 
    background-color: var(--color-bg-elevated); 
    color: var(--color-text-secondary); 
    padding: 0.625rem; 
    border: 1px solid var(--color-border);
    font-size: 0.875rem;
  }
  .markdown-preview tr:nth-child(even) td { 
    background-color: var(--color-bg-base); 
  }
  .markdown-preview img { 
    max-width: 100%; 
    height: auto; 
    border-radius: var(--radius-lg); 
    margin: 1rem 0; 
    border: 1px solid var(--color-border);
  }
  .markdown-preview hr { 
    border: none; 
    border-top: 1px solid var(--color-border); 
    margin: 1.5rem 0; 
  }
  .markdown-preview > *:first-child {
    margin-top: 0;
  }
  /* 代码块复制按钮 */
  .code-block-wrapper {
    position: relative;
  }
  .code-block-wrapper:hover .copy-code-btn {
    opacity: 1;
  }
  .copy-code-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.375rem 0.625rem;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }
  .copy-code-btn:hover {
    background: var(--color-bg-surface-hover);
    color: var(--color-text-primary);
  }
`

// 模式切换按钮组
const ModeToggle: React.FC<{
  currentMode: 'edit' | 'preview' | 'split'
  onChange: (mode: 'edit' | 'preview' | 'split') => void
}> = ({ currentMode, onChange }) => {
  const modes: { mode: 'edit' | 'preview' | 'split'; icon: React.ReactNode; label: string }[] = [
    { mode: 'edit', icon: <Edit3 className="w-3.5 h-3.5" />, label: '编辑' },
    { mode: 'split', icon: <Columns className="w-3.5 h-3.5" />, label: '分屏' },
    { mode: 'preview', icon: <Eye className="w-3.5 h-3.5" />, label: '预览' },
  ]

  return (
    <div className="flex items-center p-0.5 bg-bg-surface rounded-lg border border-border shrink-0">
      {modes.map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
            transition-all duration-fast
            ${currentMode === mode 
              ? 'bg-primary-600 text-white shadow-sm' 
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
            }
          `}
          title={label}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// 工具栏按钮
const ToolbarButton: React.FC<{
  icon: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tooltip?: string
  active?: boolean
  loading?: boolean
}> = ({ icon, onClick, disabled, tooltip, active, loading }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          p-1.5 rounded-md transition-all duration-fast
          ${active 
            ? 'bg-primary-600/20 text-primary-400' 
            : 'text-text-tertiary hover:text-text-primary hover:bg-bg-surface'
          }
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </button>
      {showTooltip && tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-0.5 
          bg-bg-overlay text-text-primary text-[11px] rounded whitespace-nowrap
          border border-border shadow-md z-tooltip">
          {tooltip}
        </div>
      )}
    </div>
  )
}

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
    addOpenFile,
    addPendingSnippet,
    openFiles,
    removeOpenFile
  } = useAppStore()

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [overlayEdit, setOverlayEdit] = useState<{ show: boolean, top: number, left: number, text: string, lineStart?: number, lineEnd?: number }>({ show: false, top: 0, left: 0, text: '' })
  const [overlayPreview, setOverlayPreview] = useState<{ show: boolean, top: number, left: number, text: string, lineStart?: number, lineEnd?: number }>({ show: false, top: 0, left: 0, text: '' })
  
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const objectUrlCacheRef = useRef<Map<string, string>>(new Map())

  // 渲染 Markdown
  const renderMarkdown = (markdownText: string) => {
    const renderer = new marked.Renderer()
    
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const validLanguage = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        const highlighted = hljs.highlight(text, { language: validLanguage }).value
        return `<div class="code-block-wrapper"><button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText).then(()=>{this.innerText='已复制';setTimeout(()=>this.innerText='复制',1500)})">复制</button><pre class="code-block"><code class="hljs language-${validLanguage}">${highlighted}</code></pre></div>`
      } catch {
        return `<pre class="code-block"><code class="language-${validLanguage}">${text}</code></pre>`
      }
    }
    
    renderer.image = ({ href, text }: any) => {
      const src = href || ''
      const alt = text || ''
      return `<img data-origin-src="${src}" alt="${alt}" loading="lazy" />`
    }
    
    marked.setOptions({ renderer, gfm: true, breaks: false, pedantic: false })
    
    const html = marked.parse(markdownText)
    return { __html: html }
  }

  // 加载文件内容
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
      }
    }
    loadFileContent()
  }, [activeFile])

  // 预览模式下监听文本选择
  useEffect(() => {
    if (editorMode !== 'preview' && editorMode !== 'split') return
    
    const handleSelectionChange = () => {
      // 延迟执行以确保选择已完成
      setTimeout(handlePreviewSelection, 0)
    }
    
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [editorMode, content])

  // 内容变化处理
  const handleContentChange = (value: string) => {
    setContent(value)
    setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
    if (activeFile) {
      setFileContent(activeFile, value)
      markUnsaved(activeFile)
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        handleAutoSave(value)
      }, 500)
    }
  }

  // 自动保存
  const handleAutoSave = async (content: string) => {
    if (!activeFile || !content) return
    try {
      await FileSystemService.writeFile(activeFile, content, workspaceHandle as any, workspace)
      markSaved(activeFile)
      setSavedIndicator(true)
      setTimeout(() => setSavedIndicator(false), 1000)
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }

  // 手动保存
  const handleSave = async () => {
    if (!activeFile || !content) return
    setIsSaving(true)
    try {
      await FileSystemService.writeFile(activeFile, content, workspaceHandle as any, workspace)
      markSaved(activeFile)
      toast.success('保存成功')
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  // 导出 PDF
  const handleExportPdf = async () => {
    if (!activeFile || !activeFile.toLowerCase().endsWith('.md')) {
      toast.error('仅支持 Markdown 文件导出')
      return
    }
    toast.info('正在生成 PDF...')
    // 这里简化处理，实际实现可能需要更复杂的逻辑
  }

  // 预览图片处理
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
        // 简化的图片加载逻辑
      }
    }
    run()
  }, [content, editorMode])

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-base text-text-tertiary">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
          <Edit3 className="w-8 h-8 opacity-30" />
        </div>
        <p className="text-text-secondary font-medium">选择一个文件开始编辑</p>
        <p className="text-xs mt-1 text-text-disabled">在左侧文件树中选择一个 Markdown 文件</p>
      </div>
    )
  }

  const isPdf = activeFile.toLowerCase().endsWith('.pdf')
  const fileName = activeFile.split('/').pop() || ''
  const hasUnsavedChanges = unsavedChanges.has(activeFile)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      <div className="flex flex-col h-full bg-bg-base">
        {/* 工具栏 */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-border bg-bg-elevated shrink-0 min-w-0" style={{ position: 'relative', zIndex: 100 }}>
          {/* 左侧：文件标签 */}
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {openFiles.length > 0 ? (
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar max-w-full">
                {openFiles.map((filePath) => {
                  const fName = filePath.split('/').pop() || ''
                  const isActive = activeFile === filePath
                  const hasUnsaved = unsavedChanges.has(filePath)
                  return (
                    <div
                      key={filePath}
                      onClick={() => setActiveFile(filePath)}
                      className={`
                        group flex items-center h-7 pl-2.5 pr-1.5 rounded-md text-xs cursor-pointer
                        transition-all duration-fast shrink-0 border
                        ${isActive 
                          ? 'bg-bg-surface text-text-primary border-border' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface/50 border-transparent'
                        }
                      `}
                    >
                      <span className="truncate max-w-[120px]">{fName}</span>
                      {hasUnsaved && (
                        <span className="w-1.5 h-1.5 rounded-full bg-warning ml-1.5 shrink-0" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeOpenFile(filePath)
                        }}
                        className={`
                          w-4 h-4 flex items-center justify-center rounded ml-1
                          opacity-0 group-hover:opacity-100 transition-all duration-fast
                          hover:bg-white/10 text-text-tertiary hover:text-text-primary shrink-0
                        `}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <span className="text-sm text-text-tertiary">未打开文件</span>
            )}
          </div>
          
          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            <ModeToggle currentMode={editorMode} onChange={setEditorMode} />
            
            <div className="w-px h-5 bg-border mx-1" />
            
            <ToolbarButton 
              icon={<Save className="w-4 h-4" />} 
              onClick={handleSave}
              disabled={isPdf || !hasUnsavedChanges}
              tooltip="保存 (⌘S)"
              loading={isSaving}
            />
            <ToolbarButton 
              icon={<FileDown className="w-4 h-4" />} 
              onClick={handleExportPdf}
              disabled={!activeFile?.toLowerCase().endsWith('.md')}
              tooltip="导出 PDF"
            />
          </div>
        </div>

        {/* 编辑器内容 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isPdf ? (
            <div className="h-full flex items-center justify-center text-text-tertiary">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4 mx-auto">
                  <FileDown className="w-8 h-8 opacity-30" />
                </div>
                <p className="text-text-secondary font-medium">PDF 文件</p>
                <p className="text-xs mt-1 text-text-disabled">暂不支持 PDF 编辑</p>
              </div>
            </div>
          ) : (
            renderEditor()
          )}
        </div>
      </div>
    </>
  )

  function renderEditor() {
    switch (editorMode) {
      case 'edit':
        return (
          <div ref={editorContainerRef} className="h-full overflow-auto custom-scrollbar relative" onPasteCapture={handlePaste}>
            <CodeMirror
              value={content}
              height="100%"
              extensions={[
                markdown(),
                EditorView.lineWrapping,
                createSelectionHandlers(),
              ]}
              theme="dark"
              basicSetup={{ 
                highlightActiveLine: false, 
                highlightActiveLineGutter: false,
                foldGutter: false,
              }}
              onChange={handleContentChange}
              placeholder="开始编写 Markdown 内容..."
            />
            {overlayEdit.show && <SelectionOverlay {...overlayEdit} onAddToAI={addToAI} />}
          </div>
        )
      
      case 'preview':
        return (
          <div className="h-full overflow-auto custom-scrollbar" ref={previewRef}>
            <div className="relative max-w-3xl mx-auto p-8" ref={previewContentRef}>
              {content ? (
                <div 
                  className="markdown-preview"
                  dangerouslySetInnerHTML={renderMarkdown(content)}
                  onMouseUp={handlePreviewSelection}
                />
              ) : (
                <div className="text-text-tertiary text-center py-16">
                  <Edit3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-text-secondary">预览区域</p>
                  <p className="text-xs mt-1 text-text-disabled">在编辑模式下输入内容以查看预览</p>
                </div>
              )}
              {overlayPreview.show && <SelectionOverlay {...overlayPreview} onAddToAI={addToAI} />}
            </div>
          </div>
        )
      
      case 'split':
        return (
          <div className="flex h-full">
            <div ref={editorContainerRef} className="w-1/2 h-full overflow-auto custom-scrollbar border-r border-border relative" onPasteCapture={handlePaste}>
              <CodeMirror
                value={content}
                height="100%"
                extensions={[
                  markdown(),
                  EditorView.lineWrapping,
                  createSelectionHandlers(),
                ]}
                theme="dark"
                basicSetup={{ 
                  highlightActiveLine: false, 
                  highlightActiveLineGutter: false,
                  foldGutter: false,
                }}
                onChange={handleContentChange}
                placeholder="开始编写 Markdown 内容..."
              />
              {overlayEdit.show && <SelectionOverlay {...overlayEdit} onAddToAI={addToAI} />}
            </div>
            <div className="w-1/2 h-full overflow-auto custom-scrollbar" ref={previewRef}>
              <div className="relative max-w-3xl mx-auto p-8" ref={previewContentRef}>
                {content ? (
                  <div 
                    className="markdown-preview"
                    dangerouslySetInnerHTML={renderMarkdown(content)}
                    onMouseUp={handlePreviewSelection}
                  />
                ) : (
                  <div className="text-text-tertiary text-center py-16">
                    <Edit3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-text-secondary">预览区域</p>
                  </div>
                )}
                {overlayPreview.show && <SelectionOverlay {...overlayPreview} onAddToAI={addToAI} />}
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  function createSelectionHandlers() {
    return EditorView.domEventHandlers({
      mouseup: handleEditorSelection,
      keyup: handleEditorSelection,
      blur: () => setOverlayEdit({ show: false, top: 0, left: 0, text: '' }),
    })
  }

  function handleEditorSelection(_e: any, view: EditorView) {
    if (!editorContainerRef.current) return
    const sel = view.state.selection.main
    if (sel.empty) { 
      setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
      return 
    }
    const text = view.state.doc.sliceString(sel.from, sel.to)
    const rect = view.coordsAtPos(sel.to)
    const box = editorContainerRef.current.getBoundingClientRect()
    const scroller = editorContainerRef.current
    const scrollTop = scroller.scrollTop || 0
    const scrollLeft = scroller.scrollLeft || 0
    const top = Math.max(rect.top - box.top + scrollTop - 36, scrollTop + 8)
    const left = Math.min(
      Math.max(rect.left - box.left + scrollLeft + 8, scrollLeft + 8),
      scrollLeft + box.width - 140
    )
    const lineStart = view.state.doc.lineAt(sel.from).number
    const lineEnd = view.state.doc.lineAt(sel.to).number
    setOverlayEdit({ show: true, top, left, text, lineStart, lineEnd })
  }

  function handlePreviewSelection() {
    const sel = window.getSelection()
    const container = previewContentRef.current
    if (!sel || sel.isCollapsed || !container) {
      setOverlayPreview({ show: false, top: 0, left: 0, text: '' })
      return
    }
    const text = sel.toString()
    if (!text.trim()) {
      setOverlayPreview({ show: false, top: 0, left: 0, text: '' })
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    // 计算相对于 container 的位置（浮层是绝对定位在 container 中的）
    const top = Math.max(rect.top - box.top - 40, 8)
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
  }

  function addToAI(text: string, lineStart?: number, lineEnd?: number) {
    if (text && activeFile) {
      addPendingSnippet(activeFile, text, lineStart, lineEnd)
      setOverlayEdit({ show: false, top: 0, left: 0, text: '' })
      setOverlayPreview({ show: false, top: 0, left: 0, text: '' })
      toast.success('已添加到 AI 对话')
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    // 简化的粘贴处理
  }
}

// 选中文字浮层
const SelectionOverlay: React.FC<{
  top: number
  left: number
  text: string
  lineStart?: number
  lineEnd?: number
  onAddToAI: (text: string, lineStart?: number, lineEnd?: number) => void
}> = ({ top, left, text, lineStart, lineEnd, onAddToAI }) => (
  <div 
    style={{ position: 'absolute', top, left }} 
    className="z-50 animate-in"
  >
    <button
      onClick={() => onAddToAI(text, lineStart, lineEnd)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs 
        bg-bg-overlay hover:bg-bg-overlay-hover text-text-primary
        border border-border hover:border-border-hover rounded-lg
        shadow-lg transition-all duration-fast"
    >
      <span>💬</span>
      添加到 AI 对话
    </button>
  </div>
)
