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

export interface ExportPdfResult {
  ok: boolean
  reason?: string
}

export interface OrannoteBridge {
  ping(): Promise<PingResult>
  exportPdf(options?: unknown): Promise<ExportPdfResult>
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
