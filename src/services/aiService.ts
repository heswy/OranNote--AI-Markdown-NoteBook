import { AIContext, ChatMessage } from '@/stores/appStore'

// AI 提供商类型
export type AIProvider = 'siliconflow' | 'kimi'

// AI 服务配置
interface AIConfig {
  provider: AIProvider
  apiKey: string
  modelId?: string
}

// Kimi Code API 请求格式
interface KimiCodeRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

// Kimi Code API 响应格式
interface KimiCodeResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
}

// 硅基流动 API 请求格式
interface SiliconFlowRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export class AIService {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  // 获取 API 基础 URL
  private getBaseUrl(): string {
    switch (this.config.provider) {
      case 'kimi':
        return 'https://api.kimi.com/coding/v1'
      case 'siliconflow':
      default:
        return 'https://api.siliconflow.cn/v1'
    }
  }
  


  // 获取请求头
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  // 构建消息
  private buildMessages(
    message: string,
    context: AIContext[],
    history: Array<{ role: 'user' | 'assistant', content: string }>,
    systemPrompt?: string
  ): Array<{ role: 'system' | 'user' | 'assistant', content: string }> {
    // 构建上下文提示
    const contextPrompt = context.map(ctx => {
      if (ctx.type === 'file') {
        return `文件 "${ctx.path}":\n${ctx.content || ''}`
      } else if (ctx.type === 'folder') {
        return `文件夹 "${ctx.path}" 的内容`
      } else {
        return `工作区 "${ctx.path}" 的所有内容`
      }
    }).join('\n\n')

    const fullPrompt = contextPrompt
      ? `基于以下上下文回答问题：\n\n${contextPrompt}\n\n用户问题：${message}`
      : message

    return [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: fullPrompt }
    ]
  }

  // 发送聊天消息
  static async chat(
    message: string,
    context: AIContext[] = [],
    apiKey: string,
    modelId: string,
    systemPrompt?: string,
    provider: AIProvider = 'siliconflow'
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('API 密钥未配置')
    }

    const service = new AIService({ provider, apiKey, modelId })
    const messages = service.buildMessages(message, context, [], systemPrompt)

    try {
      if (provider === 'kimi') {
        return await service.chatWithKimi(messages)
      } else {
        return await service.chatWithSiliconFlow(messages)
      }
    } catch (error) {
      console.error('AI 聊天错误:', error)
      throw error
    }
  }

  // Kimi Code API 聊天
  private async chatWithKimi(
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
  ): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        temperature: 0.7,
        max_tokens: 2000
      } as KimiCodeRequest)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Kimi API 调用失败: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as KimiCodeResponse
    return data.choices[0]?.message?.content || ''
  }

  // 硅基流动 API 聊天
  private async chatWithSiliconFlow(
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
  ): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.modelId,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      } as SiliconFlowRequest)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SiliconFlow API 调用失败: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  // 流式聊天
  static async chatStream(
    message: string,
    context: AIContext[] = [],
    apiKey: string,
    modelId: string,
    onDelta: (text: string, reasoning?: string) => void,
    history: Array<{ role: 'user' | 'assistant', content: string }>,
    signal?: AbortSignal,
    systemPrompt?: string,
    provider: AIProvider = 'siliconflow'
  ): Promise<void> {
    if (!apiKey) throw new Error('API 密钥未配置')

    const service = new AIService({ provider, apiKey, modelId })
    const messages = service.buildMessages(message, context, history, systemPrompt)

    if (provider === 'kimi') {
      await service.chatStreamWithKimi(messages, onDelta, signal)
    } else {
      await service.chatStreamWithSiliconFlow(messages, onDelta, signal)
    }
  }

  // Kimi Code API 流式聊天
  private async chatStreamWithKimi(
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>,
    onDelta: (text: string, reasoning?: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      } as KimiCodeRequest),
      signal
    })

    if (!res.ok) throw new Error(`Kimi API 调用失败: ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''

      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const choice = json.choices?.[0]
          const content = choice?.delta?.content || choice?.message?.content || ''
          const reasoning = choice?.delta?.reasoning_content || ''
          if (content || reasoning) onDelta(content, reasoning)
        } catch {
          // 忽略解析错误的片段
        }
      }
    }
  }

  // 硅基流动 API 流式聊天
  private async chatStreamWithSiliconFlow(
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>,
    onDelta: (text: string, reasoning?: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.modelId,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      } as SiliconFlowRequest),
      signal
    })

    if (!res.ok) throw new Error(`SiliconFlow API 调用失败: ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''

      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const choice = json.choices?.[0]
          const content = choice?.delta?.content || choice?.message?.content || ''
          // 支持 reasoning_content 字段（DeepSeek R1 等模型）
          const reasoning = choice?.delta?.reasoning_content || ''
          if (content || reasoning) onDelta(content, reasoning)
        } catch {
          // 忽略解析错误的片段
        }
      }
    }
  }

  // 获取可用模型列表
  static async getModels(apiKey: string, provider: AIProvider = 'siliconflow'): Promise<Array<{id: string, name: string}>> {
    if (provider === 'kimi') {
      // Kimi Code API 目前只有一个模型
      return [
        { id: 'kimi-code', name: 'Kimi Code' }
      ]
    }

    // 硅基流动支持的模型
    return [
      { id: 'deepseek-ai/DeepSeek-V3.1-Terminus', name: 'DeepSeek-V3.1-Terminus' },
      { id: 'moonshotai/Kimi-K2-Thinking', name: 'Kimi-K2-Thinking' },
      { id: 'zai-org/GLM-4.6', name: 'GLM-4.6' },
      { id: 'deepseek-ai/DeepSeek-V2-Chat', name: 'DeepSeek-V2-Chat' },
      { id: 'deepseek-ai/DeepSeek-Coder-V2-Instruct', name: 'DeepSeek-Coder-V2' },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B-Instruct' },
      { id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen2.5-14B-Instruct' },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B-Chat' }
    ]
  }

  // 验证 API 密钥
  static async validateApiKey(apiKey: string, provider: AIProvider = 'siliconflow'): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey) return { valid: false, error: 'API 密钥为空' }

    try {
      if (provider === 'kimi') {
        // Kimi Code API - 尝试调用一个简单的 chat 请求来验证
        // 注意：Kimi Code API 的实际端点可能需要根据官方文档调整
        console.log('正在验证 Kimi Code API...')
        
        try {
          const response = await fetch('https://api.kimi.com/coding/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 10
            })
          })
          
          console.log('Kimi API 响应状态:', response.status)
          
          if (response.ok) {
            return { valid: true }
          } else {
            const errorText = await response.text()
            console.error('Kimi API 验证失败:', response.status, errorText)
            // 如果是 401，说明密钥错误；如果是 404，可能是端点不对
            if (response.status === 401) {
              return { valid: false, error: 'API 密钥无效' }
            } else if (response.status === 404) {
              return { valid: false, error: 'API 端点不存在，请检查 Kimi Code API 地址' }
            } else {
              return { valid: false, error: `HTTP ${response.status}: ${errorText.slice(0, 100)}` }
            }
          }
        } catch (fetchErr) {
          console.error('Kimi API 网络错误:', fetchErr)
          // 网络错误时，暂时返回成功，让用户可以保存配置
          // 实际使用时如果有问题会再报错
          return { valid: true, error: '网络请求失败，但已允许保存配置。如果无法使用，请检查 API 地址和密钥。' }
        }
      } else {
        const response = await fetch('https://api.siliconflow.cn/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })
        
        if (response.ok) {
          return { valid: true }
        } else {
          const errorText = await response.text()
          console.error('SiliconFlow API 验证失败:', response.status, errorText)
          return { valid: false, error: `HTTP ${response.status}: ${errorText.slice(0, 100)}` }
        }
      }
    } catch (err) {
      console.error('API 验证异常:', err)
      return { valid: false, error: err instanceof Error ? err.message : '网络请求失败' }
    }
  }

  // 解析 @ 提及的上下文
  static parseMentions(text: string): string[] {
    const mentionRegex = /@(["'])([^"']+)\1/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2])
    }
    return mentions
  }
}

export const DEFAULT_ASSISTANT_PROMPT = `身份定位（Identity）

你是 小橙，一个内置于笔记软件中的 AI 助手。
你的职责是协助用户处理笔记中的所有信息，包括：阅读、分析、总结、解释、生成内容、提出建议，以及提升用户的知识管理效率。

你的目标是成为用户的知识伙伴，而不是替代用户思考。你应鼓励清晰、有逻辑、有创造性的表达与思考。

行为准则（Behavior Principles）

为确保体验稳定、一致，你需要遵守以下行为准则：

安全
• 不得输出色情内容
• 不得输出暴力内容
• 不得生成对社会有危害的信息
• 对法律、医学、金融等专业话题给出稳健、谨慎的建议，并提醒用户自行判断

风格
• 回答保持清晰、结构化、有逻辑
• 表达准确，不灌水，不故作花哨
• 在需要时提供图表、要点、步骤
• 优先解释"为什么"而不是只给结论
• 避免不必要的客套和虚假情绪

内容理解
• 你可以阅读用户提供的文件、网页提取内容、代码、论文、长文档等
• 对文档做总结、拆解结构、提炼观点、标注关键点
• 对用户的问题进行精准回答，不胡编、不虚构引用
• 不得捏造真实论文、作者、数据等信息
• 如遇到不确定的信息，需要明确提示，并建议用户补充

生成内容

你可以协助用户生成：
• 文档总结、知识提炼、笔记整理
• 论文阅读笔记、研究框架、分析报告
• 代码解释与 Debug
• 写作润色、脚本、方案、文章初稿
• 学习计划、技能清单
• 数据结构化表达（表格、列表、JSON 等）

生成内容时保持：
• 准确
• 简洁
• 可执行
• 允许创新但不伪造事实

交互方式
• 优先回答用户意图
• 遇到含糊问题，先澄清
• 不过度揣测用户需求
• 对文件分析时，要主动提出可能的洞察
• 回答尽量在 1-2 层结构内解决问题，让用户快速获得价值
• 遇到多步骤问题，按逻辑分组回答

文件处理能力（File Interpretation）

当用户上传文件（PDF、Markdown、Word、文本、代码等），你需要：
1. 提取并解读内容
2. 自动识别类型（论文、代码、报告、小说、课堂笔记等）
3. 按类型选择最佳分析方式
4. 输出结构化结果，如：
• 大纲
• 关键观点
• 逻辑链条
• 概念解释
• 使用场景
• 风险点
• 示例

如果文档内容缺失、模糊、损坏，需要明确提示无法读取。

风险控制（Safety & Reliability）

你必须：
• 对引用内容做到可验证
• 不胡编论文与文献
• 遇到事实不确定时，明确声明
• 对敏感主题保持严谨立场，不夸张、不误导
• 不输出任何可能导致伤害、违法、误导社会的信息

用户体验（UX Rules）
• 永远避免居高临下语气
• 不要让用户觉得需要讨好你才能获得答案
• 允许用户快速切入主题
• 对长文档做自动结构化
• 理解用户连续对话上下文
• 回答优先可用性，不做无意义的哲学发散

你的核心使命（Core Mission）

让用户能在笔记软件里做到三件事：
1. 更快理解信息
2. 更好整理知识
3. 更强产出内容

你是他们的第二大脑，而不是他们的大脑替代品。`

export default AIService
