import { updateWine } from './wines'

const BATCH_SIZE = 15
const DELAY_MS   = 2000

// Call the serverless function for a list of wines in chunks of BATCH_SIZE,
// save results to Supabase, and return the accumulated results.
// onProgress(done, total) is called after each wine's results are saved.
export async function estimateAndSaveWindows(wines, onProgress) {
  const allResults = []

  for (let i = 0; i < wines.length; i += BATCH_SIZE) {
    // 2-second delay between batches (not before the first)
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

    const batch = wines.slice(i, i + BATCH_SIZE)

    const res = await fetch('/api/drinking-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wines: batch }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to estimate drinking windows.')

    const results = data.wines ?? []

    // Save each result back to Supabase sequentially so we can fire progress updates
    for (const { wine_id, status, note, start_year, end_year } of results) {
      await updateWine(wine_id, {
        drinking_window_status: status,
        drinking_window_note:   note,
        drinking_window_start:  start_year ?? null,
        drinking_window_end:    end_year   ?? null,
      })
      allResults.push({ wine_id, status, note, start_year, end_year })
      onProgress?.(allResults.length, wines.length)
    }
  }

  return allResults
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
