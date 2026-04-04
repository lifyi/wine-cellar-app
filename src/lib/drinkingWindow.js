import { updateWine } from './wines'

// Call the serverless function for a list of wines, save results to Supabase,
// and return the array of { wine_id, status, note } results.
export async function estimateAndSaveWindows(wines) {
  const res = await fetch('/api/drinking-window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wines }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to estimate drinking windows.')

  const results = data.wines ?? []

  // Save each result back to Supabase in parallel
  await Promise.all(
    results.map(({ wine_id, status, note, start_year, end_year }) =>
      updateWine(wine_id, {
        drinking_window_status: status,
        drinking_window_note:   note,
        drinking_window_start:  start_year ?? null,
        drinking_window_end:    end_year   ?? null,
      })
    )
  )

  return results
}

// Fire-and-forget: estimate a single wine in the background after adding it.
// Does not block the caller — failures are silently ignored.
export function estimateInBackground(wine) {
  fetch('/api/drinking-window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wines: [wine] }),
  })
    .then((r) => r.json())
    .then((data) => {
      const result = data.wines?.[0]
      if (result) {
        return updateWine(wine.id, {
          drinking_window_status: result.status,
          drinking_window_note:   result.note,
          drinking_window_start:  result.start_year ?? null,
          drinking_window_end:    result.end_year   ?? null,
        })
      }
    })
    .catch(() => {}) // silent — user can refresh manually from the dashboard
}
