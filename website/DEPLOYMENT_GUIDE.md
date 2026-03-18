# GitHub Pages 部署指南

## 自动部署设置

我已经为你创建了 GitHub Actions 工作流配置文件，位于 `.github/workflows/deploy-pages.yml`。

### 启用 GitHub Pages 的步骤：

1. **进入 GitHub 仓库设置**
   - 打开你的 GitHub 仓库：`https://github.com/heswy/OranNote--AI-Markdown-NoteBook`
   - 点击 "Settings" 标签

2. **配置 Pages 设置**
   - 在左侧菜单中找到 "Pages" 选项
   - 在 "Source" 部分选择 "GitHub Actions" 作为部署源

3. **推送代码**
   - 将代码推送到 `main` 分支
   - GitHub Actions 会自动触发部署

4. **查看部署状态**
   - 在仓库的 "Actions" 标签中可以查看部署进度
   - 部署完成后，你的网站将在 `https://heswy.github.io/OranNote--AI-Markdown-NoteBook/` 访问

### 手动部署

如果你想手动触发部署：
1. 进入 GitHub 仓库的 "Actions" 标签
2. 选择 "Deploy to GitHub Pages" 工作流
3. 点击 "Run workflow" 按钮

### 网站文件说明

网站文件位于 `website/` 目录：
- `index.html` - 主页面
- `styles.css` - 样式文件
- `script.js` - 交互脚本

### 自定义域名（可选）

如果你想使用自定义域名：
1. 在仓库的 "Pages" 设置中添加自定义域名
2. 在你的域名提供商处配置 CNAME 记录指向 `heswy.github.io`

## 部署状态

部署通常需要 1-2 分钟完成。你可以在 Actions 页面查看详细的部署日志。