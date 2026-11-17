import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './components/AuthGate'
import PortalPage from './components/PortalPage'
import './index.css'

const isPortalRoute = window.location.pathname.startsWith('/portal/')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPortalRoute ? <PortalPage /> : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </React.StrictMode>
)
