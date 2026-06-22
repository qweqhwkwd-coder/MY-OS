import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'

interface Props {
  onLongPress: () => void
  delay?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function LongPressButton({ onLongPress, delay = 500, className, style, children }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function start() {
    timerRef.current = setTimeout(onLongPress, delay)
  }

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  return (
    <button
      onMouseDown={start}
      onMouseUp={clear}
      onMouseLeave={clear}
      onTouchStart={start}
      onTouchEnd={clear}
      onContextMenu={e => e.preventDefault()}
      className={className}
      style={style}
    >
      {children}
    </button>
  )
}
