import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  zIndex?: number
  children: ReactNode
}

export function BottomSheet({ open, onClose, zIndex = 40, children }: Props) {
  // Each open sheet binds its own Escape listener; callers must not open two at once
  // (Today/Notes already guarantee this by construction — one modal-state var each).
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-end"
      style={{ background: 'rgba(26,26,26,0.6)', zIndex }}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
