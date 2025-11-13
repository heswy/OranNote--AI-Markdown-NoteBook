import React, { useEffect, useMemo, useState } from 'react'
import { X, Loader2, FileText, Folder } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { fileTree, workspace, workspaceHandle, setActiveFile, addOpenFile, fileContents } = useAppStore()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<Array<{ path: string; name: string; type: 'file' | 'directory'; snippet?: string }>>([])

  const flattenFiles = useMemo(() => {
    const out: Array<{ path: string; name: string; type: 'file' | 'directory'; children?: any[] }> = []
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        out.push({ path: n.path, name: n.name, type: n.type, children: n.children })
        if (n.children) walk(n.children)
      }
    }
    walk(fileTree)
    return out
  }, [fileTree])

  const runSearch = async () => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    setIsSearching(true)
    const res: Array<{ path: string; name: string; type: 'file' | 'directory'; snippet?: string }> = []
    for (const f of flattenFiles) {
      if (f.type === 'directory') {
        if (f.name.toLowerCase().includes(q.toLowerCase())) res.push({ path: f.path, name: f.name, type: 'directory' })
        continue
      }
      const nameMatch = f.name.toLowerCase().includes(q.toLowerCase())
      let snippet: string | undefined
      if (!nameMatch) {
        let content = fileContents[f.path]
        if (content === undefined) {
          try {
            content = await FileSystemService.readFile(f.path, workspace, workspaceHandle as any)
          } catch {}
        }
        if (content) {
          const idx = content.toLowerCase().indexOf(q.toLowerCase())
          if (idx >= 0) {
            const start = Math.max(0, idx - 40)
            const end = Math.min(content.length, idx + q.length + 40)
            snippet = content.slice(start, end)
          }
        }
      }
      if (nameMatch || snippet) {
        res.push({ path: f.path, name: f.name, type: 'file', snippet })
      }
      if (res.length >= 200) break
    }
    setResults(res)
    setIsSearching(false)
  }

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setIsSearching(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
            placeholder="搜索当前目录中的文件名或内容"
            className="flex-1 bg-gray-700 text-gray-200 rounded px-3 py-2 focus:outline-none"
          />
          <button onClick={runSearch} className="ml-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">搜索</button>
          <button onClick={onClose} className="ml-2 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="max-h-96 overflow-auto p-2">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />正在搜索…</div>
          ) : results.length === 0 ? (
            <div className="text-center text-gray-500 py-8">无匹配结果</div>
          ) : (
            results.map(r => (
              <button
                key={r.path}
                onClick={() => { if (r.type === 'file') { setActiveFile(r.path); addOpenFile(r.path) } onClose() }}
                className="w-full text-left px-2 py-2 rounded hover:bg-gray-700 text-gray-200"
              >
                <div className="flex items-center">
                  {r.type === 'file' ? <FileText className="w-4 h-4 mr-2 text-yellow-400" /> : <Folder className="w-4 h-4 mr-2 text-yellow-500" />}
                  <span className="truncate">{r.name}</span>
                </div>
                {r.snippet && (
                  <div className="mt-1 text-xs text-gray-400 line-clamp-2 break-words">
                    {r.snippet}
                  </div>
                )}
                <div className="text-xs text-gray-500 truncate">{r.path}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

