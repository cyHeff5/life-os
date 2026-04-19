import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'
import { pad, parseDate } from '../utils'

const HOUR_HEIGHT = 56
const START_HOUR  = 7
const END_HOUR    = 23
const SNAP_PX     = HOUR_HEIGHT / 4
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

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

// onDropItem(item, start, end) → Promise<createdEvent>
// onAfterDelete(event) → void (optional, e.g. to reset is_scheduled)
export function CalendarPanel({ onClose, onDropItem, onAfterDelete }) {
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
    const rect = gridRef.current.getBoundingClientRect()
    return clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
  }

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
    let item
    try { item = JSON.parse(e.dataTransfer.getData('application/json')) } catch { return }
    const { hour, minute } = yToTime(getGridY(e.clientY))
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute)
    const end   = new Date(start.getTime() + (item.estimated_hours || 1) * 3600000)

    const tempId = `temp-${Date.now()}`
    setEvents(prev => [...prev, {
      id: tempId, title: item.title,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: item.color || '#00a0a0',
    }])

    try {
      const created = await onDropItem(item, start, end)
      setEvents(prev => prev.map(ev => ev.id === tempId ? created : ev))
    } catch {
      setEvents(prev => prev.filter(ev => ev.id !== tempId))
    }
  }

  const startMove = (e, event) => {
    if (e.button !== 0) return
    e.preventDefault()
    const origTop = timeToY(parseDate(event.start_time).getHours(), parseDate(event.start_time).getMinutes())
    setMoving({ event, grabOffsetY: getGridY(e.clientY) - origTop })
    setMoveTop(origTop)
  }

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
    onAfterDelete?.(ev)
  }

  const now    = new Date()
  const nowTop = (now.getHours() + now.getMinutes() / 60 - START_HOUR) * HOUR_HEIGHT
  const showNow = now.getHours() >= START_HOUR && now.getHours() < END_HOUR

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-[#1e4040] flex flex-col bg-[#050909]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e4040] flex-shrink-0">
        <span className="text-[13px] uppercase tracking-[0.25em] text-[#5aacac]">
          Heute — {now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
        </span>
        <button onClick={onClose} className="text-[#2a6060] hover:text-[#cc2222] text-[15px] transition-colors">✕</button>
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
          {HOURS.map(h => (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="text-[12px] text-[#3a7070] w-9 pl-2 pt-0.5 flex-shrink-0 tabular-nums">{pad(h)}</span>
              <div className="flex-1 border-t border-[#1e4040] mt-px" />
            </div>
          ))}

          {showNow && (
            <div
              className="absolute left-0 right-0 flex items-center z-30 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="w-1 h-1 bg-[#00cccc] ml-8 flex-shrink-0" />
              <div className="flex-1 h-px bg-[#00cccc] opacity-40" />
            </div>
          )}

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
              <span className="text-[12px] text-[#00cccc] w-9 pl-1 tabular-nums">
                {pad(dragOver.hour)}:{pad(dragOver.minute)}
              </span>
              <div className="flex-1 h-px bg-[#00cccc] opacity-60" />
            </div>
          )}

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
                <p className="text-[13px] text-[#00cccc] truncate leading-tight pointer-events-none">{ev.title}</p>
                <p className="text-[12px] pointer-events-none">
                  {(isMoving || isResizing)
                    ? <span className="text-[#00cccc]">{pad(sh)}:{pad(sm)} – {pad(eh)}:{pad(em)}</span>
                    : <span className="text-[#2a6060]">{pad(origStart.getHours())}:{pad(origStart.getMinutes())} – {pad(origEnd.getHours())}:{pad(origEnd.getMinutes())}</span>
                  }
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id) }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute top-0.5 right-1 opacity-0 group-hover:opacity-100 text-[#cc2222] text-[12px] z-30"
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
