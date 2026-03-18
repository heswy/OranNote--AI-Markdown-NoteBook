import React, { useState, useRef } from 'react'
import { Settings, Search, HelpCircle, FolderOpen, ChevronDown, Sun, Moon } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'
import { SettingsModal } from '@/components/SettingsModal'
import { AboutModal } from '@/components/AboutModal'
import { SearchModal } from '@/components/SearchModal'

export const Header: React.FC = () => {
  const { config, setConfig, workspace, setWorkspace, setFileTree, setWorkspaceHandle, resetForNewWorkspace, setTheme } = useAppStore()
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

  const workspaceName = workspace ? (workspace.split('/').pop() || workspace) : null

  return (
    <>
      <header className="h-12 bg-bg-elevated border-b border-border flex items-center justify-between px-4 shrink-0 relative z-10">
        {/* 左侧：Logo和工作区选择 */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm">🍊</span>
            </div>
            <span className="text-text-primary font-semibold text-base tracking-tight">Oran记</span>
          </div>
          
          {/* 分隔线 */}
          <div className="w-px h-5 bg-border" />
          
          {/* 工作区选择按钮 */}
          <button
            onClick={handleSelectWorkspace}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-fast
              bg-bg-surface hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary
              border border-transparent hover:border-border
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
                <span>加载中...</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4 text-primary-500" />
                <span className="max-w-[200px] truncate">
                  {workspaceName || '选择工作区'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
              </>
            )}
          </button>
        </div>

        {/* 右侧：功能按钮 */}
        <div className="flex items-center gap-1">
          <HeaderButton 
            icon={<Search className="w-4 h-4" />} 
            onClick={() => setIsSearchOpen(true)}
            tooltip="搜索文件 (⌘P)"
          />
          {/* 主题切换按钮 */}
          <HeaderButton 
            icon={config.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            onClick={() => setTheme(config.theme === 'dark' ? 'light' : 'dark')}
            tooltip={config.theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
          />
          <HeaderButton 
            icon={<Settings className="w-4 h-4" />} 
            onClick={() => setIsSettingsOpen(true)}
            tooltip="设置"
            data-settings-button
          />
          <HeaderButton 
            icon={<HelpCircle className="w-4 h-4" />} 
            onClick={() => setIsAboutOpen(true)}
            tooltip="关于"
          />
        </div>
      </header>

      {/* 模态框 */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  )
}

// 头部按钮组件
interface HeaderButtonProps {
  icon: React.ReactNode
  onClick: () => void
  tooltip: string
  'data-settings-button'?: boolean
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ icon, onClick, tooltip, ...props }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setTooltipPos({
        top: rect.bottom + 8,
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
        className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-md transition-all duration-fast"
        {...props}
      >
        {icon}
      </button>
      
      {/* 工具提示 */}
      {showTooltip && (
        <div 
          className="fixed px-2 py-1 bg-bg-overlay text-text-primary text-xs rounded-md whitespace-nowrap
            border border-border shadow-lg z-[9999] -translate-x-1/2 pointer-events-none animate-in"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {tooltip}
        </div>
      )}
    </>
  )
}
