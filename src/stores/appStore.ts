import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  ext?: string
}

export interface UserConfig {
  apiKey: string
  modelId: string
  username: string
  avatar: string
  workspace: string
  assistants?: Array<{ id: string; name: string; prompt: string }>
  activeAssistantId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: AIContext[]
}

export interface AIContext {
  type: 'file' | 'folder' | 'workspace'
  path: string
  content?: string
  line?: number
  lineStart?: number
  lineEnd?: number
}

export interface AppState {
  // 用户配置
  config: UserConfig
  
  // 文件系统
  workspace: string
  workspaceHandle?: any
  fileTree: FileNode[]
  activeFile: string | null
  openFiles: string[]
  
  // 编辑器
  editorMode: 'edit' | 'preview' | 'split'
  fileContents: Record<string, string>
  unsavedChanges: Set<string>
  
  // AI助手
  aiModel: string
  chatHistory: ChatMessage[]
  isLoading: boolean
  leftWidth: number
  rightWidth: number
  currentSessionId?: string
  pendingContext: AIContext[]
  
  // Actions
  setConfig: (config: Partial<UserConfig>) => void
  setWorkspace: (workspace: string) => void
  setWorkspaceHandle: (handle: any) => void
  setFileTree: (fileTree: FileNode[]) => void
  setActiveFile: (file: string | null) => void
  addOpenFile: (file: string) => void
  removeOpenFile: (file: string) => void
  setEditorMode: (mode: 'edit' | 'preview' | 'split') => void
  setFileContent: (file: string, content: string) => void
  markUnsaved: (file: string) => void
  markSaved: (file: string) => void
  setAIModel: (model: string) => void
  addChatMessage: (message: ChatMessage) => void
  appendToMessage: (id: string, chunk: string) => void
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void
  setLoading: (loading: boolean) => void
  clearChat: () => void
  setChatHistory: (history: ChatMessage[]) => void
  setCurrentSessionId: (id: string | undefined) => void
  addPendingSnippet: (path: string, content: string, line?: number) => void
  removePendingSnippet: (index: number) => void
  clearPendingContext: () => void
  setLeftWidth: (w: number) => void
  setRightWidth: (w: number) => void
  resetForNewWorkspace: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始状态
      config: {
        apiKey: '',
        modelId: 'deepseek-ai/DeepSeek-V3.1-Terminus',
        username: 'User',
        avatar: '',
        workspace: '',
        assistants: [
          { id: 'default', name: '默认助手', prompt: '' }
        ],
        activeAssistantId: 'default'
      },
      workspace: '',
      workspaceHandle: undefined,
      fileTree: [],
      activeFile: null,
      openFiles: [],
      editorMode: 'split',
      fileContents: {},
      unsavedChanges: new Set(),
      aiModel: 'deepseek-ai/DeepSeek-V3.1-Terminus',
      chatHistory: [],
      isLoading: false,
      leftWidth: 320,
      rightWidth: 384,
      currentSessionId: undefined,
      pendingContext: [],
      
      // Actions
      setConfig: (config) => set((state) => ({
        config: { ...state.config, ...config }
      })),
      
      setWorkspace: (workspace) => set({ workspace }),
      
      setWorkspaceHandle: (handle) => set({ workspaceHandle: handle }),
      
      setFileTree: (fileTree) => set({ fileTree }),
      
      setActiveFile: (activeFile) => set({ activeFile }),
      
      addOpenFile: (file) => set((state) => ({
        openFiles: state.openFiles.includes(file) 
          ? state.openFiles 
          : [...state.openFiles, file]
      })),
      
      removeOpenFile: (file) => set((state) => ({
        openFiles: state.openFiles.filter(f => f !== file),
        activeFile: state.activeFile === file ? null : state.activeFile
      })),
      
      setEditorMode: (editorMode) => set({ editorMode }),
      
      setFileContent: (file, content) => set((state) => ({
        fileContents: { ...state.fileContents, [file]: content }
      })),
      
      markUnsaved: (file) => set((state) => ({
        unsavedChanges: new Set([...state.unsavedChanges, file])
      })),
      
      markSaved: (file) => set((state) => {
        const newUnsaved = new Set(state.unsavedChanges)
        newUnsaved.delete(file)
        return { unsavedChanges: newUnsaved }
      }),
      
      setAIModel: (aiModel) => set({ aiModel }),
      
      addChatMessage: (message) => set((state) => ({
        chatHistory: [...state.chatHistory, message]
      })),
      appendToMessage: (id, chunk) => set((state) => ({
        chatHistory: state.chatHistory.map(m => m.id === id ? { ...m, content: (m.content || '') + chunk } : m)
      })),
      updateChatMessage: (id, patch) => set((state) => ({
        chatHistory: state.chatHistory.map(m => m.id === id ? { ...m, ...patch } : m)
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      clearChat: () => set({ chatHistory: [], currentSessionId: undefined }),
      setChatHistory: (history) => set({ chatHistory: history }),
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      addPendingSnippet: (path, content, lineStart, lineEnd) => set((state) => ({
        pendingContext: [...state.pendingContext, { type: 'file', path, content, lineStart, lineEnd }]
      })),
      removePendingSnippet: (index) => set((state) => ({
        pendingContext: state.pendingContext.filter((_, i) => i !== index)
      })),
      clearPendingContext: () => set({ pendingContext: [] }),
      setLeftWidth: (w) => set({ leftWidth: w }),
      setRightWidth: (w) => set({ rightWidth: w }),
      resetForNewWorkspace: () => set(() => ({
        activeFile: null,
        openFiles: [],
        fileContents: {},
        unsavedChanges: new Set(),
        chatHistory: [],
        currentSessionId: undefined,
        pendingContext: []
      }))
    }),
    {
      name: 'oran-note-storage',
      version: 3,
      migrate: (state: any, version: number) => {
        try {
          if (!state) return state
          const cfg = state.config || {}
          const list: any[] = Array.isArray(cfg.assistants) ? [...cfg.assistants] : []
          const hasDefault = list.some(a => a && a.id === 'default')
          if (!hasDefault) {
            list.unshift({ id: 'default', name: '默认助手', prompt: '' })
          }
          cfg.assistants = list
          const hasActive = cfg.assistants.find((a: any) => a.id === cfg.activeAssistantId)
          if (!cfg.activeAssistantId || !hasActive) {
            cfg.activeAssistantId = 'default'
          }
          state.config = cfg
          return state
        } catch {
          return state
        }
      },
      partialize: (state) => ({
        config: state.config,
        editorMode: state.editorMode,
        aiModel: state.aiModel
      })
    }
  )
)
