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

// Беремо initData від Telegram WebApp або порожній рядок у браузері
function getInitData(): string {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData
  }
  return ''
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [initData] = useState(getInitData)

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [])

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
