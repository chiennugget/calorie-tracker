import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

// The AI photo scan was removed; clear its old config (it held an access token).
try {
  localStorage.removeItem('calorie-tracker:ai')
} catch {
  // storage unavailable (private mode): nothing to clean up
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
