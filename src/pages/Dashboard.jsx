import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import WineCard from '../components/WineCard'
import { WINDOW_STYLES, WINDOW_ORDER } from '../components/DrinkingWindowBadge'
import { getWines, getDrinkingHistory } from '../lib/wines'
import { getWishlist } from '../lib/wishlist'
import { estimateAndSaveWindows } from '../lib/drinkingWindow'
import { buildTasteProfile, buildSommelierNotes } from '../lib/tasteProfile'

// Colour dot + bar fill colours (matches WineCard palette)
const COLOUR_ORDER = ['red', 'white', 'rosé', 'sparkling', 'dessert']
const COLOUR_META = {
  red:       { dot: 'bg-red-700',     bar: 'bg-red-700',     label: 'Red' },
  white:     { dot: 'bg-yellow-300',  bar: 'bg-yellow-400',  label: 'White' },
  rosé:      { dot: 'bg-pink-400',    bar: 'bg-pink-400',    label: 'Rosé' },
  sparkling: { dot: 'bg-sky-300',     bar: 'bg-sky-400',     label: 'Sparkling' },
  dessert:   { dot: 'bg-amber-400',   bar: 'bg-amber-400',   label: 'Dessert' },
}

export default function Dashboard() {
  const [wines, setWines]           = useState([])
  const [history, setHistory]       = useState([])
  const [wishlistItems, setWishlistItems] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [windowFilter, setWindowFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState(null) // { done, total }
  const [refreshError, setRefreshError] = useState(null)

  useEffect(() => {
    Promise.all([getWines(), getDrinkingHistory(), getWishlist().catch(() => [])])
      .then(([winesData, historyData, wishlistData]) => {
        setWines(winesData)
        setHistory(historyData)
        setWishlistItems(wishlistData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const currentYear  = new Date().getFullYear()
  const totalBottles = wines.reduce((sum, w) => sum + (w.quantity ?? 0), 0)
  const drunkCount   = history.reduce((sum, h) => sum + (h.quantity ?? 1), 0)

  const expiringSoon = wines.filter(
    (w) =>
      w.drinking_window_status === 'drink_now' ||
      (w.drinking_window_end != null && w.drinking_window_end <= currentYear)
  )

  const totalValue    = wines.reduce((sum, w) => sum + (w.cost ?? 0) * (w.quantity ?? 0), 0)
  const winesWithCost = wines.filter((w) => w.cost != null)
  const bottlesWithCost = winesWithCost.reduce((sum, w) => sum + (w.quantity ?? 0), 0)
  const avgPrice = bottlesWithCost > 0
    ? winesWithCost.reduce((sum, w) => sum + w.cost * (w.quantity ?? 0), 0) / bottlesWithCost
    : null

  const colourBottles = COLOUR_ORDER.reduce((acc, c) => {
    acc[c] = wines.filter((w) => w.colour === c).reduce((sum, w) => sum + (w.quantity ?? 0), 0)
    return acc
  }, {})

  const countryMap = {}
  wines.forEach((w) => {
    if (w.country) countryMap[w.country] = (countryMap[w.country] ?? 0) + (w.quantity ?? 0)
  })
  const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const grapeMap = {}
  wines.forEach((w) => {
    if (w.grape_variety) grapeMap[w.grape_variety] = (grapeMap[w.grape_variety] ?? 0) + (w.quantity ?? 0)
  })
  const topGrapes = Object.entries(grapeMap).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // ── Taste profile + sommelier notes (pure computation, no API) ─────────────
  const tasteProfile   = buildTasteProfile(history)
  const sommelierNotes = buildSommelierNotes(wines, wishlistItems, tasteProfile)

  // ── Drinking window filter ─────────────────────────────────────────────────
  const windowCounts = WINDOW_ORDER.reduce((acc, s) => {
    acc[s] = wines.filter((w) => w.drinking_window_status === s).length
    return acc
  }, {})
  const estimatedCount = WINDOW_ORDER.reduce((sum, s) => sum + windowCounts[s], 0)

  const filtered =
    windowFilter === 'all'
      ? wines
      : windowFilter === 'expiring_soon'
      ? expiringSoon
      : wines.filter((w) => w.drinking_window_status === windowFilter)

  // ── Refresh all drinking windows ──────────────────────────────────────────
  async function handleRefreshAll() {
    if (!wines.length) return
    setRefreshing(true)
    setRefreshError(null)
    setRefreshProgress({ done: 0, total: wines.length })
    try {
      const results = await estimateAndSaveWindows(wines, (done, total) => {
        setRefreshProgress({ done, total })
      })
      setWines((prev) =>
        prev.map((wine) => {
          const r = results.find((x) => x.wine_id === wine.id)
          return r
            ? { ...wine, drinking_window_status: r.status, drinking_window_note: r.note, drinking_window_start: r.start_year ?? null, drinking_window_end: r.end_year ?? null }
            : wine
        })
      )
    } catch (err) {
      setRefreshError(err.message)
    } finally {
      setRefreshing(false)
      setRefreshProgress(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Expiring soon banner ─────────────────────────────────────────── */}
      {!loading && expiringSoon.length > 0 && (
        <button
          onClick={() => setWindowFilter(windowFilter === 'expiring_soon' ? 'all' : 'expiring_soon')}
          className={`w-full text-left flex items-center justify-between gap-3 card transition-colors duration-100 ${
            windowFilter === 'expiring_soon'
              ? 'border-amber-700 bg-amber-950/50'
              : 'border-amber-900 bg-amber-950/20 hover:border-amber-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-300">
                {expiringSoon.length} {expiringSoon.length === 1 ? 'wine' : 'wines'} to drink soon
              </p>
              <p className="text-xs text-amber-500 mt-0.5">
                {windowFilter === 'expiring_soon' ? 'Tap to show all' : 'Tap to filter'}
              </p>
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-amber-500 flex-shrink-0 transition-transform duration-150 ${windowFilter === 'expiring_soon' ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Bottles"
          value={loading ? '—' : totalBottles}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 22h8M12 11v11M7 3h10l1 7a5 5 0 01-5 5h0a5 5 0 01-5-5l1-7z" />
            </svg>
          }
        />
        <StatCard
          label="Unique Wines"
          value={loading ? '—' : wines.length}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      {/* ── Collection stats ─────────────────────────────────────────────── */}
      {!loading && wines.length > 0 && (
        <div className="card space-y-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Collection</p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Cellar Value</p>
              <p className="text-sm font-bold text-neutral-100">
                {totalValue > 0 ? `S$${Math.round(totalValue).toLocaleString()}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Avg / Bottle</p>
              <p className="text-sm font-bold text-neutral-100">
                {avgPrice != null ? `S$${Math.round(avgPrice)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Drunk</p>
              <p className="text-sm font-bold text-neutral-100">{drunkCount}</p>
            </div>
          </div>

          {totalBottles > 0 && COLOUR_ORDER.some((c) => colourBottles[c] > 0) && (
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              {COLOUR_ORDER.filter((c) => colourBottles[c] > 0).map((c) => {
                const meta = COLOUR_META[c]
                const pct  = Math.round((colourBottles[c] / totalBottles) * 100)
                return (
                  <div key={c} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <span className="text-xs text-neutral-500 w-14 capitalize">{meta.label}</span>
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-neutral-500 w-6 text-right">{colourBottles[c]}</span>
                  </div>
                )
              })}
            </div>
          )}

          {(topCountries.length > 0 || topGrapes.length > 0) && (
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-neutral-800">
              {topCountries.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-500">Top Countries</p>
                  {topCountries.map(([name, count]) => (
                    <div key={name} className="flex items-baseline justify-between gap-1">
                      <span className="text-xs text-neutral-400 truncate">{name}</span>
                      <span className="text-xs text-neutral-600 flex-shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {topGrapes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-500">Top Grapes</p>
                  {topGrapes.map(([name, count]) => (
                    <div key={name} className="flex items-baseline justify-between gap-1">
                      <span className="text-xs text-neutral-400 truncate">{name}</span>
                      <span className="text-xs text-neutral-600 flex-shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Taste Profile ────────────────────────────────────────────────── */}
      {!loading && tasteProfile && (
        <div className="card space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Taste Profile</p>
            <p className="text-xs text-neutral-600">Based on {tasteProfile.totalDrunk} bottles drunk</p>
          </div>

          {/* Top grape varieties */}
          {tasteProfile.topGrapes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Favourite Varieties</p>
              {tasteProfile.topGrapes.map(({ name, count, pct }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400 w-28 truncate">{name}</span>
                  <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-wine-600" style={{ width: `${Math.max(pct, 4)}%` }} />
                  </div>
                  <span className="text-xs text-neutral-600 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Colour preferences */}
          {tasteProfile.colourSplit.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <p className="text-xs text-neutral-500">Colour Preference</p>
              {tasteProfile.colourSplit.map(({ colour, count, pct }) => {
                const meta = COLOUR_META[colour]
                return (
                  <div key={colour} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta?.dot ?? 'bg-neutral-600'}`} />
                    <span className="text-xs text-neutral-500 w-14 capitalize">{colour}</span>
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${meta?.bar ?? 'bg-neutral-600'}`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-600 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Top countries drunk + avg spend */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-800">
            {tasteProfile.topCountries.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-neutral-500">Top Countries</p>
                {tasteProfile.topCountries.slice(0, 3).map(({ name, count }) => (
                  <div key={name} className="flex items-baseline justify-between gap-1">
                    <span className="text-xs text-neutral-400 truncate">{name}</span>
                    <span className="text-xs text-neutral-600 flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {tasteProfile.avgPrice != null && (
              <div className="space-y-1">
                <p className="text-xs text-neutral-500">Avg Spend</p>
                <p className="text-lg font-bold text-neutral-100">S${Math.round(tasteProfile.avgPrice)}</p>
                <p className="text-xs text-neutral-600">per bottle</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sommelier Notes ───────────────────────────────────────────────── */}
      {!loading && sommelierNotes.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-wine-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Sommelier Notes</p>
          </div>
          <div className="space-y-3">
            {sommelierNotes.map((note, i) => (
              <SommelierNote key={i} note={note} />
            ))}
          </div>
        </div>
      )}

      {/* ── Drinking window section ───────────────────────────────────────── */}
      {!loading && wines.length > 0 && (
        <div className="space-y-3">

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Drinking Windows</p>
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-100 disabled:opacity-50 transition-colors duration-150 px-2 py-1 rounded-lg hover:bg-neutral-800"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing
                ? (refreshProgress?.done > 0
                    ? `${refreshProgress.done} / ${refreshProgress.total} done…`
                    : 'Refreshing…')
                : estimatedCount === 0 ? 'Estimate All' : 'Refresh All'}
            </button>
          </div>

          {refreshError && <p className="text-xs text-red-400">{refreshError}</p>}

          {estimatedCount > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
              {WINDOW_ORDER.filter((s) => windowCounts[s] > 0).map((s) => {
                const style  = WINDOW_STYLES[s]
                const active = windowFilter === s
                return (
                  <button
                    key={s}
                    onClick={() => setWindowFilter(active ? 'all' : s)}
                    className={`flex-shrink-0 snap-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-100 ${
                      active
                        ? style.filter
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                    {style.label}
                    <span className="font-bold">{windowCounts[s]}</span>
                  </button>
                )
              })}
              {windowFilter !== 'all' && (
                <button
                  onClick={() => setWindowFilter('all')}
                  className="flex-shrink-0 snap-start px-3 py-1.5 rounded-lg text-xs font-medium border bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500 transition-colors duration-100"
                >
                  Show all
                </button>
              )}
            </div>
          )}

          {estimatedCount === 0 && (
            <p className="text-xs text-neutral-600">
              Tap "Estimate All" to analyse drinking windows for your entire cellar.
            </p>
          )}
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          <p className="font-medium mb-1">Could not load wines</p>
          <p className="text-red-400/80">{error}</p>
          <p className="mt-2 text-red-400/60 text-xs">Make sure your Supabase credentials are correct.</p>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-4 bg-neutral-800 rounded w-2/3" />
              <div className="h-3 bg-neutral-800 rounded w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-3 bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty cellar ─────────────────────────────────────────────────── */}
      {!loading && !error && wines.length === 0 && (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-wine-950 flex items-center justify-center">
            <svg className="w-7 h-7 text-wine-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 22h8M12 11v11M7 3h10l1 7a5 5 0 01-5 5h0a5 5 0 01-5-5l1-7z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-neutral-200">Your cellar is empty</p>
            <p className="text-sm text-neutral-500 mt-1">Add your first wine to get started.</p>
          </div>
          <Link to="/add" className="btn-primary text-sm">Add a Wine</Link>
        </div>
      )}

      {/* ── Filter label ─────────────────────────────────────────────────── */}
      {!loading && wines.length > 0 && windowFilter !== 'all' && (
        <p className="text-xs text-neutral-500">
          {filtered.length} {filtered.length === 1 ? 'wine' : 'wines'} ·{' '}
          {windowFilter === 'expiring_soon'
            ? 'Drink soon'
            : WINDOW_STYLES[windowFilter]?.label}
        </p>
      )}

      {/* ── Wine cards ───────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((wine) => (
            <WineCard key={wine.id} wine={wine} />
          ))}
        </div>
      )}

      {/* ── No results for active filter ─────────────────────────────────── */}
      {!loading && wines.length > 0 && windowFilter !== 'all' && filtered.length === 0 && (
        <div className="card text-center py-6 text-neutral-500 text-sm">
          No wines matching this filter.
        </div>
      )}
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-wine-950 flex items-center justify-center text-wine-400 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-neutral-100 leading-none mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function SommelierNote({ note }) {
  const SEVERITY_STYLES = {
    amber: { text: 'text-amber-300', icon: 'text-amber-400' },
    blue:  { text: 'text-sky-300',   icon: 'text-sky-400' },
    green: { text: 'text-green-300', icon: 'text-green-400' },
  }
  const s = SEVERITY_STYLES[note.severity] ?? SEVERITY_STYLES.amber

  let icon
  if (note.type === 'drink_now' || note.type === 'closing_window') {
    icon = (
      <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  } else if (note.type === 'low_stock') {
    icon = (
      <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  } else {
    icon = (
      <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )
  }

  return (
    <div className="flex gap-2.5 items-start">
      {icon}
      <div className="min-w-0">
        <p className={`text-sm font-medium leading-snug ${s.text}`}>{note.title}</p>
        {note.detail && (
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{note.detail}</p>
        )}
      </div>
    </div>
  )
}
