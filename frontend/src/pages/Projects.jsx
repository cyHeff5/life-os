import { useState, useEffect, useRef, useCallback } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../api/client'

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 56
const START_HOUR  = 7
const END_HOUR    = 23
const SNAP_PX     = HOUR_HEIGHT / 4
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const PROJECT_COLORS = [
  '#00a0a0', '#6366f1', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#8b5cf6', '#06b6d4',
]

const PRIORITY_COLOR = { high: '#ef4444', medium: '#00a0a0', low: '#2a6060' }

// ── Helpers ────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }

function parseDate(s) {
  if (!s) return new Date()
  if (s.endsWith('Z') || s.includes('+')) return new Date(s)
  return new Date(s + 'Z')
}

function timeToY(hour, minute = 0) {
  return (hour - START_HOUR + minute / 60) * HOUR_HEIGHT
}

function snapY(y) { return Math.round(y / SNAP_PX) * SNAP_PX }

function yToTime(y) {
  const snapped   = Math.max(0, snapY(y))
  const totalMins = (snapped / HOUR_HEIGHT) * 60
  const rawH      = Math.floor(totalMins / 60) + START_HOUR
  const rawM      = Math.round(totalMins % 60)
  const hour      = rawM >= 60 ? rawH + 1 : rawH
  const minute    = rawM >= 60 ? 0 : rawM
  return { hour: Math.min(hour, END_HOUR - 1), minute }
}

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

// ── WP Card ────────────────────────────────────────────────────────────────
function WpCard({ wp, projectColor, onToggleDone, onDelete }) {
  const isDone = wp.status === 'done'

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: wp.id,
      title: wp.title,
      estimated_hours: wp.estimated_hours || 1,
      color: projectColor || wp.color || '#00a0a0',
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group flex items-start gap-2 p-2.5 border border-[#0f2828] bg-[#080e0e] hover:border-[#1a4040] transition-colors mb-1.5 cursor-grab active:cursor-grabbing ${
        isDone ? 'opacity-40' : ''
      }`}
    >
      {/* Priority dot */}
      <div
        className="w-1.5 h-1.5 mt-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOR[wp.priority] || PRIORITY_COLOR.medium }}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${isDone ? 'line-through text-[#2a6060]' : 'text-[#5aacac]'}`}>
          {wp.title}
        </p>
        {wp.description && !isDone && (
          <p className="text-[11px] text-[#2a6060] mt-0.5 leading-snug truncate">{wp.description}</p>
        )}
        {wp.estimated_hours && (
          <p className="text-[10px] text-[#1a4040] mt-0.5">{wp.estimated_hours}h</p>
        )}
      </div>

      {/* Done toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDone(wp.id, isDone) }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex-shrink-0 text-[22px] leading-none transition-colors mt-0.5 ${
          isDone ? 'text-[#00a0a0] hover:text-[#2a6060]' : 'text-[#1a4040] hover:text-[#5aacac]'
        }`}
      >
        {isDone ? '✓' : '○'}
      </button>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(wp.id) }}
        onMouseDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-[#1a4040] hover:text-[#cc2222] text-[11px] transition-all flex-shrink-0 mt-0.5"
      >✕</button>
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────
function KanbanColumn({ area, projectColor, onToggleDone, onDeleteWp, onDeleteArea, onAddWp }) {
  const [newTitle, setNewTitle] = useState('')
  const open  = area.work_packages.filter(wp => wp.status !== 'done').length
  const total = area.work_packages.length

  const handleAdd = async (e) => {
    if (e.key !== 'Enter' || !newTitle.trim()) return
    await onAddWp(area.id, { title: newTitle.trim() })
    setNewTitle('')
  }

  return (
    <div className="flex-shrink-0 w-[260px] border-r border-[#0f2828] flex flex-col bg-[#050909]">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#0f2828] flex-shrink-0">
        <span className="text-[12px] uppercase tracking-[0.2em] text-[#5aacac]">{area.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#1a4040]">{open}/{total}</span>
          <button
            onClick={() => onDeleteArea(area.id)}
            className="text-[#1a4040] hover:text-[#cc2222] text-[11px] transition-colors"
          >✕</button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-2">
        {area.work_packages.map(wp => (
          <WpCard
            key={wp.id}
            wp={wp}
            projectColor={projectColor}
            onToggleDone={onToggleDone}
            onDelete={onDeleteWp}
          />
        ))}
      </div>

      {/* Add WP input */}
      <div className="px-2 py-2 border-t border-[#0f2828] flex-shrink-0">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={handleAdd}
          placeholder="+ Aufgabe hinzufügen"
          className="w-full bg-transparent text-[12px] text-[#5aacac] placeholder-[#1a4040] focus:outline-none px-1 py-0.5"
        />
      </div>
    </div>
  )
}

// ── Mini Calendar Panel (today only, for Projects page) ───────────────────
function ProjectCalendar({ onClose }) {
  const [events, setEvents]     = useState([])
  const [dragOver, setDragOver] = useState(null)
  const [moving, setMoving]     = useState(null)
  const [moveTop, setMoveTop]   = useState(null)
  const [resizing, setResizing] = useState(null)
  const [resizeHeight, setResizeHeight] = useState(null)

  const scrollRef = useRef(null)
  const gridRef   = useRef(null)

  const loadEvents = useCallback(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 86400000)
    const evs = await api.getCalendarEvents(today.toISOString(), tomorrow.toISOString())
    setEvents(evs)
  }, [])

  useEffect(() => {
    loadEvents()
    if (scrollRef.current) {
      const off = Math.max(0, (new Date().getHours() - START_HOUR - 1) * HOUR_HEIGHT)
      scrollRef.current.scrollTop = off
    }
  }, [loadEvents])

  const getGridY = (clientY) => {
    if (!gridRef.current) return 0
    return clientY - gridRef.current.getBoundingClientRect().top
  }

  // ── WP drag-drop ──
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const { hour, minute } = yToTime(getGridY(e.clientY))
    setDragOver({ hour, minute })
  }

  const handleDragLeave = (e) => {
    if (!gridRef.current?.contains(e.relatedTarget)) setDragOver(null)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(null)
    let wp
    try { wp = JSON.parse(e.dataTransfer.getData('application/json')) } catch { return }
    const { hour, minute } = yToTime(getGridY(e.clientY))
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute)
    const end   = new Date(start.getTime() + (wp.estimated_hours || 1) * 3600000)

    const tempId = `temp-${Date.now()}`
    setEvents(prev => [...prev, {
      id: tempId, title: wp.title,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: wp.color || '#00a0a0',
    }])

    try {
      const created = await api.createCalendarEvent({
        title: wp.title,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        color: wp.color || '#00a0a0',
        work_package_id: wp.id,
      })
      setEvents(prev => prev.map(ev => ev.id === tempId ? created : ev))
      // Mark WP as scheduled
      api.updatePackage(wp.id, { is_scheduled: true }).catch(() => {})
    } catch {
      setEvents(prev => prev.filter(ev => ev.id !== tempId))
    }
  }

  // ── Move ──
  const startMove = (e, event) => {
    if (e.button !== 0) return
    e.preventDefault()
    const origTop = timeToY(parseDate(event.start_time).getHours(), parseDate(event.start_time).getMinutes())
    setMoving({ event, grabOffsetY: getGridY(e.clientY) - origTop })
    setMoveTop(origTop)
  }

  // ── Resize ──
  const startResize = (e, event) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const dur = parseDate(event.end_time) - parseDate(event.start_time)
    setResizing({ event })
    setResizeHeight(Math.max(SNAP_PX, (dur / 3600000) * HOUR_HEIGHT))
  }

  const handleMouseMove = useCallback((e) => {
    const y = getGridY(e.clientY)
    if (moving) {
      const raw     = Math.max(0, y - moving.grabOffsetY)
      const snapped = Math.min(snapY(raw), (END_HOUR - START_HOUR) * HOUR_HEIGHT - SNAP_PX)
      setMoveTop(snapped)
    }
    if (resizing) {
      const origTop = timeToY(
        parseDate(resizing.event.start_time).getHours(),
        parseDate(resizing.event.start_time).getMinutes()
      )
      setResizeHeight(Math.max(SNAP_PX, snapY(y - origTop)))
    }
  }, [moving, resizing])

  const handleMouseUp = useCallback(async () => {
    if (moving && moveTop != null) {
      const { hour, minute } = yToTime(moveTop)
      const dur = parseDate(moving.event.end_time) - parseDate(moving.event.start_time)
      const today = new Date()
      const newStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute)
      const newEnd   = new Date(newStart.getTime() + dur)
      setEvents(prev => prev.map(ev =>
        ev.id === moving.event.id
          ? { ...ev, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
          : ev
      ))
      api.updateCalendarEvent(moving.event.id, {
        start_time: newStart.toISOString(), end_time: newEnd.toISOString(),
      }).catch(() => loadEvents())
    }
    if (resizing && resizeHeight != null) {
      const origStart = parseDate(resizing.event.start_time)
      const newEnd    = new Date(origStart.getTime() + (resizeHeight / HOUR_HEIGHT) * 3600000)
      setEvents(prev => prev.map(ev =>
        ev.id === resizing.event.id ? { ...ev, end_time: newEnd.toISOString() } : ev
      ))
      api.updateCalendarEvent(resizing.event.id, { end_time: newEnd.toISOString() }).catch(() => loadEvents())
    }
    setMoving(null); setMoveTop(null)
    setResizing(null); setResizeHeight(null)
  }, [moving, moveTop, resizing, resizeHeight, loadEvents])

  useEffect(() => {
    if (!moving && !resizing) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [moving, resizing, handleMouseMove, handleMouseUp])

  const deleteEvent = async (id) => {
    const ev = events.find(e => e.id === id)
    await api.deleteCalendarEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    if (ev?.work_package_id) {
      api.updatePackage(ev.work_package_id, { is_scheduled: false }).catch(() => {})
    }
  }

  // Current time
  const now    = new Date()
  const nowTop = (now.getHours() + now.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT
  const showNow = now.getHours() >= START_HOUR && now.getHours() < END_HOUR

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-[#0f2828] flex flex-col bg-[#050909]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#0f2828] flex-shrink-0">
        <span className="text-[11px] uppercase tracking-[0.25em] text-[#5aacac]">
          Heute — {now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
        </span>
        <button onClick={onClose} className="text-[#2a6060] hover:text-[#cc2222] text-[13px] transition-colors">✕</button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{
          cursor: moving ? 'grabbing' : resizing ? 'ns-resize' : 'default',
          userSelect: (moving || resizing) ? 'none' : undefined,
        }}
      >
        <div
          ref={gridRef}
          className="relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Hour lines */}
          {HOURS.map(h => (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="text-[10px] text-[#1a4040] w-9 pl-2 pt-0.5 flex-shrink-0 tabular-nums">{pad(h)}</span>
              <div className="flex-1 border-t border-[#0f2828] mt-px" />
            </div>
          ))}

          {/* Current time line */}
          {showNow && (
            <div
              className="absolute left-0 right-0 flex items-center z-30 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="w-1 h-1 bg-[#00cccc] ml-8 flex-shrink-0" />
              <div className="flex-1 h-px bg-[#00cccc] opacity-40" />
            </div>
          )}

          {/* WP drag ghost */}
          {dragOver && (
            <div
              className="absolute left-9 right-1 bg-[#00a0a0] opacity-20 pointer-events-none z-10 rounded-sm"
              style={{ top: timeToY(dragOver.hour, dragOver.minute), height: HOUR_HEIGHT }}
            />
          )}
          {dragOver && (
            <div
              className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
              style={{ top: timeToY(dragOver.hour, dragOver.minute) }}
            >
              <span className="text-[10px] text-[#00cccc] w-9 pl-1 tabular-nums">
                {pad(dragOver.hour)}:{pad(dragOver.minute)}
              </span>
              <div className="flex-1 h-px bg-[#00cccc] opacity-60" />
            </div>
          )}

          {/* Events */}
          {events.map(ev => {
            const isMoving   = moving?.event.id === ev.id
            const isResizing = resizing?.event.id === ev.id
            const origStart  = parseDate(ev.start_time)
            const origEnd    = parseDate(ev.end_time)
            const top    = isMoving && moveTop != null ? moveTop : timeToY(origStart.getHours(), origStart.getMinutes())
            const height = isResizing && resizeHeight != null ? resizeHeight
              : Math.max(SNAP_PX, ((origEnd - origStart) / 3600000) * HOUR_HEIGHT)

            const { hour: sh, minute: sm } = yToTime(top)
            let eh, em
            if (isResizing) {
              const endD = new Date(origStart.getTime() + (resizeHeight / HOUR_HEIGHT) * 3600000)
              eh = endD.getHours(); em = endD.getMinutes()
            } else if (isMoving) {
              const endMins = sh * 60 + sm + (origEnd - origStart) / 60000
              eh = Math.floor(endMins / 60) % 24; em = endMins % 60
            } else {
              eh = origEnd.getHours(); em = origEnd.getMinutes()
            }

            return (
              <div
                key={ev.id}
                className={`absolute left-9 right-1 rounded-sm px-1.5 py-0.5 overflow-hidden group select-none ${
                  isMoving ? 'opacity-70 z-20 cursor-grabbing' : 'z-10 cursor-grab'
                }`}
                style={{ top, height, backgroundColor: (ev.color || '#00a0a0') + '22', borderLeft: `2px solid ${ev.color || '#00a0a0'}` }}
                onMouseDown={(e) => startMove(e, ev)}
              >
                <p className="text-[11px] text-[#00cccc] truncate leading-tight pointer-events-none">{ev.title}</p>
                <p className="text-[10px] pointer-events-none">
                  {(isMoving || isResizing)
                    ? <span className="text-[#00cccc]">{pad(sh)}:{pad(sm)} – {pad(eh)}:{pad(em)}</span>
                    : <span className="text-[#2a6060]">{pad(origStart.getHours())}:{pad(origStart.getMinutes())} – {pad(origEnd.getHours())}:{pad(origEnd.getMinutes())}</span>
                  }
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id) }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute top-0.5 right-1 opacity-0 group-hover:opacity-100 text-[#cc2222] text-[10px] z-30"
                >✕</button>
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20"
                  onMouseDown={(e) => { e.stopPropagation(); startResize(e, ev) }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Project Grid ───────────────────────────────────────────────────────────
function ProjectGrid({ projects, onSelect, onAdd }) {
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [adding, setAdding]     = useState(false)

  const handleAdd = async (e) => {
    if (e.key !== 'Enter' || !newName.trim()) return
    await onAdd({ name: newName.trim(), color: newColor })
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="p-6 overflow-y-auto no-scrollbar h-full">
      <div className="grid grid-cols-3 gap-4 max-w-[900px]">
        {projects.map(p => {
          const openCount = 0  // could be fetched, but keep it simple
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="group text-left p-4 border border-[#0f2828] hover:border-[#1a4040] bg-[#080e0e] hover:bg-[#0a1414] transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-[13px] uppercase tracking-[0.2em] text-[#5aacac] group-hover:text-[#00cccc] transition-colors truncate">
                  {p.name}
                </span>
              </div>
              {p.description && (
                <p className="text-[11px] text-[#2a6060] truncate">{p.description}</p>
              )}
              <p className="text-[10px] uppercase tracking-wider text-[#1a4040] mt-2">
                {p.status === 'active' ? 'Aktiv' : p.status === 'on_hold' ? 'Pausiert' : p.status}
              </p>
            </button>
          )
        })}

        {/* Add project */}
        {adding ? (
          <div className="p-4 border border-[#1a4040] bg-[#0a1414]">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleAdd}
              onBlur={() => { if (!newName.trim()) setAdding(false) }}
              placeholder="Projektname"
              className="w-full bg-transparent text-[13px] text-[#5aacac] placeholder-[#2a6060] focus:outline-none mb-3"
            />
            <div className="flex gap-1.5 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-1 ring-offset-[#0a1414]' : ''}`}
                  style={{ backgroundColor: c, ringColor: c }}
                />
              ))}
            </div>
            <p className="text-[10px] text-[#1a4040] mt-2">Enter zum Erstellen</p>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="p-4 border border-dashed border-[#0f2828] hover:border-[#1a4040] text-[#1a4040] hover:text-[#2a6060] text-[11px] uppercase tracking-[0.3em] transition-all"
          >
            + Neues Projekt
          </button>
        )}
      </div>
    </div>
  )
}

// ── Project Detail (Kanban + optional Calendar) ────────────────────────────
function ProjectDetail({ project, onBack }) {
  const [areas, setAreas]     = useState([])
  const [calOpen, setCalOpen] = useState(false)
  const [newArea, setNewArea] = useState('')

  const loadAreas = useCallback(async () => {
    const a = await api.getAreas(project.id)
    setAreas(a)
  }, [project.id])

  useEffect(() => { loadAreas() }, [loadAreas])

  const handleToggleDone = async (wpId, isDone) => {
    const newStatus = isDone ? 'todo' : 'done'
    setAreas(prev => prev.map(a => ({
      ...a,
      work_packages: a.work_packages.map(wp =>
        wp.id === wpId ? { ...wp, status: newStatus } : wp
      ),
    })))
    api.updatePackage(wpId, { status: newStatus }).catch(() => loadAreas())
  }

  const handleDeleteWp = async (wpId) => {
    setAreas(prev => prev.map(a => ({
      ...a,
      work_packages: a.work_packages.filter(wp => wp.id !== wpId),
    })))
    api.deletePackage(wpId).catch(() => loadAreas())
  }

  const handleDeleteArea = async (areaId) => {
    setAreas(prev => prev.filter(a => a.id !== areaId))
    api.deleteArea(areaId).catch(() => loadAreas())
  }

  const handleAddWp = async (areaId, data) => {
    const wp = await api.createPackage(areaId, data)
    setAreas(prev => prev.map(a =>
      a.id === areaId ? { ...a, work_packages: [...a.work_packages, wp] } : a
    ))
  }

  const handleAddArea = async (e) => {
    if (e.key !== 'Enter' || !newArea.trim()) return
    const area = await api.createArea(project.id, { name: newArea.trim() })
    setAreas(prev => [...prev, area])
    setNewArea('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#0f2828] flex-shrink-0">
        <button
          onClick={onBack}
          className="text-[#2a6060] hover:text-[#5aacac] text-[12px] uppercase tracking-[0.2em] transition-colors"
        >‹ Projekte</button>
        <span className="text-[#0f2828]">|</span>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
        <span className="text-[13px] uppercase tracking-[0.2em] text-[#5aacac]">{project.name}</span>
        {project.description && (
          <span className="text-[11px] text-[#1a4040]">── {project.description}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setCalOpen(v => !v)}
          className={`text-[11px] uppercase tracking-[0.2em] px-3 py-1 border transition-colors ${
            calOpen
              ? 'border-[#00a0a0] text-[#00cccc]'
              : 'border-[#0f2828] text-[#2a6060] hover:border-[#1a4040] hover:text-[#5aacac]'
          }`}
        >
          {calOpen ? '✕ Kalender' : '◷ Kalender'}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex min-h-0">
          {areas.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-[12px] uppercase tracking-[0.3em] text-[#1a4040]">Noch keine Spalten</p>
            </div>
          ) : (
            areas.map(area => (
              <KanbanColumn
                key={area.id}
                area={area}
                projectColor={project.color}
                onToggleDone={handleToggleDone}
                onDeleteWp={handleDeleteWp}
                onDeleteArea={handleDeleteArea}
                onAddWp={handleAddWp}
              />
            ))
          )}

          {/* Add column */}
          <div className="flex-shrink-0 w-[220px] p-3 flex flex-col justify-start">
            <input
              value={newArea}
              onChange={e => setNewArea(e.target.value)}
              onKeyDown={handleAddArea}
              placeholder="+ Neue Spalte"
              className="bg-transparent text-[12px] text-[#2a6060] placeholder-[#1a4040] focus:outline-none px-2 py-1.5 border border-transparent focus:border-[#1a4040] transition-colors"
            />
          </div>
        </div>

        {/* Calendar panel */}
        {calOpen && <ProjectCalendar onClose={() => setCalOpen(false)} />}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function Projects() {
  const [projects, setProjects]       = useState([])
  const [selectedProject, setSelected] = useState(null)

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {})
  }, [])

  const handleAdd = async (data) => {
    const p = await api.createProject(data)
    setProjects(prev => [...prev, p])
  }

  const handleDelete = async (id) => {
    await api.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    if (selectedProject?.id === id) setSelected(null)
  }

  return (
    <AppShell app="projects" label="Projekte">
      {selectedProject ? (
        <ProjectDetail
          project={selectedProject}
          onBack={() => setSelected(null)}
        />
      ) : (
        <ProjectGrid
          projects={projects}
          onSelect={setSelected}
          onAdd={handleAdd}
        />
      )}
    </AppShell>
  )
}
