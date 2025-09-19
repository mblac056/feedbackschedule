import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { EntrantProvider } from './contexts/EntrantContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EntrantProvider>
      <App />
    </EntrantProvider>
  </StrictMode>,
)
