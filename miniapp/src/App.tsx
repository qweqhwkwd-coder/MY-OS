import { useState, useEffect } from 'react'
import { Today } from './pages/Today'
import { Stats } from './pages/Stats'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'

type Tab = 'today' | 'stats' | 'water' | 'rituals' | 'tasks' | 'food'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Сьогодні', icon: '📅' },
  { id: 'stats', label: 'Стати', icon: '⚔️' },
  { id: 'water', label: 'Вода', icon: '💧' },
  { id: 'rituals', label: 'Ритуали', icon: '🔥' },
  { id: 'tasks', label: 'Завдання', icon: '✅' },
  { id: 'food', label: 'Їжа', icon: '🍽' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [initData, setInitData] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Чекаємо поки initData стане непорожнім (WebApp ініціалізується асинхронно)
    const check = setInterval(() => {
      const tg = window.Telegram?.WebApp
      if (tg?.initData) {
        clearInterval(check)
        tg.ready()
        tg.expand()
        setInitData(tg.initData)
        setReady(true)
      }
    }, 50)
    // Через 5 секунд здаємось (відкрито не в Telegram)
    const fallback = setTimeout(() => {
      clearInterval(check)
      window.Telegram?.WebApp?.ready()
      setReady(true)
    }, 5000)
    return () => { clearInterval(check); clearTimeout(fallback) }
  }, [])

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-white/50">Завантаження...</div>
    </div>
  )
  if (!initData) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 gap-4">
      <div className="text-4xl">🚀</div>
      <div className="text-white font-bold text-lg">MY-OS</div>
      <div className="text-white/50 text-sm">
        Не вдалось отримати дані від Telegram.
      </div>
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-500 hover:bg-blue-400 px-6 py-3 rounded-2xl text-white font-bold"
      >
        Спробувати ще раз
      </button>
    </div>
  )

  const page = (() => {
    switch (tab) {
      case 'today': return <Today initData={initData} />
      case 'stats': return <Stats initData={initData} />
      case 'water': return <Water initData={initData} />
      case 'rituals': return <Rituals initData={initData} />
      case 'tasks': return <Tasks initData={initData} />
      case 'food': return <Food initData={initData} />
    }
  })()

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--tg-theme-bg-color, #1a1a2e)' }}>
      {/* Контент */}
      <div className="flex-1 overflow-y-auto pb-20">
        {page}
      </div>

      {/* Навігація знизу */}
      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-white/10"
           style={{ background: 'var(--tg-theme-secondary-bg-color, #16213e)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
              tab === t.id ? 'text-blue-400' : 'text-white/40'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        ready: () => void
        expand: () => void
      }
    }
  }
}
