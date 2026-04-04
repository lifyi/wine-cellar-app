import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import WineCard from '../components/WineCard'
import { getWines } from '../lib/wines'

export default function Dashboard() {
  const [wines, setWines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getWines()
      .then(setWines)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const totalBottles = wines.reduce((sum, w) => sum + (w.quantity ?? 0), 0)

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

      {/* Error state */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          <p className="font-medium mb-1">Could not load wines</p>
          <p className="text-red-400/80">{error}</p>
          <p className="mt-2 text-red-400/60 text-xs">Make sure your Supabase credentials are set in the <code>.env</code> file.</p>
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

      {/* Empty state */}
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
          <Link to="/add" className="btn-primary text-sm">
            Add a Wine
          </Link>
        </div>
      )}

      {/* Wine cards */}
      {!loading && !error && wines.length > 0 && (
        <div className="space-y-3">
          {wines.map((wine) => (
            <WineCard key={wine.id} wine={wine} />
          ))}
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
