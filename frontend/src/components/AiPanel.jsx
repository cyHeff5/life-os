import { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'

const SPRITES = {
  idle:     '/sprites/Alter_Ego_Sprite_Danganronpa_1_291.webp',
  thinking: '/sprites/Alter_Ego_Sprite_Danganronpa_1_294.webp',
  talking:  '/sprites/Alter_Ego_Sprite_Danganronpa_1_29.webp',
}

function Avatar({ state }) {
  const src = SPRITES[state] || SPRITES.idle
  return (
    <div className="relative flex-shrink-0">
      <img
        src={src}
        alt="avatar"
        key={src}
        className="w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 20px rgba(0,160,160,0.15)' }} />
    </div>
  )
}

export function AiPanel({ app, onClose, extraContext = null, onAiResponse = null }) {
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [avatarState, setAvatarState] = useState('idle')

  useEffect(() => {
    api.getChatHistory(app).then(history => {
      setMessages(history.map(m => ({ role: m.role, content: m.content })))
    }).catch(() => {})
  }, [app])
  const [panel, setPanel]             = useState('chat') // 'chat' | 'log' | 'mem'
  const [showSprite, setShowSprite]   = useState(() => localStorage.getItem('ai_sprite') !== 'hidden')

  // MEM state
  const [memTab, setMemTab]       = useState('general') // 'general' | 'app'
  const [context, setContext]     = useState({ general: '', app: '' })
  const [editing, setEditing]     = useState(false)
  const [editValue, setEditValue] = useState('')
  const [memLoading, setMemLoading] = useState(false)

  const talkTimerRef = useRef(null)

  const showAvatar = showSprite && panel === 'chat'

  // Load context when MEM panel opens
  useEffect(() => {
    if (panel !== 'mem') return
    api.getContext(app).then(setContext).catch(() => {})
  }, [panel, app])

  const toggleSprite = (val) => {
    setShowSprite(val)
    localStorage.setItem('ai_sprite', val ? 'visible' : 'hidden')
  }

  const switchPanel = (next) => {
    setPanel(next)
    setEditing(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    setAvatarState('thinking')
    clearTimeout(talkTimerRef.current)
    try {
      const { response } = await api.chat(app, text, extraContext)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
      if (onAiResponse) onAiResponse()
      setAvatarState('talking')
      talkTimerRef.current = setTimeout(() => setAvatarState('idle'), 5000)
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Fehler: ' + e.message }])
      setAvatarState('idle')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const startEdit = () => {
    setEditValue(memTab === 'general' ? context.general : context.app)
    setEditing(true)
  }

  const saveEdit = async () => {
    setMemLoading(true)
    try {
      const patch = memTab === 'general' ? { general: editValue } : { app: editValue }
      const updated = await api.updateContext(app, patch)
      setContext(updated)
      setEditing(false)
    } catch (e) {
      // keep editing open on error
    } finally {
      setMemLoading(false)
    }
  }

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')

  return (
    <div
      className="fixed right-4 bottom-20 z-50 w-[400px] bg-[#080e0e] border border-[#3a7070] flex flex-col overflow-hidden"
      style={{ animation: 'panel-in 0.2s ease-out', height: 520 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e4040] flex-shrink-0">
        <span className="text-[14px] uppercase tracking-[0.3em] text-[#00a0a0]">KI</span>
        <span className="text-[13px] text-[#3a7070] uppercase tracking-widest">{app}</span>
        <div className="flex-1" />
        <button
          onClick={() => switchPanel(panel === 'log' ? 'chat' : 'log')}
          className={`text-[13px] uppercase tracking-[0.2em] border px-2 py-0.5 transition-colors mr-1 ${
            panel === 'log'
              ? 'border-[#00a0a0] text-[#00a0a0]'
              : 'border-[#3a7070] text-[#4a9090] hover:text-[#5aacac]'
          }`}
        >LOG</button>
        <button
          onClick={() => switchPanel(panel === 'mem' ? 'chat' : 'mem')}
          className={`text-[13px] uppercase tracking-[0.2em] border px-2 py-0.5 transition-colors mr-2 ${
            panel === 'mem'
              ? 'border-[#00a0a0] text-[#00a0a0]'
              : 'border-[#3a7070] text-[#4a9090] hover:text-[#5aacac]'
          }`}
        >MEM</button>
        <button onClick={onClose} className="text-[#4a9090] hover:text-[#5aacac] transition-colors">✕</button>
      </div>

      {/* Main area */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* CHAT */}
        {panel === 'chat' && (
          <div className="h-full p-3">
            {loading ? (
              <div className="border border-[#3a7070] bg-[#0d1e1e] px-3 py-2.5 text-[#4a9090] h-full">···</div>
            ) : lastAssistant ? (
              <div
                key={lastAssistant.content?.slice(0, 30)}
                className="border border-[#3a7070] bg-[#0d1e1e] px-3 py-2.5 text-[15px] text-[#5aacac] leading-relaxed overflow-y-auto h-full animate-fade-in"
              >
                {lastAssistant.content}
              </div>
            ) : (
              <div className="border border-[#1e4040] h-full flex items-center justify-center">
                <span className="text-[14px] text-[#3a7070] uppercase tracking-widest">bereit</span>
              </div>
            )}
          </div>
        )}

        {/* LOG */}
        {panel === 'log' && (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-[13px] text-[#3a7070] text-center mt-4">Noch keine Nachrichten.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-2.5 py-1.5 text-[15px] leading-relaxed border ${
                  m.role === 'user'
                    ? 'border-[#00a0a0] text-[#00cccc]'
                    : 'border-[#3a7070] text-[#5aacac]'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MEM */}
        {panel === 'mem' && (
          <div className="h-full flex flex-col">
            {/* Tab switcher */}
            <div className="flex border-b border-[#1e4040] flex-shrink-0">
              <button
                onClick={() => { setMemTab('general'); setEditing(false) }}
                className={`flex-1 py-1.5 text-[13px] uppercase tracking-[0.2em] transition-colors ${
                  memTab === 'general'
                    ? 'text-[#00cccc] border-b-2 border-[#00a0a0]'
                    : 'text-[#4a9090] hover:text-[#5aacac]'
                }`}
              >Allgemein</button>
              <button
                onClick={() => { setMemTab('app'); setEditing(false) }}
                className={`flex-1 py-1.5 text-[13px] uppercase tracking-[0.2em] transition-colors ${
                  memTab === 'app'
                    ? 'text-[#00cccc] border-b-2 border-[#00a0a0]'
                    : 'text-[#4a9090] hover:text-[#5aacac]'
                }`}
              >{app}</button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
              {editing ? (
                <>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="flex-1 resize-none bg-[#0d1e1e] border border-[#3a7070] px-3 py-2 text-[14px] text-[#5aacac] focus:outline-none focus:border-[#00a0a0] font-mono leading-relaxed"
                  />
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={saveEdit}
                      disabled={memLoading}
                      className="flex-1 py-1.5 text-[13px] uppercase tracking-[0.2em] border border-[#00a0a0] text-[#00a0a0] hover:text-[#00cccc] transition-colors disabled:opacity-40"
                    >Speichern</button>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 py-1.5 text-[13px] uppercase tracking-[0.2em] border border-[#3a7070] text-[#4a9090] hover:text-[#5aacac] transition-colors"
                    >Abbrechen</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-h-0 overflow-y-auto border border-[#1e4040] bg-[#0d1e1e] px-3 py-2.5 text-[14px] text-[#5aacac] leading-relaxed whitespace-pre-wrap">
                    {(memTab === 'general' ? context.general : context.app) || (
                      <span className="text-[#3a7070]">(leer)</span>
                    )}
                  </div>
                  <button
                    onClick={startEdit}
                    className="flex-shrink-0 py-1.5 text-[13px] uppercase tracking-[0.2em] border border-[#3a7070] text-[#4a9090] hover:border-[#00a0a0] hover:text-[#00a0a0] transition-colors"
                  >Bearbeiten</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Avatar — only in chat mode */}
      {showAvatar && (
        <div className="flex-shrink-0 relative">
          <Avatar state={avatarState} />
          <button
            onClick={() => toggleSprite(false)}
            className="absolute bottom-2 right-2 text-[13px] text-[#3a7070] hover:text-[#5aacac] border border-[#3a7070] px-1.5 py-0.5 bg-[#080e0e] transition-colors"
          >hide</button>
        </div>
      )}
      {!showAvatar && panel === 'chat' && (
        <div className="flex-shrink-0 flex justify-end px-2 py-1 border-t border-[#1e4040]">
          <button
            onClick={() => toggleSprite(true)}
            className="text-[13px] text-[#3a7070] hover:text-[#5aacac] border border-[#3a7070] px-1.5 py-0.5 transition-colors"
          >show sprite</button>
        </div>
      )}

      {/* Input */}
      <div className="flex border-t border-[#1e4040] flex-shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="..."
          rows={1}
          className="flex-1 resize-none bg-transparent border-r border-[#1e4040] px-3 py-2.5 text-[16px] text-[#00cccc] placeholder-[#3a7070] focus:outline-none font-mono leading-tight"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 text-[18px] text-[#5aacac] hover:text-[#00a0a0] disabled:opacity-20 transition-colors"
        >→</button>
      </div>
    </div>
  )
}
