import React, { useState, useRef, useEffect } from 'react'
import { Send, Clock, Plus, Folder, Pause } from 'lucide-react'
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

export const AIAssistant: React.FC = () => {
  const { 
    config, 
    chatHistory, 
    isLoading, 
    setLoading, 
    addChatMessage, 
    appendToMessage,
    clearChat,
    fileTree,
    fileContents,
    workspace,
    workspaceHandle,
    pendingContext,
    clearPendingContext,
    removePendingSnippet
  } = useAppStore()
  
  const [inputMessage, setInputMessage] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [selectedMentions, setSelectedMentions] = useState<Array<{type:'file'|'folder'|'workspace', name:string, path?:string}>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const markdownStyles = `
  .markdown-preview h1 { font-size: 1.25rem; font-weight: 700; color: #e5e7eb; margin: 0.75rem 0 0.5rem 0; }
  .markdown-preview h2 { font-size: 1.125rem; font-weight: 600; color: #e5e7eb; margin: 0.5rem 0 0.5rem 0; }
  .markdown-preview h3 { font-size: 1rem; font-weight: 600; color: #e5e7eb; margin: 0.5rem 0 0.25rem 0; }
  .markdown-preview p { color: #e5e7eb; line-height: 1.6; margin-bottom: 0.5rem; }
  .markdown-preview ul { list-style-type: disc; color: #e5e7eb; margin: 0.25rem 0; padding-left: 1.25rem; }
  .markdown-preview ol { list-style-type: decimal; color: #e5e7eb; margin: 0.25rem 0; padding-left: 1.25rem; }
  .markdown-preview li { margin: 0.125rem 0; line-height: 1.5; }
  .markdown-preview strong { color: #fb923c; font-weight: 700; }
  .markdown-preview em { color: #c084fc; font-style: italic; }
  .markdown-preview code { background-color: #1f2937; color: #fdba74; padding: 0.1rem 0.2rem; border-radius: 0.25rem; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.875rem; }
  .markdown-preview pre { background-color: #111827; border: 1px solid #374151; border-radius: 0.5rem; padding: 0.75rem; margin: 0.5rem 0; overflow-x: auto; }
  .markdown-preview blockquote { border-left: 4px solid #6b7280; background-color: #1f2937; padding: 0.5rem 0.75rem; margin: 0.5rem 0; border-radius: 0 0.375rem 0.375rem 0; color: #d1d5db; }
  `

  const renderMarkdown = (markdownText: string) => {
    const renderer = new marked.Renderer()
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const validLanguage = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        const highlighted = hljs.highlight(text, { language: validLanguage }).value
        return `<pre class="code-block"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`
      } catch {
        return `<pre class="code-block"><code class="language-${validLanguage}">${text}</code></pre>`
      }
    }
    marked.setOptions({ renderer, gfm: true, breaks: true, pedantic: false })
    const html = marked.parse(markdownText)
    return { __html: html }
  }

  // Hook必须在组件顶部调用
  useEffect(() => {
    scrollToBottom()
  }, [chatHistory])

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const trimForAI = (text: string, limit: number = 100000) => {
    return text.length > limit ? (text.slice(0, limit) + '\n\n[...内容已截断]') : text
  }

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

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    if (!config.apiKey) {
      toast.error('请先配置API密钥')
      return
    }

    const displayContext: AIContext[] = []
    selectedMentions.forEach(m => {
      if (m.type === 'file' && m.path) {
        displayContext.push({ type: 'file', path: m.path })
      } else if (m.type === 'folder' && m.path) {
        displayContext.push({ type: 'folder', path: m.path })
      } else {
        displayContext.push({ type: 'workspace', path: config.workspace })
      }
    })
    pendingContext.forEach(pc => {
      displayContext.push({ type: 'file', path: pc.path })
    })

    const callContext: AIContext[] = []
    const gatherFiles = async (folderPath: string) => {
      const findNode = (nodes: any[]): any | null => {
        for (const n of nodes) {
          if (n.path === folderPath) return n
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
          const path = node.path
          const cached = fileContents[path]
          let content = cached !== undefined ? cached : undefined
          if (content === undefined) {
            if (path.toLowerCase().endsWith('.pdf')) {
              const txt = await extractPdfText(path)
              content = txt ? trimForAI(txt) : '[该PDF无法解析文本]'
            } else {
              content = await FileSystemService.readFile(path, workspace, workspaceHandle as any)
            }
          }
          callContext.push({ type: 'file', path, content })
        } else if (node.type === 'directory' && node.children) {
          for (const child of node.children) {
            await collect(child)
          }
        }
      }
      await collect(folderNode)
    }

    for (const m of selectedMentions) {
      if (m.type === 'file' && m.path) {
        const cached = fileContents[m.path]
        let content = cached !== undefined ? cached : undefined
        if (content === undefined) {
          if (m.path.toLowerCase().endsWith('.pdf')) {
            const txt = await extractPdfText(m.path)
            content = txt ? trimForAI(txt) : '[该PDF无法解析文本]'
          } else {
            content = await FileSystemService.readFile(m.path, workspace, workspaceHandle as any)
          }
        }
        callContext.push({ type: 'file', path: m.path, content })
      } else if (m.type === 'folder' && m.path) {
        await gatherFiles(m.path)
      } else {
        callContext.push({ type: 'workspace', path: config.workspace })
      }
    }
    pendingContext.forEach(pc => {
      callContext.push({ type: 'file', path: pc.path, content: pc.content })
    })

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      context: displayContext
    }

    addChatMessage(userMessage)
    setInputMessage('')
    setSelectedMentions([])
    setShowMentions(false)
    setLoading(true)

      try {
        const assistantId = (Date.now() + 1).toString()
        addChatMessage({ id: assistantId, role: 'assistant', content: '', timestamp: new Date(), context: callContext })
        abortRef.current = new AbortController()
        const as = (config.assistants || [])
        const active = as.find(a => a.id === config.activeAssistantId)
        const persona = active ? (active.id === 'default' ? DEFAULT_ASSISTANT_PROMPT : (active.prompt || '')) : DEFAULT_ASSISTANT_PROMPT
        await AIService.chatStream(
          inputMessage,
          callContext,
          config.apiKey,
          config.modelId,
          (chunk) => {
            appendToMessage(assistantId, chunk)
          },
          chatHistory.map(m => ({ role: m.role, content: m.content })),
          abortRef.current.signal,
          persona
        )
      } catch (error) {
      const aborted = (abortRef.current && abortRef.current.signal.aborted) || (error as any)?.name === 'AbortError'
      if (!aborted) {
        console.error('AI对话错误:', error)
        toast.error('AI对话失败，请检查API密钥和网络连接')
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，我无法处理您的请求。请检查API配置或稍后重试。',
          timestamp: new Date()
        }
        addChatMessage(errorMessage)
      }
    } finally {
      setLoading(false)
      abortRef.current = null
      // 持久化会话
      try {
        if (workspace && workspaceHandle) {
          const { currentSessionId } = useAppStore.getState()
          let sessionId = currentSessionId
          if (!sessionId) {
            sessionId = `session_${Date.now()}`
            useAppStore.getState().setCurrentSessionId(sessionId)
          }
          await FileSystemService.writeSession(sessionId!, {
            title: (chatHistory[0]?.content || '会话').slice(0, 32),
            messages: useAppStore.getState().chatHistory
          }, workspace, workspaceHandle as any)
        }
      } catch (e) {
        console.warn('保存会话失败', e)
      }
      clearPendingContext()
    }
  }

  const handleAbort = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setLoading(false)
  }

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputMessage(value)
    
    // 检测@提及
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const query = value.substring(lastAtIndex + 1)
      // 只要出现 @ 就展示提及菜单；空查询展示常用项
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
      const before = current.substring(0, atIndex)
      setInputMessage(before.trimEnd())
    }
    setShowMentions(false)
    inputRef.current?.focus()
  }

  // 获取文件建议
  const getSuggestions = () => {
    const folders: Array<{type:'file'|'folder'|'workspace', name:string, path?:string}> = []
    const pdfs: Array<{type:'file'|'folder'|'workspace', name:string, path?:string}> = []
    const files: Array<{type:'file'|'folder'|'workspace', name:string, path?:string}> = []
    const match = (name: string) => !mentionQuery || name.toLowerCase().includes(mentionQuery.toLowerCase())
    const pushNode = (node: any) => {
      if (!match(node.name)) return
      const item = { type: node.type === 'file' ? 'file' as const : 'folder' as const, name: node.name, path: node.path }
      if (node.type === 'file') {
        if (node.name.toLowerCase().endsWith('.pdf')) pdfs.push(item)
        else files.push(item)
      } else {
        folders.push(item)
      }
    }
    const traverse = (nodes: any[]) => {
      nodes.forEach(n => {
        pushNode(n)
        if (n.children) traverse(n.children)
      })
    }
    traverse(fileTree)
    const result: Array<{type:'file'|'folder'|'workspace', name:string, path?:string}> = []
    if (!mentionQuery || match('workspace') || match('工作区')) {
      result.push({ type: 'workspace', name: '工作区', path: config.workspace })
    }
    // 平衡排序：工作区 → 文件夹 → PDF → 其它文件
    result.push(...folders)
    result.push(...pdfs)
    result.push(...files)
    return result.slice(0, 20)
  }

  // 处理按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Backspace') {
      const target = e.target as HTMLTextAreaElement
      if (target.selectionStart === 0 && target.selectionEnd === 0 && selectedMentions.length > 0) {
        setSelectedMentions(prev => prev.slice(0, prev.length - 1))
        e.preventDefault()
      }
    }
  }

  // 点击外部关闭提及菜单
  const handleClickOutside = () => {
    setShowMentions(false)
  }

  // Hook必须在组件顶部调用
  useEffect(() => {
    if (showMentions) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMentions])

  return (
    <>
    <div className="h-full flex flex-col bg-gray-800">
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      {/* 头部 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="relative">
          <button
            className="text-sm font-medium text-gray-300 hover:text-white"
            onClick={() => setAssistantMenuOpen(v => !v)}
            title="切换助手"
          >
            {(() => {
              const { config } = useAppStore.getState()
              const as = (config.assistants || [])
              const active = as.find(a => a.id === config.activeAssistantId)
              return `AI 助手${active ? ` · ${active.name}` : ''}`
            })()}
          </button>
          {assistantMenuOpen && (
            <div className="absolute z-10 mt-2 w-56 bg-gray-700 border border-gray-600 rounded shadow">
              {(useAppStore.getState().config.assistants || []).map(a => (
                <button
                  key={a.id}
                  onClick={() => {
                    useAppStore.getState().setConfig({ activeAssistantId: a.id })
                    setAssistantMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-600"
                >{a.name || '未命名助手'}</button>
              ))}
              <div className="px-3 py-2 border-t border-gray-600 text-xs text-blue-300">
                <button
                  onClick={() => {
                    const settingsBtn = document.querySelector('[data-settings-button]') as HTMLButtonElement
                    settingsBtn?.click()
                    setAssistantMenuOpen(false)
                  }}
                  className="hover:underline"
                >管理助手</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="历史对话"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => { clearChat(); setInputMessage('') }}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="新建对话"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 对话历史 */}
      <div className={`flex-1 p-3 space-y-4 ${chatHistory.length > 0 ? 'overflow-y-auto custom-scrollbar' : ''}`}>
        {chatHistory.length === 0 ? (
          <div className="h-full grid place-items-center">
            <div className="text-center text-gray-500">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-xl">🤖</span>
              </div>
              <p className="text-sm">快来问我！</p>
            </div>
          </div>
        ) : (
          chatHistory.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-700 text-gray-200'
              }`}>
                <div className="flex items-start space-x-2">
                  {message.role === 'assistant' && (
                    <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs">🤖</span>
                    </div>
                  )}
                  {message.role === 'user' && (
                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5 bg-orange-600 text-white flex items-center justify-center">
                      {config.avatar ? (
                        <img src={config.avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">{(config.username || 'U').slice(0,1)}</span>
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    {message.role === 'user' && message.context && message.context.length > 0 && (
                      <div className={`mb-2 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                        <div className="flex flex-wrap gap-2">
                          {message.context.map((c, i) => (
                            <span key={(c.path || c.type) + i} className="inline-flex items-center px-2 py-1 rounded-full bg-gray-600 text-gray-200 text-xs">
                              {c.type === 'file' ? (
                                <svg className="w-4 h-4 mr-1 text-orange-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M18 15.75C18 17.4833 17.3917 18.9583 16.175 20.175C14.9583 21.3917 13.4833 22 11.75 22C10.0167 22 8.54167 21.3917 7.325 20.175C6.10833 18.9583 5.5 17.4833 5.5 15.75V6.5C5.5 5.25 5.9375 4.1875 6.8125 3.3125C7.6875 2.4375 8.75 2 10 2C11.25 2 12.3125 2.4375 13.1875 3.3125C14.0625 4.1875 14.5 5.25 14.5 6.5V15.25C14.5 16.0167 14.2333 16.6667 13.7 17.2C13.1667 17.7333 12.5167 18 11.75 18C10.9833 18 10.3333 17.7333 9.8 17.2C9.26667 16.6667 9 16.0167 9 15.25V6H11V15.25C11 15.4667 11.0708 15.6458 11.2125 15.7875C11.3542 15.9292 11.5333 16 11.75 16C11.9667 16 12.1458 15.9292 12.2875 15.7875C12.4292 15.6458 12.5 15.4667 12.5 15.25V6.5C12.4833 5.8 12.2375 5.20833 11.7625 4.725C11.2875 4.24167 10.7 4 10 4C9.3 4 8.70833 4.24167 8.225 4.725C7.74167 5.20833 7.5 5.8 7.5 6.5V15.75C7.48333 16.9333 7.89167 17.9375 8.725 18.7625C9.55833 19.5875 10.5667 20 11.75 20C12.9167 20 13.9083 19.5875 14.725 18.7625C15.5417 17.9375 15.9667 16.9333 16 15.75V6H18V15.75Z"/>
                                </svg>
                              ) : (
                                <Folder className="w-4 h-4 mr-1 text-orange-500" />
                              )}
                              {c.type === 'workspace' ? '工作区' : (c.path ? c.path.split('/').pop() : '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {message.role === 'assistant' ? (
                      <div 
                        className="text-sm markdown-preview leading-relaxed"
                        dangerouslySetInnerHTML={renderMarkdown(message.content)}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    )}
                    {message.role === 'assistant' && message.context && message.context.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-600">
                        <div className="flex flex-wrap gap-2">
                          {message.context.map((c, i) => (
                            <span key={(c.path || c.type) + i} className="inline-flex items-center px-2 py-1 rounded-full bg-gray-600 text-gray-200 text-xs">
                              {c.type === 'file' ? (
                                <svg className="w-4 h-4 mr-1 text-orange-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M18 15.75C18 17.4833 17.3917 18.9583 16.175 20.175C14.9583 21.3917 13.4833 22 11.75 22C10.0167 22 8.54167 21.3917 7.325 20.175C6.10833 18.9583 5.5 17.4833 5.5 15.75V6.5C5.5 5.25 5.9375 4.1875 6.8125 3.3125C7.6875 2.4375 8.75 2 10 2C11.25 2 12.3125 2.4375 13.1875 3.3125C14.0625 4.1875 14.5 5.25 14.5 6.5V15.25C14.5 16.0167 14.2333 16.6667 13.7 17.2C13.1667 17.7333 12.5167 18 11.75 18C10.9833 18 10.3333 17.7333 9.8 17.2C9.26667 16.6667 9 16.0167 9 15.25V6H11V15.25C11 15.4667 11.0708 15.6458 11.2125 15.7875C11.3542 15.9292 11.5333 16 11.75 16C11.9667 16 12.1458 15.9292 12.2875 15.7875C12.4292 15.6458 12.5 15.4667 12.5 15.25V6.5C12.4833 5.8 12.2375 5.20833 11.7625 4.725C11.2875 4.24167 10.7 4 10 4C9.3 4 8.70833 4.24167 8.225 4.725C7.74167 5.20833 7.5 5.8 7.5 6.5V15.75C7.48333 16.9333 7.89167 17.9375 8.725 18.7625C9.55833 19.5875 10.5667 20 11.75 20C12.9167 20 13.9083 19.5875 14.725 18.7625C15.5417 17.9375 15.9667 16.9333 16 15.75V6H18V15.75Z"/>
                                </svg>
                              ) : (
                                <Folder className="w-4 h-4 mr-1 text-orange-500" />
                              )}
                              {c.type === 'workspace' ? '工作区' : (c.path ? c.path.split('/').pop() : '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 提及建议 */}

      {/* 输入区域 */}
      <div className="p-3 border-t border-gray-700">
        {!config.apiKey ? (
          <div className="text-center py-4">
            <div className="text-gray-400 mb-2">🤖</div>
            <p className="text-sm text-gray-400 mb-3">请先配置API密钥以使用AI助手</p>
            <button
              onClick={() => {
                const settingsBtn = document.querySelector('[data-settings-button]') as HTMLButtonElement
                settingsBtn?.click()
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm transition-colors"
            >
              配置API密钥
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
              <div className="flex-1 relative">
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedMentions.map((m, idx) => (
                    <span key={(m.path || m.name) + idx} className="inline-flex items-center px-2 py-1 rounded-full bg-gray-600 text-gray-200 text-xs">
                      {m.type === 'file' ? (
                        <svg className="w-4 h-4 mr-1 text-orange-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 15.75C18 17.4833 17.3917 18.9583 16.175 20.175C14.9583 21.3917 13.4833 22 11.75 22C10.0167 22 8.54167 21.3917 7.325 20.175C6.10833 18.9583 5.5 17.4833 5.5 15.75V6.5C5.5 5.25 5.9375 4.1875 6.8125 3.3125C7.6875 2.4375 8.75 2 10 2C11.25 2 12.3125 2.4375 13.1875 3.3125C14.0625 4.1875 14.5 5.25 14.5 6.5V15.25C14.5 16.0167 14.2333 16.6667 13.7 17.2C13.1667 17.7333 12.5167 18 11.75 18C10.9833 18 10.3333 17.7333 9.8 17.2C9.26667 16.6667 9 16.0167 9 15.25V6H11V15.25C11 15.4667 11.0708 15.6458 11.2125 15.7875C11.3542 15.9292 11.5333 16 11.75 16C11.9667 16 12.1458 15.9292 12.2875 15.7875C12.4292 15.6458 12.5 15.4667 12.5 15.25V6.5C12.4833 5.8 12.2375 5.20833 11.7625 4.725C11.2875 4.24167 10.7 4 10 4C9.3 4 8.70833 4.24167 8.225 4.725C7.74167 5.20833 7.5 5.8 7.5 6.5V15.75C7.48333 16.9333 7.89167 17.9375 8.725 18.7625C9.55833 19.5875 10.5667 20 11.75 20C12.9167 20 13.9083 19.5875 14.725 18.7625C15.5417 17.9375 15.9667 16.9333 16 15.75V6H18V15.75Z"/>
                        </svg>
                      ) : (
                        <Folder className="w-4 h-4 mr-1 text-orange-500" />
                      )}
                      {m.name}
                      <button
                        type="button"
                        className="ml-2 w-4 h-4 flex items-center justify-center rounded-full bg-gray-500 text-gray-200 hover:bg-gray-400"
                        onClick={() => setSelectedMentions(prev => prev.filter((_, i) => i !== idx))}
                        aria-label="移除引用"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {pendingContext.map((pc, idx) => (
                    <span key={(pc.path || '') + idx} className="inline-flex items-center px-2 py-1 rounded-full bg-orange-600 text-white text-xs">
                      <span className="mr-1">✂️</span>
                      {((pc.path || '').split('/').pop() || '')}{pc.lineStart && pc.lineEnd ? `:${pc.lineStart}-${pc.lineEnd}` : pc.line ? `:${pc.line}` : ''}
                      <button
                        type="button"
                        className="ml-2 w-4 h-4 flex items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-400"
                        onClick={() => removePendingSnippet(idx)}
                        aria-label="移除引用"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {showMentions && (
                  <div className="absolute left-0 w-72 max-h-64 overflow-auto bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10" style={{ bottom: 'calc(100% + 8px)' }}>
                    <div className="p-2">
                      <div className="text-xs text-gray-400 mb-2">选择要提及的内容：</div>
                      {getSuggestions().map((item) => (
                        <button
                          key={item.path || item.name}
                          onClick={() => handleMentionSelect(item)}
                          className="w-full text-left px-2 py-1 text-sm text-gray-300 hover:bg-gray-600 rounded flex items-center space-x-2"
                        >
                          {item.type === 'file' ? (
                            <svg className="w-4 h-4 mr-1 text-orange-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 15.75C18 17.4833 17.3917 18.9583 16.175 20.175C14.9583 21.3917 13.4833 22 11.75 22C10.0167 22 8.54167 21.3917 7.325 20.175C6.10833 18.9583 5.5 17.4833 5.5 15.75V6.5C5.5 5.25 5.9375 4.1875 6.8125 3.3125C7.6875 2.4375 8.75 2 10 2C11.25 2 12.3125 2.4375 13.1875 3.3125C14.0625 4.1875 14.5 5.25 14.5 6.5V15.25C14.5 16.0167 14.2333 16.6667 13.7 17.2C13.1667 17.7333 12.5167 18 11.75 18C10.9833 18 10.3333 17.7333 9.8 17.2C9.26667 16.6667 9 16.0167 9 15.25V6H11V15.25C11 15.4667 11.0708 15.6458 11.2125 15.7875C11.3542 15.9292 11.5333 16 11.75 16C11.9667 16 12.1458 15.9292 12.2875 15.7875C12.4292 15.6458 12.5 15.4667 12.5 15.25V6.5C12.4833 5.8 12.2375 5.20833 11.7625 4.725C11.2875 4.24167 10.7 4 10 4C9.3 4 8.70833 4.24167 8.225 4.725C7.74167 5.20833 7.5 5.8 7.5 6.5V15.75C7.48333 16.9333 7.89167 17.9375 8.725 18.7625C9.55833 19.5875 10.5667 20 11.75 20C12.9167 20 13.9083 19.5875 14.725 18.7625C15.5417 17.9375 15.9667 16.9333 16 15.75V6H18V15.75Z"/>
                            </svg>
                          ) : (
                            <Folder className="w-4 h-4 mr-1 text-orange-500" />
                          )}
                          <span>{item.name}</span>
                        </button>
                      ))}
                      {getSuggestions().length === 0 && (
                        <div className="text-xs text-gray-500 px-2 py-1">
                          没有找到匹配的项目
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="输入消息，使用@提及文件..."
                className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                disabled={isLoading}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={(e) => {
                  e.preventDefault()
                  const path = e.dataTransfer.getData('text/plain')
                  if (!path) return
                  const find = (nodes: any[]): any => {
                    for (const n of nodes) {
                      if (n.path === path) return n
                      if (n.children) {
                        const f = find(n.children)
                        if (f) return f
                      }
                    }
                    return null
                  }
                  const node = find(fileTree)
                  if (node) {
                    handleMentionSelect({ type: node.type === 'file' ? 'file' : 'folder', name: node.name, path: node.path })
                  }
                }}
              />
              {/* 取消@按钮，使用输入@触发提及 */}
            </div>
            <button
              onClick={isLoading ? handleAbort : handleSendMessage}
              disabled={!isLoading && (inputMessage.trim().length === 0 && selectedMentions.length === 0)}
              className={`px-4 py-2 ${isLoading ? 'bg-gray-600 hover:bg-gray-500' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg transition-colors`}
            >
              {isLoading ? <Pause className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
        
        {/* 模型选择 */}
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            模型: {config.modelId.split('/').pop()}
          </div>
          <div className="text-xs text-gray-500">
            Shift+Enter 换行
          </div>
        </div>
      </div>
    </div>
    <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}
