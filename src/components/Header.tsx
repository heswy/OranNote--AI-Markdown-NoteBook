import React, { useState } from 'react'
import { Settings, Search, User, HelpCircle } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'
import { SettingsModal } from '@/components/SettingsModal'
import { AboutModal } from '@/components/AboutModal'
import { SearchModal } from '@/components/SearchModal'

export const Header: React.FC = () => {
  const { config, setConfig, workspace, setWorkspace, setFileTree, setWorkspaceHandle, resetForNewWorkspace } = useAppStore()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const handleSelectWorkspace = async () => {
    try {
      setIsLoading(true)
      console.log('开始选择工作区...')
      
      const result = await FileSystemService.selectWorkspace()
      console.log(`选择的工作区路径: ${result.path}`)
      
      // 取消选择时不更新工作区（无句柄且返回占位名）
      if (!result.dirHandle && (result.path === 'workspace' || !result.path)) {
        console.log('用户取消选择目录，保持当前工作区不变')
      } else {
        setConfig({ workspace: result.path })
        setWorkspace(result.path)
        resetForNewWorkspace()
        if (result.dirHandle) {
          setWorkspaceHandle(result.dirHandle)
        }
        // 加载文件树，如果有目录句柄则传入
        console.log('加载文件树...')
        const files = await FileSystemService.getWorkspaceFiles(result.path, result.dirHandle)
        console.log(`文件树加载完成，找到 ${files.length} 个顶级项目`)
        setFileTree(files)
        console.log('工作区选择完成')
      }
    } catch (error) {
      console.error('选择工作区失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        {/* 左侧：Logo和工作区选择 */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">🍊</span>
            </div>
            <span className="text-orange-400 font-bold text-lg select-none">Oran记</span>
          </div>
          
          <button
            onClick={handleSelectWorkspace}
            disabled={isLoading}
            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-white text-sm rounded-full transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                加载中...
              </>
            ) : (
              workspace ? (workspace.split('/').pop() || workspace) : '选择目录'
            )}
          </button>
          
          
        </div>

        {/* 右侧：功能按钮 */}
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setIsSearchOpen(true)}>
            <Search className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            data-settings-button
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setIsAboutOpen(true)}>
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 设置模态框 */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  )
}
