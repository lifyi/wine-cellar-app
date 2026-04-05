import { useEffect, useState } from 'react'
import ColourBadge from '../components/ColourBadge'
import { getDrinkingHistory } from '../lib/wines'
import { addToWishlistIfNew } from '../lib/wishlist'

// Format a date into a friendly string, e.g. "Today · 2:45 PM" or "3 Apr 2026"
function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart - 86400000)

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (d >= todayStart) return `Today · ${time}`
  if (d >= yesterdayStart) return `Yesterday · ${time}`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ` · ${time}`
}

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wishlistStatuses, setWishlistStatuses] = useState({}) // id → 'pending'|'added'|'duplicate'

  useEffect(() => {
    getDrinkingHistory()
      .then(setHistory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleWishlist(entry) {
    const id = entry.id
    setWishlistStatuses((prev) => ({ ...prev, [id]: 'pending' }))
    try {
      const result = await addToWishlistIfNew({
        name:          entry.wine_name,
        producer:      entry.producer      ?? null,
        vintage:       entry.vintage       ?? null,
        region:        entry.region        ?? null,
        country:       entry.country       ?? null,
        grape_variety: entry.grape_variety ?? null,
        colour:        entry.colour        ?? 'red',
        // Ratings not snapshotted in drinking_history — leave null for Refresh Ratings
        james_suckling: null,
        robert_parker:  null,
        wine_spectator: null,
        cost:   entry.cost ?? null,
        source: 'Previously owned — from drinking history',
      })
      const status = result.duplicate ? 'duplicate' : 'added'
      setWishlistStatuses((prev) => ({ ...prev, [id]: status }))
      // Clear after 3 s so the button is usable again
      setTimeout(() => setWishlistStatuses((prev) => {
        const next = { ...prev }; delete next[id]; return next
      }), 3000)
    } catch {
      setWishlistStatuses((prev) => {
        const next = { ...prev }; delete next[id]; return next
      })
    }
  }

  return (
    <div className="space-y-4">

      {/* Error */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          Could not load history: {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-neutral-800 rounded w-3/4" />
                <div className="h-3 bg-neutral-800 rounded w-1/2" />
              </div>
              <div className="h-5 w-16 bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && history.length === 0 && (
        <div className="card text-center py-12 space-y-2">
          <svg className="w-10 h-10 text-neutral-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-neutral-500 text-sm">No drinks logged yet.</p>
          <p className="text-neutral-600 text-xs">Tap "Drink" on any bottle in your inventory to start tracking.</p>
        </div>
      )}

      {/* Count */}
      {!loading && history.length > 0 && (
        <p className="text-xs text-neutral-500">
          {history.length} {history.length === 1 ? 'bottle' : 'bottles'} consumed
        </p>
      )}

      {/* History list */}
      {!loading && history.length > 0 && (
        <div className="space-y-2">
          {history.map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              wishlistState={wishlistStatuses[entry.id] ?? null}
              onWishlist={() => handleWishlist(entry)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryRow({ entry, wishlistState, onWishlist }) {
  return (
    <div className="card space-y-2">
      {/* Top row: info + wishlist button + date */}
      <div className="flex items-start gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-neutral-100 truncate">{entry.wine_name}</span>
            {entry.vintage && (
              <span className="text-xs text-neutral-500 flex-shrink-0">{entry.vintage}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {entry.producer && (
              <span className="text-xs text-neutral-500 truncate">{entry.producer}</span>
            )}
            {entry.colour && <ColourBadge colour={entry.colour} />}
            {entry.cost != null && (
              <span className="text-xs text-neutral-500">S${Number(entry.cost).toFixed(2)}</span>
            )}
          </div>
          {(entry.region || entry.grape_variety) && (
            <p className="text-xs text-neutral-600 truncate">
              {[entry.grape_variety, entry.region, entry.country].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Right: wishlist button + date stacked */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <WishlistButton state={wishlistState} onClick={onWishlist} />
          <p className="text-xs text-neutral-400 leading-snug">{formatDate(entry.drunk_at)}</p>
        </div>
      </div>

      {/* Wishlist feedback */}
      {wishlistState === 'added' && (
        <p className="text-xs text-wine-400">Added to your wishlist!</p>
      )}
      {wishlistState === 'duplicate' && (
        <p className="text-xs text-neutral-500">Already on your wishlist</p>
      )}

      {/* Note */}
      {entry.note && (
        <div className="flex gap-2 items-start pt-1 border-t border-neutral-800">
          <svg className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <p className="text-xs text-neutral-400 leading-relaxed">{entry.note}</p>
        </div>
      )}
    </div>
  )
}

// Shared heart button — 4 visual states: idle, pending, added, duplicate
function WishlistButton({ state, onClick }) {
  if (state === 'pending') {
    return (
      <button disabled className="p-1.5 text-neutral-500 opacity-50 rounded-lg">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </button>
    )
  }
  if (state === 'added') {
    return (
      <button disabled title="Added to wishlist" className="p-1.5 text-wine-400 rounded-lg">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    )
  }
  if (state === 'duplicate') {
    return (
      <button disabled title="Already on your wishlist" className="p-1.5 text-neutral-600 rounded-lg">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    )
  }
  // idle
  return (
    <button
      onClick={onClick}
      title="Add to wishlist"
      className="p-1.5 text-neutral-500 hover:text-wine-400 transition-colors duration-100 rounded-lg hover:bg-neutral-800"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  )
}
