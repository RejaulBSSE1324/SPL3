import { AlertCircle, X } from 'lucide-react';

/**
 * ErrorToast
 * ----------
 * Fixed-position error notification shown in the bottom-right corner.
 */
export function ErrorToast({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      background: '#7f1d1d', border: '1px solid #ef4444',
      borderRadius: 10, padding: '14px 18px',
      maxWidth: 380, display: 'flex', gap: 10,
      alignItems: 'flex-start', zIndex: 1000,
    }}>
      <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#fca5a5' }}>Error</div>
        <div style={{ fontSize: 12, color: '#fecaca', marginTop: 4 }}>{message}</div>
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', marginLeft: 'auto' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
