import DrinkingWindowBadge from './DrinkingWindowBadge'

const COLOUR_STYLES = {
  red:       { dot: 'bg-red-700',    badge: 'bg-red-950 text-red-300',       label: 'Red' },
  white:     { dot: 'bg-yellow-300', badge: 'bg-yellow-950 text-yellow-300', label: 'White' },
  rosé:      { dot: 'bg-pink-400',   badge: 'bg-pink-950 text-pink-300',     label: 'Rosé' },
  sparkling: { dot: 'bg-sky-300',    badge: 'bg-sky-950 text-sky-300',       label: 'Sparkling' },
  dessert:   { dot: 'bg-amber-400',  badge: 'bg-amber-950 text-amber-300',   label: 'Dessert' },
}

export default function WishlistCard({ item, onAddToCellar, onRemove, addingId, removingId }) {
  const style = COLOUR_STYLES[item.colour] ?? COLOUR_STYLES.red
  const isAdding   = addingId   === item.id
  const isRemoving = removingId === item.id
  const busy = isAdding || isRemoving

  return (
    <div className="card space-y-3">

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-100 leading-snug truncate">{item.name}</h3>
          {item.producer && (
            <p className="text-sm text-neutral-400 truncate">{item.producer}</p>
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className={`colour-badge ${style.badge}`}>
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
            {style.label}
          </span>
          {item.drinking_window_status && (
            <DrinkingWindowBadge
              status={item.drinking_window_status}
              startYear={item.drinking_window_start}
              endYear={item.drinking_window_end}
            />
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {item.vintage && <Detail label="Vintage" value={item.vintage} />}
        {item.region  && <Detail label="Region"  value={item.region} />}
        {item.country && <Detail label="Country" value={item.country} />}
        {item.grape_variety && <Detail label="Grape" value={item.grape_variety} />}
        {item.cost != null && (
          <Detail label="Est. Cost" value={`S$${Number(item.cost).toFixed(0)}`} />
        )}
      </div>

      {/* Critic ratings */}
      {(() => {
        const parts = []
        if (item.james_suckling > 0) parts.push(`JS ${item.james_suckling}`)
        if (item.robert_parker  > 0) parts.push(`RP ${item.robert_parker}`)
        if (item.wine_spectator > 0) parts.push(`WS ${item.wine_spectator}`)
        return parts.length > 0 ? (
          <p className="text-xs font-mono text-neutral-400 tracking-wide">{parts.join(' · ')}</p>
        ) : null
      })()}

      {/* Drinking window note */}
      {item.drinking_window_note && (
        <p className="text-xs text-neutral-600 truncate">{item.drinking_window_note}</p>
      )}

      {/* Notes */}
      {item.notes && (
        <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">{item.notes}</p>
      )}

      {/* Source */}
      {item.source && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {item.source}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-neutral-800">
        {/* Add to cellar */}
        <button
          onClick={() => onAddToCellar(item)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 bg-wine-800 hover:bg-wine-700 active:bg-wine-900 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors duration-100"
        >
          {isAdding ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          )}
          {isAdding ? 'Adding…' : 'Add to Cellar'}
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(item.id)}
          disabled={busy}
          title="Remove from wishlist"
          className="p-2 text-neutral-600 hover:text-red-400 disabled:opacity-50 transition-colors duration-100 rounded-lg hover:bg-neutral-800"
        >
          {isRemoving ? (
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

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-neutral-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-neutral-200 truncate">{value}</p>
    </div>
  )
}
