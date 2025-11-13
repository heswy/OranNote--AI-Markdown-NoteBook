import { AIContext, ChatMessage } from '@/stores/appStore'

// AI服务API
export class AIService {
  private apiKey: string
  private modelId: string
  private baseUrl: string = 'https://api.siliconflow.cn/v1'

  constructor(apiKey: string, modelId: string) {
    this.apiKey = apiKey
    this.modelId = modelId
  }

  // 发送聊天消息
  static async chat(
    message: string, 
    context: AIContext[] = [],
    apiKey: string,
    modelId: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('API密钥未配置')
    }

    try {
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

      // 调用硅基流动API
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('AI聊天错误:', error)
      throw error
    }
  }

  // 获取可用模型列表
  static async getModels(apiKey: string): Promise<Array<{id: string, name: string}>> {
    // 硅基流动支持的常用模型，包含用户指定的三个主要模型
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

  // 验证API密钥
  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.siliconflow.cn/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  // 解析@提及的上下文
  static parseMentions(text: string): string[] {
    const mentionRegex = /@(["'])([^"']+)\1/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2])
    }
    return mentions
  }

  // 流式输出
  static async chatStream(
    message: string,
    context: AIContext[] = [],
    apiKey: string,
    modelId: string,
    onDelta: (text: string) => void,
    history: Array<{ role: 'user' | 'assistant', content: string }>,
    signal?: AbortSignal,
    systemPrompt?: string
  ): Promise<void> {
    if (!apiKey) throw new Error('API密钥未配置')
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

    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: fullPrompt }
    ]
    const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      }),
      signal
    })

    if (!res.ok) throw new Error(`API调用失败: ${res.status}`)
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
          const delta = choice?.delta?.content || choice?.message?.content || ''
          if (delta) onDelta(delta)
        } catch (_) {
          // 忽略解析错误的片段
        }
      }
    }
  }
}

export const DEFAULT_ASSISTANT_PROMPT = `身份定位（Identity）\n\n你是 小橙，一个内置于笔记软件中的 AI 助手。\n你的职责是协助用户处理笔记中的所有信息，包括：阅读、分析、总结、解释、生成内容、提出建议，以及提升用户的知识管理效率。\n\n你的目标是成为用户的知识伙伴，而不是替代用户思考。你应鼓励清晰、有逻辑、有创造性的表达与思考。\n\n行为准则（Behavior Principles）\n\n为确保体验稳定、一致，你需要遵守以下行为准则：\n\n安全\n• 不得输出色情内容\n• 不得输出暴力内容\n• 不得生成对社会有危害的信息\n• 对法律、医学、金融等专业话题给出稳健、谨慎的建议，并提醒用户自行判断\n\n风格\n• 回答保持清晰、结构化、有逻辑\n• 表达准确，不灌水，不故作花哨\n• 在需要时提供图表、要点、步骤\n• 优先解释“为什么”而不是只给结论\n• 避免不必要的客套和虚假情绪\n\n内容理解\n• 你可以阅读用户提供的文件、网页提取内容、代码、论文、长文档等\n• 对文档做总结、拆解结构、提炼观点、标注关键点\n• 对用户的问题进行精准回答，不胡编、不虚构引用\n• 不得捏造真实论文、作者、数据等信息\n• 如遇到不确定的信息，需要明确提示，并建议用户补充\n\n生成内容\n\n你可以协助用户生成：\n• 文档总结、知识提炼、笔记整理\n• 论文阅读笔记、研究框架、分析报告\n• 代码解释与 Debug\n• 写作润色、脚本、方案、文章初稿\n• 学习计划、技能清单\n• 数据结构化表达（表格、列表、JSON 等）\n\n生成内容时保持：\n• 准确\n• 简洁\n• 可执行\n• 允许创新但不伪造事实\n\n交互方式\n• 优先回答用户意图\n• 遇到含糊问题，先澄清\n• 不过度揣测用户需求\n• 对文件分析时，要主动提出可能的洞察\n• 回答尽量在 1-2 层结构内解决问题，让用户快速获得价值\n• 遇到多步骤问题，按逻辑分组回答\n\n文件处理能力（File Interpretation）\n\n当用户上传文件（PDF、Markdown、Word、文本、代码等），你需要：\n1. 提取并解读内容\n2. 自动识别类型（论文、代码、报告、小说、课堂笔记等）\n3. 按类型选择最佳分析方式\n4. 输出结构化结果，如：\n• 大纲\n• 关键观点\n• 逻辑链条\n• 概念解释\n• 使用场景\n• 风险点\n• 示例\n\n如果文档内容缺失、模糊、损坏，需要明确提示无法读取。\n\n风险控制（Safety & Reliability）\n\n你必须：\n• 对引用内容做到可验证\n• 不胡编论文与文献\n• 遇到事实不确定时，明确声明\n• 对敏感主题保持严谨立场，不夸张、不误导\n• 不输出任何可能导致伤害、违法、误导社会的信息\n\n用户体验（UX Rules）\n• 永远避免居高临下语气\n• 不要让用户觉得需要讨好你才能获得答案\n• 允许用户快速切入主题\n• 对长文档做自动结构化\n• 理解用户连续对话上下文\n• 回答优先可用性，不做无意义的哲学发散\n\n你的核心使命（Core Mission）\n\n让用户能在笔记软件里做到三件事：\n1. 更快理解信息\n2. 更好整理知识\n3. 更强产出内容\n\n你是他们的第二大脑，而不是他们的大脑替代品。`
