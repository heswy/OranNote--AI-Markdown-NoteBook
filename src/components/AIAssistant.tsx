import React, { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Send, 
  Clock, 
  Plus, 
  Folder, 
  Pause, 
  Bot, 
  User, 
  FileText,
  X,
  ChevronDown,
  Sparkles,
  Copy,
  Check
} from 'lucide-react'
import { useAppStore, ChatMessage, AIContext } from '@/stores/appStore'
import { AIService, DEFAULT_ASSISTANT_PROMPT } from '@/services/aiService'
import { FileSystemService } from '@/services/fileSystem'
import { HistoryModal } from '@/components/HistoryModal'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { toast } from 'sonner'
import * as pdfjsLib from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

// Markdown 渲染样式
const markdownStyles = `
  .ai-markdown { 
    color: var(--color-text-secondary);
    line-height: 1.7;
    font-size: 0.9375rem;
  }
  .ai-markdown p { 
    margin-bottom: 0.75rem; 
  }
  .ai-markdown p:last-child { 
    margin-bottom: 0; 
  }
  .ai-markdown h1, .ai-markdown h2, .ai-markdown h3 { 
    color: var(--color-text-primary);
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
  }
  .ai-markdown h1 { font-size: 1.25rem; }
  .ai-markdown h2 { font-size: 1.125rem; }
  .ai-markdown h3 { font-size: 1rem; }
  .ai-markdown ul, .ai-markdown ol { 
    margin: 0.5rem 0; 
    padding-left: 1.25rem; 
  }
  .ai-markdown li { 
    margin: 0.25rem 0; 
  }
  .ai-markdown a { 
    color: var(--color-primary-500); 
    text-decoration: none;
  }
  .ai-markdown a:hover { 
    text-decoration: underline; 
  }
  .ai-markdown strong { 
    color: var(--color-text-primary); 
    font-weight: 600; 
  }
  .ai-markdown code { 
    background-color: var(--color-bg-surface); 
    color: var(--color-primary-400); 
    padding: 0.125rem 0.375rem; 
    border-radius: 4px; 
    font-family: var(--font-mono); 
    font-size: 0.85em;
  }
  .ai-markdown pre { 
    background-color: var(--color-bg-base); 
    border: 1px solid var(--color-border); 
    border-radius: var(--radius-lg); 
    padding: 0.75rem; 
    margin: 0.75rem 0; 
    overflow-x: auto;
    position: relative;
  }
  .ai-markdown pre code { 
    background-color: transparent; 
    color: var(--color-text-primary); 
    padding: 0; 
    border-radius: 0;
    border: none;
    font-size: 0.8125rem;
  }
  .ai-markdown blockquote { 
    border-left: 3px solid var(--color-primary-500); 
    background-color: var(--color-bg-surface); 
    padding: 0.5rem 0.75rem; 
    margin: 0.5rem 0; 
    border-radius: 0 var(--radius-md) var(--radius-md) 0; 
  }
  .ai-markdown table { 
    border-collapse: collapse; 
    width: 100%; 
    margin: 0.75rem 0; 
    border-radius: var(--radius-md);
    overflow: hidden;
    font-size: 0.875rem;
  }
  .ai-markdown th { 
    background-color: var(--color-bg-surface); 
    color: var(--color-text-primary); 
    padding: 0.5rem; 
    border: 1px solid var(--color-border); 
    text-align: left; 
    font-weight: 600;
  }
  .ai-markdown td { 
    background-color: var(--color-bg-elevated); 
    color: var(--color-text-secondary); 
    padding: 0.5rem; 
    border: 1px solid var(--color-border);
  }
`

// 渲染 Markdown
const renderMarkdown = (markdownText: string) => {
  const renderer = new marked.Renderer()
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const validLanguage = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    try {
      const highlighted = hljs.highlight(text, { language: validLanguage }).value
      return `<pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`
    } catch {
      return `<pre><code class="language-${validLanguage}">${text}</code></pre>`
    }
  }
  marked.setOptions({ renderer, gfm: true, breaks: true, pedantic: false })
  return { __html: marked.parse(markdownText) }
}

// 消息气泡组件
const MessageBubble: React.FC<{
  message: ChatMessage
  isLast: boolean
  config: any
  isStreaming?: boolean
}> = ({ message, isLast, config, isStreaming }) => {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [showReasoning, setShowReasoning] = useState(true)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isEmpty = !message.content || message.content.trim() === ''
  const hasReasoning = !!message.reasoning && message.reasoning.trim() !== ''
  
  // 是否正在思考中（有思考内容但还没开始正式回复）
  const isThinking = hasReasoning && isEmpty && isStreaming
  // 思考已完成（有正式回复内容了）
  const hasFinishedThinking = hasReasoning && !isEmpty

  // 思考开始后自动展开，有正文内容后自动折叠
  useEffect(() => {
    if (hasReasoning && isEmpty) {
      // 开始思考时展开
      setShowReasoning(true)
    } else if (!isEmpty) {
      // 有正文内容后折叠
      setShowReasoning(false)
    }
  }, [hasReasoning, isEmpty])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in`}>
      <div className={`flex gap-3 max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 头像 */}
        <div className={`
          w-8 h-8 rounded-xl flex items-center justify-center shrink-0
          ${isUser 
            ? 'bg-primary-600' 
            : 'bg-gradient-to-br from-primary-400 to-primary-600'
          }
        `}>
          {isUser ? (
            config.avatar ? (
              <img src={config.avatar} alt="avatar" className="w-full h-full rounded-xl object-cover" />
            ) : (
              <User className="w-4 h-4 text-white" />
            )
          ) : (
            <Bot className="w-4 h-4 text-white" />
          )}
        </div>

        {/* 消息内容 */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* 上下文标签 */}
          {message.context && message.context.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {message.context.map((ctx, i) => (
                <ContextTag key={i} context={ctx} />
              ))}
            </div>
          )}

          {/* 思考过程区域 */}
          {hasReasoning && (
            <div className="mb-2 w-full min-w-[280px]">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg text-xs text-text-tertiary 
                  hover:text-text-secondary hover:bg-bg-surface/50 transition-all"
              >
                <div className="flex items-center justify-center w-4 h-4 rounded bg-primary-500/10">
                  <Sparkles className="w-2.5 h-2.5 text-primary-500" />
                </div>
                <span className="font-medium">{isThinking ? '深度思考中' : '已深度思考'}</span>
                <span className="text-text-disabled">
                  {showReasoning ? '收起' : '展开'}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
              </button>
              
              {showReasoning && (
                <div className="mt-1.5 px-3 py-2.5 bg-bg-elevated border-l-2 border-primary-500/30 text-xs text-text-tertiary leading-relaxed">
                  <p className="whitespace-pre-wrap font-mono">{message.reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* 消息主体 - 思考中时不显示 */}
          {!isThinking && (
            <div className={`
              relative group px-4 py-3 rounded-2xl
              ${isUser 
                ? 'bg-primary-600 text-white rounded-tr-sm' 
                : 'bg-bg-surface border border-border rounded-tl-sm'
              }
            `}>
              {isUser ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              ) : (
                <>
                  <div 
                    className="ai-markdown text-sm"
                    dangerouslySetInnerHTML={renderMarkdown(message.content)}
                  />
                  {/* 流式生成中的闪烁光标 */}
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-primary-500 ml-0.5 animate-pulse align-middle" />
                  )}
                  {/* 复制按钮 - 只在非流式且非空时显示 */}
                  {!isStreaming && !isEmpty && (
                    <button
                      onClick={handleCopy}
                      className={`
                        absolute -top-2 -right-2 p-1.5 rounded-lg
                        bg-bg-elevated border border-border shadow-sm
                        text-text-tertiary hover:text-text-primary
                        opacity-0 group-hover:opacity-100 transition-all duration-fast
                      `}
                      title="复制"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* 时间戳 */}
          <span className="text-[10px] text-text-disabled mt-1 px-1">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  )
}

// 上下文标签
const ContextTag: React.FC<{ context: AIContext }> = ({ context }) => {
  const isFile = context.type === 'file'
  const name = context.path?.split('/').pop() || (context.type === 'workspace' ? '工作区' : '')

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
      ${isFile 
        ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' 
        : 'bg-bg-surface text-text-secondary border border-border'
      }
    `}>
      {isFile ? <FileText className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
      <span className="truncate max-w-[120px]">{name}</span>
    </span>
  )
}

// 输入框提及标签
const MentionTag: React.FC<{
  name: string
  type: 'file' | 'folder' | 'workspace'
  onRemove: () => void
}> = ({ name, type, onRemove }) => (
  <span className={`
    inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
    bg-bg-surface border border-border text-text-secondary
  `}>
    {type === 'file' ? <FileText className="w-3 h-3 text-primary-500" /> : <Folder className="w-3 h-3 text-primary-500" />}
    <span className="truncate max-w-[100px]">{name}</span>
    <button
      onClick={onRemove}
      className="ml-1 p-0.5 rounded hover:bg-bg-overlay text-text-tertiary hover:text-text-primary transition-colors"
    >
      <X className="w-3 h-3" />
    </button>
  </span>
)

// 提及建议下拉框
const MentionSuggestions: React.FC<{
  items: Array<{type: 'file' | 'folder' | 'workspace', name: string, path?: string}>
  onSelect: (item: {type: 'file' | 'folder' | 'workspace', name: string, path?: string}) => void
}> = ({ items, onSelect }) => (
  <div className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-auto bg-bg-elevated border border-border rounded-xl shadow-lg z-dropdown">
    <div className="p-2">
      <div className="text-[11px] text-text-disabled uppercase tracking-wider px-2 py-1.5">
        选择要引用的内容
      </div>
      {items.map((item) => (
        <button
          key={item.path || item.name}
          onClick={() => onSelect(item)}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-lg transition-colors text-left"
        >
          {item.type === 'file' ? (
            <FileText className="w-4 h-4 text-primary-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-primary-500 shrink-0" />
          )}
          <span className="truncate">{item.name}</span>
        </button>
      ))}
      {items.length === 0 && (
        <div className="text-xs text-text-disabled px-2 py-3 text-center">
          没有找到匹配的项目
        </div>
      )}
    </div>
  </div>
)

export const AIAssistant: React.FC = () => {
  const { 
    config, 
    chatHistory, 
    isLoading, 
    setLoading, 
    addChatMessage, 
    appendToMessage,
    appendToMessageReasoning,
    clearChat,
    fileTree,
    fileContents,
    workspace,
    workspaceHandle,
    pendingContext,
    clearPendingContext,
    removePendingSnippet,
    currentSessionId,
    setCurrentSessionId,
  } = useAppStore()
  
  const [inputMessage, setInputMessage] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [selectedMentions, setSelectedMentions] = useState<Array<{type:'file'|'folder'|'workspace', name:string, path?:string}>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastMessageCountRef = useRef(0)
  const isStreamingRef = useRef(false)

  // 滚动到底部
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  // 只在消息数量增加时滚动（新消息），不在内容更新时滚动
  useEffect(() => {
    const currentCount = chatHistory.length
    if (currentCount > lastMessageCountRef.current) {
      // 新消息添加时滚动
      scrollToBottom(false)
    }
    lastMessageCountRef.current = currentCount
  }, [chatHistory.length])

  // 提取 PDF 文本
  const extractPdfText = async (path: string): Promise<string | null> => {
    try {
      const blob = await FileSystemService.readFileBlob(path, workspace, workspaceHandle as any)
      if (!blob) return null
      const ab = await blob.arrayBuffer()
      const doc = await (pdfjsLib as any).getDocument({ data: ab }).promise
      const maxPages = Math.min(doc.numPages || 0, 30)
      let out = ''
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i)
        const tc = await page.getTextContent()
        const pageText = (tc.items as any[]).map(it => (it && (it as any).str) ? (it as any).str : '').join(' ')
        out += `\n\n--- 第 ${i} 页 ---\n${pageText}`
        if (out.length > 200000) break
      }
      try { doc.destroy && doc.destroy() } catch {}
      return out
    } catch (e) {
      return null
    }
  }

  // 获取提及建议
  const getSuggestions = useCallback(() => {
    const items: Array<{type:'file'|'folder'|'workspace', name:string, path?:string}> = []
    
    const traverse = (nodes: any[]) => {
      nodes.forEach(n => {
        const matches = !mentionQuery || n.name.toLowerCase().includes(mentionQuery.toLowerCase())
        if (matches) {
          items.push({
            type: n.type === 'file' ? 'file' : 'folder',
            name: n.name,
            path: n.path
          })
        }
        if (n.children) traverse(n.children)
      })
    }
    
    traverse(fileTree)
    
    // 添加工作区选项
    if (!mentionQuery || 'workspace'.includes(mentionQuery.toLowerCase()) || '工作区'.includes(mentionQuery)) {
      items.unshift({ type: 'workspace', name: '工作区', path: config.workspace })
    }
    
    return items.slice(0, 10)
  }, [fileTree, mentionQuery, config.workspace])

  // 发送消息
  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && selectedMentions.length === 0) || isLoading) return
    if (!config.apiKey) {
      toast.error('请先配置 API 密钥')
      return
    }
    if (config.provider === 'kimi') {
      toast.error('Kimi Code 目前暂不可用，请在设置中切换为硅基流动')
      return
    }

    // 收集上下文
    const callContext: AIContext[] = []
    
    for (const m of selectedMentions) {
      if (m.type === 'file' && m.path) {
        let content = fileContents[m.path]
        if (content === undefined) {
          if (m.path.toLowerCase().endsWith('.pdf')) {
            const txt = await extractPdfText(m.path)
            content = txt || '[该 PDF 无法解析文本]'
          } else {
            content = await FileSystemService.readFile(m.path, workspace, workspaceHandle as any)
          }
        }
        callContext.push({ type: 'file', path: m.path, content })
      } else if (m.type === 'folder' && m.path) {
        // 收集文件夹内所有文件
        const findNode = (nodes: any[]): any | null => {
          for (const n of nodes) {
            if (n.path === m.path) return n
            if (n.children) {
              const f = findNode(n.children)
              if (f) return f
            }
          }
          return null
        }
        const folderNode = findNode(fileTree)
        const collect = async (node: any) => {
          if (!node) return
          if (node.type === 'file') {
            let content = fileContents[node.path]
            if (content === undefined) {
              content = await FileSystemService.readFile(node.path, workspace, workspaceHandle as any)
            }
            callContext.push({ type: 'file', path: node.path, content })
          } else if (node.children) {
            for (const child of node.children) await collect(child)
          }
        }
        await collect(folderNode)
      } else {
        callContext.push({ type: 'workspace', path: config.workspace })
      }
    }

    // 添加待处理的上下文（从编辑器选择的片段）
    pendingContext.forEach(pc => {
      callContext.push(pc)
    })

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      context: selectedMentions.map(m => ({ type: m.type, path: m.path || '' }))
    }

    addChatMessage(userMessage)
    setInputMessage('')
    setSelectedMentions([])
    setShowMentions(false)
    setLoading(true)
    
    // 重置 textarea 高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const assistantId = (Date.now() + 1).toString()
      addChatMessage({ id: assistantId, role: 'assistant', content: '', timestamp: new Date(), context: callContext })
      
      abortRef.current = new AbortController()
      const assistants = config.assistants || []
      const active = assistants.find(a => a.id === config.activeAssistantId)
      const persona = active ? (active.id === 'default' ? DEFAULT_ASSISTANT_PROMPT : (active.prompt || '')) : DEFAULT_ASSISTANT_PROMPT
      
      await AIService.chatStream(
        inputMessage,
        callContext,
        config.apiKey,
        config.modelId,
        (content, reasoning) => {
          if (content) appendToMessage(assistantId, content)
          if (reasoning) appendToMessageReasoning(assistantId, reasoning)
        },
        chatHistory.map(m => ({ role: m.role, content: m.content })),
        abortRef.current.signal,
        persona,
        config.provider || 'siliconflow'
      )
    } catch (error) {
      const aborted = abortRef.current?.signal.aborted || (error as any)?.name === 'AbortError'
      if (!aborted) {
        console.error('AI 对话错误:', error)
        const errorMsg = error instanceof Error ? error.message : '未知错误'
        toast.error(`AI 对话失败: ${errorMsg}`)
        addChatMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，我无法处理您的请求。请检查 API 配置或稍后重试。',
          timestamp: new Date()
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
      clearPendingContext()
      
      // 保存会话
      if (workspace && workspaceHandle) {
        try {
          let sessionId = currentSessionId
          if (!sessionId) {
            sessionId = `session_${Date.now()}`
            setCurrentSessionId(sessionId)
          }
          await FileSystemService.writeSession(sessionId, {
            title: (chatHistory[0]?.content || '会话').slice(0, 32),
            messages: [...chatHistory, { id: Date.now().toString(), role: 'user', content: inputMessage, timestamp: new Date() }]
          }, workspace, workspaceHandle as any)
        } catch (e) {
          console.warn('保存会话失败', e)
        }
      }
    }
  }

  // 停止生成
  const handleAbort = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  // 输入变化处理
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputMessage(value)
    
    // 自动调整 textarea 高度
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px' // max-h-32 = 128px
    
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const query = value.substring(lastAtIndex + 1)
      if (!query.includes('\n')) {
        setShowMentions(true)
        setMentionQuery(query.trim())
      }
    } else {
      setShowMentions(false)
    }
  }

  // 选择提及项
  const handleMentionSelect = (item: {type:'file'|'folder'|'workspace', name:string, path?:string}) => {
    setSelectedMentions(prev => {
      if (prev.find(p => p.path === item.path && p.type === item.type)) return prev
      return [...prev, item]
    })
    
    const current = inputRef.current?.value || inputMessage
    const atIndex = current.lastIndexOf('@')
    if (atIndex !== -1) {
      setInputMessage(current.substring(0, atIndex).trimEnd())
    }
    setShowMentions(false)
    inputRef.current?.focus()
  }

  // 键盘处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Backspace' && inputMessage === '' && selectedMentions.length > 0) {
      setSelectedMentions(prev => prev.slice(0, -1))
    }
  }

  // 获取当前助手名称
  const activeAssistantName = (() => {
    const assistants = config.assistants || []
    const active = assistants.find(a => a.id === config.activeAssistantId)
    return active?.name || 'AI 助手'
  })()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      <div className="h-full flex flex-col bg-bg-elevated">
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0 bg-bg-elevated" style={{ position: 'relative', zIndex: 100 }}>
          <div className="relative">
            <button
              onClick={() => setAssistantMenuOpen(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors"
            >
              <Sparkles className="w-4 h-4 text-primary-500" />
              {activeAssistantName}
              <ChevronDown className={`
                w-3.5 h-3.5 text-text-tertiary transition-transform duration-fast
                ${assistantMenuOpen ? 'rotate-180' : ''}
              `} />
            </button>
            
            {/* 助手切换菜单 */}
            {assistantMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-bg-elevated border border-border rounded-xl shadow-lg z-dropdown animate-in">
                <div className="p-1.5">
                  {(config.assistants || []).map(a => (
                    <button
                      key={a.id}
                      onClick={() => {
                        // 切换助手逻辑
                        setAssistantMenuOpen(false)
                      }}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                        transition-colors
                        ${a.id === config.activeAssistantId 
                          ? 'bg-primary-500/10 text-primary-400' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                        }
                      `}
                    >
                      <Bot className="w-4 h-4" />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-0.5">
            <HeaderButton 
              icon={<Clock className="w-4 h-4" />} 
              onClick={() => setHistoryOpen(true)}
              tooltip="历史对话"
            />
            <HeaderButton 
              icon={<Plus className="w-4 h-4" />} 
              onClick={() => { clearChat(); setInputMessage('') }}
              tooltip="新建对话"
            />
          </div>
        </div>

        {/* 消息列表 */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar"
        >
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-tertiary">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400/20 to-primary-600/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary-500" />
              </div>
              <p className="text-text-secondary font-medium">有什么可以帮你的？</p>
              <p className="text-xs mt-1 text-text-disabled">使用 @ 引用文件或文件夹</p>
            </div>
          ) : (
            <>
              {chatHistory.map((message, i) => {
                // 判断是否是正在流式生成的最后一条 AI 消息
                const isLastAssistant = i === chatHistory.length - 1 && message.role === 'assistant'
                const streaming = isLastAssistant && isLoading
                
                return (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    isLast={i === chatHistory.length - 1}
                    config={config}
                    isStreaming={streaming}
                  />
                )
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-3 border-t border-border shrink-0">
          {config.provider === 'kimi' ? (
            <div className="text-center py-4">
              <Bot className="w-8 h-8 mx-auto mb-2 text-warning" />
              <p className="text-sm text-text-secondary mb-3">Kimi Code 目前暂不可用</p>
              <button
                onClick={() => {
                  document.querySelector<HTMLButtonElement>('[data-settings-button]')?.click()
                }}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-500 transition-colors"
              >
                切换为硅基流动
              </button>
            </div>
          ) : !config.apiKey ? (
            <div className="text-center py-4">
              <Bot className="w-8 h-8 mx-auto mb-2 text-text-disabled" />
              <p className="text-sm text-text-secondary mb-3">请先配置 API 密钥</p>
              <button
                onClick={() => {
                  document.querySelector<HTMLButtonElement>('[data-settings-button]')?.click()
                }}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-500 transition-colors"
              >
                去配置
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* 提及建议 */}
              {showMentions && <MentionSuggestions items={getSuggestions()} onSelect={handleMentionSelect} />}
              
              {/* 提及标签 - 放在输入框上方 */}
              {(selectedMentions.length > 0 || pendingContext.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedMentions.map((m, i) => (
                    <MentionTag 
                      key={i} 
                      name={m.name} 
                      type={m.type} 
                      onRemove={() => setSelectedMentions(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                  {pendingContext.map((pc, i) => (
                    <MentionTag 
                      key={`pending-${i}`}
                      name={(pc.path?.split('/').pop() || '') + (pc.lineStart ? `:${pc.lineStart}-${pc.lineEnd}` : '')}
                      type="file"
                      onRemove={() => removePendingSnippet(i)}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息，使用 @ 引用文件..."
                  className="flex-1 min-h-10 max-h-32 px-3 py-2 bg-bg-surface border border-border rounded-xl text-sm text-text-primary 
                    placeholder:text-text-disabled resize-none leading-5 m-0 overflow-y-auto
                    focus:outline-none focus:ring-0 focus:border-border transition-colors"
                  rows={1}
                  disabled={isLoading}
                />
                
                <button
                  onClick={isLoading ? handleAbort : handleSendMessage}
                  disabled={!isLoading && inputMessage.trim().length === 0 && selectedMentions.length === 0}
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-fast shrink-0 mb-0
                    ${isLoading 
                      ? 'bg-bg-surface text-text-secondary hover:bg-error/10 hover:text-error' 
                      : 'bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-600/20'
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed
                  `}
                >
                  {isLoading ? <Pause className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              
              {/* 提示文字 */}
              <div className="flex items-center justify-between mt-1.5 px-0.5 text-[11px] text-text-disabled">
                <span>{(config.provider as string) === 'kimi' ? 'Kimi Code' : config.modelId.split('/').pop()}</span>
                <span>Shift + Enter 换行</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}

// 头部按钮
const HeaderButton: React.FC<{
  icon: React.ReactNode
  onClick: () => void
  tooltip: string
}> = ({ icon, onClick, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setTooltipPos({
        top: rect.top - 30,
        left: rect.left + rect.width / 2
      })
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={() => { updatePosition(); setShowTooltip(true) }}
        onMouseLeave={() => setShowTooltip(false)}
        className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded-lg transition-all duration-fast"
      >
        {icon}
      </button>
      {showTooltip && (
        <div 
          className="fixed px-2 py-0.5 bg-bg-overlay text-text-primary text-[11px] rounded whitespace-nowrap
            border border-border shadow-md z-[9999] -translate-x-1/2 pointer-events-none"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {tooltip}
        </div>
      )}
    </>
  )
}
