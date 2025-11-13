import React, { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { useAppStore, ChatMessage } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const { workspace, workspaceHandle, setChatHistory, setCurrentSessionId } = useAppStore()
  const [sessions, setSessions] = useState<Array<{ id: string, title: string, updatedAt: number }>>([])

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !workspace || !workspaceHandle) return
      const list = await FileSystemService.listSessions(workspace, workspaceHandle as any)
      setSessions(list)
    }
    load()
  }, [isOpen, workspace, workspaceHandle])

  if (!isOpen) return null

  const openSession = async (id: string) => {
    if (!workspace || !workspaceHandle) return
    const data = await FileSystemService.readSession(id, workspace, workspaceHandle as any)
    if (data && Array.isArray(data.messages)) {
      const history: ChatMessage[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        context: m.context
      }))
      setChatHistory(history)
      setCurrentSessionId(id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center text-gray-200">
            <Clock className="w-5 h-5 mr-2" /> 历史对话
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"> <X className="w-5 h-5" /> </button>
        </div>
        <div className="max-h-96 overflow-auto p-2 custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无历史对话</div>
          ) : (
            sessions.map(s => (
              <button key={s.id} onClick={() => openSession(s.id)} className="w-full text-left px-2 py-2 rounded hover:bg-gray-700 text-gray-200">
                <div className="flex items-center justify-between">
                  <div className="truncate">{s.title}</div>
                  <div className="text-xs text-gray-500">{new Date(s.updatedAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-500 truncate">{s.id}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

