// 渲染层 IPC 访问层：统一封装 Electron preload 暴露的 window.orannote 桥
// 纯 Web 环境下 window.orannote 不存在，getBridge() 返回 null，调用方需做空值判断

export interface PingResult {
  ok: boolean
  name: string
  version: string
  platform: string
  electron: string
  chrome: string
}

// pdf:export 入参：待打印 HTML（渲染层构造）+ 保存对话框默认文件名
export interface ExportPdfOptions {
  html: string
  suggestedName?: string
}

export interface ExportPdfResult {
  ok: boolean
  // 成功时为实际落盘路径
  path?: string
  // 失败原因（用户取消为 'canceled'）
  reason?: string
}

export interface OrannoteBridge {
  ping(): Promise<PingResult>
  exportPdf(options: ExportPdfOptions): Promise<ExportPdfResult>
}

declare global {
  interface Window {
    orannote?: OrannoteBridge
  }
}

// 获取 IPC 桥；非 Electron 环境返回 null
export function getBridge(): OrannoteBridge | null {
  if (typeof window === 'undefined') return null
  return window.orannote ?? null
}
