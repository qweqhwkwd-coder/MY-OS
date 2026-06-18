const QUOTES = [
  { text: 'Щастя твого тіла — це здоров\'я. Щастя твоєї душі — це спокій.', author: 'Епіктет' },
  { text: 'Ти маєш владу над своїм розумом, а не над зовнішніми подіями. Усвідом це — і знайдеш силу.', author: 'Марк Аврелій' },
  { text: 'Не витрачай часу на те, що ти не можеш зробити — але досягни найвищого в тому, що можеш.', author: 'Марк Аврелій' },
  { text: 'Почни робити потрібне, потім — можливе, і раптом опинишся, що робиш неможливе.', author: 'Франциск Асизький' },
  { text: 'Будь байдужим до того, що байдуже природі.', author: 'Марк Аврелій' },
  { text: 'Люби і прагни лише одного — чинити те, чого вимагає розум.', author: 'Марк Аврелій' },
  { text: 'Людина страждає не від того, що відбувається, а від думок про те, що відбувається.', author: 'Епіктет' },
  { text: 'Ніколи не надто пізно стати тим, ким ти міг бути.', author: 'Сенека' },
  { text: 'Майбутнє не в наших руках. Але є в наших руках сьогодення.', author: 'Сенека' },
  { text: 'Живи кожен день так, ніби це останній день твого життя, і ти ніколи не будеш жалкувати.', author: 'Марк Аврелій' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function shouldShowWelcome(): boolean {
  return localStorage.getItem('last_welcome_date') !== todayStr()
}

interface Props {
  onEnter: () => void
  streak?: number
}

export function WelcomeScreen({ onEnter, streak = 0 }: Props) {
  const quote = QUOTES[new Date().getDate() % QUOTES.length]

  function handleEnter() {
    localStorage.setItem('last_welcome_date', todayStr())
    onEnter()
  }

  const today = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      className="flex flex-col min-h-screen px-6 py-10"
      style={{ background: '#1a1a1a', color: '#f8f7f4' }}
    >
      <div className="font-mono text-xs" style={{ color: 'rgba(248,247,244,0.3)' }}>
        MY-OS · v1.0
      </div>

      <div className="flex-1 flex flex-col justify-center gap-8">
        <blockquote className="space-y-4">
          <p className="font-condensed text-2xl font-semibold leading-snug">
            «{quote.text}»
          </p>
          <footer className="font-mono text-sm" style={{ color: 'rgba(248,247,244,0.4)' }}>
            — {quote.author}
          </footer>
        </blockquote>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs" style={{ color: 'rgba(248,247,244,0.4)' }}>
          <span>{today}</span>
          {streak > 0 && <span>{streak}🔥</span>}
        </div>
        <button
          onClick={handleEnter}
          className="w-full py-4 font-condensed font-semibold text-base"
          style={{
            background: '#f8f7f4',
            color: '#1a1a1a',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          Відкрити систему →
        </button>
      </div>
    </div>
  )
}
