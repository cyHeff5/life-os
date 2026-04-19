import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiPanel } from './AiPanel'

export function AppShell({ app, label, children, extraContext = null, onAiResponse = null }) {
  const [aiOpen, setAiOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="h-screen bg-[#050909] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1e4040] flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-[15px] uppercase tracking-[0.2em] text-[#2a6060] hover:text-[#5aacac] transition-colors px-2 py-1 border border-transparent hover:border-[#3a7070]"
        >← Life OS</button>
        <span className="text-[13px] text-[#1e4040]">/</span>
        <span className="text-[15px] uppercase tracking-[0.3em] text-[#00a0a0]">{label}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>

      {/* AI toggle */}
      <button
        onClick={() => setAiOpen(v => !v)}
        className={`fixed bottom-5 right-5 z-40 px-3 py-2 border border-dashed text-[14px] uppercase tracking-[0.2em] bg-[#050909] transition-colors ${
          aiOpen
            ? 'border-[#00a0a0] text-[#00cccc]'
            : 'border-[#3a7070] text-[#2a6060] hover:border-[#1a4a4a] hover:text-[#5aacac]'
        }`}
      >
        {aiOpen ? '✕' : '◈ KI'}
      </button>

      {aiOpen && <AiPanel app={app} onClose={() => setAiOpen(false)} extraContext={extraContext} onAiResponse={onAiResponse} />}
    </div>
  )
}
