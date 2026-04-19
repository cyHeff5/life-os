import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../api/client'

// ── Colour maps ────────────────────────────────────────────────────────────────

const REGIME_COLOR = {
  Bull_LowVol:  '#00cc66',
  Bull_HighVol: '#aacc00',
  Bear_LowVol:  '#cc7700',
  Bear_HighVol: '#cc2222',
}

const RISK_COLOR = {
  LOW:       '#00cc66',
  MEDIUM:    '#aacc00',
  HIGH:      '#cc7700',
  VERY_HIGH: '#cc2222',
}

const NEWS_COLOR = {
  BULLISH: '#00cc66',
  NEUTRAL: '#5aacac',
  BEARISH: '#cc2222',
}

const RECO_COLOR = {
  STRONG_BUY:  '#00ff88',
  BUY:         '#00cc66',
  HOLD:        '#ccaa00',
  SELL:        '#cc5500',
  STRONG_SELL: '#cc1111',
}

const SENTIMENT_COLOR = {
  Bullish:      '#00cc66',
  'Somewhat-Bullish': '#aacc00',
  Neutral:      '#5aacac',
  'Somewhat-Bearish': '#cc7700',
  Bearish:      '#cc2222',
}

function Badge({ label, color }) {
  return (
    <span
      className="text-[11px] uppercase tracking-wider px-2 py-0.5 border"
      style={{ color, borderColor: color + '55' }}
    >{label}</span>
  )
}

// ── News article row ───────────────────────────────────────────────────────────
function NewsRow({ article }) {
  const color = SENTIMENT_COLOR[article.sentiment] || '#5aacac'
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-4 py-2.5 border-b border-[#0d1e1e] hover:bg-[#080e0e] transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[#5aacac] group-hover:text-[#00cccc] leading-snug">{article.title}</p>
        <p className="text-[11px] text-[#2a5050] mt-0.5">{article.source} · {article.published}</p>
      </div>
      <span className="text-[11px] flex-shrink-0 mt-0.5" style={{ color }}>{article.sentiment}</span>
    </a>
  )
}

// ── Stock card ─────────────────────────────────────────────────────────────────
function StockCard({ stock, onDelete, onRefresh }) {
  const [expanded, setExpanded]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const handleRefresh = async (e) => {
    e.stopPropagation()
    setLoading(true); setError('')
    try {
      await onRefresh(stock.symbol)
    } catch (err) {
      setError(err.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onDelete(stock.symbol)
  }

  const recoColor = RECO_COLOR[stock.recommendation] || '#5aacac'

  return (
    <div className="border-b border-[#1a3030]">
      {/* Header row — click to expand */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#080e0e] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Symbol + name */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] text-[#00cccc] font-mono">{stock.symbol}</span>
            {stock.name && stock.name !== stock.symbol && (
              <span className="text-[12px] text-[#2a5050] truncate">{stock.name}</span>
            )}
          </div>
          {stock.price != null && (
            <span className="text-[13px] text-[#3a7070] tabular-nums">${stock.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
        </div>

        {/* Badges */}
        {stock.cached && !stock.stale ? (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge label={stock.regime}      color={REGIME_COLOR[stock.regime] || '#5aacac'} />
            <Badge label={stock.news_signal} color={NEWS_COLOR[stock.news_signal] || '#5aacac'} />
            <span
              className="text-[14px] font-mono px-2.5 py-1 border"
              style={{ color: recoColor, borderColor: recoColor + '66', background: recoColor + '11' }}
            >{stock.recommendation?.replace('_', ' ')}</span>
          </div>
        ) : (
          <span className="text-[12px] text-[#2a4a4a] uppercase tracking-wider">
            {stock.stale && stock.cached ? 'veraltet' : 'kein cache'}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-[12px] text-[#2a5050] hover:text-[#00a0a0] transition-colors disabled:opacity-40 uppercase tracking-wider"
            title="Aktualisieren (2 API-Calls)"
          >{loading ? '···' : '↺'}</button>
          <button
            onClick={handleDelete}
            className="text-[12px] text-[#2a4040] hover:text-[#cc2222] transition-colors"
          >✕</button>
        </div>
      </div>

      {(error || stock._error) && <p className="px-4 pb-2 text-[12px] text-[#cc4444]">{error || stock._error}</p>}

      {/* Expanded: regime detail + news */}
      {expanded && stock.cached && !stock.stale && (
        <div className="bg-[#020808]">
          {/* Regime detail */}
          <div className="flex gap-6 px-4 py-3 border-t border-[#0d1e1e]">
            <div>
              <p className="text-[11px] text-[#2a5050] uppercase tracking-wider mb-1">Marktregime</p>
              <p className="text-[14px]" style={{ color: REGIME_COLOR[stock.regime] || '#5aacac' }}>{stock.regime}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#2a5050] uppercase tracking-wider mb-1">Risiko</p>
              <p className="text-[14px]" style={{ color: RISK_COLOR[stock.risk_tag] || '#5aacac' }}>{stock.risk_tag}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#2a5050] uppercase tracking-wider mb-1">News-Signal</p>
              <p className="text-[14px]" style={{ color: NEWS_COLOR[stock.news_signal] || '#5aacac' }}>{stock.news_signal}</p>
            </div>
            {stock.updated_at && (
              <div className="ml-auto text-right">
                <p className="text-[11px] text-[#2a5050] uppercase tracking-wider mb-1">Zuletzt aktualisiert</p>
                <p className="text-[12px] text-[#2a4040]">{new Date(stock.updated_at).toLocaleString('de-DE')}</p>
              </div>
            )}
          </div>

          {/* News */}
          {stock.news?.length > 0 && (
            <div className="border-t border-[#0d1e1e]">
              <p className="px-4 pt-2.5 pb-1.5 text-[11px] uppercase tracking-widest text-[#2a5050]">Aktuelle News</p>
              {stock.news.map((a, i) => <NewsRow key={i} article={a} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add dialog ─────────────────────────────────────────────────────────────────
function AddDialog({ onAdd, onClose }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding]   = useState(false)
  const [error, setError]     = useState('')

  const search = async () => {
    if (!query.trim()) return
    setSearching(true); setError(''); setResults([])
    try {
      const r = await api.searchStockSymbols(query)
      setResults(r)
      if (r.length === 0) setError('Keine Treffer')
    } catch (err) {
      setError(err.message || 'Suche fehlgeschlagen')
    } finally {
      setSearching(false)
    }
  }

  const pick = async (symbol, name) => {
    setAdding(true); setError('')
    try {
      await onAdd(symbol, name)
      onClose()
    } catch (err) {
      setError(err.message || 'Fehler beim Hinzufügen')
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#020808] border border-[#3a7070] w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[#1a3030]">
          <p className="text-[13px] uppercase tracking-[0.3em] text-[#5aacac] mb-3">Aktie suchen</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Firmenname oder Ticker (z.B. Nvidia)"
              className="flex-1 bg-transparent border border-[#3a7070] px-3 py-2 text-[14px] text-[#00cccc] placeholder-[#2a5050] focus:outline-none focus:border-[#00a0a0]"
            />
            <button
              onClick={search}
              disabled={searching}
              className="px-3 border border-[#3a7070] text-[#5aacac] text-[13px] hover:border-[#00a0a0] hover:text-[#00cccc] transition-colors disabled:opacity-40"
            >{searching ? '···' : 'Suchen'}</button>
          </div>
          {error && <p className="text-[12px] text-[#cc4444] mt-2">{error}</p>}
        </div>

        {results.length > 0 && (
          <div className="max-h-72 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.symbol}
                onClick={() => pick(r.symbol, r.name)}
                disabled={adding}
                className="w-full text-left px-4 py-3 border-b border-[#0d1e1e] hover:bg-[#0d1e1e] transition-colors disabled:opacity-40"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] text-[#00cccc] font-mono">{r.symbol}</span>
                  <span className="text-[12px] text-[#3a7070]">{r.region}</span>
                </div>
                <p className="text-[13px] text-[#5aacac] mt-0.5">{r.name}</p>
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-2.5 flex justify-end">
          <button onClick={onClose} className="text-[13px] text-[#3a7070] hover:text-[#5aacac]">Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function needsRefresh(stock) {
  if (!stock.updated_at) return true
  return new Date(stock.updated_at).toLocaleDateString('en-CA') !== todayStr()
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function Stocks() {
  const [stocks, setStocks]         = useState([])
  const [showAdd, setShowAdd]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress]     = useState(null) // { done, total, current }

  const load = useCallback(() => {
    api.getStocks().then(setStocks).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async (symbol, name) => {
    const s = await api.addStock(symbol, name)
    setStocks(prev => [...prev, s])
  }

  const handleDelete = async (symbol) => {
    await api.deleteStock(symbol)
    setStocks(prev => prev.filter(s => s.symbol !== symbol))
  }

  const handleRefresh = async (symbol) => {
    const updated = await api.refreshStock(symbol)
    setStocks(prev => prev.map(s => s.symbol === symbol ? { ...s, ...updated } : s))
  }

  const handleRefreshAll = async () => {
    const toRefresh = stocks.filter(needsRefresh)
    if (toRefresh.length === 0) return
    setRefreshing(true)
    for (let i = 0; i < toRefresh.length; i++) {
      const symbol = toRefresh[i].symbol
      setProgress({ done: i, total: toRefresh.length, current: symbol })
      try {
        const updated = await api.refreshStock(symbol)
        setStocks(prev => prev.map(s => s.symbol === symbol ? { ...s, ...updated } : s))
      } catch (err) {
        setStocks(prev => prev.map(s => s.symbol === symbol ? { ...s, _error: err.message } : s))
      }
      if (i < toRefresh.length - 1) await new Promise(r => setTimeout(r, 2000))
    }
    setRefreshing(false)
    setProgress(null)
  }

  const staleCount = stocks.filter(needsRefresh).length

  return (
    <AppShell app="stocks" label="Aktien">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e4040] flex-shrink-0">
          <span className="text-[13px] uppercase tracking-[0.3em] text-[#3a7070] flex-1">Watchlist</span>

          {progress ? (
            <span className="text-[12px] text-[#3a7070] tabular-nums">
              {progress.current} · {progress.done}/{progress.total}
            </span>
          ) : staleCount > 0 && (
            <span className="text-[11px] text-[#2a4a4a]">{staleCount} veraltet</span>
          )}

          {staleCount > 0 && (
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="text-[13px] border border-[#1e4040] text-[#3a7070] px-3 py-1 hover:border-[#3a7070] hover:text-[#5aacac] uppercase tracking-wider transition-colors disabled:opacity-40"
            >{refreshing ? '···' : `↺ Alle (${staleCount})`}</button>
          )}

          <button
            onClick={() => setShowAdd(true)}
            disabled={refreshing}
            className="text-[13px] border border-[#1e4040] text-[#3a7070] px-3 py-1 hover:border-[#3a7070] hover:text-[#5aacac] uppercase tracking-wider transition-colors disabled:opacity-40"
          >+ Aktie</button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {stocks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <p className="text-[13px] uppercase tracking-widest text-[#2a4a4a]">Keine Aktien in der Watchlist</p>
              <p className="text-[12px] text-[#1a3030]">Füge ein Ticker-Symbol hinzu, z.B. AAPL, MSFT, KO</p>
            </div>
          )}
          {stocks.map(s => (
            <StockCard
              key={s.symbol}
              stock={s}
              onDelete={handleDelete}
              onRefresh={handleRefresh}
            />
          ))}
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 border-t border-[#0d1e1e] flex-shrink-0">
          <p className="text-[11px] text-[#1a3030]">
            Regime: Trend × Volatilität · News: Alpha Vantage · 2 API-Calls pro Aktie · 25 Calls/Tag
          </p>
        </div>
      </div>

      {showAdd && <AddDialog onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
