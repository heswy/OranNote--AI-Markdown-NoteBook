# OranNote 更新路线图

> 制定于 2026-10-15。依据：Codex 全仓体检（49,777 tokens）+ 三份前沿调研（AI 笔记赛道 / 桌面技术栈 / MCP 与 agent 架构）。
> 原则：**先修破损，再补缺口，最后追前沿**；每一档做完再进下一档，不并行。
> 状态标记：`[ ]` 未开始 `[~]` 进行中 `[x]` 完成

---

## P0 — 地基与破损（不做，后面全是沙上建塔）

| # | 做什么 | 为什么（一句话） | 验收 |
|---|---|---|---|
| 0.1 | **Electron 33 → 44** | 33 已于 2025-04 停支，Electron 只维护最新三个大版本；这是安全债不是"旧一点" | `npm run app:dist` 能出包，应用能起、能开目录、AI 能对话 |
| 0.2 | **Node 升到 20.19+ / 22.12+** | Vite 7 与新 Electron 的前置条件 | `node -v` 达标，`npm i` 无报错 |
| 0.3 | **修图片不显示** | renderer 只写 `data-origin-src` 没写 `src`，`MarkdownEditor.tsx:425` 的补图逻辑是空注释——**破损，每天必踩** | 笔记里插入/粘贴的图片能在预览里显示 |
| 0.4 | **GlassWorm 历史清理** | 载荷已从 HEAD 删除，但仍在 git 历史（`a2320926`）里可 checkout | 历史里搜不到 `codepointAt` / `Solana 地址` / 变体选择符 |
| 0.5 | **清死代码与依赖** | `planStore.ts`(214行,零引用)、`Empty.tsx`、`Home.tsx`、`react.svg`、`objectUrlCacheRef`；未用依赖 `@supabase/supabase-js`/`react-router-dom`/`chokidar`/`electron-store`/裸 `codemirror` | `npm run build` 通过，包体积下降，无回归 |
| 0.6 | **元数据与仓库卫生** | 包名还是 `trae-project`；`tsconfig` include 了不存在的 `api/`；根目录躺着 4.4MB `logoforpkg.png` | 包名改为 `orannote`；`tsconfig` 干净；大图移出仓库 |
| 0.7 | **清掉 19 处 `console.log`** | 生产残留，噪音 | `grep -r "console.log" src` 结果为空或均为有意保留 |

**P0 完成才算有了可迭代的地基。这一步不改变任何用户可见功能。**

---

## P1 — 补完已有功能 + 低风险升级

| # | 做什么 | 为什么（一句话） | 依赖 |
|---|---|---|---|
| 1.1 | **决定 PDF 导出的新底层** | Paged.js 停在 0.4.3、维护标 inactive、镜像已归档——**头号卖点的地基没人维护了**。候选：pdf-lib 直出 / 打印 CSS（`@page`）/ 观察 Typst | 先做技术验证，再动手 |
| 1.2 | **补完 PDF 导出** | `MarkdownEditor.tsx:404` 现在只弹 toast，**宣传与实际对不上** | 1.1 |
| 1.3 | **React 18 → 19.3** | 官方 codemod 可跑；注意 defaultProps/PropTypes/字符串 ref 已移除 | 0.2 |
| 1.4 | **Vite 6 → 7** | 低风险；Vite 8(Rolldown) 等插件生态追平再上 | 0.2 |
| 1.5 | **TypeScript → 6.0** | 与 5.9 API 兼容，基本无痛 | 1.3 |
| 1.6 | **补测试地基** | Vitest 4 覆盖 store 与 Markdown 解析等纯逻辑；没有测试就没有重构的胆量 | 1.4 |
| 1.7 | **`⌘P` 文件搜索 + 拖拽文件进 AI 输入框** | 已对外宣称却无实现（`⌘P` 未绑定、无 `onDrop`），属体验漏项 | — |
| 1.8 | **补 Electron 的 fs/IPC 适配层** | 现在完全没有——这是后面 key 安全、agent 隔离的地基 | 0.1 |
| 1.9 | **README 与实现的诚实对齐** | 体检原话："README 与注释明显夸大" | 1.2 |

---

## P2 — 追前沿（决定这个项目 2026 年还算不算活着）

| # | 做什么 | 为什么（一句话） |
|---|---|---|
| 2.1 | **API key 从 localStorage 挪进系统凭证库** | 现在 key 明文躺在渲染层里；2026 标准是 Electron `safeStorage` → macOS Keychain / Windows DPAPI / Linux libsecret，**明文 key 永不进渲染层** |
| 2.2 | **agent 架构分层** | agent 循环与工具执行放主进程/子进程，渲染层零特权；开 `contextIsolation`+`sandbox`、关 `nodeIntegration`、IPC 校验 sender |
| 2.3 | **MCP server** | 让 Claude/Cursor/ChatGPT 能读写你的笔记库——**这是 2026 年最硬的一道分水岭**，不接等于自绝于 AI 生态 |
| 2.4 | **MCP client** | 反向调用外部工具（搜索、日历、其他 MCP server） |
| 2.5 | **工具调用审批机制** | 默认需批准 + diff + 可撤销；`MCP server` 与一切外部内容都当不可信代码 |
| 2.6 | **本地推理先接 Ollama** | 本地 HTTP API 最现实；之后再评估 `@electron/llm`（实验包）或 node-llama-cpp |
| 2.7 | **Tailwind 3 → 4** | CSS-first 重写，官方 upgrade 工具跑完仍需人工复核 theme 与 `@apply`；**单独排一轮** |
| 2.8 | **代码签名 + 自动更新** | macOS 代码签名也是 `safeStorage` 行为一致的前提；`electron-updater` |

---

## P3 — 探索与以后

| # | 做什么 | 说明 |
|---|---|---|
| 3.1 | **AI 从"帮写"升级到"帮做"** | agentic 工作流（自动归档、建链接、周报、把笔记变成待办）——但**必须配人工审批**。全自动那条（Mem 路线）留存未被验证 |
| 3.2 | **端侧 embedding 做语义检索 / 自动链接** | 免费、离线、隐私；端侧适合摘要与分类，**不适合重推理**（Bear 实测 Apple Foundation Models 做不了 AI 搜索） |
| 3.3 | **多模态捕获（语音 / 图片 / PDF）** | 趋势里已立住的一项 |
| 3.4 | **Marked → markdown-it** | 更快、插件更强，约半天工作量；非必要 |
| 3.5 | **~~迁 Tauri~~** | **不做**。要重写 Rust 主进程 + 重调 WebView 的打印/字体/PDF 差异，个人项目不划算 |
| 3.6 | **~~换掉 CodeMirror 6~~** | **不做**。文件即文本、无 AST 往返，AI 补全与内联装饰最贴合；Tiptap 更适合所见即所得协作 |
| 3.7 | **~~再加一个"生成摘要"按钮~~** | **不做**。2026 年那只是个 checkbox，不是卖点 |

---

## 一句话记法

- **P0**：让地基能承重（安全债 + 每天踩的破损）
- **P1**：让宣称的东西真的能用
- **P2**：让它在 2026 年还说得上话（key 安全 + MCP + agent 隔离）
- **P3**：往里加东西，以及明确哪些**不做**

## 三个明确不碰的方向（来自调研）

1. **会议 bot 式 AI 笔记** —— 被 Zoom/Teams/Copilot 原生功能吃掉
2. **自建云 AI 后端、锁死单一模型** —— 成本高、换代快、隐私争议大；改走 BYO key
3. **正面对抗"又一个 Notion 全能 workspace"** —— 对手 $600M ARR + agent，打不过

## 附：架构上本来就对的地方（别改坏）

本地明文 Markdown + 文件系统直连 + 本地优先——**这恰好是 2026 年那三个门槛的入场券**。行业这一年才想通"只有明文文件能被 AI 真正读写"这件事，而这个项目一开始就是这么做的。
