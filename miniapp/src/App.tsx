import { useState, useEffect, useRef } from 'react'
import { api } from './api'
import type { ProfileData } from './api'
import { useToast } from './components/Toast'
import { profileMilestones } from './utils'
import { WelcomeScreen, shouldShowWelcome } from './components/WelcomeScreen'
import { SysBar } from './components/SysBar'
import { NavGrid } from './components/NavGrid'
import { ProfileModal } from './components/ProfileModal'
import type { Theme } from './components/ProfileModal'
import { Today } from './pages/Today'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'
import { Notes } from './pages/Notes'
import { Diary } from './pages/Diary'

type View = 'today' | 'water' | 'rituals' | 'tasks' | 'food' | 'notes' | 'diary'

export default function App() {
  const { push } = useToast()
  const [initData, setInitData] = useState('')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('today')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => { try { return shouldShowWelcome() } catch { return false } })
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('theme') as Theme) || 'auto' } catch { return 'auto' }
  })

  useEffect(() => {
    let mounted = true
    const check = setInterval(() => {
      const tg = window.Telegram?.WebApp
      if (tg?.initData) {
        clearInterval(check)
        tg.ready()
        tg.expand()
        if (mounted) {
          setInitData(tg.initData)
          setReady(true)
        }
      }
    }, 50)
    const fallback = setTimeout(() => {
      clearInterval(check)
      window.Telegram?.WebApp?.ready()
      if (mounted) setReady(true)
    }, 5000)
    return () => { mounted = false; clearInterval(check); clearTimeout(fallback) }
  }, [])

  useEffect(() => {
    if (initData) refreshProfile()
  }, [initData])

  useEffect(() => {
    try { localStorage.setItem('theme', theme) } catch {}
    try {
      if (theme === 'auto') {
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
        if (mq) {
          const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
          apply()
          mq.addEventListener('change', apply)
          return () => mq.removeEventListener('change', apply)
        } else {
          document.documentElement.setAttribute('data-theme', 'light')
        }
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [theme])

  const prevProfileRef = useRef<ProfileData | null>(null)

  function refreshProfile() {
    if (!initData) return
    api.profile(initData).then(next => {
      const prev = prevProfileRef.current
      if (prev) {
        for (const m of profileMilestones(prev, next)) push(m.text, m.size)
      }
      prevProfileRef.current = next
      setProfile(next)
    }).catch(() => {})
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>…</span>
    </div>
  )

  if (!initData) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 gap-4" style={{ background: 'var(--bg)' }}>
      <div className="font-condensed font-bold text-2xl" style={{ color: 'var(--ink)' }}>MY-OS</div>
      <div className="font-condensed text-sm" style={{ color: 'var(--muted)' }}>Відкрий через Telegram</div>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 font-condensed font-semibold text-sm"
        style={{ background: '#1a1a1a', color: '#f8f7f4', border: 'none', cursor: 'pointer' }}
      >
        Спробувати ще раз
      </button>
    </div>
  )

  if (showWelcome) return (
    <WelcomeScreen onEnter={() => setShowWelcome(false)} streak={profile?.streak} />
  )

  const page = (() => {
    switch (view) {
      case 'today':   return <Today initData={initData} onDataChange={refreshProfile} />
      case 'water':   return <Water initData={initData} onDataChange={refreshProfile} />
      case 'rituals': return <Rituals initData={initData} onDataChange={refreshProfile} />
      case 'tasks':   return <Tasks initData={initData} onDataChange={refreshProfile} />
      case 'food':    return <Food initData={initData} kcalGoal={profile?.kcal_goal} />
      case 'notes':   return <Notes initData={initData} onDataChange={refreshProfile} />
      case 'diary':   return <Diary initData={initData} onDataChange={refreshProfile} />
    }
  })()

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      <SysBar profile={profile} onProfileClick={() => setProfileOpen(true)} />
      <NavGrid activeView={view} onNavigate={(v) => setView(v as View)} />
      <div className="flex-1 overflow-y-auto">{page}</div>
      {profileOpen && profile && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
          theme={theme}
          onThemeChange={setTheme}
          initData={initData}
        />
      )}
      {profileOpen && !profile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(26,26,26,0.8)' }}
          onClick={() => setProfileOpen(false)}
        >
          <div className="font-mono text-sm" style={{ color: '#f8f7f4' }}>Профіль недоступний</div>
        </div>
      )}
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
