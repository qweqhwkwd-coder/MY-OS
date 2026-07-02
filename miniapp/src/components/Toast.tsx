import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: string
  size: 'sm' | 'lg'
}

interface ToastContextValue {
  push: (text: string, size?: 'sm' | 'lg') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const push = useCallback((text: string, size: 'sm' | 'lg' = 'sm') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, text, size }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, size === 'lg' ? 4000 : 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div role="status" aria-live="polite" className="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 pt-3 px-4 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast-item font-mono text-center px-4 py-2 ${t.size === 'lg' ? 'text-base font-semibold' : 'text-xs'}`}
            style={{ background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
