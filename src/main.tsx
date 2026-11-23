import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CrashGuard } from './components/CrashScreen'
import './index.css'
import { ToastProvider } from './lib/toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashGuard>
      <ToastProvider>
        <App />
      </ToastProvider>
    </CrashGuard>
  </StrictMode>,
)
