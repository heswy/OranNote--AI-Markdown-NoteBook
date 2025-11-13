import React from 'react'
import { HelpCircle, X } from 'lucide-react'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <HelpCircle className="w-5 h-5 mr-2" />
            关于
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3 text-gray-200">
          <div className="text-sm">📚 作者：阿橙 & Trae</div>
          <div className="text-sm">🙏 感谢使用！如果有反馈请发送至 ✉️ heswyc@gmail.com</div>
          <div className="text-sm">✨ 祝你写作顺利，灵感满满！</div>
          <div className="mt-3">
            <div className="text-sm font-medium text-white mb-2">快速入门</div>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>打开目录：点击顶部导航的“选择目录”，授权本地笔记工作区。</li>
              <li>配置 API：前往 <a href="https://siliconflow.cn" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">硅基流动</a> 获取密钥，在“设置”里填入并保存。</li>
              <li>引用文件：在 AI 助手输入框键入 `@` 选择“工作区/文件夹/文件”，或从左侧文件树拖拽到输入框。</li>
              <li>PDF 解读：通过 `@` 引用 PDF 后发送问题，系统会解析文本并作为上下文回答。</li>
              <li>MD 转 PDF：在编辑器工具栏点击“导出 PDF（样式保真）”，生成文件保存在同目录并自动打开预览。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
