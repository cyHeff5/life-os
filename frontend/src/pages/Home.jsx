import { useNavigate } from 'react-router-dom'

const APPS = [
  { id: 'calendar', label: 'Kalender',   symbol: '◈', path: '/calendar'  },
  { id: 'projects', label: 'Projekte',   symbol: '◉', path: '/projects'  },
  { id: 'docs',     label: 'Dokumente',  symbol: '◎', path: '/docs'      },
  { id: 'fitness',  label: 'Fitness',    symbol: '◇', path: '/fitness'   },
  { id: 'calories', label: 'Kalorien',   symbol: '○', path: '/calories'  },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#050909] flex flex-col items-center justify-center p-8">
      <div className="mb-12 text-center">
        <p className="text-[11px] uppercase tracking-[0.6em] text-[#1a4040] mb-2">── personal ──</p>
        <h1 className="text-[22px] uppercase tracking-[0.5em] text-[#00a0a0]">LIFE OS</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[480px]">
        {APPS.map(app => (
          <button
            key={app.id}
            onClick={() => navigate(app.path)}
            className="group flex flex-col items-center gap-3 p-6 border border-[#0f2828] hover:border-[#1a4040] bg-[#080e0e] hover:bg-[#0a1414] transition-all"
          >
            <span className="text-[28px] text-[#2a6060] group-hover:text-[#00a0a0] transition-colors">
              {app.symbol}
            </span>
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#2a6060] group-hover:text-[#5aacac] transition-colors">
              {app.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
