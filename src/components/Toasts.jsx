import { IconHeart } from './Icons.jsx'

/**
 * `aria-live="polite"` invece di `assertive`: una conferma di preferito non
 * merita di interrompere quello che uno screen reader sta già leggendo.
 */
export default function Toasts({ items, onDismiss }) {
  if (items.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone || 'neutral'}`}>
          <span className="toast__icon" aria-hidden="true">
            <IconHeart filled={toast.tone === 'good'} width="17" height="17" />
          </span>

          <span className="toast__text">{toast.text}</span>

          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => { toast.action.run(); onDismiss(toast.id) }}
            >
              {toast.action.label}
            </button>
          )}

          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Chiudi la notifica"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
