import { useState, useEffect } from 'react'
import { api } from './api'
import type { ProfileData } from './api'
import { WelcomeScreen, shouldShowWelcome } from './components/WelcomeScreen'
import { SysBar } from './components/SysBar'
import { NavGrid } from './components/NavGrid'
import { ProfileModal } from './components/ProfileModal'
import { Today } from './pages/Today'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'

type View = 'today' | 'water' | 'rituals' | 'tasks' | 'food'

export default function App() {
  const [initData, setInitData] = useState('')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('today')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome())

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
    if (initData) {
      api.profile(initData).then(setProfile).catch(() => {})
    }
  }, [initData])

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
      case 'today':   return <Today initData={initData} />
      case 'water':   return <Water initData={initData} />
      case 'rituals': return <Rituals initData={initData} />
      case 'tasks':   return <Tasks initData={initData} />
      case 'food':    return <Food initData={initData} />
    }
  })()

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      <SysBar profile={profile} onProfileClick={() => setProfileOpen(true)} />
      <NavGrid activeView={view} onNavigate={(v) => setView(v as View)} />
      <div className="flex-1 overflow-y-auto">{page}</div>
      {profileOpen && profile && (
        <ProfileModal profile={profile} onClose={() => setProfileOpen(false)} />
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
