// Shared styles — imported by Dashboard and Inventory too
export const WINDOW_STYLES = {
  drink_now: {
    label:  'Drink Now',
    badge:  'bg-red-950 text-red-300 border-red-900',
    dot:    'bg-red-400',
    filter: 'bg-red-900/40 text-red-300 border-red-800',
  },
  ready: {
    label:  'Ready',
    badge:  'bg-green-950 text-green-300 border-green-900',
    dot:    'bg-green-400',
    filter: 'bg-green-900/40 text-green-300 border-green-800',
  },
  hold: {
    label:  'Hold',
    badge:  'bg-amber-950 text-amber-300 border-amber-900',
    dot:    'bg-amber-400',
    filter: 'bg-amber-900/40 text-amber-300 border-amber-800',
  },
  past_peak: {
    label:  'Past Peak',
    badge:  'bg-neutral-800 text-neutral-400 border-neutral-700',
    dot:    'bg-neutral-500',
    filter: 'bg-neutral-700 text-neutral-300 border-neutral-600',
  },
}

export const WINDOW_ORDER = ['drink_now', 'ready', 'hold', 'past_peak']

// Format start/end years into a compact range string.
// If start is current year or earlier → "Now"; future start stays as a year.
export function formatWindowRange(startYear, endYear) {
  if (!startYear && !endYear) return null
  const currentYear = new Date().getFullYear()
  const start = startYear ? (startYear <= currentYear ? 'Now' : String(startYear)) : null
  const end   = endYear   ? String(endYear) : null
  if (start && end) return `${start}–${end}`
  if (end)          return `–${end}`
  if (start)        return `${start}–`
  return null
}

export default function DrinkingWindowBadge({ status, startYear, endYear }) {
  if (!status) return null
  const style = WINDOW_STYLES[status]
  if (!style) return null
  const range = formatWindowRange(startYear, endYear)

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      {style.label}
      {range && <span className="opacity-75">({range})</span>}
    </span>
  )
}
