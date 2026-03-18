# 🍊 Oran记 · AI Markdown Notebook

一个好用、轻量、走心的 AI 笔记应用。三栏 IDE 风格 · 本地文件工作区 · Markdown 写作 · PDF 预览与导出 · AI 助手支持 `@` 引用文件上下文。

## ✨ 亮点速览

- 📁 本地工作区：直接选择电脑目录，读取/写入不离开你的设备
- 📝 Markdown 分屏写作：编辑 / 预览 / 分屏，代码高亮与自定义样式
- 📄 PDF 能力：打开预览、样式保真导出（Paged.js），图片与中文兼容
- 🤖 AI 助手：基于硅基流动 API，支持 `@工作区/文件夹/文件/PDF` 上下文引用
- 🧠 多助手人设：可配置多个助手，默认“小橙”助手内置系统提示词
- ⚙️ 配置持久化：API Key、模型、头像、助手设置全部本地保存

## 🚀 快速开始

1. 🔓 打开目录：顶部点击“选择目录”，授权你的笔记文件夹
2. 🔑 获取密钥：去 `https://siliconflow.cn` 申请 API Key，并在“设置”里填入保存
3. 🗂️ 管理文件：左侧文件树支持新建/删除/重命名，双击打开，拖拽移动
4. ✍️ 写 Markdown：中间编辑器支持分屏预览、代码高亮与自动保存
5. 🤝 用 AI：右侧输入问题，输入 `@` 选择工作区/文件夹/文件，或拖拽路径到输入框
6. 📄 导出 PDF：编辑器工具栏点击“导出 PDF（样式保真）”，生成后同目录可预览

## � 本地运行

```bash
npm install
npm run dev
# 生产构建
npm run build
# 类型检查
npm run check
```

## 🧩 功能详解

### 📁 文件管理
- 选择工作区（电脑本地目录）
- 树形结构展示 Markdown / PDF
- 右键与拖拽操作（移动、重命名、新建）

### 📝 Markdown 编辑
- 编辑 / 预览 / 分屏模式
- 代码高亮（Highlight.js）
- 粘贴图片自动保存到 `images/` 并插入 Markdown（`![name](images/name)`）
- 自定义预览样式，适合打印与导出

### 📄 PDF 支持
- 预览：本地 PDF 直接在右侧面板打开
- 导出：Paged.js 打印路径，保留样式与图片、中文
- 解析：AI 引用 PDF 时自动解析文本并纳入上下文

### 🤖 AI 助手
- 平台：硅基流动（SiliconFlow）
- 模型：DeepSeek / Kimi / GLM / Qwen 等可选
- 引用：`@` 可选择“工作区 / 文件夹 / 文件 / PDF”；也可从文件树拖拽路径到输入框
- 多助手：在“设置 → 助手与人设”添加多个助手；默认助手“小橙”内置系统提示词

## 🛡️ 隐私与安全
- API Key 保存在本地（Zustand+persist），不上传服务器
- 使用浏览器 `File System Access API` 访问本地文件
- 不做用户追踪与数据收集

## � 项目结构

```
src/
├── components/          # 界面组件（文件树、编辑器、AI助手、设置等）
├── services/            # 业务服务（文件系统、AI）
├── stores/              # 状态管理（Zustand）
├── pages/               # 页面入口（Home）
└── App.tsx              # 布局主入口
```

## �️ 桌面应用计划（Win/Mac）
- 推荐 Electron 封装为桌面应用（Windows + macOS），保持功能不受影响
- 通过主进程 `fs` 与预加载 `ipc` 提供文件系统适配层，前端保持现有调用

## 🤝 参与贡献
- 欢迎 Issue / PR，一起把「Oran记」打磨为你的第二大脑 ✨

## 📄 License

MIT License © 2025 heswy
