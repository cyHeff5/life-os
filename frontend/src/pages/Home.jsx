import { useNavigate } from 'react-router-dom'

const APPS = [
  { id: 'calendar', label: 'Kalender',   symbol: '◈', path: '/calendar'  },
  { id: 'projects', label: 'Projekte',   symbol: '◉', path: '/projects'  },
  { id: 'docs',     label: 'Dokumente',  symbol: '◎', path: '/docs'      },
  { id: 'fitness',  label: 'Fitness',    symbol: '◇', path: '/fitness'   },
  { id: 'calories', label: 'Kalorien',   symbol: '○', path: '/calories'  },
  { id: 'stocks',   label: 'Aktien',     symbol: '◈', path: '/stocks'    },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#050909] flex flex-col items-center justify-center p-8">
      <div className="mb-12 text-center">
        <p className="text-[13px] uppercase tracking-[0.6em] text-[#3a7070] mb-2">── personal ──</p>
        <h1 className="text-[22px] uppercase tracking-[0.5em] text-[#00a0a0]">LIFE OS</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[480px]">
        {APPS.map(app => (
          <button
            key={app.id}
            onClick={() => navigate(app.path)}
            className="group flex flex-col items-center gap-3 p-6 border border-[#1e4040] hover:border-[#3a7070] bg-[#080e0e] hover:bg-[#0d1e1e] transition-all"
          >
            <span className="text-[28px] text-[#2a6060] group-hover:text-[#00a0a0] transition-colors">
              {app.symbol}
            </span>
            <span className="text-[13px] uppercase tracking-[0.25em] text-[#2a6060] group-hover:text-[#5aacac] transition-colors">
              {app.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
