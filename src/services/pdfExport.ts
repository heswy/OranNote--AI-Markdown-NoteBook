// 渲染层「打印 HTML 构造器」：把预览区 DOM 变成一份自包含、全离线的打印 HTML，
// 再交给主进程的隐藏窗口执行 printToPDF（坑与结论见仓库根目录 spike-report.md）。
//
// 设计要点：
// 1. 打印样式与深色应用主题完全解耦——导出的 HTML 只内联浅色纸面样式，绝不注入应用 DOM；
// 2. blob:/file: 图片全部转成 data: base64，规避隐藏窗口里的资源加载竞态；
// 3. 页边距/纸张只由主进程的 options 负责（margins/pageSize），CSS 里不写 @page margin。

// hljs 浅色主题：直接复用 highlight.js 自带样式（构建期内联成字符串，产物不引在线资源）
import hljsLightTheme from 'highlight.js/styles/github.css?raw'

export interface BuildPrintHtmlOptions {
  // 当前文件名（如 欢迎.md），用于 <title> 与 PDF 默认文件名
  fileName: string
  // 预览区 DOM 元素引用（自身或其后代含 .markdown-preview）
  source: HTMLElement | null
}

// 中文字体栈：与 spike 验证过的可用字体一致
const PRINT_FONT_STACK = "'WenQuanYi Zen Hei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
const PRINT_MONO_FONT_STACK = "'WenQuanYi Zen Hei Mono', 'Menlo', 'Consolas', monospace"

// 单次分片长度，避免 String.fromCharCode 参数过多爆栈
const BASE64_CHUNK_SIZE = 0x8000

// 文件名 → 建议的 PDF 文件名（去掉 .md，补上 .pdf）
export function suggestPdfFileName(fileName: string): string {
  const base = (fileName || '').trim().replace(/\.md$/i, '')
  return `${base || 'orannote'}.pdf`
}

const escapeHtmlText = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE))
  }
  return btoa(binary)
}

const guessMimeType = (src: string): string => {
  const ext = src.split('#')[0].split('?')[0].split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'bmp': return 'image/bmp'
    case 'svg': return 'image/svg+xml'
    default: return 'application/octet-stream'
  }
}

// blob: / file: 资源转 data: base64（fetch → arrayBuffer → base64）
// 返回是否成功内联；http(s) 等协议原样保留
const inlineImage = async (img: HTMLImageElement): Promise<boolean> => {
  const src = img.currentSrc || img.getAttribute('src') || ''
  if (!src || /^data:/i.test(src)) return true
  if (!/^(?:blob:|file:)/i.test(src)) return true
  try {
    const response = await fetch(src)
    if (!response.ok) return false
    const buffer = new Uint8Array(await response.arrayBuffer())
    const mime = response.headers.get('Content-Type')?.split(';')[0]?.trim() || guessMimeType(src)
    img.setAttribute('src', `data:${mime};base64,${bytesToBase64(buffer)}`)
    img.removeAttribute('data-origin-src')
    return true
  } catch (error) {
    console.warn('PDF 导出：图片内联失败', src, error)
    return false
  }
}

// 取出真正承载正文的节点
const resolveContentRoot = (source: HTMLElement): HTMLElement | null => {
  if (source.classList?.contains('markdown-preview')) return source
  return source.querySelector<HTMLElement>('.markdown-preview')
}

// 清掉与正文无关的交互元素：复制按钮、划词浮层等
const stripInteractiveNodes = (clone: HTMLElement): void => {
  clone.querySelectorAll('button, [data-print-exclude]').forEach((node) => node.remove())
  clone.querySelectorAll('img').forEach((img) => {
    // 懒加载在打印窗口里可能不触发，去掉更稳（图片本身已内联为 data URI）
    img.removeAttribute('loading')
    img.removeAttribute('onclick')
  })
}

// 打印样式：白底浅色纸面，与深色应用主题无关
const PRINT_CSS = `
html,
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #1f2328;
  font-family: ${PRINT_FONT_STACK};
  font-size: 14px;
  line-height: 1.7;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* 纸张固定 A4；页边距统一交给主进程 printToPDF 的 margins 选项，
   这里绝不能写 @page margin（CSS 会覆盖 options，见 spike-report.md 问题 4） */
@page {
  size: A4;
}

.print-document {
  max-width: 100%;
}

.print-document h1,
.print-document h2,
.print-document h3,
.print-document h4,
.print-document h5,
.print-document h6 {
  color: #111827;
  font-weight: 600;
  line-height: 1.35;
  /* 标题不带正文一起断页，避免孤行 */
  break-after: avoid;
  page-break-after: avoid;
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document h1 {
  font-size: 24px;
  margin: 24px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.print-document h2 {
  font-size: 19px;
  margin: 20px 0 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f1f3;
}

.print-document h3 { font-size: 16px; margin: 16px 0 8px; }
.print-document h4 { font-size: 15px; margin: 14px 0 6px; }
.print-document h5,
.print-document h6 { font-size: 14px; margin: 12px 0 6px; color: #374151; }

.print-document p {
  margin: 0 0 12px;
  color: #374151;
  line-height: 1.8;
}

.print-document ul,
.print-document ol {
  margin: 10px 0;
  padding-left: 24px;
  color: #374151;
}

.print-document li {
  margin: 4px 0;
  line-height: 1.7;
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document li > p { margin-bottom: 4px; }

.print-document a {
  color: #c2410c;
  text-decoration: underline;
}

.print-document strong { color: #111827; font-weight: 600; }
.print-document em { font-style: italic; }

.print-document code {
  background: #f2f3f5;
  color: #b45309;
  padding: 1px 4px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-family: ${PRINT_MONO_FONT_STACK};
  font-size: 0.9em;
}

.print-document pre {
  background: #f6f8fa;
  border: 1px solid #d8dee4;
  border-radius: 6px;
  padding: 12px 14px;
  margin: 12px 0;
  /* 打印没有横向滚动，长行折行而不是被裁掉 */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  break-inside: avoid;
  page-break-inside: avoid;
  font-family: ${PRINT_MONO_FONT_STACK};
  font-size: 12px;
  line-height: 1.6;
}

.print-document pre code {
  background: transparent;
  color: #1f2328;
  padding: 0;
  border: none;
  border-radius: 0;
  font-size: inherit;
  font-family: inherit;
}

.print-document blockquote {
  margin: 12px 0;
  padding: 10px 14px;
  border-left: 3px solid #f97316;
  background: #faf8f5;
  color: #4b5563;
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document blockquote p:last-child { margin-bottom: 0; }

.print-document table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 13px;
}

/* 表格跨页时重复表头；行内不断页 */
.print-document thead { display: table-header-group; }
.print-document tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document th {
  background: #f2f4f7;
  color: #111827;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid #d8dee4;
}

.print-document td {
  color: #374151;
  padding: 8px 10px;
  border: 1px solid #d8dee4;
  break-inside: avoid;
}

.print-document tr:nth-child(even) td { background: #fafafa; }

.print-document img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 20px 0;
}

.print-document > *:first-child { margin-top: 0; }
.print-document > *:last-child { margin-bottom: 0; }

/* 交互控件不进纸面 */
.copy-code-btn { display: none !important; }
`

// hljs 浅色主题（github.css）后置覆盖：代码底色沿用 pre 的浅灰
const HLJS_OVERRIDES = `
.print-document pre code.hljs {
  background: transparent;
  padding: 0;
}
`

/**
 * 克隆预览区 DOM，生成独立可打印的完整 HTML 字符串。
 * 打印 CSS 全部内联；图片内联为 data URI；不依赖任何在线资源。
 */
export async function buildPrintHtml({ fileName, source }: BuildPrintHtmlOptions): Promise<string> {
  const root = source ? resolveContentRoot(source) : null
  if (!root) {
    throw new Error('预览内容尚未就绪，请切换到预览模式后再导出')
  }

  const clone = root.cloneNode(true) as HTMLElement
  clone.classList.add('print-document')
  stripInteractiveNodes(clone)

  const images = Array.from(clone.querySelectorAll('img'))
  const inlined = await Promise.all(images.map((img) => inlineImage(img as HTMLImageElement)))

  let dropped = 0
  images.forEach((img, index) => {
    if (!inlined[index]) {
      dropped += 1
      img.remove()
    }
  })
  if (dropped > 0) {
    console.warn(`PDF 导出：有 ${dropped} 张图片无法内联，已从导出内容中移除`)
  }

  const title = escapeHtmlText(fileName || 'Oran记')
  const style = `${PRINT_CSS}\n${hljsLightTheme}\n${HLJS_OVERRIDES}`

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${title}</title>`,
    '<style>',
    style,
    '</style>',
    '</head>',
    '<body>',
    clone.outerHTML,
    '</body>',
    '</html>'
  ].join('\n')
}
