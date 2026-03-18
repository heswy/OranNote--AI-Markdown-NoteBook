import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  FileJson, 
  FileImage, 
  FileType, 
  Plus, 
  MoreHorizontal,
  Trash2,
  Edit3,
  FilePlus,
  FolderPlus
} from 'lucide-react'
import { FileNode } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'
import { useAppStore } from '@/stores/appStore'

// 文件图标映射
const FileIcon: React.FC<{ name: string; isOpen?: boolean }> = ({ name, isOpen }) => {
  const ext = name.split('.').pop()?.toLowerCase()
  
  // 文件夹
  if (!ext || name.endsWith('/')) {
    return isOpen 
      ? <FolderOpen className="w-4 h-4 text-file-folder shrink-0" />
      : <Folder className="w-4 h-4 text-file-folder shrink-0" />
  }
  
  // 根据扩展名返回对应图标
  switch (ext) {
    case 'md':
    case 'markdown':
      return <FileText className="w-4 h-4 text-file-md shrink-0" />
    case 'pdf':
      return <FileType className="w-4 h-4 text-file-pdf shrink-0" />
    case 'json':
      return <FileJson className="w-4 h-4 text-file-json shrink-0" />
    case 'txt':
      return <FileText className="w-4 h-4 text-file-txt shrink-0" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return <FileImage className="w-4 h-4 text-primary-400 shrink-0" />
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'vue':
      return <FileCode className="w-4 h-4 text-warning shrink-0" />
    default:
      return <FileText className="w-4 h-4 text-text-tertiary shrink-0" />
  }
}

// 树节点组件
interface FileTreeNodeProps {
  node: FileNode
  level: number
  onFileClick: (path: string) => void
  onContextMenu: (event: React.MouseEvent, path: string, type: 'file' | 'directory') => void
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  node, 
  level, 
  onFileClick, 
  onContextMenu 
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 0)
  const { activeFile, setActiveFile, addOpenFile, removeOpenFile, workspaceHandle, config, setFileTree, workspace } = useAppStore()
  
  const isActive = activeFile === node.path
  const isDirectory = node.type === 'directory'

  const handleClick = () => {
    if (isDirectory) {
      setIsExpanded(!isExpanded)
    } else {
      onFileClick(node.path)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (isDirectory) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    if (!isDirectory) return
    e.preventDefault()
    const srcPath = e.dataTransfer.getData('text/plain')
    if (!srcPath || !config.workspace) return
    
    const baseName = srcPath.split('/').pop() as string
    const destPath = `${node.path}/${baseName}`
    
    try {
      await FileSystemService.moveItem(srcPath, destPath, workspaceHandle as any, config.workspace)
      if (activeFile === srcPath) {
        setActiveFile(destPath)
        removeOpenFile(srcPath)
        addOpenFile(destPath)
      }
      const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
      setFileTree(files)
    } catch (err) {
      console.error('移动文件失败:', err)
    }
  }

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    onContextMenu(event, node.path, node.type)
  }

  // 重命名对话框
  const openRenameDialog = useCallback(() => {
    const name = node.name
    const newName = window.prompt('重命名', name)
    if (!newName || newName === name || !config.workspace) return
    
    FileSystemService.renameItem(node.path, newName, node.type, workspaceHandle as any, config.workspace)
      .then((newPath) => {
        if (activeFile && activeFile.startsWith(node.path)) {
          const replaced = activeFile.replace(node.path, newPath)
          setActiveFile(replaced)
          removeOpenFile(activeFile)
          addOpenFile(replaced)
        }
        return FileSystemService.getWorkspaceFiles(config.workspace!, workspaceHandle as any)
      })
      .then(files => setFileTree(files))
      .catch(e => console.error('重命名失败:', e))
  }, [node, config.workspace, workspaceHandle, activeFile, setActiveFile, removeOpenFile, addOpenFile, setFileTree])

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-md cursor-pointer
          transition-all duration-fast select-none
          ${isActive 
            ? 'bg-primary-500/10 text-primary-400' 
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface/50'
          }
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={openRenameDialog}
        onContextMenu={handleContextMenu}
        draggable={!isDirectory}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 展开/折叠图标 */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {isDirectory ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="p-0.5 rounded hover:bg-bg-surface transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
              )}
            </button>
          ) : (
            <span className="w-3.5" />
          )}
        </div>
        
        {/* 文件/文件夹图标 */}
        <FileIcon name={node.name} isOpen={isExpanded} />
        
        {/* 文件名 */}
        <span className={`
          text-sm truncate flex-1 min-w-0
          ${isActive ? 'font-medium' : ''}
        `}>
          {node.name}
        </span>
        
        {/* 悬停时的操作按钮 */}
        <div className={`
          flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity
          ${isActive ? 'opacity-100' : ''}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              openRenameDialog()
            }}
            className="p-1 rounded hover:bg-bg-surface text-text-tertiary hover:text-text-primary"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* 子节点 */}
      {isDirectory && isExpanded && node.children && (
        <div className="animate-slide-in">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 新建文件/文件夹对话框
const CreateDialog: React.FC<{
  type: 'file' | 'folder'
  isOpen: boolean
  onClose: () => void
  onConfirm: (name: string) => void
}> = ({ type, isOpen, onClose, onConfirm }) => {
  const [name, setName] = useState('')
  
  if (!isOpen) return null
  
  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim())
      setName('')
    }
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal animate-in">
      <div className="bg-bg-elevated border border-border rounded-lg shadow-lg p-4 w-80">
        <h3 className="text-text-primary font-medium mb-3">
          新建{type === 'file' ? '文件' : '文件夹'}
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`请输入${type === 'file' ? '文件' : '文件夹'}名称`}
          className="w-full px-3 py-2 bg-bg-surface border border-border rounded-md text-text-primary 
            placeholder:text-text-tertiary focus:outline-none focus:border-primary-500 mb-4"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm()
            if (e.key === 'Escape') onClose()
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary 
              bg-bg-surface hover:bg-bg-surface-hover rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-sm text-white bg-primary-600 hover:bg-primary-500 
              rounded-md transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

// 删除确认对话框
const DeleteDialog: React.FC<{
  itemName: string
  itemType: 'file' | 'directory'
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}> = ({ itemName, itemType, isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal animate-in">
      <div className="bg-bg-elevated border border-border rounded-lg shadow-lg p-4 w-80">
        <h3 className="text-text-primary font-medium mb-2">确认删除</h3>
        <p className="text-text-secondary text-sm mb-4">
          确定要删除 {itemType === 'directory' ? '文件夹' : '文件'} <span className="text-text-primary">{itemName}</span> 吗？
          {itemType === 'directory' && ' 文件夹内的所有内容都将被删除。'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary 
              bg-bg-surface hover:bg-bg-surface-hover rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm text-white bg-error hover:bg-red-600 
              rounded-md transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// 主组件
interface FileTreeProps {
  fileTree: FileNode[]
  onFileClick: (path: string) => void
}

export const FileTree: React.FC<FileTreeProps> = ({ fileTree, onFileClick }) => {
  const { config, setFileTree, workspaceHandle, activeFile, setActiveFile, addOpenFile, removeOpenFile, workspace } = useAppStore()
  
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    path: string
    type: 'file' | 'directory'
    name: string
  } | null>(null)
  
  const [createDialog, setCreateDialog] = useState<{ isOpen: boolean; type: 'file' | 'folder' }>({ isOpen: false, type: 'file' })
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; path: string; type: 'file' | 'directory'; name: string }>({ 
    isOpen: false, path: '', type: 'file', name: '' 
  })

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => setContextMenu(null)
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  const handleNewFile = () => {
    setCreateDialog({ isOpen: true, type: 'file' })
    setContextMenu(null)
  }

  const handleNewFolder = () => {
    setCreateDialog({ isOpen: true, type: 'folder' })
    setContextMenu(null)
  }

  const handleCreateConfirm = async (name: string) => {
    if (!config.workspace) return
    
    const path = `${config.workspace}/${name}`
    try {
      if (createDialog.type === 'file') {
        await FileSystemService.createFile(path, '', workspaceHandle as any, config.workspace)
      } else {
        await FileSystemService.createFolder(path, workspaceHandle as any, config.workspace)
      }
      const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
      setFileTree(files)
    } catch (error) {
      console.error(`创建${createDialog.type === 'file' ? '文件' : '文件夹'}失败:`, error)
    }
  }

  const handleDelete = () => {
    if (!contextMenu) return
    setDeleteDialog({
      isOpen: true,
      path: contextMenu.path,
      type: contextMenu.type,
      name: contextMenu.name
    })
    setContextMenu(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.path || !config.workspace) return
    
    try {
      if (deleteDialog.type === 'file') {
        await FileSystemService.deleteFile(deleteDialog.path, workspaceHandle as any, config.workspace)
      } else {
        await FileSystemService.deleteFolder(deleteDialog.path, workspaceHandle as any, config.workspace)
      }
      
      if (activeFile === deleteDialog.path || activeFile?.startsWith(deleteDialog.path + '/')) {
        setActiveFile(null)
      }
      removeOpenFile(deleteDialog.path)
      
      const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
      setFileTree(files)
    } catch (error) {
      console.error('删除失败:', error)
    }
    
    setDeleteDialog({ isOpen: false, path: '', type: 'file', name: '' })
  }

  const handleContextMenu = (event: React.MouseEvent, path: string, type: 'file' | 'directory') => {
    event.preventDefault()
    const name = path.split('/').pop() || ''
    setContextMenu({ x: event.clientX, y: event.clientY, path, type, name })
  }

  const handleDropToRoot = async (e: React.DragEvent) => {
    e.preventDefault()
    const srcPath = e.dataTransfer.getData('text/plain')
    if (!srcPath || !config.workspace) return
    
    const baseName = srcPath.split('/').pop() as string
    const destPath = `${config.workspace}/${baseName}`
    
    try {
      await FileSystemService.moveItem(srcPath, destPath, workspaceHandle as any, config.workspace)
      if (activeFile === srcPath) {
        setActiveFile(destPath)
        removeOpenFile(srcPath)
        addOpenFile(destPath)
      }
      const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
      setFileTree(files)
    } catch (err) {
      console.error('移动到根目录失败:', err)
    }
  }

  return (
    <>
      <div 
        className="h-full flex flex-col bg-bg-elevated"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropToRoot}
      >
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-bg-elevated" style={{ position: 'relative', zIndex: 100 }}>
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">文件</h3>
          <div className="flex items-center gap-0.5">
            <ToolbarButton icon={<FilePlus className="w-3.5 h-3.5" />} onClick={handleNewFile} tooltip="新建文件" />
            <ToolbarButton icon={<FolderPlus className="w-3.5 h-3.5" />} onClick={handleNewFolder} tooltip="新建文件夹" />
          </div>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
          {fileTree.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-tertiary px-6">
              <div className="w-12 h-12 rounded-xl bg-bg-surface flex items-center justify-center mb-3">
                <Folder className="w-6 h-6 opacity-50" />
              </div>
              <p className="text-sm text-center">请选择工作区目录</p>
              <p className="text-xs text-text-disabled mt-1 text-center">点击上方"选择工作区"按钮开始</p>
            </div>
          ) : (
            fileTree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                level={0}
                onFileClick={onFileClick}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-bg-elevated border border-border rounded-lg shadow-lg py-1 z-popover animate-in min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <ContextMenuItem icon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => {
            const node = findNode(fileTree, contextMenu.path)
            if (node) {
              const newName = window.prompt('重命名', node.name)
              if (newName && newName !== node.name && config.workspace) {
                FileSystemService.renameItem(contextMenu.path, newName, contextMenu.type, workspaceHandle as any, config.workspace)
                  .then((newPath) => {
                    if (activeFile && activeFile.startsWith(contextMenu.path)) {
                      const replaced = activeFile.replace(contextMenu.path, newPath)
                      setActiveFile(replaced)
                      removeOpenFile(activeFile)
                      addOpenFile(replaced)
                    }
                    return FileSystemService.getWorkspaceFiles(config.workspace!, workspaceHandle as any)
                  })
                  .then(files => setFileTree(files))
                  .catch(e => console.error('重命名失败:', e))
              }
            }
            setContextMenu(null)
          }}>
            重命名
          </ContextMenuItem>
          <div className="h-px bg-border my-1" />
          <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5" />} danger onClick={handleDelete}>
            删除
          </ContextMenuItem>
        </div>
      )}

      {/* 对话框 */}
      <CreateDialog 
        type={createDialog.type}
        isOpen={createDialog.isOpen}
        onClose={() => setCreateDialog({ isOpen: false, type: 'file' })}
        onConfirm={handleCreateConfirm}
      />
      
      <DeleteDialog
        itemName={deleteDialog.name}
        itemType={deleteDialog.type}
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, path: '', type: 'file', name: '' })}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}

// 工具栏按钮
const ToolbarButton: React.FC<{ icon: React.ReactNode; onClick: () => void; tooltip: string }> = ({ icon, onClick, tooltip }) => {
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
        className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded-md transition-all duration-fast"
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

// 右键菜单项
const ContextMenuItem: React.FC<{ 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  onClick: () => void;
  danger?: boolean 
}> = ({ icon, children, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`
      w-full px-3 py-1.5 flex items-center gap-2 text-sm
      transition-colors duration-fast
      ${danger 
        ? 'text-error hover:bg-error/10' 
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
      }
    `}
  >
    {icon}
    {children}
  </button>
)

// 查找节点
const findNode = (nodes: FileNode[], path: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return null
}
