// Pure calculation functions — no API calls, no Supabase queries.
// All inputs come from data already loaded in the component.

const COLOUR_ORDER = ['red', 'white', 'rosé', 'sparkling', 'dessert']

/**
 * Build a taste profile from drinking history rows.
 * Returns null if there is no history to analyse.
 *
 * @param {Array} history — rows from the drinking_history table
 */
export function buildTasteProfile(history = []) {
  if (!history.length) return null

  // Each drinkOne() call logs quantity: 1, so sum gives total bottles drunk
  const totalDrunk = history.reduce((sum, h) => sum + (h.quantity ?? 1), 0)
  if (totalDrunk === 0) return null

  // ── Top 5 grape varieties ──────────────────────────────────────────────────
  const grapeMap = {}
  history.forEach((h) => {
    if (h.grape_variety) {
      grapeMap[h.grape_variety] = (grapeMap[h.grape_variety] ?? 0) + (h.quantity ?? 1)
    }
  })
  const topGrapes = Object.entries(grapeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / totalDrunk) * 100) }))

  // ── Top 5 countries ────────────────────────────────────────────────────────
  const countryMap = {}
  history.forEach((h) => {
    if (h.country) {
      countryMap[h.country] = (countryMap[h.country] ?? 0) + (h.quantity ?? 1)
    }
  })
  const topCountries = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / totalDrunk) * 100) }))

  // ── Colour split ──────────────────────────────────────────────────────────
  const colourMap = {}
  COLOUR_ORDER.forEach((c) => { colourMap[c] = 0 })
  history.forEach((h) => {
    if (h.colour) colourMap[h.colour] = (colourMap[h.colour] ?? 0) + (h.quantity ?? 1)
  })
  const colourSplit = COLOUR_ORDER
    .filter((c) => colourMap[c] > 0)
    .map((colour) => ({
      colour,
      count: colourMap[colour],
      pct: Math.round((colourMap[colour] / totalDrunk) * 100),
    }))

  // ── Average spend per bottle ───────────────────────────────────────────────
  const histWithCost = history.filter((h) => h.cost != null && h.cost > 0)
  const costBottles  = histWithCost.reduce((sum, h) => sum + (h.quantity ?? 1), 0)
  const avgPrice     = costBottles > 0
    ? histWithCost.reduce((sum, h) => sum + h.cost * (h.quantity ?? 1), 0) / costBottles
    : null

  return { totalDrunk, topGrapes, topCountries, colourSplit, avgPrice }
}

/**
 * Build proactive sommelier alerts entirely from local data — no API call.
 *
 * @param {Array}  wines        — current inventory rows
 * @param {Array}  wishlist     — wishlist rows
 * @param {object} tasteProfile — output of buildTasteProfile (may be null)
 */
export function buildSommelierNotes(wines = [], wishlist = [], tasteProfile = null) {
  const currentYear = new Date().getFullYear()
  const notes = []

  // 1. Wines at drink_now status ─────────────────────────────────────────────
  const drinkNow = wines.filter((w) => w.drinking_window_status === 'drink_now')
  if (drinkNow.length > 0) {
    const names = drinkNow.slice(0, 3).map((w) => w.name)
    notes.push({
      type:   'drink_now',
      severity: 'amber',
      title:  `${drinkNow.length} ${drinkNow.length === 1 ? 'wine' : 'wines'} to drink soon`,
      detail: names.join(', ') + (drinkNow.length > 3 ? ` and ${drinkNow.length - 3} more` : ''),
    })
  }

  // 2. Drinking windows closing within 12 months ─────────────────────────────
  const closingWindow = wines.filter(
    (w) =>
      w.drinking_window_end != null &&
      w.drinking_window_end >= currentYear &&
      w.drinking_window_end <= currentYear + 1 &&
      w.drinking_window_status !== 'drink_now'
  )
  if (closingWindow.length > 0) {
    const names = closingWindow
      .slice(0, 3)
      .map((w) => `${w.name}${w.vintage ? ` ${w.vintage}` : ''}`)
    notes.push({
      type:   'closing_window',
      severity: 'amber',
      title:  `${closingWindow.length} ${closingWindow.length === 1 ? 'wine' : 'wines'} approaching end of drinking window`,
      detail: names.join(', ') + (closingWindow.length > 3 ? ` and ${closingWindow.length - 3} more` : ''),
    })
  }

  // 3. Low stock by colour (1–2 bottles left of a colour you hold) ───────────
  const COLOURS = ['red', 'white', 'rosé', 'sparkling', 'dessert']
  COLOURS.forEach((colour) => {
    const colourWines = wines.filter((w) => w.colour === colour)
    if (colourWines.length === 0) return
    const total = colourWines.reduce((sum, w) => sum + (w.quantity ?? 0), 0)
    if (total > 0 && total <= 2) {
      notes.push({
        type:   'low_stock',
        severity: 'blue',
        title:  `Only ${total} ${colour} ${total === 1 ? 'bottle' : 'bottles'} left`,
        detail: 'Consider restocking',
      })
    }
  })

  // 4. Wishlist wines matching top drunk grape varieties ─────────────────────
  if (tasteProfile?.topGrapes?.length > 0 && wishlist?.length > 0) {
    const topGrapeNames = tasteProfile.topGrapes.slice(0, 3).map((g) => g.name.toLowerCase())
    const matches = wishlist.filter(
      (w) =>
        w.grape_variety &&
        topGrapeNames.some(
          (g) =>
            w.grape_variety.toLowerCase().includes(g) ||
            g.includes(w.grape_variety.toLowerCase())
        )
    )
    matches.slice(0, 2).forEach((match) => {
      notes.push({
        type:   'wishlist_match',
        severity: 'green',
        title:  `${match.name} is on your wishlist`,
        detail: `${match.grape_variety} — one of your most-drunk varieties`,
      })
    })
  }

  return notes
}
