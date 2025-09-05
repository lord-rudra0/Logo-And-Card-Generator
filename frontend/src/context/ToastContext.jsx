import React, { createContext, useContext, useState, useCallback } from 'react'
import Toast from '../components/Toast'

const ToastContext = createContext(null)

let idSeq = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback((type, message, opts = {}) => {
    const id = String(idSeq++)
    const t = { id, type, message, action: opts.action }
    setToasts((s) => [...s, t])
    if (!opts.sticky) setTimeout(() => remove(id), opts.duration || 5000)
    return id
  }, [remove])

  const api = {
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast toasts={toasts} remove={remove} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
