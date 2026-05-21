import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './services/AuthContext.jsx'
import { JathaListsProvider } from './context/JathaListsContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <JathaListsProvider>
        <App />
      </JathaListsProvider>
    </AuthProvider>
  </StrictMode>,
)
