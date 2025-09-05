import React from 'react'
import './Toast.css'

export default function Toast({ toasts, remove }) {
  return (
    <div className="cg-toast-root" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`cg-toast cg-toast-${t.type || 'info'}`} role="status">
          <div className="cg-toast-body">
            <div className="cg-toast-message">{t.message}</div>
            {t.action && (
              <button className="cg-toast-action" onClick={() => { t.action.onClick(); remove(t.id) }}>{t.action.label}</button>
            )}
            <button className="cg-toast-close" onClick={() => remove(t.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  )
}
