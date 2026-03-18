# Oran记 / Oran Note - AI Markdown Notebook

## Project Overview

Oran记 (Oran Note) is a lightweight, local-first AI-powered Markdown note-taking application with a three-panel IDE-style interface.

### Key Features
- **Local Workspace**: Direct access to local directories using File System Access API
- **Markdown Editing**: Split-pane editor with CodeMirror, preview mode, and syntax highlighting
- **PDF Support**: Preview and export with Paged.js, Chinese text support
- **AI Assistant**: SiliconFlow API integration with `@` context referencing (files/folders/workspace)
- **Multi-Assistant System**: Configurable assistants with customizable prompts
- **Desktop App**: Electron wrapper for Windows, macOS, and Linux

### Language
Project documentation and comments are primarily in **Chinese (中文)**.

---

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State Management | Zustand (with persist middleware) |
| Editor | CodeMirror 6 (@uiw/react-codemirror) |
| Markdown | Marked + Highlight.js |
| PDF | pdf-lib, pdfjs-dist, Paged.js |
| Desktop | Electron 33 + electron-builder |
| UI Components | Lucide React |
| Notifications | Sonner |

---

## Project Structure

```
/
├── src/
│   ├── components/          # React components
│   │   ├── AIAssistant.tsx      # AI chat panel (right)
│   │   ├── FileTree.tsx         # File explorer (left)
│   │   ├── MarkdownEditor.tsx   # Editor + preview (center)
│   │   ├── MainLayout.tsx       # Three-column layout
│   │   ├── Header.tsx           # Top navigation bar
│   │   ├── SettingsModal.tsx    # Settings dialog
│   │   ├── SearchModal.tsx      # File search dialog
│   │   ├── HistoryModal.tsx     # Chat history dialog
│   │   └── AboutModal.tsx       # About dialog
│   ├── services/            # Business logic services
│   │   ├── fileSystem.ts        # File System Access API wrapper
│   │   └── aiService.ts         # SiliconFlow API client
│   ├── stores/              # State management
│   │   └── appStore.ts          # Zustand store with persistence
│   ├── hooks/               # Custom React hooks
│   │   └── useTheme.ts          # Theme management
│   ├── lib/                 # Utilities
│   │   └── utils.ts             # Helper functions
│   ├── pages/               # Page components
│   │   └── Home.tsx             # Main page
│   ├── App.tsx              # Root component
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles + Tailwind
├── electron/
│   └── main.cjs             # Electron main process
├── scripts/
│   └── make-ico.cjs         # Icon generation script
├── package.json             # Dependencies + electron-builder config
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── eslint.config.js         # ESLint configuration
└── vercel.json              # Vercel deployment config
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (web)
npm run dev

# Build for production
npm run build

# Type checking (without emit)
npm run check

# Lint code
npm run lint

# Preview production build
npm run preview

# Electron development (requires dev server running)
npm run app:dev

# Build desktop app for distribution
npm run app:dist

# Generate ICO icon from PNG
npm run make:ico
```

---

## Architecture Details

### Three-Panel Layout (MainLayout.tsx)
1. **Left Panel** (`leftWidth`, default 320px): File tree navigation
2. **Center Panel** (flex-1): Markdown editor with tabs
3. **Right Panel** (`rightWidth`, default 384px): AI assistant chat

Resizable dividers between panels use mouse drag handlers.

### State Management (appStore.ts)
Zustand store with localStorage persistence for:
- User config (API key, model, username, avatar, assistants)
- Editor mode (edit/preview/split)
- Panel widths

File contents and workspace state are NOT persisted (volatile).

### File System Service (fileSystem.ts)
Uses browser File System Access API with graceful fallbacks:
- `selectWorkspace()`: Opens directory picker
- `getWorkspaceFiles()`: Builds file tree recursively
- `readFile()`: Reads file content
- `writeFile()`: Writes file content
- `createFile()`: Creates new file
- `deleteFile()`: Removes file
- `moveItem()`: Move/rename files
- `createFolder()`: Creates directories

Supported file types: `.md`, `.pdf`, `.txt`, `.json`

### AI Service (aiService.ts)
Integrates with SiliconFlow API (硅基流动):
- Base URL: `https://api.siliconflow.cn/v1`
- Default model: `deepseek-ai/DeepSeek-V3.1-Terminus`
- Context support: Files, folders, entire workspace via `@` mentions
- Streaming responses supported

Default system prompt (小橙 assistant) is defined in `DEFAULT_ASSISTANT_PROMPT`.

---

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2020
- Module: ESNext
- Module Resolution: bundler
- JSX: react-jsx
- **Strict mode is OFF** (`strict: false`)
- Path alias: `@/*` maps to `./src/*`

### Naming Conventions
- Components: PascalCase (e.g., `AIAssistant.tsx`)
- Services: PascalCase with `Service` suffix (e.g., `FileSystemService`)
- Stores: camelCase with `use` prefix (e.g., `useAppStore`)
- Types/Interfaces: PascalCase (e.g., `FileNode`, `UserConfig`)

### Component Patterns
- Use functional components with React.FC type
- Prefer `clsx` and `tailwind-merge` for conditional classes
- Use Tailwind CSS for all styling
- Dark mode is default (gray-800/900 backgrounds)

### Comments
Comments and UI text are primarily in Chinese to match the target user base.

---

## Testing

**No automated testing framework is currently configured.** Testing is done manually:

1. Run `npm run dev` for web testing
2. Run `npm run app:dev` for desktop testing
3. Use `npm run check` for TypeScript validation
4. Use `npm run lint` for code quality

---

## Security Considerations

1. **API Key Storage**: API keys are stored in localStorage via Zustand persist
2. **File System Access**: Uses browser File System Access API with user permission
3. **No Server Upload**: All file operations are local-only
4. **Context Isolation**: Electron uses `contextIsolation: true`

---

## Deployment

### Web (Vercel)
- Configured via `vercel.json` with SPA fallback
- Run `npm run build` to generate `dist/` folder
- Static deployment on Vercel

### Desktop (Electron)
- Configured in `package.json` under `build` key
- App ID: `com.heswy.orannote`
- Product Name: `Oran记`
- Output: `release/` directory
- Targets:
  - macOS: `.dmg`, `.zip`
  - Windows: `.nsis`, `.zip`
  - Linux: `.AppImage`, `.zip`

---

## Important Notes for AI Agents

1. **File System Access API**: This is a browser API that requires HTTPS or localhost. The app gracefully degrades for unsupported browsers.

2. **Hidden Data Directory**: The app creates `.oran/ai-sessions/` in the workspace root for storing chat sessions.

3. **Electron Main Process**: The `electron/main.cjs` file contains a security-related encoded string at the end. Do not modify this.

4. **PDF Handling**: PDF files have special handling - they can be referenced in AI context and exported with custom styling.

5. **Context Referencing**: The `@` mention system allows users to reference:
   - `@"workspace"` - entire workspace
   - `@"folder/path"` - specific folder
   - `@"file.md"` - specific file

6. **Chinese Support**: The app is designed for Chinese users. Maintain Chinese text in UI and comments.
