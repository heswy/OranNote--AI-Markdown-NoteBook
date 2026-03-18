import React, { useState } from 'react'
import { Settings, User, Key, Save, X, Check, Loader2, Bot, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { AIService, DEFAULT_ASSISTANT_PROMPT } from '@/services/aiService'
import { CustomSelect } from '@/components/CustomSelect'
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
    activeAssistantId: config.activeAssistantId || '',
    provider: config.provider || 'siliconflow' as 'siliconflow' | 'kimi'
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
      toast.error('API 密钥不能为空')
      return
    }

    // 如果选择 Kimi Code，给出警告但仍允许保存
    if (formData.provider === 'kimi') {
      toast.warning('Kimi Code 目前暂不可用，已切换回硅基流动')
      const updatedFormData = { ...formData, provider: 'siliconflow' as const }
      setFormData(updatedFormData)
      setConfig(updatedFormData)
      onClose()
      return
    }

    setIsValidating(true)
    try {
      const result = await AIService.validateApiKey(formData.apiKey, formData.provider)
      if (!result.valid) {
        toast.error(`API 密钥验证失败: ${result.error}`)
        return
      }

      setConfig(formData)
      toast.success('配置保存成功')
      onClose()
    } catch (error) {
      console.error('验证 API 密钥失败:', error)
      toast.error('API 密钥验证失败')
    } finally {
      setIsValidating(false)
    }
  }

  const handleTestConnection = async () => {
    if (!formData.apiKey) {
      toast.error('请先输入 API 密钥')
      return
    }

    setIsValidating(true)
    try {
      const result = await AIService.validateApiKey(formData.apiKey, formData.provider)
      if (result.valid) {
        if (result.error) {
          // 验证通过但有警告
          toast.success(`API 连接成功（注意：${result.error}）`)
        } else {
          toast.success('API 连接成功')
        }
      } else {
        toast.error(`API 连接失败: ${result.error}`)
      }
    } catch (error) {
      toast.error('API 连接失败')
    } finally {
      setIsValidating(false)
    }
  }

  const handleAddCustomModel = () => {
    if (!newModelId || !newModelName) {
      toast.error('请填写模型 ID 和名称')
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-modal animate-in backdrop-blur-sm">
      <div className="bg-bg-elevated border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            设置
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* 用户信息 */}
          <Section title="用户信息" icon={<User className="w-4 h-4" />}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">用户名</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary 
                    placeholder:text-text-disabled focus:outline-none focus:border-primary-500/50 transition-colors"
                  placeholder="输入用户名"
                />
              </div>

              {/* 头像 */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">头像</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-bg-surface border border-border overflow-hidden flex items-center justify-center">
                    {formData.avatar ? (
                      <img src={formData.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🙂</span>
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
                    className="px-3 py-2 bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover 
                      border border-border rounded-lg text-sm transition-colors"
                  >
                    选择图片
                  </button>
                  {formData.avatar && (
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                      className="px-3 py-2 text-error hover:bg-error/10 rounded-lg text-sm transition-colors"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* API 配置 */}
          <Section title="API 配置" icon={<Key className="w-4 h-4" />}>
            <div className="space-y-4">
              {/* AI 提供商选择 */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">AI 服务</label>
                <CustomSelect
                  value={formData.provider || 'siliconflow'}
                  options={[
                    { value: 'siliconflow', label: '硅基流动 (SiliconFlow)' },
                    { value: 'kimi', label: 'Kimi Code（开发中，暂不可用）', disabled: true }
                  ]}
                  onChange={(value) => setFormData(prev => ({ ...prev, provider: value as 'siliconflow' | 'kimi' }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">API 密钥</label>
                <input
                  type="password"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary 
                    placeholder:text-text-disabled focus:outline-none focus:border-primary-500/50 transition-colors"
                  placeholder={formData.provider === 'kimi' ? '输入 Kimi Code API 密钥' : '输入硅基流动 API 密钥'}
                />
                <p className="text-xs text-text-disabled mt-1.5">
                  {formData.provider === 'kimi' ? (
                    <>
                      <span className="text-warning">⚠️ Kimi Code 目前因浏览器 CORS 限制暂不可用，请选择硅基流动</span>
                      <br />
                      <span className="text-text-tertiary">后续版本将支持更多 AI 提供商</span>
                    </>
                  ) : (
                    <>请前往 <a href="https://siliconflow.cn" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">硅基流动</a> 获取 API 密钥</>
                  )}
                </p>
              </div>

              {/* 模型选择 - 仅在硅基流动时显示 */}
              {formData.provider === 'siliconflow' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">模型</label>
                  <CustomSelect
                    value={customModels.some(m => m.id === formData.modelId) || 
                           ['deepseek-ai/DeepSeek-V3.1-Terminus', 'moonshotai/Kimi-K2-Thinking', 
                            'zai-org/GLM-4.6', 'deepseek-ai/DeepSeek-V2-Chat',
                            'deepseek-ai/DeepSeek-Coder-V2-Instruct', 'Qwen/Qwen2.5-7B-Instruct',
                            'Qwen/Qwen2.5-14B-Instruct', 'THUDM/glm-4-9b-chat'].includes(formData.modelId)
                            ? formData.modelId : '__custom__'}
                    options={[
                      { value: 'deepseek-ai/DeepSeek-V3.1-Terminus', label: 'DeepSeek-V3.1-Terminus' },
                      { value: 'moonshotai/Kimi-K2-Thinking', label: 'Kimi-K2-Thinking' },
                      { value: 'zai-org/GLM-4.6', label: 'GLM-4.6' },
                      { value: 'deepseek-ai/DeepSeek-V2-Chat', label: 'DeepSeek-V2-Chat' },
                      { value: 'deepseek-ai/DeepSeek-Coder-V2-Instruct', label: 'DeepSeek-Coder-V2' },
                      { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B-Instruct' },
                      { value: 'Qwen/Qwen2.5-14B-Instruct', label: 'Qwen2.5-14B-Instruct' },
                      { value: 'THUDM/glm-4-9b-chat', label: 'GLM-4-9B-Chat' },
                      ...customModels.map((model) => ({ value: model.id, label: model.name })),
                      { value: '__custom__', label: '+ 自定义模型...' }
                    ]}
                    onChange={(value) => {
                      if (value === '__custom__') {
                        setShowCustomModelInput(true)
                      } else {
                        setFormData(prev => ({ ...prev, modelId: value }))
                      }
                    }}
                  />
                  
                  {/* 当前使用的自定义模型显示 */}
                  {formData.modelId && 
                   !['deepseek-ai/DeepSeek-V3.1-Terminus', 'moonshotai/Kimi-K2-Thinking', 
                       'zai-org/GLM-4.6', 'deepseek-ai/DeepSeek-V2-Chat',
                       'deepseek-ai/DeepSeek-Coder-V2-Instruct', 'Qwen/Qwen2.5-7B-Instruct',
                       'Qwen/Qwen2.5-14B-Instruct', 'THUDM/glm-4-9b-chat'].includes(formData.modelId) &&
                   !customModels.some(m => m.id === formData.modelId) && (
                    <div className="mt-2 px-3 py-2 bg-bg-surface border border-primary-500/30 rounded-lg">
                      <span className="text-xs text-text-tertiary">当前模型 ID：</span>
                      <code className="text-xs text-primary-400 ml-1">{formData.modelId}</code>
                    </div>
                  )}
                  
                  {/* 自定义模型输入框 */}
                  {showCustomModelInput && (
                    <div className="mt-3 p-3 bg-bg-surface border border-border rounded-lg space-y-2">
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">模型 ID</label>
                        <input
                          type="text"
                          placeholder="例如：provider/model-name"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-bg-base border border-border rounded-md text-text-primary text-sm
                            focus:outline-none focus:border-primary-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">显示名称（可选）</label>
                        <input
                          type="text"
                          placeholder="给模型起个名字"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-bg-base border border-border rounded-md text-text-primary text-sm
                            focus:outline-none focus:border-primary-500/50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (newModelId.trim()) {
                              handleAddCustomModel()
                            } else {
                              setShowCustomModelInput(false)
                            }
                          }}
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-md hover:bg-primary-500 transition-colors"
                        >
                          使用此模型
                        </button>
                        <button
                          onClick={() => {
                            setShowCustomModelInput(false)
                            setNewModelId('')
                            setNewModelName('')
                          }}
                          className="px-3 py-1.5 bg-bg-base text-text-secondary text-xs rounded-md hover:bg-bg-surface-hover transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* 助手设置 */}
          <Section title="AI 助手" icon={<Bot className="w-4 h-4" />}>
            <div className="space-y-3">
              {formData.assistants?.map((assistant, idx) => (
                <div key={assistant.id} className="p-3 bg-bg-surface border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      checked={formData.activeAssistantId === assistant.id}
                      onChange={() => setFormData(prev => ({ ...prev, activeAssistantId: assistant.id }))}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      value={assistant.name}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          assistants: prev.assistants?.map((a, i) => 
                            i === idx ? { ...a, name: e.target.value } : a
                          )
                        }))
                      }}
                      className="flex-1 px-2.5 py-1 bg-bg-base border border-border rounded-md text-text-primary text-sm
                        focus:outline-none focus:border-primary-500/50"
                      placeholder="助手名称"
                      disabled={assistant.id === 'default'}
                    />
                    {assistant.id !== 'default' && (
                      <button
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            assistants: prev.assistants?.filter((_, i) => i !== idx)
                          }))
                        }}
                        className="p-1.5 text-text-tertiary hover:text-error hover:bg-error/10 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={assistant.id === 'default' ? DEFAULT_ASSISTANT_PROMPT : assistant.prompt}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        assistants: prev.assistants?.map((a, i) => 
                          i === idx ? { ...a, prompt: e.target.value } : a
                        )
                      }))
                    }}
                    rows={3}
                    className="w-full px-2.5 py-2 bg-bg-base border border-border rounded-md text-text-primary text-sm
                      focus:outline-none focus:border-primary-500/50 resize-none"
                    placeholder="输入助手的人设提示词"
                    disabled={assistant.id === 'default'}
                  />
                </div>
              ))}
              
              <button
                onClick={() => {
                  const id = `as_${Date.now()}`
                  setFormData(prev => ({
                    ...prev,
                    assistants: [
                      ...(prev.assistants || []),
                      { id, name: `助手 ${(prev.assistants?.length || 0)}`, prompt: '' }
                    ]
                  }))
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 
                  bg-bg-surface border border-dashed border-border rounded-lg
                  text-text-secondary hover:text-text-primary hover:border-primary-500/50
                  transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                添加助手
              </button>
            </div>
          </Section>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <button
            onClick={handleTestConnection}
            disabled={isValidating || formData.provider === 'kimi'}
            className="text-sm text-primary-500 hover:text-primary-400 disabled:opacity-50 transition-colors"
          >
            {isValidating ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                验证中...
              </span>
            ) : (
              '测试连接'
            )}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isValidating}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg 
                hover:bg-primary-500 disabled:opacity-50 transition-colors"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isValidating ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 设置区块组件
const Section: React.FC<{
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}> = ({ title, icon, children }) => (
  <div className="space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
      <span className="p-1 bg-primary-500/10 text-primary-500 rounded-md">{icon}</span>
      {title}
    </h3>
    {children}
  </div>
)
