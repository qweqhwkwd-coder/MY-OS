interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  font?: 'condensed' | 'mono'
  border?: 'ink' | 'subtle'
  autoFocus?: boolean
  inputMode?: 'numeric' | 'decimal' | 'text'
  type?: string
  onEnter?: () => void
  onBlur?: () => void
  multiline?: boolean
  rows?: number
}

export function TextField({
  value, onChange, placeholder, font = 'condensed', border = 'ink',
  autoFocus, inputMode, type, onEnter, onBlur, multiline, rows = 3,
}: Props) {
  const fontClass = font === 'mono' ? 'font-mono' : 'font-condensed'
  const borderColor = border === 'subtle' ? 'var(--subtle)' : 'var(--ink)'
  const className = `w-full px-0 py-3 ${fontClass} text-sm outline-none border-b focus-visible:border-b-2${multiline ? ' resize-none' : ''}`
  const style = {
    background: 'transparent',
    color: 'var(--ink)',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomColor: borderColor,
  }

  if (multiline) {
    return (
      <textarea
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        className={className}
        style={style}
      />
    )
  }

  return (
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }}
      onBlur={onBlur}
      placeholder={placeholder}
      inputMode={inputMode}
      type={type}
      className={className}
      style={style}
    />
  )
}
