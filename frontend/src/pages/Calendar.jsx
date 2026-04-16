import { useState, useEffect, useRef } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../api/client'

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64       // px per hour
const START_HOUR  = 7
const END_HOUR    = 23
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const VIEWS = [
  { id: 'today',  label: 'Heute'   },
  { id: '3days',  label: '3 Tage'  },
  { id: 'week',   label: 'Woche'   },
]

const DE_DAYS  = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const DE_MONTH = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToY(hour, minute = 0) {
  return (hour - START_HOUR + minute / 60) * HOUR_HEIGHT
}

function yToTime(y) {
  const raw  = (y / HOUR_HEIGHT) * 60
  const hour = START_HOUR + Math.floor(raw / 60)
  const minute = Math.round((raw % 60) / 30) * 30
  const clampedHour = Math.max(START_HOUR, Math.min(hour, END_HOUR - 1))
  return { hour: clampedHour, minute: minute >= 60 ? 0 : minute }
}

function getViewDays(view, anchor) {
  const d = new Date(anchor)
  d.setHours(0, 0, 0, 0)
  if (view === 'today') return [new Date(d)]
  if (view === '3days') return [0, 1, 2].map(i => { const x = new Date(d); x.setDate(x.getDate() + i); return x })
  // week — start on Monday
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

function isoDay(date) {
  return date.toISOString().slice(0, 10)
}

function parseDT(isoString) {
  const d = new Date(isoString)
  return { date: isoDay(d), hour: d.getHours(), minute: d.getMinutes(), durationMin: 0 }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function WorkPackageCard({ wp, onDelete }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(wp))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-2 px-2 py-1.5 border border-[#1a4040] hover:border-[#2a6060] bg-[#0a1414] cursor-grab active:cursor-grabbing transition-colors"
    >
      <span className="text-[#1a4040] group-hover:text-[#2a6060] text-[14px] flex-shrink-0">⠿</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-[#5aacac] truncate">{wp.title}</p>
        <p className="text-[10px] text-[#2a6060]">{wp.estimated_hours}h</p>
      </div>
      <button
        onClick={() => onDelete(wp.id)}
        className="opacity-0 group-hover:opacity-100 text-[#1a4040] hover:text-[#cc2222] text-[11px] transition-all flex-shrink-0"
      >✕</button>
    </div>
  )
}

function CalendarEventBlock({ event, onDelete }) {
  const start     = new Date(event.start_time)
  const end       = new Date(event.end_time)
  const top       = timeToY(start.getHours(), start.getMinutes())
  const height    = Math.max(((end - start) / 60000) * (HOUR_HEIGHT / 60), 20)

  return (
    <div
      className="absolute left-1 right-1 rounded-sm px-1.5 py-0.5 overflow-hidden group cursor-pointer"
      style={{ top, height, backgroundColor: event.color + '22', borderLeft: `2px solid ${event.color}` }}
    >
      <p className="text-[11px] text-[#00cccc] truncate leading-tight">{event.title}</p>
      <p className="text-[10px] text-[#2a6060]">
        {start.getHours().toString().padStart(2,'0')}:{start.getMinutes().toString().padStart(2,'0')} –{' '}
        {end.getHours().toString().padStart(2,'0')}:{end.getMinutes().toString().padStart(2,'0')}
      </p>
      <button
        onClick={() => onDelete(event.id)}
        className="absolute top-0.5 right-1 opacity-0 group-hover:opacity-100 text-[#cc2222] text-[10px] transition-all"
      >✕</button>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function Calendar() {
  const [view, setView]           = useState('today')
  const [anchor, setAnchor]       = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [events, setEvents]       = useState([])
  const [workPackages, setWPs]    = useState([])
  const [dragOver, setDragOver]   = useState(null) // { dayKey, hour, minute }
  const [newWP, setNewWP]         = useState('')
  const gridRef = useRef(null)

  const days = getViewDays(view, anchor)

  // Load events when range changes
  useEffect(() => {
    const start = days[0].toISOString()
    const end   = new Date(days[days.length - 1].getTime() + 86400000).toISOString()
    api.getCalendarEvents(start, end).then(setEvents).catch(() => {})
  }, [view, anchor.toDateString()])

  // Load work packages once
  useEffect(() => {
    api.getWorkPackages().then(setWPs).catch(() => {})
  }, [])

  // ── Drop handling ──
  const handleDragOver = (e, dayKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!gridRef.current) return
    const rect     = gridRef.current.getBoundingClientRect()
    const scrollTop = gridRef.current.scrollTop
    const relY     = e.clientY - rect.top + scrollTop
    const { hour, minute } = yToTime(relY)
    setDragOver({ dayKey, hour, minute })
  }

  const handleDrop = async (e, day) => {
    e.preventDefault()
    setDragOver(null)
    const wp = JSON.parse(e.dataTransfer.getData('application/json'))
    if (!gridRef.current) return
    const rect      = gridRef.current.getBoundingClientRect()
    const scrollTop = gridRef.current.scrollTop
    const relY      = e.clientY - rect.top + scrollTop
    const { hour, minute } = yToTime(relY)

    const startTime = new Date(day)
    startTime.setHours(hour, minute, 0, 0)
    const endTime = new Date(startTime.getTime() + (wp.estimated_hours || 1) * 3600000)

    const event = await api.createCalendarEvent({
      title: wp.title,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      color: wp.color || '#00a0a0',
      work_package_id: wp.id,
    })
    setEvents(prev => [...prev, event])
    setWPs(prev => prev.filter(w => w.id !== wp.id))
  }

  const deleteEvent = async (id) => {
    const event = events.find(e => e.id === id)
    await api.deleteCalendarEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    // If it had a work package, reload WPs
    if (event?.work_package_id) {
      api.getWorkPackages().then(setWPs).catch(() => {})
    }
  }

  const deleteWP = async (id) => {
    await api.deleteWorkPackage(id)
    setWPs(prev => prev.filter(w => w.id !== id))
  }

  const addWP = async (e) => {
    if (e.key !== 'Enter' || !newWP.trim()) return
    const wp = await api.createWorkPackage({ title: newWP.trim(), estimated_hours: 1.0 })
    setWPs(prev => [...prev, wp])
    setNewWP('')
  }

  const eventsForDay = (day) => {
    const key = isoDay(day)
    return events.filter(ev => isoDay(new Date(ev.start_time)) === key)
  }

  const isToday = (day) => isoDay(day) === isoDay(new Date())

  return (
    <AppShell app="calendar" label="Kalender">
      <div className="flex h-[calc(100vh-44px)] overflow-hidden">

        {/* ── Left Panel ── */}
        <div className="w-[220px] flex-shrink-0 border-r border-[#0f2828] flex flex-col bg-[#050909]">

          {/* View selector */}
          <div className="flex border-b border-[#0f2828]">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex-1 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors ${
                  view === v.id
                    ? 'text-[#00cccc] border-b-2 border-[#00a0a0]'
                    : 'text-[#2a6060] hover:text-[#5aacac]'
                }`}
              >{v.label}</button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#0f2828]">
            <button
              onClick={() => setAnchor(navigate(view, anchor, -1))}
              className="text-[#2a6060] hover:text-[#5aacac] text-[16px] w-7 h-7 flex items-center justify-center transition-colors"
            >‹</button>
            <span className="text-[11px] text-[#5aacac] text-center flex-1 px-1">
              {formatRange(view, days)}
            </span>
            <button
              onClick={() => setAnchor(navigate(view, anchor, 1))}
              className="text-[#2a6060] hover:text-[#5aacac] text-[16px] w-7 h-7 flex items-center justify-center transition-colors"
            >›</button>
          </div>

          {/* Ungeplant */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#1a4040]">── Ungeplant</p>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {workPackages.length === 0 && (
                <p className="text-[11px] text-[#1a4040] px-1">Keine Aufgaben.</p>
              )}
              {workPackages.map(wp => (
                <WorkPackageCard key={wp.id} wp={wp} onDelete={deleteWP} />
              ))}
            </div>

            {/* Add work package */}
            <div className="px-2 py-2 border-t border-[#0f2828] flex-shrink-0">
              <input
                value={newWP}
                onChange={e => setNewWP(e.target.value)}
                onKeyDown={addWP}
                placeholder="+ Aufgabe hinzufügen"
                className="w-full bg-transparent text-[12px] text-[#5aacac] placeholder-[#1a4040] focus:outline-none px-1 py-1"
              />
            </div>
          </div>
        </div>

        {/* ── Calendar Grid ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Day headers */}
          <div className="flex flex-shrink-0 border-b border-[#0f2828]" style={{ paddingLeft: 48 }}>
            {days.map(day => (
              <div
                key={isoDay(day)}
                className={`flex-1 text-center py-2 text-[12px] uppercase tracking-[0.15em] border-r border-[#0f2828] last:border-r-0 ${
                  isToday(day) ? 'text-[#00cccc]' : 'text-[#2a6060]'
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
          <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={gridRef}>
            <div className="flex" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>

              {/* Time labels */}
              <div className="flex-shrink-0 w-12">
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-2 text-[10px] text-[#1a4040]"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className="-mt-2">{h}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map(day => (
                <div
                  key={isoDay(day)}
                  className="flex-1 relative border-r border-[#0f2828] last:border-r-0"
                  style={{ minHeight: HOURS.length * HOUR_HEIGHT }}
                  onDragOver={e => handleDragOver(e, isoDay(day))}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, day)}
                >
                  {/* Hour lines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-[#0f2828]"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Drop indicator */}
                  {dragOver?.dayKey === isoDay(day) && (
                    <div
                      className="absolute left-1 right-1 h-0.5 bg-[#00a0a0] pointer-events-none z-10"
                      style={{ top: timeToY(dragOver.hour, dragOver.minute) }}
                    />
                  )}

                  {/* Events */}
                  {eventsForDay(day).map(event => (
                    <CalendarEventBlock key={event.id} event={event} onDelete={deleteEvent} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
