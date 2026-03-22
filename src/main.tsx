import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { accountManager } from './features/auth/services/authService.ts'

// Migrate existing single-user session to the multi-account schema
const existingUser = localStorage.getItem('hive_user');
if (existingUser && accountManager.getAll().length === 0) {
  accountManager.add(existingUser, 'keychain');
}

// Global fix to prevent mouse-wheel scrolling from mutating <input type="number"> fields
document.addEventListener('wheel', () => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).type === 'number') {
    (document.activeElement as HTMLElement).blur();
  }
}, { passive: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
