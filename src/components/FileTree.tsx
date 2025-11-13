import React, { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, FolderPlus, FilePlus } from 'lucide-react'
import { FileNode } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'
import { useAppStore } from '@/stores/appStore'

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
  const fileIcon = FileSystemService.getFileIcon(node.name)

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded)
    } else {
      onFileClick(node.path)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    // 支持文件与文件夹拖拽到输入框进行引用
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (node.type === 'directory') {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const { config, setFileTree, workspaceHandle, activeFile, setActiveFile, addOpenFile, removeOpenFile } = useAppStore()
  const isActive = activeFile === node.path
  const handleDrop = async (e: React.DragEvent) => {
    if (node.type !== 'directory') return
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

  const openRenameDialog = () => {
    const dialog = document.createElement('div')
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: #1f2937; padding: 20px; border-radius: 8px; border: 1px solid #374151; min-width: 320px;">
          <h3 style="color: #e5e7eb; margin-bottom: 10px;">重命名</h3>
          <input type="text" id="rename-input" placeholder="请输入新名称" style="width: 100%; padding: 8px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #e5e7eb; margin-bottom: 15px;">
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="cancel-btn" style="padding: 6px 12px; background: #374151; color: #e5e7eb; border: 1px solid #4b5563; border-radius: 4px; cursor: pointer;">取消</button>
            <button id="confirm-btn" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(dialog)
    const input = dialog.querySelector('#rename-input') as HTMLInputElement
    const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement
    input.focus()
    const cleanup = () => { document.body.removeChild(dialog) }
    const doRename = async () => {
      const newName = input.value.trim()
      if (!newName || !config.workspace) { cleanup(); return }
      try {
        const newPath = await FileSystemService.renameItem(node.path, newName, node.type, workspaceHandle as any, config.workspace)
        if (activeFile && activeFile.startsWith(node.path)) {
          const replaced = activeFile.replace(node.path, newPath)
          setActiveFile(replaced)
          removeOpenFile(activeFile)
          addOpenFile(replaced)
        }
        const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
        setFileTree(files)
      } catch (e) {
        console.error('重命名失败:', e)
      }
      cleanup()
    }
    confirmBtn.addEventListener('click', doRename)
    cancelBtn.addEventListener('click', cleanup)
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doRename() })
    dialog.addEventListener('click', (e) => { if (e.target === dialog) { cleanup() } })
  }

  return (
    <div>
      <div
        className={`flex items-center px-2 py-1 hover:bg-gray-700 cursor-pointer rounded ${
          isActive ? 'bg-gray-700 text-orange-400' : 'text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={openRenameDialog}
        onContextMenu={handleContextMenu}
        draggable={node.type === 'file'}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {node.type === 'directory' ? (
          <>
            {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
            {isExpanded ? <FolderOpen className="w-4 h-4 mr-2 text-orange-500" /> : <Folder className="w-4 h-4 mr-2 text-orange-500" />}
          </>
        ) : (
          <svg className="w-4 h-4 mr-2 text-orange-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 15.75C18 17.4833 17.3917 18.9583 16.175 20.175C14.9583 21.3917 13.4833 22 11.75 22C10.0167 22 8.54167 21.3917 7.325 20.175C6.10833 18.9583 5.5 17.4833 5.5 15.75V6.5C5.5 5.25 5.9375 4.1875 6.8125 3.3125C7.6875 2.4375 8.75 2 10 2C11.25 2 12.3125 2.4375 13.1875 3.3125C14.0625 4.1875 14.5 5.25 14.5 6.5V15.25C14.5 16.0167 14.2333 16.6667 13.7 17.2C13.1667 17.7333 12.5167 18 11.75 18C10.9833 18 10.3333 17.7333 9.8 17.2C9.26667 16.6667 9 16.0167 9 15.25V6H11V15.25C11 15.4667 11.0708 15.6458 11.2125 15.7875C11.3542 15.9292 11.5333 16 11.75 16C11.9667 16 12.1458 15.9292 12.2875 15.7875C12.4292 15.6458 12.5 15.4667 12.5 15.25V6.5C12.4833 5.8 12.2375 5.20833 11.7625 4.725C11.2875 4.24167 10.7 4 10 4C9.3 4 8.70833 4.24167 8.225 4.725C7.74167 5.20833 7.5 5.8 7.5 6.5V15.75C7.48333 16.9333 7.89167 17.9375 8.725 18.7625C9.55833 19.5875 10.5667 20 11.75 20C12.9167 20 13.9083 19.5875 14.725 18.7625C15.5417 17.9375 15.9667 16.9333 16 15.75V6H18V15.75Z"/>
          </svg>
        )}
        <span className="text-sm truncate">{node.name}</span>
      </div>
      
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
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

interface FileTreeProps {
  fileTree: FileNode[]
  onFileClick: (path: string) => void
}

export const FileTree: React.FC<FileTreeProps> = ({ fileTree, onFileClick }) => {
  const { config, setFileTree, workspaceHandle, activeFile, setActiveFile, addOpenFile, removeOpenFile } = useAppStore()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    path: string
    type: 'file' | 'directory'
  } | null>(null)

  // Hook必须在组件顶部调用
  useEffect(() => {
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  const handleNewFile = async () => {
    // 创建简单的输入对话框替代prompt
    const dialog = document.createElement('div')
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: #1f2937; padding: 20px; border-radius: 8px; border: 1px solid #374151; min-width: 300px;">
          <h3 style="color: #e5e7eb; margin-bottom: 10px;">新建文件</h3>
          <input type="text" id="filename-input" placeholder="请输入文件名（包含扩展名）" style="width: 100%; padding: 8px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #e5e7eb; margin-bottom: 15px;">
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="cancel-btn" style="padding: 6px 12px; background: #374151; color: #e5e7eb; border: 1px solid #4b5563; border-radius: 4px; cursor: pointer;">取消</button>
            <button id="confirm-btn" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(dialog)
    const input = dialog.querySelector('#filename-input') as HTMLInputElement
    const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement
    
    input.focus()
    
    const cleanup = () => {
      document.body.removeChild(dialog)
    }
    
    const handleConfirm = async () => {
      const fileName = input.value.trim()
      if (fileName && config.workspace) {
        const filePath = `${config.workspace}/${fileName}`
        try {
          await FileSystemService.createFile(filePath, '', workspaceHandle as any, config.workspace)
          // 重新加载文件树
          const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
          setFileTree(files)
        } catch (error) {
          console.error('创建文件失败:', error)
        }
      }
      cleanup()
    }
    
    confirmBtn.addEventListener('click', handleConfirm)
    cancelBtn.addEventListener('click', cleanup)
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleConfirm()
      }
    })
    
    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        cleanup()
      }
    })
    
    setContextMenu(null)
  }

  const handleNewFolder = async () => {
    // 创建简单的输入对话框替代prompt
    const dialog = document.createElement('div')
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: #1f2937; padding: 20px; border-radius: 8px; border: 1px solid #374151; min-width: 300px;">
          <h3 style="color: #e5e7eb; margin-bottom: 10px;">新建文件夹</h3>
          <input type="text" id="foldername-input" placeholder="请输入文件夹名称" style="width: 100%; padding: 8px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #e5e7eb; margin-bottom: 15px;">
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="cancel-btn" style="padding: 6px 12px; background: #374151; color: #e5e7eb; border: 1px solid #4b5563; border-radius: 4px; cursor: pointer;">取消</button>
            <button id="confirm-btn" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(dialog)
    const input = dialog.querySelector('#foldername-input') as HTMLInputElement
    const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement
    
    input.focus()
    
    const cleanup = () => {
      document.body.removeChild(dialog)
    }
    
    const handleConfirm = async () => {
      const folderName = input.value.trim()
      if (folderName && config.workspace) {
        const folderPath = `${config.workspace}/${folderName}`
        try {
          await FileSystemService.createFolder(folderPath, workspaceHandle as any, config.workspace)
          // 重新加载文件树
          const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
          setFileTree(files)
        } catch (error) {
          console.error('创建文件夹失败:', error)
        }
      }
      cleanup()
    }
    
    confirmBtn.addEventListener('click', handleConfirm)
    cancelBtn.addEventListener('click', cleanup)
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleConfirm()
      }
    })
    
    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        cleanup()
      }
    })
    
    setContextMenu(null)
  }

  const handleDelete = async () => {
    if (contextMenu) {
      // 创建确认对话框替代confirm
      const dialog = document.createElement('div')
      dialog.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
          <div style="background: #1f2937; padding: 20px; border-radius: 8px; border: 1px solid #374151; min-width: 300px;">
            <h3 style="color: #e5e7eb; margin-bottom: 10px;">确认删除</h3>
            <p style="color: #d1d5db; margin-bottom: 15px;">确定要删除 ${contextMenu.path.split('/').pop()} 吗？</p>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button id="cancel-btn" style="padding: 6px 12px; background: #374151; color: #e5e7eb; border: 1px solid #4b5563; border-radius: 4px; cursor: pointer;">取消</button>
              <button id="confirm-btn" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">删除</button>
            </div>
          </div>
        </div>
      `
      
      document.body.appendChild(dialog)
      const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement
      const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement
      
      const cleanup = () => {
        document.body.removeChild(dialog)
      }
      
      const handleConfirm = async () => {
        try {
          if (contextMenu.type === 'file') {
            await FileSystemService.deleteFile(contextMenu.path, workspaceHandle as any, config.workspace)
          } else {
            await FileSystemService.deleteFolder(contextMenu.path, workspaceHandle as any, config.workspace)
          }
          // 重新加载文件树
          if (config.workspace) {
            const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
            setFileTree(files)
          }
        } catch (error) {
          console.error('删除失败:', error)
        }
        cleanup()
      }
      
      confirmBtn.addEventListener('click', handleConfirm)
      cancelBtn.addEventListener('click', cleanup)
      
      // 点击背景关闭
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          cleanup()
        }
      })
    }
    setContextMenu(null)
  }

  const handleContextMenu = (event: React.MouseEvent, path: string, type: 'file' | 'directory') => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      path,
      type
    })
  }

  const handleClickOutside = () => {
    setContextMenu(null)
  }

  return (
    <div className="h-full flex flex-col"
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={async (e) => {
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
      }}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300">文件树</h3>
        <div className="flex space-x-1">
          <button
            onClick={handleNewFile}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="新建文件"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleNewFolder}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="新建文件夹"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto p-2">
        {fileTree.length === 0 ? (
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <Folder className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-400">请选择工作区目录</p>
              <p className="text-xs mt-1 text-gray-500">点击上方"选择目录"按钮开始</p>
            </div>
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

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={async () => {
              const dialog = document.createElement('div')
              dialog.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                  <div style="background: #1f2937; padding: 20px; border-radius: 8px; border: 1px solid #374151; min-width: 320px;">
                    <h3 style="color: #e5e7eb; margin-bottom: 10px;">重命名</h3>
                    <input type="text" id="rename-input" placeholder="请输入新名称" style="width: 100%; padding: 8px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #e5e7eb; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                      <button id="cancel-btn" style="padding: 6px 12px; background: #374151; color: #e5e7eb; border: 1px solid #4b5563; border-radius: 4px; cursor: pointer;">取消</button>
                      <button id="confirm-btn" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
                    </div>
                  </div>
                </div>
              `
              document.body.appendChild(dialog)
              const input = dialog.querySelector('#rename-input') as HTMLInputElement
              const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement
              const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement
              input.focus()
              const cleanup = () => { document.body.removeChild(dialog) }
              const doRename = async () => {
                const newName = input.value.trim()
                if (!newName || !config.workspace) { cleanup(); return }
                try {
                  const newPath = await FileSystemService.renameItem(contextMenu.path, newName, contextMenu.type, workspaceHandle as any, config.workspace)
                  if (activeFile && activeFile.startsWith(contextMenu.path)) {
                    const replaced = activeFile.replace(contextMenu.path, newPath)
                    setActiveFile(replaced)
                    removeOpenFile(activeFile)
                    addOpenFile(replaced)
                  }
                  const files = await FileSystemService.getWorkspaceFiles(config.workspace, workspaceHandle as any)
                  setFileTree(files)
                } catch (e) {
                  console.error('重命名失败:', e)
                }
                cleanup()
              }
              confirmBtn.addEventListener('click', doRename)
              cancelBtn.addEventListener('click', cleanup)
              input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doRename() })
              dialog.addEventListener('click', (e) => { if (e.target === dialog) { cleanup() } })
              setContextMenu(null)
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
          >
            重命名
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}
