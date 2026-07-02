import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Transaction } from '../api'
import { TextField } from '../components/TextField'
import { MonoBar } from '../components/MonoBar'
import { useToast } from '../components/Toast'
import { xpToastText, haptic } from '../utils'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

// Копійки не округлюємо — трекер фінансів має показувати точні суми
function fmtAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export function Finance({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    api.finance(initData)
      .then(d => { setTxs(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  const total = txs.reduce((s, t) => s + t.amount, 0)

  const byCategory = txs.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount
    return acc
  }, {})
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const maxCat = categories[0]?.[1] ?? 0

  async function handleAdd() {
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) return
    setSaving(true)
    setSaveErr('')
    try {
      const tx = await api.addSpend(initData, num, category.trim() || 'інше')
      haptic('success')
      setTxs(prev => [tx, ...prev])
      if (tx.xp_granted) push(xpToastText(tx.xp_granted))
      setAmount('')
      setCategory('')
      onDataChange?.()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  const amountValid = parseFloat(amount.replace(',', '.')) > 0

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', letterSpacing: '0.05em', borderBottom: '1px solid var(--subtle)' }}>
        <span>7 ДНІВ</span>
        <span>{fmtAmount(total)} грн</span>
      </div>

      {/* Add form */}
      <div className="px-4 py-4 space-y-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <div className="font-condensed font-semibold text-sm">Додати витрату</div>
        {saveErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            border="subtle"
            font="mono"
            inputMode="decimal"
            value={amount}
            onChange={v => setAmount(v.replace(/[^\d.,]/g, ''))}
            placeholder="Сума"
          />
          <TextField
            border="subtle"
            value={category}
            onChange={setCategory}
            onEnter={handleAdd}
            placeholder="Категорія (їжа...)"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !amountValid}
          className="w-full py-3 font-condensed font-semibold text-sm"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving || !amountValid ? 0.5 : 1 }}
        >
          Додати
        </button>
      </div>

      {/* Category summary */}
      {categories.length > 0 && (
        <>
          <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
            ЗА КАТЕГОРІЯМИ
          </div>
          <div style={{ borderBottom: '1px solid var(--subtle)' }}>
            {categories.map(([cat, sum]) => (
              <div key={cat} className="px-4 py-3 flex items-center justify-between">
                <span className="font-condensed" style={{ fontSize: '15px' }}>{cat}</span>
                <MonoBar value={sum} max={maxCat} label={`${fmtAmount(sum)} грн`} color="var(--mod-finance)" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Transactions */}
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        ОПЕРАЦІЇ
      </div>
      {txs.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Витрат за тиждень немає.
        </div>
      )}
      {txs.map((t, i) => (
        <div key={t.id ?? i} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div>
            <span className="font-condensed text-sm">{t.category}</span>
            {t.note && <span className="font-condensed text-xs ml-2" style={{ color: 'var(--muted)' }}>{t.note}</span>}
          </div>
          <div className="text-right">
            <span className="font-mono text-sm">{fmtAmount(t.amount)}</span>
            <span className="font-mono text-xs ml-2" style={{ color: 'var(--muted)' }}>{fmtDate(t.date)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
