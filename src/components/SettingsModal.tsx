import React, { useState } from 'react'
import { Settings, User, Key, Save, X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { AIService, DEFAULT_ASSISTANT_PROMPT } from '@/services/aiService'
import { toast } from 'sonner'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { config, setConfig } = useAppStore()
  const [formData, setFormData] = useState({
    apiKey: config.apiKey,
    modelId: config.modelId,
    username: config.username,
    avatar: config.avatar,
    assistants: config.assistants || [],
    activeAssistantId: config.activeAssistantId || ''
  })
  const [isValidating, setIsValidating] = useState(false)
  const [customModels, setCustomModels] = useState<Array<{id: string, name: string}>>([])
  const [showCustomModelInput, setShowCustomModelInput] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!formData.apiKey) {
      toast.error('API密钥不能为空')
      return
    }

    setIsValidating(true)
    try {
      // 验证API密钥
      const isValid = await AIService.validateApiKey(formData.apiKey)
      if (!isValid) {
        toast.error('API密钥验证失败')
        return
      }

      setConfig(formData)
      toast.success('配置保存成功')
      onClose()
    } catch (error) {
      console.error('验证API密钥失败:', error)
      toast.error('API密钥验证失败')
    } finally {
      setIsValidating(false)
    }
  }

  const handleTestConnection = async () => {
    if (!formData.apiKey) {
      toast.error('请先输入API密钥')
      return
    }

    setIsValidating(true)
    try {
      const isValid = await AIService.validateApiKey(formData.apiKey)
      if (isValid) {
        toast.success('API连接成功')
      } else {
        toast.error('API连接失败')
      }
    } catch (error) {
      toast.error('API连接失败')
    } finally {
      setIsValidating(false)
    }
  }

  const handleAddCustomModel = () => {
    if (!newModelId || !newModelName) {
      toast.error('请填写模型ID和名称')
      return
    }

    const newModel = { id: newModelId, name: newModelName }
    setCustomModels(prev => [...prev, newModel])
    setNewModelId('')
    setNewModelName('')
    setShowCustomModelInput(false)
    toast.success('自定义模型添加成功')
  }

  const handleRemoveCustomModel = (modelId: string) => {
    setCustomModels(prev => prev.filter(model => model.id !== modelId))
    toast.success('自定义模型删除成功')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            设置
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* 用户信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              用户名
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入用户名"
            />
          </div>

          {/* 头像 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" /> 头像
            </label>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-sm">🙂</span>
                )}
              </div>
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = reader.result as string
                    setFormData(prev => ({ ...prev, avatar: dataUrl }))
                  }
                  reader.readAsDataURL(file)
                }}
              />
              <button
                onClick={() => document.getElementById('avatar-file-input')?.click()}
                className="px-3 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
              >
                选择图片
              </button>
              {formData.avatar && (
                <button
                  onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                  className="px-3 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* API密钥 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
              <Key className="w-4 h-4 mr-2" />
              API密钥
            </label>
            <input
              type="password"
              name="apiKey"
              value={formData.apiKey}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入硅基流动API密钥"
            />
            <p className="text-xs text-gray-400 mt-1">
              请前往 <a href="https://siliconflow.cn" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">硅基流动</a> 获取API密钥
            </p>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              模型
            </label>
            <select
              name="modelId"
              value={formData.modelId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="deepseek-ai/DeepSeek-V3.1-Terminus">DeepSeek-V3.1-Terminus</option>
              <option value="moonshotai/Kimi-K2-Thinking">Kimi-K2-Thinking</option>
              <option value="zai-org/GLM-4.6">GLM-4.6</option>
              <option value="deepseek-ai/DeepSeek-V2-Chat">DeepSeek-V2-Chat</option>
              <option value="deepseek-ai/DeepSeek-Coder-V2-Instruct">DeepSeek-Coder-V2</option>
              <option value="Qwen/Qwen2.5-7B-Instruct">Qwen2.5-7B-Instruct</option>
              <option value="Qwen/Qwen2.5-14B-Instruct">Qwen2.5-14B-Instruct</option>
              <option value="THUDM/glm-4-9b-chat">GLM-4-9B-Chat</option>
              {customModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            
            {/* 自定义模型管理 */}
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => setShowCustomModelInput(!showCustomModelInput)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showCustomModelInput ? '取消' : '添加自定义模型'}
              </button>
              {customModels.length > 0 && (
                <span className="text-xs text-gray-400">
                  已添加 {customModels.length} 个自定义模型
                </span>
              )}
            </div>
            
            {showCustomModelInput && (
              <div className="mt-2 p-3 bg-gray-700 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="模型ID (如: custom/model-name)"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="模型显示名称"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddCustomModel}
                    className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                  >
                    添加
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomModelInput(false)
                      setNewModelId('')
                      setNewModelName('')
                    }}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
            
            {/* 已添加的自定义模型列表 */}
            {customModels.length > 0 && (
              <div className="mt-2 space-y-1">
                {customModels.map((model) => (
                  <div key={model.id} className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                    <span className="text-gray-300">{model.name}</span>
                    <button
                      onClick={() => handleRemoveCustomModel(model.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 助手与人设 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">助手与人设</label>
            <div className="space-y-2">
              {(formData.assistants || []).map((a, idx) => (
                <div key={a.id} className="p-3 bg-gray-700 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={formData.activeAssistantId === a.id}
                        onChange={() => setFormData(prev => ({ ...prev, activeAssistantId: a.id }))}
                      />
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) => {
                          const v = e.target.value
                          setFormData(prev => ({
                            ...prev,
                            assistants: prev.assistants.map((x, i) => i === idx ? { ...x, name: v } : x)
                          }))
                        }}
                        className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                        placeholder="助手名称"
                        disabled={a.id === 'default'}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          assistants: prev.assistants.filter((_, i) => i !== idx)
                        }))
                        if (formData.activeAssistantId === a.id) {
                          setFormData(prev => ({ ...prev, activeAssistantId: '' }))
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >删除</button>
                  </div>
                  <textarea
                    value={a.id === 'default' ? DEFAULT_ASSISTANT_PROMPT : a.prompt}
                    onChange={(e) => {
                      const v = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        assistants: prev.assistants.map((x, i) => i === idx ? { ...x, prompt: v } : x)
                      }))
                    }}
                    rows={3}
                    className="mt-2 w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    placeholder="输入该助手的人设提示词"
                    disabled={a.id === 'default'}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const id = `as_${Date.now()}`
                  setFormData(prev => ({
                    ...prev,
                    assistants: [
                      ...prev.assistants,
                      { id, name: `助手${prev.assistants.length + 1}`, prompt: '' }
                    ],
                    activeAssistantId: prev.activeAssistantId || id
                  }))
                }}
                className="px-3 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-sm"
              >添加助手</button>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <button
            onClick={handleTestConnection}
            disabled={isValidating}
            className="px-4 py-2 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            {isValidating ? '验证中...' : '测试连接'}
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isValidating}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {isValidating ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
