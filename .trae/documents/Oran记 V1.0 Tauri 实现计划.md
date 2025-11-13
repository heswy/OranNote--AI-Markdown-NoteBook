## 项目初始化
- 选择 Tauri（Rust 后端 + React/TypeScript 前端），创建基础脚手架：`src/`（前端）与 `src-tauri/`（后端）。
- 前端依赖：React、Tailwind（或 Radix UI）、monaco-editor、markdown-it（表格/任务列表/代码高亮插件）、prismjs 或 highlight.js、pdfjs-dist、uuid、zustand（或 recoil）用于状态、zod 用于数据校验。
- 后端依赖：tauri、tauri-plugin-sql（SQLite）、notify（文件监听）、serde/serde_json（序列化）、anyhow/thiserror（错误）、reqwest（HTTP/AI 调用，若走后端）或前端直连（按规范支持）。
- 基础配置：`tauri.conf.json`、打包与缓存目录 `$APP_DATA/oran/cache/`。

## 目录结构
- 前端：`src/app`（布局与路由）、`src/components`（UI 组件）、`src/features`（文件/编辑器/AI/设置/会话模块）、`src/styles/tokens.css`（Design Tokens）、`src/lib`（工具函数），`src/state`（store）。
- 后端：`src-tauri/src/main.rs`（入口与命令注册）、`src-tauri/src/ipc/*.rs`（workspace/fs/pdf/settings/keychain/chat/message/ai）、`src-tauri/src/db/*.rs`（SQLite 初始化与DAO）、`src-tauri/src/fs/*.rs`（文件与监听）、`src-tauri/src/cache/*.rs`（PDF文本缓存、摘要）。

## UI 与 Design Tokens
- 引入并全局挂载规范内 CSS 变量（Design Tokens）；建立通用样式 `.surface-panel`，确保左/中/右三面板视觉一致。
- 组件实现（可复用与组合）：`<SurfaceCard>`、`<PanelHeader>`、`<SOButton variant="primary|ghost|ctrl">`、`<Input>`、`<Toolbar>`、`<ContextChips>`、`<AIMessage role>`, `<FileTree>`（虚拟滚动 + 键盘导航）。

## 三栏布局骨架
- 顶部 64px Header + 主区域三列：左（文件管理区 300px）、中（编辑区 1fr）、右（AI 区 360px），应用 `.surface-panel` 与 Token 数值。
- 路由/状态：工作区路径为全局状态，三栏相互通信（文件选择驱动编辑区与 AI 上下文）。

## 文件管理区
- 最近工作区列表与当前工作区选择：`workspace:select()`、`workspace:listRecent()`。
- 目录树：懒加载与虚拟滚动；文件类型图标（.md/.pdf/其他只读灰显）；搜索过滤（模糊匹配）。
- 文件操作：`fs:newFile/newFolder/rename/delete(move)`，删除二次确认（含是否删除磁盘文件），拖拽移动与插入指示（2px dashed brand，圆角 12px）。
- 外部变更监听：`fs:watch(path)`，刷新视图与冲突提示。

## 笔记编辑区
- 模式切换：编辑/预览/分栏（`Ctrl/Cmd+\`）。编辑器优先 Monaco（备选 CodeMirror 6）。
- 工具条：H1~H3、粗/斜、列表、引用、代码、任务列表、表格、链接、图片、水平线。
- Markdown 渲染：markdown-it + 表格/任务列表/代码高亮插件；预览区背景白色。
- 自动保存：500ms 防抖写入（`fs:writeFile(path, content, safe:true)`）；外部修改检测与提示（V1 不做 diff）。
- 粘贴图片（可选）：保存至 `workspace/assets/xxx.png` 并插入相对路径。

## AI 区（核心）
- 对话输入与 `@` 选择器：最近文件、当前目录文件、文件夹、`@workspace`，多选 Chip 可移除；支持相对路径搜索。
- 上下文打包：
  - `.md`：基于 Markdown AST 按标题分块，优先摘要/首段。
  - `.pdf`：PDF.js 抽取纯文本，按页/段分块；缓存文本于 `$APP_DATA/oran/cache/pdf_text/`。
  - 超限策略：显式 @ 优先 → 最近修改 → 浅层优先 → `@workspace`；块上限约 1500 字，模型上下文安全阈值默认 70%。
- Prompt 组织：system（回答规范与引用要求）+ context（按文件聚合，标注相对路径与片段范围）+ user（原始问题）。
- AI 请求（硅基流动兼容）：流式输出、错误码映射（401/403/429/5xx），显示“引用来源”。支持配置 Provider/Base URL/API Key/Model ID。
- 会话管理：多会话、重命名、置顶、归档、删除；全文检索（标题/消息）。

## 设置与持久化
- 个人信息（头像本地、用户名）、主题（浅色/深色/跟随系统；V1至少浅色）、编辑器参数（字号、字体、行高、自动换行、Tab 宽度）、渲染（KaTeX、Mermaid 可选）。
- AI 配置：Provider、Base URL、Model ID、API Key（入 OS Keychain）、上下文安全阈值与先行摘要开关。
- 数据与缓存：清理缓存（PDF 文本、摘要）、导入/导出设置（不含 API Key）。

## IPC 接口（Tauri 命令）
- workspace：`select()`、`listRecent()`。
- fs：`listDir(path)`（懒加载）、`newFile/newFolder`、`rename`、`delete(permanent)`、`move`、`readFile`、`writeFile(safe)`、`watch(path)`（事件流）。
- pdf：`extractText(path)`（带缓存）。
- settings：`get/set`；keychain：`set/get`（service/account）。
- chat：`create/list/rename/delete`；message：`append(chatId, role, content, contextJson?)`。
- ai：`complete(stream, payload)`（支持流式）。

## 数据模型与初始化（SQLite）
- 表：`workspaces`、`chats`、`messages`、`settings`（按规范 SQL）。
- 初始化：应用启动时检测/创建表；DAO 层封装 CRUD 与近期工作区逻辑。
- `messages.context_json` 存储 @ 选择快照与切片信息（JSON 字符串）。

## 缓存与路径
- `$APP_DATA/oran/cache/`：`pdf_text/`、`summaries/`（可选启发式本地摘要）。
- 清理缓存接口与设置开关；大文件保护：>10MB 提醒是否先摘要参与上下文。

## 错误与边界处理
- 路径无效/权限问题：提示重新选择工作区。
- 文件占用保存失败：提供“重试/另存副本”。
- PDF 抽取为空：提示“可能为扫描件，暂不支持文本抽取”。
- AI 错误映射：401/403/429/5xx → 明确提示与“重试/去配置”。

## 快捷键
- 全局：`Ctrl/Cmd+O` 选择工作区、`Ctrl/Cmd+N` 新建 Markdown、`Ctrl/Cmd+P` 快速打开、`Ctrl/Cmd+\` 切换编辑/预览/分栏、`Ctrl/Cmd+J` 聚焦 AI。
- 编辑：常规 Markdown 快捷键；`Ctrl/Cmd+S` 立即保存。AI：`@` 选择器、`Ctrl/Cmd+Enter` 发送、`Esc` 取消流式。

## 性能与安全
- 性能：冷启动 <2s、目录树 1000 节点无明显卡顿（虚拟滚动）、编辑响应 <16ms/帧、AI 首包 <2s。
- 安全与隐私：API Key 入 OS Keychain；无远端埋点；仅访问用户选择的工作区路径；缓存可一键清除；可访问性与对比度达标。

## 验收与测试
- 用例覆盖：工作区选择与自动保存、外部修改提示、AI 总结并给出引用来源、`@workspace`/文件夹超限裁剪、缺失 API Key 的引导与修复。
- 自动化测试：前端单元测试（上下文打包、选择器、渲染）、端到端（文件操作与AI流程的伪接口或沙箱）、后端单元测试（DAO/IPC）。
- 性能测试：目录树虚拟滚动与渲染帧率；AI首包时延；PDF抽取缓存命中率。

## 里程碑与交付
- M0（3~5天）：脚手架、三栏布局、选择工作区、目录树只读、Markdown 打开与预览。
- M1（5~7天）：Monaco 编辑、自动保存、PDF 预览、文件操作（新建/重命名/删除/拖拽）、文件监听。
- M2（5~7天）：AI 基础（输入/流式/配置页/硅基流动直连）、`@` 选择器、上下文打包 V1、引用来源展示。
- M3（5~7天）：会话管理、外部修改处理、Keychain、安全与错误态、性能打磨与验收。
- M4（可选）：启发式本地摘要、Mermaid/KaTeX、图片粘贴落地、最近工作区。

## 备选方案（Electron）
- Electron + React + TS；Keytar 存 Key；主进程处理 fs 与 pdf；打包体积更大、调试工具丰富；其余设计保持一致。

## 下一步
- 当前仓库为空：按上述计划从脚手架开始搭建（优先 Tauri）。确认后将初始化项目结构、依赖与基础 UI/IPC，并逐里程碑交付可验收的增量版本。