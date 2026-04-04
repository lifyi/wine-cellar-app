import DrinkingWindowBadge from './DrinkingWindowBadge'

const COLOUR_STYLES = {
  red:       { dot: 'bg-red-700',      badge: 'bg-red-950 text-red-300',      label: 'Red' },
  white:     { dot: 'bg-yellow-300',   badge: 'bg-yellow-950 text-yellow-300', label: 'White' },
  rosé:      { dot: 'bg-pink-400',     badge: 'bg-pink-950 text-pink-300',     label: 'Rosé' },
  sparkling: { dot: 'bg-sky-300',      badge: 'bg-sky-950 text-sky-300',       label: 'Sparkling' },
  dessert:   { dot: 'bg-amber-400',    badge: 'bg-amber-950 text-amber-300',   label: 'Dessert' },
}

export default function WineCard({ wine }) {
  const style = COLOUR_STYLES[wine.colour] ?? COLOUR_STYLES.red

  return (
    <div className="card space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-100 leading-snug truncate">{wine.name}</h3>
          <p className="text-sm text-neutral-400 truncate">{wine.producer}</p>
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {wine.vintage && (
          <Detail label="Vintage" value={wine.vintage} />
        )}
        {wine.region && (
          <Detail label="Region" value={wine.region} />
        )}
        {wine.country && (
          <Detail label="Country" value={wine.country} />
        )}
        {wine.grape_variety && (
          <Detail label="Grape" value={wine.grape_variety} />
        )}
        {wine.cost != null && (
          <Detail label="Cost" value={`S$${Number(wine.cost).toFixed(2)}`} />
        )}
      </div>

      {/* Critic ratings */}
      {wine.ratings && (
        <p className="text-xs font-mono text-neutral-400 tracking-wide">{wine.ratings}</p>
      )}

      {/* Notes */}
      {wine.notes && (
        <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">{wine.notes}</p>
      )}

      {/* Quantity pill */}
      <div className="flex items-center gap-2 pt-1 border-t border-neutral-800">
        <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 22h8M12 11v11M7 3h10l1 7a5 5 0 01-5 5h0a5 5 0 01-5-5l1-7z" />
        </svg>
        <span className="text-sm text-neutral-400">
          <span className="text-neutral-100 font-semibold">{wine.quantity}</span>{' '}
          {wine.quantity === 1 ? 'bottle' : 'bottles'}
        </span>
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
