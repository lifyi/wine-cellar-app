import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ColourBadge, { COLOUR_STYLES } from '../components/ColourBadge'
import DrinkingWindowBadge from '../components/DrinkingWindowBadge'
import DrinkConfirmModal from '../components/DrinkConfirmModal'
import { getWines, drinkOne, deleteWine } from '../lib/wines'

const COLOURS = ['all', 'red', 'white', 'rosé', 'sparkling', 'dessert']

export default function Inventory() {
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [colourFilter, setColourFilter] = useState('all')
  const [pendingDrink, setPendingDrink] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [modalWine, setModalWine] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState(null) // { done, total }
  const [refreshDone, setRefreshDone] = useState(false)

  useEffect(() => {
    getWines()
      .then(setWines)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = wines.filter((w) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      w.name?.toLowerCase().includes(q) ||
      w.producer?.toLowerCase().includes(q) ||
      w.region?.toLowerCase().includes(q) ||
      w.country?.toLowerCase().includes(q) ||
      w.grape_variety?.toLowerCase().includes(q) ||
      String(w.vintage ?? '').includes(q)
    const matchesColour = colourFilter === 'all' || w.colour === colourFilter
    return matchesSearch && matchesColour
  })

  // Wines where at least one critic field has never been attempted (null = not yet tried)
  const missingRatings = wines.filter(
    (w) => w.james_suckling === null || w.robert_parker === null || w.wine_spectator === null
  )

  async function handleDrinkOne(wine, note) {
    setModalWine(null)
    setPendingDrink(wine.id)
    try {
      const updated = await drinkOne(wine, note)
      setWines((prev) =>
        updated
          ? prev.map((w) => (w.id === wine.id ? updated : w))
          : prev.filter((w) => w.id !== wine.id)
      )
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setPendingDrink(null)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this wine from your cellar entirely?')) return
    setPendingDelete(id)
    try {
      await deleteWine(id)
      setWines((prev) => prev.filter((w) => w.id !== id))
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setPendingDelete(null)
    }
  }

  // Bulk refresh — only processes wines with no ratings, in batches of 20
  const RATINGS_BATCH_SIZE = 20
  const RATINGS_DELAY_MS   = 2000

  async function handleRefreshRatings() {
    if (missingRatings.length === 0 || refreshing) return
    setRefreshing(true)
    setRefreshDone(false)
    setRefreshProgress({ done: 0, total: missingRatings.length })

    let done = 0
    for (let i = 0; i < missingRatings.length; i += RATINGS_BATCH_SIZE) {
      // 2-second delay between batches (not before the first)
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, RATINGS_DELAY_MS))

      const batch = missingRatings.slice(i, i + RATINGS_BATCH_SIZE)

      try {
        const res = await fetch('/api/get-ratings-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wines: batch.map((w) => ({ id: w.id, name: w.name, vintage: w.vintage ?? null })),
          }),
        })
        const data = await res.json()
        const results = data.results ?? []

        // Server already saved results to Supabase — just update local React state
        for (const result of results) {
          const update = {
            james_suckling: result.james_suckling ?? -1,
            robert_parker:  result.robert_parker  ?? -1,
            wine_spectator: result.wine_spectator ?? -1,
          }
          setWines((prev) =>
            prev.map((w) => (w.id === result.id ? { ...w, ...update } : w))
          )
          done += 1
          setRefreshProgress({ done, total: missingRatings.length })
        }
      } catch {
        // skip entire batch on network error; advance counter
        done += batch.length
        setRefreshProgress({ done, total: missingRatings.length })
      }
    }

    setRefreshing(false)
    setRefreshDone(true)
    setRefreshProgress(null)
    // Clear the done banner after a few seconds
    setTimeout(() => setRefreshDone(false), 4000)
  }

  return (
    <div className="space-y-4">

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search wines…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Colour filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        {COLOURS.map((c) => {
          const active = c === colourFilter
          const style = c !== 'all' ? COLOUR_STYLES[c] : null
          return (
            <button
              key={c}
              onClick={() => setColourFilter(c)}
              className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-100 capitalize ${
                active
                  ? c === 'all'
                    ? 'bg-wine-700 text-white border-wine-600'
                    : `${style.badge} border-current`
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {c === 'all' ? 'All' : c}
            </button>
          )
        })}
      </div>

      {/* Refresh Ratings — shown when wines are missing ratings */}
      {!loading && missingRatings.length > 0 && (
        <button
          onClick={handleRefreshRatings}
          disabled={refreshing}
          className="w-full flex items-center justify-center gap-2 btn-secondary text-sm disabled:opacity-60"
        >
          {refreshing ? (
            <>
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {refreshProgress?.done > 0
                ? `${refreshProgress.done} / ${refreshProgress.total} done…`
                : 'Fetching ratings…'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Refresh Ratings ({missingRatings.length} missing)
            </>
          )}
        </button>
      )}

      {/* Refresh done banner */}
      {refreshDone && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ratings updated — wines already rated were left unchanged
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          Could not load inventory: {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-neutral-800 rounded w-3/4" />
                <div className="h-3 bg-neutral-800 rounded w-1/2" />
              </div>
              <div className="h-8 w-20 bg-neutral-800 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="card text-center py-8 text-neutral-500">
          {wines.length === 0
            ? 'No wines in your cellar yet.'
            : 'No wines match your search.'}
        </div>
      )}

      {/* Result count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-neutral-500">
          {filtered.length} {filtered.length === 1 ? 'wine' : 'wines'}
          {colourFilter !== 'all' && ` · ${colourFilter}`}
        </p>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((wine) => (
            <InventoryRow
              key={wine.id}
              wine={wine}
              drinkPending={pendingDrink === wine.id}
              deletePending={pendingDelete === wine.id}
              onDrink={() => setModalWine(wine)}
              onDelete={() => handleDelete(wine.id)}
            />
          ))}
        </div>
      )}

      {/* Drink confirm modal */}
      {modalWine && (
        <DrinkConfirmModal
          wine={modalWine}
          onConfirm={(note) => handleDrinkOne(modalWine, note)}
          onCancel={() => setModalWine(null)}
        />
      )}
    </div>
  )
}

function InventoryRow({ wine, drinkPending, deletePending, onDrink, onDelete }) {
  return (
    <div className="card flex items-center gap-3">
      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-neutral-100 truncate">{wine.name}</span>
          {wine.vintage && (
            <span className="text-xs text-neutral-500 flex-shrink-0">{wine.vintage}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {wine.producer && (
            <span className="text-xs text-neutral-500 truncate">{wine.producer}</span>
          )}
          <ColourBadge colour={wine.colour} />
          {wine.cost != null && (
            <span className="text-xs text-neutral-500">S${Number(wine.cost).toFixed(2)}</span>
          )}
          <DrinkingWindowBadge
            status={wine.drinking_window_status}
            startYear={wine.drinking_window_start}
            endYear={wine.drinking_window_end}
          />
        </div>
        {(wine.region || wine.grape_variety) && (
          <p className="text-xs text-neutral-600 truncate">
            {[wine.grape_variety, wine.region, wine.country].filter(Boolean).join(' · ')}
          </p>
        )}
        {wine.drinking_window_note && (
          <p className="text-xs text-neutral-600 truncate">{wine.drinking_window_note}</p>
        )}
        {(() => {
          const parts = []
          if (wine.james_suckling > 0) parts.push(`JS ${wine.james_suckling}`)
          if (wine.robert_parker  > 0) parts.push(`RP ${wine.robert_parker}`)
          if (wine.wine_spectator > 0) parts.push(`WS ${wine.wine_spectator}`)
          return parts.length > 0 ? (
            <p className="text-xs font-mono text-neutral-500 truncate">{parts.join(' · ')}</p>
          ) : null
        })()}
      </div>

      {/* Quantity + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-lg font-bold text-neutral-100 w-7 text-center">
          {wine.quantity}
        </span>

        {/* Edit */}
        <Link
          to={`/edit/${wine.id}`}
          title="Edit wine"
          className="p-2 text-neutral-500 hover:text-neutral-100 transition-colors duration-100 rounded-lg hover:bg-neutral-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Link>

        {/* Drink one */}
        <button
          onClick={onDrink}
          disabled={drinkPending || deletePending}
          title="Drink one bottle"
          className="flex items-center gap-1.5 bg-wine-800 hover:bg-wine-700 active:bg-wine-900 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors duration-100"
        >
          {drinkPending ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
          Drink
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={drinkPending || deletePending}
          title="Remove wine"
          className="p-2 text-neutral-600 hover:text-red-400 disabled:opacity-50 transition-colors duration-100 rounded-lg hover:bg-neutral-800"
        >
          {deletePending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
