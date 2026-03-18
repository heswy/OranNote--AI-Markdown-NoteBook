import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { FileSystemService } from '@/services/fileSystem'
import { toast } from 'sonner'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
  preventDefault?: boolean
}

export const useKeyboardShortcuts = () => {
  const { 
    activeFile, 
    setEditorMode, 
    editorMode,
    fileContents,
    workspace,
    workspaceHandle,
    markSaved
  } = useAppStore()

  const saveCurrentFile = useCallback(async () => {
    if (!activeFile) {
      toast.error('没有打开的文件')
      return
    }
    
    const content = fileContents[activeFile]
    if (content === undefined) {
      toast.error('文件内容为空')
      return
    }
    
    try {
      await FileSystemService.writeFile(activeFile, content, workspaceHandle, workspace)
      markSaved(activeFile)
      toast.success('已保存')
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败')
    }
  }, [activeFile, fileContents, workspace, workspaceHandle, markSaved])

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const metaKey = isMac ? 'meta' : 'ctrl'

    const shortcuts: ShortcutConfig[] = [
      // 保存文件: Cmd/Ctrl + S
      {
        key: 's',
        [metaKey]: true,
        handler: saveCurrentFile,
        preventDefault: true,
      },
      // 切换编辑模式: Cmd/Ctrl + 1
      {
        key: '1',
        [metaKey]: true,
        handler: () => setEditorMode('edit'),
        preventDefault: true,
      },
      // 切换分屏模式: Cmd/Ctrl + 2
      {
        key: '2',
        [metaKey]: true,
        handler: () => setEditorMode('split'),
        preventDefault: true,
      },
      // 切换预览模式: Cmd/Ctrl + 3
      {
        key: '3',
        [metaKey]: true,
        handler: () => setEditorMode('preview'),
        preventDefault: true,
      },
      // 循环切换模式: Cmd/Ctrl + E
      {
        key: 'e',
        [metaKey]: true,
        handler: () => {
          const modes: ('edit' | 'preview' | 'split')[] = ['edit', 'split', 'preview']
          const currentIndex = modes.indexOf(editorMode)
          const nextIndex = (currentIndex + 1) % modes.length
          setEditorMode(modes[nextIndex])
        },
        preventDefault: true,
      },
    ]

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框中，不触发快捷键（除了保存）
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch) {
          // 对于非保存快捷键，如果在输入框中则跳过
          if (isInput && shortcut.key !== 's') continue
          
          if (shortcut.preventDefault) {
            e.preventDefault()
          }
          shortcut.handler()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveCurrentFile, setEditorMode, editorMode])
}

export default useKeyboardShortcuts
