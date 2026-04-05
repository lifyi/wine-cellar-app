import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { COLOUR_STYLES } from '../components/ColourBadge'
import DrinkingWindowBadge from '../components/DrinkingWindowBadge'
import DrinkConfirmModal from '../components/DrinkConfirmModal'
import { getWines, drinkOne, deleteWine } from '../lib/wines'
import { addToWishlistIfNew } from '../lib/wishlist'

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
  const [wishlistStatuses, setWishlistStatuses] = useState({}) // id → 'pending'|'added'|'duplicate'

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

  async function handleWishlist(wine) {
    const id = wine.id
    setWishlistStatuses((prev) => ({ ...prev, [id]: 'pending' }))
    try {
      const result = await addToWishlistIfNew({
        name:          wine.name,
        producer:      wine.producer      ?? null,
        vintage:       wine.vintage       ?? null,
        region:        wine.region        ?? null,
        country:       wine.country       ?? null,
        grape_variety: wine.grape_variety ?? null,
        colour:        wine.colour        ?? 'red',
        james_suckling: wine.james_suckling ?? null,
        robert_parker:  wine.robert_parker  ?? null,
        wine_spectator: wine.wine_spectator ?? null,
        cost:   wine.cost ?? null,
        source: 'Currently in cellar — want more',
      })
      const status = result.duplicate ? 'duplicate' : 'added'
      setWishlistStatuses((prev) => ({ ...prev, [id]: status }))
      setTimeout(() => setWishlistStatuses((prev) => {
        const next = { ...prev }; delete next[id]; return next
      }), 3000)
    } catch {
      setWishlistStatuses((prev) => {
        const next = { ...prev }; delete next[id]; return next
      })
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
            table: 'wines',
            wines: batch.map((w) => ({
              id:          w.id,
              name:        w.name,
              producer:    w.producer  ?? null,
              vintage:     w.vintage   ?? null,
              region:      w.region    ?? null,
              country:     w.country   ?? null,
              // Only tell the server which fields are null — it won't touch the rest
              null_fields: ['james_suckling', 'robert_parker', 'wine_spectator'].filter((f) => w[f] === null),
            })),
          }),
        })
        const data = await res.json()
        const results = data.results ?? []

        // Server already saved — update local state for null fields only
        for (const result of results) {
          const wine = batch.find((w) => w.id === result.id)
          const nullFields = wine
            ? ['james_suckling', 'robert_parker', 'wine_spectator'].filter((f) => wine[f] === null)
            : []
          const update = {}
          for (const field of nullFields) { update[field] = result[field] ?? -1 }
          if (Object.keys(update).length > 0) {
            setWines((prev) => prev.map((w) => (w.id === result.id ? { ...w, ...update } : w)))
          }
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-800 rounded w-2/3" />
                  <div className="h-3 bg-neutral-800 rounded w-1/3" />
                </div>
                <div className="h-5 w-16 bg-neutral-800 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-3 bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-800 rounded" />
              </div>
              <div className="h-3 bg-neutral-800 rounded w-1/2" />
              <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                <div className="h-4 w-20 bg-neutral-800 rounded" />
                <div className="h-8 w-28 bg-neutral-800 rounded-lg" />
              </div>
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

      {/* Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((wine) => (
            <InventoryRow
              key={wine.id}
              wine={wine}
              drinkPending={pendingDrink === wine.id}
              deletePending={pendingDelete === wine.id}
              onDrink={() => setModalWine(wine)}
              onDelete={() => handleDelete(wine.id)}
              wishlistState={wishlistStatuses[wine.id] ?? null}
              onWishlist={() => handleWishlist(wine)}
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

function InventoryRow({ wine, drinkPending, deletePending, onDrink, onDelete, wishlistState, onWishlist }) {
  const style = COLOUR_STYLES[wine.colour] ?? COLOUR_STYLES.red

  const ratingParts = []
  if (wine.james_suckling > 0) ratingParts.push(`JS ${wine.james_suckling}`)
  if (wine.robert_parker  > 0) ratingParts.push(`RP ${wine.robert_parker}`)
  if (wine.wine_spectator > 0) ratingParts.push(`WS ${wine.wine_spectator}`)

  return (
    <div className="card space-y-3">

      {/* Header — name + producer left, colour + window badges right */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-100 leading-snug">{wine.name}</h3>
          {wine.producer && (
            <p className="text-sm text-neutral-400">{wine.producer}</p>
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className={`colour-badge ${style.badge}`}>
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
            {style.label}
          </span>
          <DrinkingWindowBadge
            status={wine.drinking_window_status}
            startYear={wine.drinking_window_start}
            endYear={wine.drinking_window_end}
          />
        </div>
      </div>

      {/* Details grid */}
      {(wine.vintage || wine.region || wine.country || wine.grape_variety || wine.cost != null) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {wine.vintage      && <Detail label="Vintage" value={wine.vintage} />}
          {wine.region       && <Detail label="Region"  value={wine.region} />}
          {wine.country      && <Detail label="Country" value={wine.country} />}
          {wine.grape_variety && <Detail label="Grape"  value={wine.grape_variety} />}
          {wine.cost != null  && <Detail label="Cost"   value={`S$${Number(wine.cost).toFixed(2)}`} />}
        </div>
      )}

      {/* Critic ratings */}
      {ratingParts.length > 0 && (
        <p className="text-xs font-mono text-neutral-400 tracking-wide">{ratingParts.join(' · ')}</p>
      )}

      {/* Drinking window note */}
      {wine.drinking_window_note && (
        <p className="text-xs text-neutral-500 leading-relaxed">{wine.drinking_window_note}</p>
      )}

      {/* Notes — full text, no truncation */}
      {wine.notes && (
        <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{wine.notes}</p>
      )}

      {/* Wishlist feedback */}
      {wishlistState === 'added' && (
        <p className="text-xs text-wine-400">Added to your wishlist!</p>
      )}
      {wishlistState === 'duplicate' && (
        <p className="text-xs text-neutral-500">Already on your wishlist</p>
      )}

      {/* Footer: quantity left, actions right */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-800">

        {/* Quantity */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 22h8M12 11v11M7 3h10l1 7a5 5 0 01-5 5h0a5 5 0 01-5-5l1-7z" />
          </svg>
          <span className="text-sm text-neutral-400">
            <span className="text-neutral-100 font-semibold">{wine.quantity}</span>{' '}
            {wine.quantity === 1 ? 'bottle' : 'bottles'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">

          {/* Add to wishlist */}
          <WishlistButton state={wishlistState} onClick={onWishlist} />

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
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-neutral-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-neutral-200 truncate">{value}</p>
    </div>
  )
}

// Heart button — 4 visual states: idle, pending, added, duplicate
function WishlistButton({ state, onClick }) {
  if (state === 'pending') {
    return (
      <button disabled className="p-2 text-neutral-500 opacity-50 rounded-lg">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </button>
    )
  }
  if (state === 'added') {
    return (
      <button disabled title="Added to wishlist" className="p-2 text-wine-400 rounded-lg">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    )
  }
  if (state === 'duplicate') {
    return (
      <button disabled title="Already on your wishlist" className="p-2 text-neutral-600 rounded-lg">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      title="Add to wishlist"
      className="p-2 text-neutral-500 hover:text-wine-400 transition-colors duration-100 rounded-lg hover:bg-neutral-800"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  )
}
