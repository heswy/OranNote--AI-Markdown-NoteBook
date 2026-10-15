import { FileNode } from '@/stores/appStore'

// 文件系统API服务
export class FileSystemService {
  // 选择工作区目录
  static async selectWorkspace(): Promise<{ path: string; dirHandle?: FileSystemDirectoryHandle }> {
    try {
      // 尝试使用浏览器的 File System Access API
      if ('showDirectoryPicker' in window) {
        // @ts-ignore - showDirectoryPicker 是实验性 API
        const dirHandle = await window.showDirectoryPicker()
        const workspacePath = dirHandle.name
        return { path: workspacePath, dirHandle }
      } else {
        // 降级方案：使用文件输入来选择文件夹
        return new Promise((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.webkitdirectory = true
          input.style.display = 'none'
          
          input.addEventListener('change', (event) => {
            const files = (event.target as HTMLInputElement).files
            if (files && files.length > 0) {
              // 获取第一个文件的目录路径
              const firstFile = files[0]
              const path = firstFile.webkitRelativePath || firstFile.name
              const folderName = path.split('/')[0] || 'workspace'
              resolve({ path: folderName })
            } else {
              resolve({ path: 'workspace' })
            }
            document.body.removeChild(input)
          })
          
          document.body.appendChild(input)
          input.click()
        })
      }
    } catch (error) {
      // 如果用户取消选择，使用默认路径
      return { path: 'workspace' }
    }
  }

  // 获取工作区文件树
  static async getWorkspaceFiles(workspacePath: string, dirHandle?: FileSystemDirectoryHandle): Promise<FileNode[]> {
    try {
      // 如果有目录句柄，直接使用它
      if (dirHandle) {
        return await this.readDirectory(dirHandle, workspacePath)
      }
      
      // 尝试使用 File System Access API 读取真实目录
      if ('showDirectoryPicker' in window) {
        // @ts-ignore - showDirectoryPicker 是实验性 API
        const handle = await window.showDirectoryPicker()
        return await this.readDirectory(handle, workspacePath)
      } else {
        // 降级方案：使用文件输入来读取目录结构
        return await this.readFilesFromInput(workspacePath)
      }
    } catch (error) {
      console.error('读取工作区文件失败:', error)
      // 如果读取失败，返回空数组而不是示例数据
      return []
    }
  }

  // 使用 File System Access API 读取目录
  private static async readDirectory(dirHandle: any, basePath: string): Promise<FileNode[]> {
    const nodes: FileNode[] = []
    
    try {
      // @ts-ignore - 使用 values() 方法
      const values = dirHandle.values ? dirHandle.values() : []
      
      for await (const entry of values) {
        if (entry.name.startsWith('.')) continue
        const fullPath = `${basePath}/${entry.name}`
        
        if (entry.kind === 'file') {
          // 只处理支持的文件类型
          if (this.isSupportedFile(entry.name)) {
            nodes.push({
              name: entry.name, // 不再添加图标，让UI组件处理图标显示
              path: fullPath,
              type: 'file',
              ext: this.getFileExtension(entry.name)
            })
          }
        } else if (entry.kind === 'directory') {
          // 递归读取子目录
          const subDirHandle = await dirHandle.getDirectoryHandle(entry.name)
          const children = await this.readDirectory(subDirHandle, fullPath)
          
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children: children
          })
        }
      }
    } catch (error) {
      console.error('读取目录失败:', error)
    }
    
    return nodes.sort((a, b) => {
      // 目录优先，然后按名称排序
      if (a.type === 'directory' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })
  }

  // 从文件输入读取文件列表
  private static async readFilesFromInput(workspacePath: string): Promise<FileNode[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.webkitdirectory = true
      input.multiple = true
      input.style.display = 'none'
      
      input.addEventListener('change', (event) => {
        const files = (event.target as HTMLInputElement).files
        const nodes: FileNode[] = []
        
        if (files && files.length > 0) {
          const fileMap = new Map<string, FileNode>()
          
          // 处理所有文件
          Array.from(files).forEach(file => {
            const relativePath = file.webkitRelativePath || file.name
            const pathParts = relativePath.split('/')
            if (pathParts.some(p => p.startsWith('.'))) return
            
            // 只处理支持的文件类型
            if (this.isSupportedFile(file.name)) {
              const fileName = pathParts[pathParts.length - 1]
              const dirPath = pathParts.slice(0, -1).join('/')
              
              const fileNode: FileNode = {
                name: fileName, // 不再添加图标，让UI组件处理图标显示
                path: `${workspacePath}/${relativePath}`,
                type: 'file',
                ext: this.getFileExtension(fileName)
              }
              
              if (pathParts.length === 1) {
                // 根目录文件
                nodes.push(fileNode)
              } else {
                // 子目录文件，需要找到或创建父目录
                const parentPath = pathParts.slice(0, -1).join('/')
                let parent = fileMap.get(parentPath)
                
                if (!parent) {
                  parent = {
                    name: pathParts[pathParts.length - 2],
                    path: `${workspacePath}/${parentPath}`,
                    type: 'directory',
                    children: []
                  }
                  fileMap.set(parentPath, parent)
                }
                
                if (parent.children) {
                  parent.children.push(fileNode)
                }
              }
            }
          })
          
          // 添加所有目录到结果中
          fileMap.forEach(dir => nodes.push(dir))
        }
        
        // 排序：目录优先，然后按名称排序
        const sortedNodes = nodes.sort((a, b) => {
          if (a.type === 'directory' && b.type === 'file') return -1
          if (a.type === 'file' && b.type === 'directory') return 1
          return a.name.localeCompare(b.name)
        })
        
        document.body.removeChild(input)
        resolve(sortedNodes)
      })
      
      document.body.appendChild(input)
      input.click()
    })
  }

  // 获取文件扩展名
  private static getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot >= 0 ? fileName.substring(lastDot) : ''
  }

  // 读取文件内容
  static async readFile(filePath: string, workspacePath?: string, dirHandle?: any): Promise<string> {
    try {
      // 检查是否是PDF文件，PDF文件需要特殊处理
      if (filePath.toLowerCase().endsWith('.pdf')) {
        return '# PDF文件\n\nPDF文件预览功能正在开发中，请使用系统PDF阅读器打开。'
      }
      
      // 如果有工作区句柄，直接按路径读取文件
      if (workspacePath && dirHandle) {
        const relative = filePath.startsWith(workspacePath)
          ? filePath.slice(workspacePath.length + 1)
          : filePath
        const parts = relative.split('/').filter(Boolean)
        let current = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          current = await current.getDirectoryHandle(parts[i], { create: false })
        }
        const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: false })
        const file = await fileHandle.getFile()
        const content = await file.text()
        return content
      }
      
      // 无句柄时不弹窗，返回提示
      return `# 无法读取文件\n\n缺少工作区访问权限，无法直接读取 ${filePath}。\n请使用支持 File System Access API 的浏览器并通过“选择目录”授权。`
    } catch (error) {
      console.error('读取文件失败:', error)
      return `# 文件读取失败\n\n无法读取文件内容，请重试。\n\n错误: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }

  // 写入文件内容
  static async writeFile(filePath: string, content: string | Blob | Uint8Array, dirHandle?: any, workspacePath?: string): Promise<void> {
    try {
      // 如果有工作区句柄，直接按路径保存文件，不弹出对话框
      if (workspacePath && dirHandle) {
        const relative = filePath.startsWith(workspacePath)
          ? filePath.slice(workspacePath.length + 1)
          : filePath
        const parts = relative.split('/').filter(Boolean)
        let current = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          current = await current.getDirectoryHandle(parts[i], { create: true })
        }
        const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(content as any)
        await writable.close()
      } else {
        // 无句柄时不进行任何保存以避免弹窗
        console.warn('缺少工作区句柄，跳过文件保存:', filePath)
      }
    } catch (error) {
      console.error('保存文件失败:', error)
      throw new Error('文件保存失败，请重试')
    }
  }

  // 创建文件
  static async createFile(filePath: string, content: string = '', dirHandle?: any, workspacePath?: string): Promise<void> {
    try {
      if (workspacePath && dirHandle) {
        const relative = filePath.startsWith(workspacePath)
          ? filePath.slice(workspacePath.length + 1)
          : filePath
        const parts = relative.split('/').filter(Boolean)
        let current = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          current = await current.getDirectoryHandle(parts[i], { create: true })
        }
        const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()
      } else {
        console.warn('缺少工作区句柄，跳过文件创建:', filePath)
      }
    } catch (error) {
      console.error('创建文件失败:', error)
      throw new Error('文件创建失败，请重试')
    }
  }

  // 删除文件
  static async deleteFile(filePath: string, dirHandle?: any, workspacePath?: string): Promise<void> {
    // 在浏览器环境中，我们无法真正删除文件，只能记录操作
    try {
      if (workspacePath && dirHandle && dirHandle.removeEntry) {
        const relative = filePath.startsWith(workspacePath)
          ? filePath.slice(workspacePath.length + 1)
          : filePath
        const parts = relative.split('/').filter(Boolean)
        let current = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          current = await current.getDirectoryHandle(parts[i], { create: false })
        }
        await current.removeEntry(parts[parts.length - 1])
      }
    } catch (error) {
      console.error('删除文件失败:', error)
      throw error
    }
  }

  // 创建文件夹
  static async createFolder(folderPath: string, dirHandle?: any, workspacePath?: string): Promise<void> {
    try {
      if (workspacePath && dirHandle) {
        const relative = folderPath.startsWith(workspacePath)
          ? folderPath.slice(workspacePath.length + 1)
          : folderPath
        const parts = relative.split('/').filter(Boolean)
        let current = dirHandle
        for (let i = 0; i < parts.length; i++) {
          current = await current.getDirectoryHandle(parts[i], { create: true })
        }
      }
    } catch (error) {
      console.error('创建文件夹失败:', error)
      throw error
    }
  }

  // 确保隐藏数据目录存在 .oran/ai-sessions
  static async ensureDataFolders(workspacePath: string, dirHandle: any): Promise<void> {
    const root = dirHandle
    const dot = await root.getDirectoryHandle('.oran', { create: true })
    await dot.getDirectoryHandle('ai-sessions', { create: true })
  }

  // 列出历史会话文件
  static async listSessions(workspacePath: string, dirHandle: any): Promise<Array<{ id: string, title: string, updatedAt: number }>> {
    try {
      await this.ensureDataFolders(workspacePath, dirHandle)
      const dot = await dirHandle.getDirectoryHandle('.oran', { create: true })
      const sess = await dot.getDirectoryHandle('ai-sessions', { create: true })
      // @ts-ignore
      const entries = sess.values ? sess.values() : []
      const out: Array<{ id: string, title: string, updatedAt: number }> = []
      for await (const entry of entries) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          const fh = await sess.getFileHandle(entry.name)
          const file = await fh.getFile()
          const text = await file.text()
          try {
            const json = JSON.parse(text)
            out.push({ id: entry.name.replace(/\.json$/, ''), title: json.title || entry.name, updatedAt: json.updatedAt || file.lastModified })
          } catch {
            out.push({ id: entry.name.replace(/\.json$/, ''), title: entry.name, updatedAt: file.lastModified })
          }
        }
      }
      return out.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (e) {
      console.error('列出会话失败:', e)
      return []
    }
  }

  // 读取会话
  static async readSession(sessionId: string, workspacePath: string, dirHandle: any): Promise<any | null> {
    try {
      await this.ensureDataFolders(workspacePath, dirHandle)
      const dot = await dirHandle.getDirectoryHandle('.oran', { create: true })
      const sess = await dot.getDirectoryHandle('ai-sessions', { create: true })
      const fh = await sess.getFileHandle(`${sessionId}.json`, { create: false })
      const file = await fh.getFile()
      const text = await file.text()
      return JSON.parse(text)
    } catch (e) {
      console.error('读取会话失败:', e)
      return null
    }
  }

  // 保存会话
  static async writeSession(sessionId: string, data: any, workspacePath: string, dirHandle: any): Promise<void> {
    try {
      await this.ensureDataFolders(workspacePath, dirHandle)
      const dot = await dirHandle.getDirectoryHandle('.oran', { create: true })
      const sess = await dot.getDirectoryHandle('ai-sessions', { create: true })
      const fh = await sess.getFileHandle(`${sessionId}.json`, { create: true })
      const writable = await fh.createWritable()
      await writable.write(JSON.stringify({ ...data, updatedAt: Date.now() }, null, 2))
      await writable.close()
    } catch (e) {
      console.error('保存会话失败:', e)
    }
  }

  // 删除文件夹
  static async deleteFolder(folderPath: string, dirHandle?: any, workspacePath?: string): Promise<void> {
    try {
      if (workspacePath && dirHandle && dirHandle.removeEntry) {
        const relative = folderPath.startsWith(workspacePath)
          ? folderPath.slice(workspacePath.length + 1)
          : folderPath
        await dirHandle.removeEntry(relative, { recursive: true })
      }
    } catch (error) {
      console.error('删除文件夹失败:', error)
      throw error
    }
  }

  // 移动文件/文件夹
  static async moveItem(srcPath: string, destPath: string, dirHandle?: any, workspacePath?: string): Promise<void> {
    try {
      if (!(workspacePath && dirHandle)) {
        console.warn('缺少工作区句柄，跳过移动:', srcPath)
        return
      }
      const srcRel = srcPath.startsWith(workspacePath) ? srcPath.slice(workspacePath.length + 1) : srcPath
      const destRel = destPath.startsWith(workspacePath) ? destPath.slice(workspacePath.length + 1) : destPath
      const srcParts = srcRel.split('/').filter(Boolean)
      const destParts = destRel.split('/').filter(Boolean)
      let srcDir = dirHandle
      for (let i = 0; i < srcParts.length - 1; i++) {
        try {
          srcDir = await srcDir.getDirectoryHandle(srcParts[i], { create: false })
        } catch (e) {
          console.warn('源目录不存在，可能已移动，跳过:', srcParts[i])
          return
        }
      }
      let destDir = dirHandle
      for (let i = 0; i < destParts.length - 1; i++) {
        destDir = await destDir.getDirectoryHandle(destParts[i], { create: true })
      }
      let srcFileHandle
      try {
        srcFileHandle = await srcDir.getFileHandle(srcParts[srcParts.length - 1], { create: false })
      } catch (e) {
        console.warn('源文件不存在，可能已移动，跳过:', srcPath)
        return
      }
      const file = await srcFileHandle.getFile()
      const content = await file.text()
      const destFileHandle = await destDir.getFileHandle(destParts[destParts.length - 1], { create: true })
      const writable = await destFileHandle.createWritable()
      await writable.write(content)
      await writable.close()
      if (srcDir.removeEntry) {
        try {
          await srcDir.removeEntry(srcParts[srcParts.length - 1])
        } catch (e) {
          console.warn('删除源文件失败（可能已删除）:', srcPath)
        }
      }
    } catch (error) {
      console.error('移动文件失败:', error)
      throw error
    }
  }

  static async renameItem(srcPath: string, newName: string, type: 'file' | 'directory', dirHandle?: any, workspacePath?: string): Promise<string> {
    if (!(workspacePath && dirHandle)) return srcPath
    const rel = srcPath.startsWith(workspacePath) ? srcPath.slice(workspacePath.length + 1) : srcPath
    const parts = rel.split('/').filter(Boolean)
    const parentParts = parts.slice(0, -1)
    let parent = dirHandle
    for (let i = 0; i < parentParts.length; i++) {
      parent = await parent.getDirectoryHandle(parentParts[i], { create: false })
    }
    const newRel = [...parentParts, newName].join('/')
    const newFull = `${workspacePath}/${newRel}`
    if (type === 'file') {
      try {
        const fileHandle = await parent.getFileHandle(parts[parts.length - 1], { create: false })
        const file = await fileHandle.getFile()
        const content = await file.text()
        const dest = await parent.getFileHandle(newName, { create: true })
        const writable = await dest.createWritable()
        await writable.write(content)
        await writable.close()
        if (parent.removeEntry) await parent.removeEntry(parts[parts.length - 1])
      } catch (e) {
        throw e
      }
    } else {
      const copyDir = async (srcDir: any, destDir: any) => {
        // @ts-ignore
        const entries = srcDir.values ? srcDir.values() : []
        for await (const entry of entries) {
          if (entry.kind === 'file') {
            const f = await srcDir.getFileHandle(entry.name, { create: false })
            const file = await f.getFile()
            const text = await file.text()
            const df = await destDir.getFileHandle(entry.name, { create: true })
            const w = await df.createWritable()
            await w.write(text)
            await w.close()
          } else if (entry.kind === 'directory') {
            const sd = await srcDir.getDirectoryHandle(entry.name)
            const dd = await destDir.getDirectoryHandle(entry.name, { create: true })
            await copyDir(sd, dd)
          }
        }
      }
      try {
        const srcDir = await parent.getDirectoryHandle(parts[parts.length - 1], { create: false })
        const destDir = await parent.getDirectoryHandle(newName, { create: true })
        await copyDir(srcDir, destDir)
        if (parent.removeEntry) await parent.removeEntry(parts[parts.length - 1], { recursive: true })
      } catch (e) {
        throw e
      }
    }
    return newFull
  }

  // 检查文件类型是否支持
  static isSupportedFile(fileName: string): boolean {
    const supportedExts = ['.md', '.pdf', '.txt', '.json']
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return supportedExts.includes(ext)
  }

  // 获取文件图标
  static getFileIcon(fileName: string): string {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    switch (ext) {
      case '.md':
        return '📝'
      case '.pdf':
        return '📄'
      case '.txt':
        return '📃'
      case '.json':
        return '📋'
      default:
        return '📎'
    }
  }
  // 读取二进制文件为Blob
  static async readFileBlob(filePath: string, workspacePath?: string, dirHandle?: any): Promise<Blob | null> {
    try {
      if (workspacePath && dirHandle) {
        const relative = filePath.startsWith(workspacePath)
          ? filePath.slice(workspacePath.length + 1)
          : filePath
        const parts = relative.split('/').filter(Boolean)
        let current = dirHandle
        for (let i = 0; i < parts.length - 1; i++) {
          current = await current.getDirectoryHandle(parts[i], { create: false })
        }
        const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: false })
        const file = await fileHandle.getFile()
        return file
      }
      return null
    } catch (error) {
      if (error && (error as any).name !== 'NotFoundError') {
        console.error('读取二进制文件失败:', error)
      }
      return null
    }
  }
}
