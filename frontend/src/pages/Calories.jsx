import { useState, useEffect, useCallback, useRef } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../api/client'

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(n) { return n != null ? Math.round(n) : '—' }

// ── Macro Bar ──────────────────────────────────────────────────────────────
function MacroBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[12px] text-[#3a7070] uppercase tracking-wider w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-[#0d1e1e] relative">
        <div className="absolute left-0 top-0 h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] tabular-nums w-12 text-right flex-shrink-0" style={{ color }}>{fmt(value)}g</span>
    </div>
  )
}

// ── Food Log Entry ─────────────────────────────────────────────────────────
function LogEntry({ entry, onDelete }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-[#0d1e1e] hover:bg-[#080e0e] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] text-[#5aacac] truncate">{entry.name}</span>
          {entry.brand && <span className="text-[12px] text-[#2a5050] truncate">{entry.brand}</span>}
        </div>
        <div className="flex gap-3 mt-0.5">
          <span className="text-[12px] text-[#3a7070]">{entry.grams}g</span>
          <span className="text-[12px] text-[#3a6060]">P {fmt(entry.protein)}g</span>
          <span className="text-[12px] text-[#3a6060]">F {fmt(entry.fat)}g</span>
          <span className="text-[12px] text-[#3a6060]">C {fmt(entry.carbs)}g</span>
        </div>
      </div>
      <span className="text-[16px] text-[#00a0a0] tabular-nums flex-shrink-0">{fmt(entry.kcal)} kcal</span>
      <button
        onClick={() => onDelete(entry.id)}
        className="opacity-0 group-hover:opacity-100 text-[#2a4040] hover:text-[#cc2222] text-[13px] transition-all flex-shrink-0"
      >✕</button>
    </div>
  )
}

// ── Portion Input ──────────────────────────────────────────────────────────
function PortionInput({ product, onConfirm, onCancel }) {
  const [grams, setGrams] = useState('100')

  const kcal = product.kcal_per_100g * parseFloat(grams || 0) / 100

  return (
    <div className="p-4 border border-[#3a7070] bg-[#080e0e] space-y-3">
      <div>
        <p className="text-[15px] text-[#00cccc]">{product.name}</p>
        {product.brand && <p className="text-[12px] text-[#3a7070] mt-0.5">{product.brand}</p>}
        <p className="text-[12px] text-[#2a5050] mt-1">
          {product.kcal_per_100g} kcal · {product.protein_per_100g}g P · {product.fat_per_100g}g F · {product.carbs_per_100g}g C &nbsp;(pro 100g)
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Menge (g)</div>
          <input
            autoFocus
            type="number"
            value={grams}
            onChange={e => setGrams(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { const g = parseFloat(grams); if (g > 0) onConfirm(product, g) } }}
            className="w-24 bg-transparent border border-[#3a7070] px-2 py-1.5 text-[15px] text-[#00cccc] focus:outline-none focus:border-[#00a0a0] text-center"
          />
        </div>
        <div className="mt-4">
          <p className="text-[14px] text-[#00a0a0]">≈ {fmt(kcal)} kcal</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { const g = parseFloat(grams); if (g > 0) onConfirm(product, g) }}
          className="px-4 py-1.5 border border-[#00a0a0] text-[#00a0a0] text-[13px] uppercase tracking-[0.2em] hover:text-[#00cccc] transition-colors"
        >Hinzufügen</button>
        <button onClick={onCancel} className="text-[13px] text-[#3a7070] hover:text-[#5aacac] transition-colors">Abbrechen</button>
      </div>
    </div>
  )
}

// ── Search Panel ───────────────────────────────────────────────────────────
function SearchPanel({ onConfirm, onCancel }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [error, setError]     = useState('')

  const search = async () => {
    if (!query.trim()) return
    setLoading(true); setError('')
    try {
      const r = await api.searchFood(query)
      setResults(r)
      if (r.length === 0) setError('Keine Ergebnisse gefunden')
    } catch {
      setError('Suche fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  if (selected) {
    return <PortionInput product={selected} onConfirm={onConfirm} onCancel={() => setSelected(null)} />
  }

  return (
    <div className="border border-[#3a7070] bg-[#080e0e] overflow-hidden">
      <div className="flex gap-2 p-3 border-b border-[#1a3030]">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Lebensmittel suchen..."
          className="flex-1 bg-transparent text-[15px] text-[#00cccc] placeholder-[#2a6060] focus:outline-none"
        />
        <button
          onClick={search}
          disabled={loading}
          className="text-[13px] border border-[#3a7070] text-[#5aacac] px-3 py-1 hover:border-[#00a0a0] hover:text-[#00cccc] transition-colors disabled:opacity-40"
        >{loading ? '···' : 'Suchen'}</button>
        <button onClick={onCancel} className="text-[#3a7070] hover:text-[#cc2222] text-[14px] transition-colors">✕</button>
      </div>
      {error && <p className="px-4 py-3 text-[13px] text-[#cc4444]">{error}</p>}
      {results.map((r, i) => (
        <button
          key={i}
          onClick={() => setSelected(r)}
          className="w-full text-left px-4 py-2.5 border-b border-[#0d1e1e] hover:bg-[#0d1e1e] transition-colors"
        >
          <p className="text-[14px] text-[#5aacac]">{r.name}</p>
          <p className="text-[12px] text-[#3a7070] mt-0.5">
            {r.brand && `${r.brand} · `}{r.kcal_per_100g} kcal · P {r.protein_per_100g}g · F {r.fat_per_100g}g · C {r.carbs_per_100g}g &nbsp;(pro 100g)
          </p>
        </button>
      ))}
    </div>
  )
}

// ── Barcode Scanner ────────────────────────────────────────────────────────
function BarcodeScanner({ onResult, onClose }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)
  const [status, setStatus]   = useState('starting')
  const [product, setProduct] = useState(null)
  const [error, setError]     = useState('')

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }, [])

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!('BarcodeDetector' in window)) {
        setStatus('unsupported'); return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
        const scan = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              stop()
              setStatus('loading')
              const barcode = codes[0].rawValue
              try {
                const p = await api.scanBarcode(barcode)
                setProduct(p)
                setStatus('found')
              } catch {
                setError(`Barcode ${barcode} nicht gefunden`)
                setStatus('error')
              }
              return
            }
          } catch {}
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      } catch (e) {
        setError('Kamera nicht verfügbar')
        setStatus('error')
      }
    }
    start()
    return () => { cancelled = true; stop() }
  }, [stop])

  if (status === 'unsupported') {
    return <BarcodeManualInput onResult={onResult} onClose={onClose} />
  }

  if (status === 'found' && product) {
    return <PortionInput product={product} onConfirm={onResult} onCancel={onClose} />
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#020606] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e4040]">
        <span className="text-[13px] uppercase tracking-[0.3em] text-[#5aacac]">Barcode scannen</span>
        <button onClick={() => { stop(); onClose() }} className="text-[#3a7070] hover:text-[#cc2222] text-[16px]">✕</button>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        {(status === 'scanning' || status === 'starting') && (
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        )}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-[#00cccc] opacity-60" />
          </div>
        )}
        {status === 'loading' && (
          <p className="text-[14px] uppercase tracking-widest text-[#3a7070]">Produkt wird geladen···</p>
        )}
        {status === 'error' && (
          <div className="text-center space-y-3">
            <p className="text-[14px] text-[#cc4444]">{error}</p>
            <button onClick={onClose} className="text-[13px] border border-[#3a7070] text-[#5aacac] px-4 py-1.5 hover:border-[#00a0a0]">Schließen</button>
          </div>
        )}
      </div>
      {status === 'scanning' && (
        <p className="text-center py-3 text-[12px] uppercase tracking-widest text-[#2a5050]">Barcode in den Rahmen halten</p>
      )}
    </div>
  )
}

function BarcodeManualInput({ onResult, onClose }) {
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const lookup = async () => {
    if (!barcode.trim()) return
    setLoading(true); setError('')
    try {
      const p = await api.scanBarcode(barcode.trim())
      setProduct(p)
    } catch {
      setError('Produkt nicht gefunden')
    } finally {
      setLoading(false)
    }
  }

  if (product) return <PortionInput product={product} onConfirm={onResult} onCancel={onClose} />

  return (
    <div className="border border-[#3a7070] bg-[#080e0e] p-4 space-y-3">
      <p className="text-[13px] text-[#3a7070]">Barcode manuell eingeben (BarcodeDetector nicht verfügbar)</p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={barcode}
          onChange={e => setBarcode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="z.B. 4008400201771"
          className="flex-1 bg-transparent border border-[#3a7070] px-2 py-1.5 text-[14px] text-[#00cccc] focus:outline-none"
        />
        <button onClick={lookup} disabled={loading} className="text-[13px] border border-[#3a7070] text-[#5aacac] px-3 py-1 disabled:opacity-40">
          {loading ? '···' : 'Suchen'}
        </button>
        <button onClick={onClose} className="text-[#3a7070] hover:text-[#cc2222] text-[14px]">✕</button>
      </div>
      {error && <p className="text-[13px] text-[#cc4444]">{error}</p>}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function Calories() {
  const [date, setDate]         = useState(new Date())
  const [logs, setLogs]         = useState([])
  const [mode, setMode]         = useState(null) // null | 'search' | 'scan'

  const dateStr = isoDate(date)

  const load = useCallback(() => {
    api.getFoodLogs(dateStr).then(setLogs).catch(() => {})
  }, [dateStr])

  useEffect(() => { load() }, [load])

  const totals = logs.reduce((acc, e) => ({
    kcal:    acc.kcal    + (e.kcal    || 0),
    protein: acc.protein + (e.protein || 0),
    fat:     acc.fat     + (e.fat     || 0),
    carbs:   acc.carbs   + (e.carbs   || 0),
  }), { kcal: 0, protein: 0, fat: 0, carbs: 0 })

  const handleDelete = async (id) => {
    const prev = logs
    setLogs(l => l.filter(e => e.id !== id))
    try {
      await api.deleteFoodLog(id)
    } catch {
      setLogs(prev)
    }
  }

  const handleConfirm = async (product, grams) => {
    try {
      await api.createFoodLog({
        date:             dateStr,
        name:             product.name,
        brand:            product.brand,
        grams,
        kcal_per_100g:    product.kcal_per_100g,
        protein_per_100g: product.protein_per_100g,
        fat_per_100g:     product.fat_per_100g,
        carbs_per_100g:   product.carbs_per_100g,
      })
      setMode(null)
      load()
    } catch {
      // Panel bleibt offen, Nutzer kann erneut versuchen
    }
  }

  const navDay = (delta) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
    setMode(null)
  }

  const isToday = isoDate(date) === isoDate(new Date())
  const dateLabel = isToday ? 'Heute' : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const extraContext = `Datum: ${dateStr}. Heute geloggt: ${fmt(totals.kcal)} kcal, Protein ${fmt(totals.protein)}g, Fett ${fmt(totals.fat)}g, Carbs ${fmt(totals.carbs)}g. ${logs.length} Einträge.`

  return (
    <AppShell app="calories" label="Kalorien" extraContext={extraContext} onAiResponse={load}>
      {mode === 'scan' && (
        <BarcodeScanner onResult={handleConfirm} onClose={() => setMode(null)} />
      )}

      <div className="flex flex-col h-full">
        {/* Date nav + kcal total */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-[#1e4040] flex-shrink-0">
          <button onClick={() => navDay(-1)} className="text-[#3a7070] hover:text-[#5aacac] text-[18px] transition-colors">‹</button>
          <button
            onClick={() => { setDate(new Date()); setMode(null) }}
            className="text-[14px] uppercase tracking-[0.25em] text-[#5aacac] hover:text-[#00cccc] transition-colors min-w-[80px] text-center"
          >{dateLabel}</button>
          <button onClick={() => navDay(1)} className="text-[#3a7070] hover:text-[#5aacac] text-[18px] transition-colors">›</button>
          <div className="flex-1" />
          <span className="text-[22px] text-[#00a0a0] tabular-nums font-mono">{fmt(totals.kcal)}</span>
          <span className="text-[13px] text-[#3a7070] uppercase tracking-wider">kcal</span>
        </div>

        {/* Macro summary */}
        <div className="px-4 py-2.5 border-b border-[#0d1e1e] flex-shrink-0 space-y-1.5">
          <MacroBar label="Protein" value={totals.protein} max={150} color="#5080c0" />
          <MacroBar label="Fett"    value={totals.fat}     max={80}  color="#c07030" />
          <MacroBar label="Carbs"   value={totals.carbs}   max={250} color="#50a070" />
        </div>

        {/* Log list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {logs.length === 0 && mode === null && (
            <div className="flex items-center justify-center h-48">
              <p className="text-[13px] uppercase tracking-widest text-[#2a4a4a]">Noch nichts geloggt</p>
            </div>
          )}
          {logs.map(entry => (
            <LogEntry key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}

          {/* Inline panel for search */}
          {mode === 'search' && (
            <div className="p-4">
              <SearchPanel onConfirm={handleConfirm} onCancel={() => setMode(null)} />
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        {mode === null && (
          <div className="flex gap-3 px-4 py-3 border-t border-[#1e4040] flex-shrink-0">
            <button
              onClick={() => setMode('scan')}
              className="flex-1 py-2.5 border border-[#1e4040] text-[#3a7070] text-[13px] uppercase tracking-[0.25em] hover:border-[#3a7070] hover:text-[#5aacac] transition-colors"
            >⊡ Scannen</button>
            <button
              onClick={() => setMode('search')}
              className="flex-1 py-2.5 border border-[#1e4040] text-[#3a7070] text-[13px] uppercase tracking-[0.25em] hover:border-[#3a7070] hover:text-[#5aacac] transition-colors"
            >+ Suchen</button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
