import { useState } from 'react'
import { Link } from 'react-router-dom'
import WineCard from '../components/WineCard'
import DrinkConfirmModal from '../components/DrinkConfirmModal'
import { getWines, drinkOne } from '../lib/wines'
import { getWishlist } from '../lib/wishlist'

export default function Pair() {
  const [meal, setMeal] = useState('')
  const [occasion, setOccasion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [generalAdvice, setGeneralAdvice] = useState(null)
  const [wishlistSuggestions, setWishlistSuggestions] = useState(null)
  const [wineMap, setWineMap] = useState({})
  const [pendingDrink, setPendingDrink] = useState(null)
  const [drankIds, setDrankIds] = useState(new Set())
  const [modalWine, setModalWine] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!meal.trim()) return
    setLoading(true)
    setError(null)
    setRecommendations(null)
    setGeneralAdvice(null)
    setWishlistSuggestions(null)
    setDrankIds(new Set())

    try {
      // Load inventory and wishlist in parallel
      const [wines, wishlist] = await Promise.all([getWines(), getWishlist().catch(() => [])])

      if (wines.length === 0) {
        setError('Your inventory is empty — add some wines first before pairing.')
        return
      }

      const res = await fetch('/api/pair-wine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal: meal.trim(), occasion: occasion || null, wines, wishlist }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pairing failed — please try again.')

      setWineMap(Object.fromEntries(wines.map((w) => [w.id, w])))
      setRecommendations(data.recommendations ?? [])
      setGeneralAdvice(data.general_advice ?? null)
      setWishlistSuggestions(data.wishlist_suggestions?.length ? data.wishlist_suggestions : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDrink(wine, note) {
    setModalWine(null)
    setPendingDrink(wine.id)
    try {
      const updated = await drinkOne(wine, note)
      setWineMap((prev) => ({
        ...prev,
        [wine.id]: updated ?? { ...wine, quantity: 0 },
      }))
      setDrankIds((prev) => new Set([...prev, wine.id]))
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setPendingDrink(null)
    }
  }

  return (
    <div className="space-y-5">

      {/* Meal input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-neutral-300">
            Hello, what are we having today?
          </label>
          <input
            type="text"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            placeholder="e.g. grilled lamb chops, sushi, mushroom risotto…"
            className="input-field"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-neutral-300">
            What's the occasion? <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="input-field"
            disabled={loading}
          >
            <option value="">No particular occasion</option>
            <option value="weeknight dinner">Weeknight dinner</option>
            <option value="dinner party">Dinner party</option>
            <option value="celebration">Celebration</option>
            <option value="casual drinks">Casual drinks</option>
            <option value="date night">Date night</option>
            <option value="barbecue">Barbecue</option>
            <option value="picnic">Picnic</option>
            <option value="gift">Gift</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !meal.trim()}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Finding pairings…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Find Pairings
            </span>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {recommendations !== null && (
        <div className="space-y-5">

          {/* No matches */}
          {recommendations.length === 0 && (
            <div className="card text-center py-8 space-y-2">
              <svg className="w-8 h-8 text-neutral-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-neutral-400 text-sm">No strong matches in your current inventory.</p>
              {generalAdvice && (
                <p className="text-neutral-500 text-xs leading-relaxed">{generalAdvice}</p>
              )}
            </div>
          )}

          {/* Wishlist suggestions — shown when inventory match is weak/absent */}
          {wishlistSuggestions && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Consider picking up from your wishlist
              </p>
              {wishlistSuggestions.map((ws) => (
                <div key={ws.wishlist_id} className="card space-y-2 border-wine-900/50 bg-wine-950/20">
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-wine-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-200">{ws.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{ws.explanation}</p>
                    </div>
                  </div>
                  <Link
                    to="/wishlist"
                    className="text-xs text-wine-400 hover:text-wine-300 transition-colors"
                  >
                    View wishlist →
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-8">
              {/* General advice shown above results if present */}
              {generalAdvice && (
                <p className="text-sm text-neutral-400 italic leading-relaxed">{generalAdvice}</p>
              )}

              {recommendations.map((rec, i) => {
                const wine = wineMap[rec.wine_id]
                if (!wine) return null
                const drank = drankIds.has(wine.id)
                const outOfStock = wine.quantity === 0

                return (
                  <div key={rec.wine_id} className="space-y-3">

                    {/* Rank label */}
                    <p className="text-xs font-semibold text-wine-400 uppercase tracking-widest">
                      #{i + 1} Recommendation
                    </p>

                    {/* Wine card */}
                    <WineCard wine={wine} />

                    {/* Pairing notes */}
                    <div className="card space-y-3 bg-neutral-900/60">
                      {/* Pairing explanation */}
                      <div className="flex gap-2.5 items-start">
                        <svg className="w-4 h-4 text-wine-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-neutral-200 leading-relaxed">{rec.explanation}</p>
                      </div>

                      {/* Drinking window */}
                      <div className="flex gap-2.5 items-start">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-neutral-400 leading-relaxed">{rec.drinking_window_note}</p>
                      </div>
                    </div>

                    {/* Drink button */}
                    {outOfStock ? (
                      <p className="text-center text-sm text-neutral-600 py-1">No bottles left in cellar</p>
                    ) : (
                      <button
                        onClick={() => setModalWine(wine)}
                        disabled={!!pendingDrink}
                        className={`w-full flex items-center justify-center gap-2 ${drank ? 'btn-secondary' : 'btn-primary'}`}
                      >
                        {pendingDrink === wine.id ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Logging…
                          </>
                        ) : drank ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Enjoyed! Drink another?
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                            </svg>
                            Drink this one
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Drink confirm modal */}
      {modalWine && (
        <DrinkConfirmModal
          wine={modalWine}
          onConfirm={(note) => handleDrink(modalWine, note)}
          onCancel={() => setModalWine(null)}
        />
      )}
    </div>
  )
}
