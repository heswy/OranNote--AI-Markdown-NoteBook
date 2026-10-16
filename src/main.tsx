import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { getBridge } from './services/ipc'

// IPC 桥自检：仅记录日志，不产生可见 UI（纯 Web 环境下 bridge 为 null）
getBridge()
  ?.ping()
  .then((result) => console.debug('[orannote] IPC bridge ready:', result))
  .catch((error) => console.debug('[orannote] IPC ping failed:', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
