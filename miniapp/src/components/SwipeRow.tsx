import { useRef, useState, useEffect } from 'react'

export interface SwipeAction {
  label: string
  bgColor: string
  onClick: () => void
}

interface Props {
  id: string
  openId: string | null
  onOpen: (id: string) => void
  onClose: () => void
  actions: SwipeAction[]
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const ACTION_W = 72

export function SwipeRow({ id, openId, onOpen, onClose, actions, children, style, className }: Props) {
  const totalW = actions.length * ACTION_W
  const isOpen = openId === id
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const currentX = useRef(0)
  const touching = useRef(false)

  useEffect(() => {
    if (!isOpen) setOffset(0)
  }, [isOpen])

  function onTouchStart(e: React.TouchEvent) {
    touching.current = true
    startX.current = e.touches[0].clientX
    currentX.current = e.touches[0].clientX
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touching.current) return
    currentX.current = e.touches[0].clientX
    const base = isOpen ? -totalW : 0
    const raw = base + (currentX.current - startX.current)
    setOffset(Math.max(-totalW, Math.min(0, raw)))
  }

  function onTouchEnd() {
    touching.current = false
    const delta = currentX.current - startX.current
    const isTap = Math.abs(delta) < 5

    if (isOpen && isTap) {
      setOffset(0)
      onClose()
      return
    }

    if (offset < -totalW / 2) {
      setOffset(-totalW)
      onOpen(id)
    } else {
      setOffset(0)
      if (isOpen) onClose()
    }
  }

  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={style}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Action buttons — sit behind the content on the right */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: totalW }}>
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => { a.onClick(); onClose() }}
            className="flex items-center justify-center font-condensed text-xs font-semibold"
            style={{ width: ACTION_W, background: a.bgColor, color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Content slides left to reveal actions */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: touching.current ? 'none' : 'transform 200ms ease',
          background: 'var(--bg)',
          position: 'relative',
        }}
      >
        {isOpen && (
          <div
            className="absolute inset-0"
            style={{ zIndex: 10 }}
            onClick={() => { setOffset(0); onClose() }}
          />
        )}
        {children}
      </div>
    </div>
  )
}
