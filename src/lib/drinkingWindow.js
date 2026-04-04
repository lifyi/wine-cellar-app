const BATCH_SIZE = 15
const DELAY_MS   = 2000

// Call the serverless function for a list of wines in chunks of BATCH_SIZE.
// The API writes results directly to Supabase, so this function only needs
// to collect and return the accumulated results for local React state updates.
// onProgress(done, total) is called after each batch completes.
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
    allResults.push(...results)

    // Fire progress once per batch
    onProgress?.(allResults.length, wines.length)
  }

  return allResults
}

// Fire-and-forget: estimate a single wine in the background after adding it.
// The API saves the result to Supabase directly, so no .then() DB write needed.
// Failures are silently ignored — user can refresh manually from the dashboard.
export function estimateInBackground(wine) {
  fetch('/api/drinking-window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wines: [wine] }),
  }).catch(() => {})
}
