import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import WineCard from '../components/WineCard'
import { WINDOW_STYLES, WINDOW_ORDER } from '../components/DrinkingWindowBadge'
import { getWines } from '../lib/wines'
import { estimateAndSaveWindows } from '../lib/drinkingWindow'

export default function Dashboard() {
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [windowFilter, setWindowFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)

  useEffect(() => {
    getWines()
      .then(setWines)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const totalBottles = wines.reduce((sum, w) => sum + (w.quantity ?? 0), 0)

  // Per-status counts
  const windowCounts = WINDOW_ORDER.reduce((acc, s) => {
    acc[s] = wines.filter((w) => w.drinking_window_status === s).length
    return acc
  }, {})
  const estimatedCount = WINDOW_ORDER.reduce((sum, s) => sum + windowCounts[s], 0)

  // Apply filter
  const filtered =
    windowFilter === 'all'
      ? wines
      : wines.filter((w) => w.drinking_window_status === windowFilter)

  async function handleRefreshAll() {
    if (!wines.length) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      const results = await estimateAndSaveWindows(wines)
      setWines((prev) =>
        prev.map((wine) => {
          const r = results.find((x) => x.wine_id === wine.id)
          return r
            ? { ...wine, drinking_window_status: r.status, drinking_window_note: r.note }
            : wine
        })
      )
    } catch (err) {
      setRefreshError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Stats bar */}
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

      {/* Drinking window section */}
      {!loading && wines.length > 0 && (
        <div className="space-y-3">

          {/* Header + Refresh button */}
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
              {refreshing ? 'Refreshing…' : estimatedCount === 0 ? 'Estimate All' : 'Refresh All'}
            </button>
          </div>

          {/* Refresh error */}
          {refreshError && <p className="text-xs text-red-400">{refreshError}</p>}

          {/* Summary chips — tap to filter */}
          {estimatedCount > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
              {WINDOW_ORDER.filter((s) => windowCounts[s] > 0).map((s) => {
                const style = WINDOW_STYLES[s]
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

          {/* Prompt if nothing estimated yet */}
          {estimatedCount === 0 && (
            <p className="text-xs text-neutral-600">
              Tap "Estimate All" to analyse drinking windows for your entire cellar.
            </p>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          <p className="font-medium mb-1">Could not load wines</p>
          <p className="text-red-400/80">{error}</p>
          <p className="mt-2 text-red-400/60 text-xs">Make sure your Supabase credentials are correct.</p>
        </div>
      )}

      {/* Loading skeleton */}
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

      {/* Empty cellar */}
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

      {/* Filter label */}
      {!loading && wines.length > 0 && windowFilter !== 'all' && (
        <p className="text-xs text-neutral-500">
          {filtered.length} {filtered.length === 1 ? 'wine' : 'wines'} · {WINDOW_STYLES[windowFilter]?.label}
        </p>
      )}

      {/* Wine cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((wine) => (
            <WineCard key={wine.id} wine={wine} />
          ))}
        </div>
      )}

      {/* No results for active filter */}
      {!loading && wines.length > 0 && windowFilter !== 'all' && filtered.length === 0 && (
        <div className="card text-center py-6 text-neutral-500 text-sm">
          No wines with "{WINDOW_STYLES[windowFilter]?.label}" status yet.
        </div>
      )}
    </div>
  )
}

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
