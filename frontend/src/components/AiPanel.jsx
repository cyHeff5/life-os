import { useState, useRef } from 'react'
import { api } from '../api/client'

export function AiPanel({ app, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const talkTimerRef = useRef(null)

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const { response } = await api.chat(app, text)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Fehler: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')

  return (
    <div
      className="fixed right-4 bottom-20 z-50 w-[400px] h-[520px] bg-[#080e0e] border border-[#1a4040] flex flex-col overflow-hidden"
      style={{ animation: 'panel-in 0.2s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0f2828] flex-shrink-0">
        <span className="text-[12px] uppercase tracking-[0.3em] text-[#00a0a0]">KI</span>
        <span className="text-[11px] text-[#1a4040] uppercase tracking-widest">{app}</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowLog(v => !v)}
          className="text-[11px] uppercase tracking-[0.2em] text-[#2a6060] hover:text-[#5aacac] border border-[#1a4040] px-2 py-0.5 transition-colors mr-2"
        >LOG</button>
        <button onClick={onClose} className="text-[#2a6060] hover:text-[#5aacac] transition-colors">✕</button>
      </div>

      {/* Main area — log or speech bubble */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showLog ? (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-2.5 py-1.5 text-[13px] leading-relaxed border ${
                  m.role === 'user'
                    ? 'border-[#00a0a0] text-[#00cccc]'
                    : 'border-[#1a4040] text-[#5aacac]'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full p-3">
            {loading ? (
              <div className="border border-[#1a4040] bg-[#0a1414] px-3 py-2.5 text-[#2a6060] h-full">
                ···
              </div>
            ) : lastAssistant ? (
              <div
                key={lastAssistant.content?.slice(0, 30)}
                className="border border-[#1a4040] bg-[#0a1414] px-3 py-2.5 text-[13px] text-[#5aacac] leading-relaxed overflow-y-auto h-full animate-fade-in"
              >
                {lastAssistant.content}
              </div>
            ) : (
              <div className="border border-[#0f2828] h-full flex items-center justify-center">
                <span className="text-[12px] text-[#1a4040] uppercase tracking-widest">bereit</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex border-t border-[#0f2828] flex-shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="..."
          rows={1}
          className="flex-1 resize-none bg-transparent border-r border-[#0f2828] px-3 py-2.5 text-[14px] text-[#00cccc] placeholder-[#1a4040] focus:outline-none font-mono leading-tight"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 text-[16px] text-[#5aacac] hover:text-[#00a0a0] disabled:opacity-20 transition-colors"
        >→</button>
      </div>
    </div>
  )
}
