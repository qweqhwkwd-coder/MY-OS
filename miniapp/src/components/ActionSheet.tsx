import { useEffect, useRef, useState } from 'react'

export interface ActionSheetItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  items: ActionSheetItem[]
}

export function ActionSheet({ open, onClose, items }: Props) {
  const [armedIndex, setArmedIndex] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setArmedIndex(null)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  if (!open) return null

  function handleClick(idx: number, item: ActionSheetItem) {
    if (!item.danger) {
      onClose()
      item.onClick()
      return
    }
    if (armedIndex === idx) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setArmedIndex(null)
      onClose()
      item.onClick()
      return
    }
    setArmedIndex(idx)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setArmedIndex(null), 2500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(26,26,26,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx, item)}
            className="w-full px-6 py-4 text-left font-condensed text-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: idx < items.length - 1 ? '1px solid var(--subtle)' : 'none',
              color: item.danger && armedIndex === idx ? '#dc2626' : 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            {item.danger && armedIndex === idx ? 'Натисни ще раз' : item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
