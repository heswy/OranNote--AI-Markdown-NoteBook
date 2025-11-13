import React, { useRef, useCallback } from 'react'
import { Header } from '@/components/Header'
import { FileTree } from '@/components/FileTree'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { AIAssistant } from '@/components/AIAssistant'
import { useAppStore } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'
import { Toaster } from 'sonner'

export const MainLayout: React.FC = () => {
  const { 
    fileTree, 
    setFileTree, 
    setActiveFile, 
    addOpenFile,
    config,
    workspace,
    workspaceHandle,
    leftWidth,
    rightWidth,
    setLeftWidth,
    setRightWidth
  } = useAppStore()

  // 处理文件点击
  const handleFileClick = async (filePath: string) => {
    console.log(`点击文件: ${filePath}`)
    setActiveFile(filePath)
    addOpenFile(filePath)
  }

  const startDragLeft = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX
    const init = leftWidth
    const onMove = (ev: MouseEvent) => {
      if ((ev as MouseEvent).buttons === 0) { onUp(); return }
      const delta = ev.clientX - startX
      const next = Math.max(200, Math.min(600, init + delta))
      setLeftWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mouseleave', onUp)
      window.removeEventListener('blur', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mouseleave', onUp)
    window.addEventListener('blur', onUp)
  }, [leftWidth, setLeftWidth])

  const startDragRight = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX
    const init = rightWidth
    const onMove = (ev: MouseEvent) => {
      if ((ev as MouseEvent).buttons === 0) { onUp(); return }
      const delta = startX - ev.clientX
      const next = Math.max(260, Math.min(600, init + delta))
      setRightWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mouseleave', onUp)
      window.removeEventListener('blur', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mouseleave', onUp)
    window.addEventListener('blur', onUp)
  }, [rightWidth, setRightWidth])

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* 头部 */}
      <Header />
      
      {/* 主要内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：文件管理区 */}
        <div className="bg-gray-800 border-r border-gray-700 flex flex-col" style={{ width: leftWidth }}>
          <FileTree 
            fileTree={fileTree}
            onFileClick={handleFileClick}
          />
        </div>

        <div onMouseDown={startDragLeft} className="w-2 flex-shrink-0 cursor-col-resize hover:bg-gray-600 bg-transparent relative z-20" />

        {/* 中间：笔记编辑区 */}
        <div className="flex-1 bg-gray-900 flex flex-col min-h-0 border-l border-r border-gray-700">
          <MarkdownEditor />
        </div>

        {/* 右侧：AI助手区 */}
        <div onMouseDown={startDragRight} className="w-2 flex-shrink-0 cursor-col-resize hover:bg-gray-600 bg-transparent relative z-20" />
        <div className="bg-gray-800 border-l border-gray-700 flex flex-col" style={{ width: rightWidth }}>
          <AIAssistant />
        </div>
      </div>

      {/* Toast通知 */}
      <Toaster 
        position="bottom-right"
        theme="dark"
        richColors
      />
    </div>
  )
}
