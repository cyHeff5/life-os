import { useState, useEffect, useRef, useCallback } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../api/client'
import { pad, parseDate } from '../utils'

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64
const SNAP_PX     = HOUR_HEIGHT / 4          // 15-min snap
const START_HOUR  = 7
const END_HOUR    = 23
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const VIEWS = [
  { id: 'today',  label: 'Heute'  },
  { id: '3days',  label: '3 Tage' },
  { id: 'week',   label: 'Woche'  },
]

const DE_DAYS  = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const DE_MONTH = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToY(hour, minute = 0) {
  return (hour - START_HOUR + minute / 60) * HOUR_HEIGHT
}

function snapY(y) {
  return Math.round(y / SNAP_PX) * SNAP_PX
}

function yToTime(y) {
  const snapped    = Math.max(0, snapY(y))
  const totalMins  = (snapped / HOUR_HEIGHT) * 60
  const rawH       = Math.floor(totalMins / 60) + START_HOUR
  const rawM       = Math.round(totalMins % 60)
  const hour       = rawM >= 60 ? rawH + 1 : rawH
  const minute     = rawM >= 60 ? 0 : rawM
  return { hour: Math.min(hour, END_HOUR - 1), minute }
}

function isoDay(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getViewDays(view, anchor) {
  const d = new Date(anchor)
  d.setHours(0, 0, 0, 0)
  if (view === 'today') return [new Date(d)]
  if (view === '3days') return [0, 1, 2].map(i => { const x = new Date(d); x.setDate(x.getDate() + i); return x })
  const dow  = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(x.getDate() + i); return x })
}

function navigate(view, anchor, dir) {
  const d     = new Date(anchor)
  const delta = view === 'today' ? 1 : view === '3days' ? 3 : 7
  d.setDate(d.getDate() + dir * delta)
  return d
}

function formatRange(view, days) {
  if (view === 'today') {
    const d = days[0]
    return `${DE_DAYS[d.getDay()]}, ${d.getDate()}. ${DE_MONTH[d.getMonth()]}`
  }
  const first = days[0]
  const last  = days[days.length - 1]
  if (first.getMonth() === last.getMonth())
    return `${first.getDate()}. – ${last.getDate()}. ${DE_MONTH[first.getMonth()]}`
  return `${first.getDate()}. ${DE_MONTH[first.getMonth()]} – ${last.getDate()}. ${DE_MONTH[last.getMonth()]}`
}

// ── Sub-components ─────────────────────────────────────────────────────────
function WorkPackageCard({ wp, onDone, onDragStart: onListDragStart, onDragEnter }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(wp))
    e.dataTransfer.effectAllowed = 'copy'
    onListDragStart?.()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter?.() }}
      onDragOver={(e) => e.preventDefault()}
      className="group flex items-center gap-2 px-2 py-1.5 border border-[#2a6060] hover:border-[#2a6060] bg-[#0d1e1e] cursor-grab active:cursor-grabbing transition-colors"
    >
      <span className="text-[#3a8080] group-hover:text-[#4a9090] text-[16px] flex-shrink-0">⠿</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-[#5aacac] truncate">{wp.title}</p>
        <p className="text-[12px] text-[#4a9090]">{wp.estimated_hours}h</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDone(wp.id) }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Als erledigt markieren"
        className="opacity-0 group-hover:opacity-100 w-4 h-4 border border-[#3a8080] hover:border-[#00a0a0] hover:bg-[#00a0a0] flex-shrink-0 transition-all"
      />
    </div>
  )
}

function CalendarEventBlock({
  event, overrideTop, overrideHeight,
  isMoving, isResizing,
  onDelete, onStartMove, onStartResize,
}) {
  const origStart = parseDate(event.start_time)
  const origEnd   = parseDate(event.end_time)
  const duration  = origEnd - origStart   // ms

  const top    = overrideTop    ?? timeToY(origStart.getHours(), origStart.getMinutes())
  const height = overrideHeight ?? Math.max(SNAP_PX, (duration / 3600000) * HOUR_HEIGHT)

  // Live start/end labels during interaction
  const { hour: sh, minute: sm } = yToTime(top)
  let eh, em
  if (isResizing && overrideHeight != null) {
    const endD = new Date(origStart.getTime() + (overrideHeight / HOUR_HEIGHT) * 3600000)
    eh = endD.getHours(); em = endD.getMinutes()
  } else if (isMoving) {
    const endMins = sh * 60 + sm + duration / 60000
    eh = Math.floor(endMins / 60) % 24
    em = endMins % 60
  } else {
    eh = origEnd.getHours(); em = origEnd.getMinutes()
  }

  return (
    <div
      className={`absolute left-1 right-1 rounded-sm px-1.5 py-0.5 overflow-hidden group select-none ${
        isMoving ? 'opacity-70 z-20 cursor-grabbing' : 'z-10 cursor-grab'
      }`}
      style={{ top, height, backgroundColor: event.color + '22', borderLeft: `2px solid ${event.color}` }}
      onMouseDown={(e) => { if (e.button === 0) onStartMove(e) }}
    >
      <p className="text-[13px] text-[#00cccc] truncate leading-tight pointer-events-none">{event.title}</p>
      <p className="text-[12px] pointer-events-none">
        {(isMoving || isResizing)
          ? <span className="text-[#00cccc]">{pad(sh)}:{pad(sm)} – {pad(eh)}:{pad(em)}</span>
          : <span className="text-[#4a9090]">
              {pad(origStart.getHours())}:{pad(origStart.getMinutes())} –{' '}
              {pad(origEnd.getHours())}:{pad(origEnd.getMinutes())}
            </span>
        }
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-0.5 right-1 opacity-0 group-hover:opacity-100 text-[#cc2222] text-[12px] transition-all z-30"
      >✕</button>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20"
        onMouseDown={(e) => { e.stopPropagation(); if (e.button === 0) onStartResize(e) }}
      />
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function Calendar() {
  const [view, setView]           = useState('today')
  const [anchor, setAnchor]       = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [events, setEvents]       = useState([])
  const [workPackages, setWPs]    = useState([])
  const [workoutsToday, setWorkoutsToday] = useState([])
  const [dragOver, setDragOver]   = useState(null)   // { dayKey, hour, minute } — WP drag preview
  // Move state
  const [moving, setMoving]       = useState(null)   // { event, grabOffsetY }
  const [movePos, setMovePos]     = useState(null)   // { top, dayKey }
  // Resize state
  const [resizing, setResizing]   = useState(null)   // { event }
  const [resizeHeight, setResizeHeight] = useState(null)
  const [nowY, setNowY]           = useState(null)

  const dragWPIdxRef = useRef(null)

  const handleWPDragStart = (i) => { dragWPIdxRef.current = i }
  const handleWPDragEnter = (i) => {
    const from = dragWPIdxRef.current
    if (from === null || from === i) return
    setWPs(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(i, 0, item)
      return next
    })
    dragWPIdxRef.current = i
  }

  const gridRef    = useRef(null)
  const dayColRefs = useRef({})   // dayKey → DOM element

  const days = getViewDays(view, anchor)

  // ── Data loading ──
  useEffect(() => {
    const start = days[0].toISOString()
    const end   = new Date(days[days.length - 1].getTime() + 86400000).toISOString()
    api.getCalendarEvents(start, end).then(setEvents).catch(() => {})
  }, [view, anchor.toDateString()])

  useEffect(() => {
    api.getWorkPackages().then(setWPs).catch(() => {})
    const todayIndex = (new Date().getDay() + 6) % 7  // 0=Mon
    api.getWorkoutsToday(todayIndex).then(setWorkoutsToday).catch(() => {})
  }, [])

  // ── Current time indicator ──
  useEffect(() => {
    const update = () => {
      const now = new Date()
      const y = timeToY(now.getHours(), now.getMinutes())
      setNowY(y >= 0 ? y : null)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  // ── Coordinate helpers ──
  const getGridY = useCallback((clientY) => {
    if (!gridRef.current) return 0
    const rect = gridRef.current.getBoundingClientRect()
    return clientY - rect.top + gridRef.current.scrollTop
  }, [])

  const getDayAtX = useCallback((clientX) => {
    for (const [key, el] of Object.entries(dayColRefs.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return key
    }
    return null
  }, [])

  // ── WP drop handling ──
  const handleDragOver = (e, dayKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const { hour, minute } = yToTime(getGridY(e.clientY))
    setDragOver({ dayKey, hour, minute })
  }

  const handleDrop = async (e, day) => {
    e.preventDefault()
    setDragOver(null)
    const wp = JSON.parse(e.dataTransfer.getData('application/json'))
    const { hour, minute } = yToTime(getGridY(e.clientY))

    const startTime = new Date(day)
    startTime.setHours(hour, minute, 0, 0)
    const endTime = new Date(startTime.getTime() + (wp.estimated_hours || 1) * 3600000)

    const tempId    = `temp-${Date.now()}`
    const isWorkout = !!wp.isWorkout
    const tempEvent = {
      id: tempId, title: wp.title,
      start_time: startTime.toISOString(), end_time: endTime.toISOString(),
      color: wp.color || '#00a0a0',
      work_package_id: isWorkout ? null : wp.id,
    }
    setEvents(prev => [...prev, tempEvent])

    try {
      const created = await api.createCalendarEvent({
        title: wp.title,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: wp.color || '#00a0a0',
        work_package_id: isWorkout ? null : wp.id,
      })
      setEvents(prev => prev.map(ev => ev.id === tempId ? created : ev))
    } catch {
      setEvents(prev => prev.filter(ev => ev.id !== tempId))
      if (!isWorkout) setWPs(prev => [...prev, wp])
    }
  }

  // ── Move / Resize ──
  const startMove = useCallback((e, event) => {
    const y       = getGridY(e.clientY)
    const origTop = timeToY(parseDate(event.start_time).getHours(), parseDate(event.start_time).getMinutes())
    setMoving({ event, grabOffsetY: y - origTop })
    setMovePos({ top: origTop, dayKey: isoDay(parseDate(event.start_time)) })
  }, [getGridY])

  const startResize = useCallback((e, event) => {
    const dur = parseDate(event.end_time) - parseDate(event.start_time)
    setResizing({ event })
    setResizeHeight(Math.max(SNAP_PX, (dur / 3600000) * HOUR_HEIGHT))
  }, [])

  const handleMouseMove = useCallback((e) => {
    const y = getGridY(e.clientY)
    if (moving) {
      const raw     = Math.max(0, y - moving.grabOffsetY)
      const snapped = Math.min(snapY(raw), (END_HOUR - START_HOUR) * HOUR_HEIGHT - SNAP_PX)
      const dayKey  = getDayAtX(e.clientX) ?? movePos?.dayKey
      setMovePos({ top: snapped, dayKey })
    }
    if (resizing) {
      const origTop = timeToY(
        parseDate(resizing.event.start_time).getHours(),
        parseDate(resizing.event.start_time).getMinutes()
      )
      const snapped = Math.max(SNAP_PX, snapY(y - origTop))
      setResizeHeight(snapped)
    }
  }, [moving, resizing, getGridY, getDayAtX, movePos])

  const handleMouseUp = useCallback(async () => {
    if (moving && movePos) {
      const { hour, minute } = yToTime(movePos.top)
      const dur = parseDate(moving.event.end_time) - parseDate(moving.event.start_time)
      const [yr, mo, dy] = movePos.dayKey.split('-').map(Number)
      const newStart = new Date(yr, mo - 1, dy, hour, minute, 0, 0)
      const newEnd   = new Date(newStart.getTime() + dur)
      setEvents(prev => prev.map(ev =>
        ev.id === moving.event.id
          ? { ...ev, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
          : ev
      ))
      api.updateCalendarEvent(moving.event.id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      }).catch(() => {})
    }
    if (resizing && resizeHeight != null) {
      const origStart = parseDate(resizing.event.start_time)
      const newEnd    = new Date(origStart.getTime() + (resizeHeight / HOUR_HEIGHT) * 3600000)
      setEvents(prev => prev.map(ev =>
        ev.id === resizing.event.id
          ? { ...ev, end_time: newEnd.toISOString() }
          : ev
      ))
      api.updateCalendarEvent(resizing.event.id, { end_time: newEnd.toISOString() }).catch(() => {})
    }
    setMoving(null); setMovePos(null)
    setResizing(null); setResizeHeight(null)
  }, [moving, movePos, resizing, resizeHeight])

  // Attach window listeners only while dragging
  useEffect(() => {
    if (!moving && !resizing) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [moving, resizing, handleMouseMove, handleMouseUp])

  // ── CRUD helpers ──
  const deleteEvent = async (id) => {
    const event = events.find(e => e.id === id)
    setEvents(prev => prev.filter(e => e.id !== id))
    try {
      await api.deleteCalendarEvent(id)
      if (event?.work_package_id) api.getWorkPackages().then(setWPs).catch(() => {})
    } catch {
      setEvents(prev => [...prev, event])
    }
  }

  const markWPDone = async (id) => {
    setWPs(prev => prev.filter(w => w.id !== id))
    try {
      await api.updatePackage(id, { status: 'done' })
    } catch {
      api.getWorkPackages().then(setWPs).catch(() => {})
    }
  }

  const eventsForDay = (day) => {
    const key = isoDay(day)
    return events.filter(ev => {
      if (moving && ev.id === moving.event.id) return false   // rendered as ghost in target column
      return isoDay(parseDate(ev.start_time)) === key
    })
  }

  const isToday = (day) => isoDay(day) === isoDay(new Date())

  return (
    <AppShell app="calendar" label="Kalender">
      <div
        className="flex h-[calc(100vh-44px)] overflow-hidden"
        style={{ cursor: moving ? 'grabbing' : resizing ? 'ns-resize' : undefined,
                 userSelect: (moving || resizing) ? 'none' : undefined }}
      >

        {/* ── Left Panel ── */}
        <div className="w-[220px] flex-shrink-0 border-r border-[#1e4a4a] flex flex-col bg-[#050909]">

          {/* View selector */}
          <div className="flex border-b border-[#1e4a4a]">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex-1 py-2 text-[13px] uppercase tracking-[0.15em] transition-colors ${
                  view === v.id
                    ? 'text-[#00cccc] border-b-2 border-[#00a0a0]'
                    : 'text-[#4a9090] hover:text-[#5aacac]'
                }`}
              >{v.label}</button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e4a4a]">
            <button
              onClick={() => setAnchor(navigate(view, anchor, -1))}
              className="text-[#4a9090] hover:text-[#5aacac] text-[18px] w-7 h-7 flex items-center justify-center transition-colors"
            >‹</button>
            <span className="text-[13px] text-[#5aacac] text-center flex-1 px-1">
              {formatRange(view, days)}
            </span>
            <button
              onClick={() => setAnchor(navigate(view, anchor, 1))}
              className="text-[#4a9090] hover:text-[#5aacac] text-[18px] w-7 h-7 flex items-center justify-center transition-colors"
            >›</button>
          </div>

          {/* Ungeplant */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
            {/* Today's workouts */}
            {workoutsToday.length > 0 && (
              <div className="px-2 pt-2 pb-1 space-y-1 border-b border-[#1e4a4a] flex-shrink-0">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#3a8080] px-1 pb-0.5">── Heute</p>
                {workoutsToday.map(w => {
                  const handleDragStart = (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      id: w.id, title: w.name,
                      estimated_hours: (w.duration_min || 60) / 60,
                      color: w.color || '#00a0a0',
                      isWorkout: true,
                    }))
                    e.dataTransfer.effectAllowed = 'copy'
                  }
                  return (
                    <div
                      key={w.id}
                      draggable
                      onDragStart={handleDragStart}
                      className="group flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-[#0d1e1e] transition-colors"
                      style={{ borderLeft: `3px solid ${w.color || '#00a0a0'}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: w.color || '#00a0a0' }}>{w.name}</p>
                        <p className="text-[11px] text-[#3a7070]">{w.duration_min} Min</p>
                      </div>
                      <span className="text-[#3a6060] group-hover:text-[#5a8080] text-[14px]">⠿</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <p className="text-[13px] uppercase tracking-[0.3em] text-[#3a8080]">── Ungeplant</p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar px-2 space-y-1">
              {workPackages.length === 0 && (
                <p className="text-[13px] text-[#3a8080] px-1">Keine Aufgaben.</p>
              )}
              {workPackages.map((wp, i) => (
                <WorkPackageCard
                  key={wp.id} wp={wp} onDone={markWPDone}
                  onDragStart={() => handleWPDragStart(i)}
                  onDragEnter={() => handleWPDragEnter(i)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Calendar Grid ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Day headers */}
          <div className="flex flex-shrink-0 border-b border-[#1e4a4a]" style={{ paddingLeft: 48 }}>
            {days.map(day => (
              <div
                key={isoDay(day)}
                className={`flex-1 text-center py-2 text-[14px] uppercase tracking-[0.15em] border-r border-[#1e4a4a] last:border-r-0 ${
                  isToday(day) ? 'text-[#00cccc]' : 'text-[#4a9090]'
                }`}
              >
                <span>{DE_DAYS[day.getDay()]} </span>
                <span className={isToday(day)
                  ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#00a0a0] text-[#050909]'
                  : ''
                }>{day.getDate()}</span>
              </div>
            ))}
          </div>

          {/* Scrollable grid */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
            ref={gridRef}
          >
            <div className="flex" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>

              {/* Time labels */}
              <div className="flex-shrink-0 w-12">
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-2 text-[12px] text-[#3a8080]"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className="-mt-2">{h}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map(day => {
                const dayKey = isoDay(day)
                return (
                  <div
                    key={dayKey}
                    ref={el => { dayColRefs.current[dayKey] = el }}
                    className="flex-1 relative border-r border-[#1e4a4a] last:border-r-0"
                    style={{ minHeight: HOURS.length * HOUR_HEIGHT }}
                    onDragOver={e => handleDragOver(e, dayKey)}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
                    onDrop={e => handleDrop(e, day)}
                  >
                    {/* Hour lines */}
                    {HOURS.map(h => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-[#112828]"
                        style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Current time indicator */}
                    {nowY != null && isoDay(new Date()) === dayKey && (
                      <div
                        className="absolute left-0 right-0 flex items-center pointer-events-none z-30"
                        style={{ top: nowY }}
                      >
                        <div className="w-2 h-2 rounded-full bg-[#00cccc] flex-shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-[#00cccc] opacity-60" />
                      </div>
                    )}

                    {/* WP drag: ghost block */}
                    {dragOver?.dayKey === dayKey && (
                      <div
                        className="absolute left-1 right-1 rounded-sm bg-[#00a0a0] opacity-20 pointer-events-none z-10"
                        style={{ top: timeToY(dragOver.hour, dragOver.minute), height: HOUR_HEIGHT }}
                      />
                    )}

                    {/* WP drag: time indicator */}
                    {dragOver?.dayKey === dayKey && (
                      <div
                        className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                        style={{ top: timeToY(dragOver.hour, dragOver.minute) }}
                      >
                        <span className="text-[12px] text-[#00cccc] w-12 pl-1 flex-shrink-0 tabular-nums">
                          {pad(dragOver.hour)}:{pad(dragOver.minute)}
                        </span>
                        <div className="flex-1 h-px bg-[#00cccc] opacity-60" />
                      </div>
                    )}

                    {/* Stationary events */}
                    {eventsForDay(day).map(event => (
                      <CalendarEventBlock
                        key={event.id}
                        event={event}
                        isResizing={resizing?.event.id === event.id}
                        overrideHeight={resizing?.event.id === event.id ? resizeHeight : undefined}
                        onDelete={deleteEvent}
                        onStartMove={(e) => startMove(e, event)}
                        onStartResize={(e) => startResize(e, event)}
                      />
                    ))}

                    {/* Moving event ghost in target column */}
                    {moving && movePos?.dayKey === dayKey && (
                      <CalendarEventBlock
                        key={`moving-${moving.event.id}`}
                        event={moving.event}
                        overrideTop={movePos.top}
                        isMoving
                        onDelete={() => {}}
                        onStartMove={() => {}}
                        onStartResize={() => {}}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
