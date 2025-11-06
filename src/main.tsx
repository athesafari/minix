// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { worker } from './mocks/browser'
import './styles.css'

// Start MSW only in development
if (process.env.NODE_ENV === 'development') {
  worker.start({
    onUnhandledRequest: 'bypass', // don't block real API calls
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
