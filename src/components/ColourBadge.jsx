const COLOUR_STYLES = {
  red:       { dot: 'bg-red-700',      badge: 'bg-red-950 text-red-300',      label: 'Red' },
  white:     { dot: 'bg-yellow-300',   badge: 'bg-yellow-950 text-yellow-300', label: 'White' },
  rosé:      { dot: 'bg-pink-400',     badge: 'bg-pink-950 text-pink-300',     label: 'Rosé' },
  sparkling: { dot: 'bg-sky-300',      badge: 'bg-sky-950 text-sky-300',       label: 'Sparkling' },
  dessert:   { dot: 'bg-amber-400',    badge: 'bg-amber-950 text-amber-300',   label: 'Dessert' },
}

export default function ColourBadge({ colour }) {
  const style = COLOUR_STYLES[colour] ?? COLOUR_STYLES.red
  return (
    <span className={`colour-badge ${style.badge}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

export { COLOUR_STYLES }
