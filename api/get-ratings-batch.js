import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseClient } from './_supabase.js'

// Fetches critic scores for a batch of wines in a SINGLE Claude call
// using training knowledge only (no web search, no per-wine API calls).
//
// Request body:
//   wines: [{ id, name, vintage?, null_fields: string[] }]
//     null_fields — the critic fields that are currently null for this wine.
//     Only those fields will be written back to Supabase; existing scores are
//     never overwritten.
//   table: 'wines' | 'wishlist'  (default 'wines')
//
// Returns { results: [{ id, james_suckling, robert_parker, wine_spectator }] }

const ALLOWED_TABLES = ['wines', 'wishlist']
const RATING_FIELDS  = ['james_suckling', 'robert_parker', 'wine_spectator']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { wines, table = 'wines' } = req.body ?? {}
  if (!wines?.length) {
    return res.status(400).json({ error: 'No wines provided.' })
  }
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Invalid table' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const wineList = wines
      .map((w) => {
        const parts = [`- id: ${w.id}`]
        if (w.producer) parts.push(`producer: ${w.producer}`)
        parts.push(`name: ${w.name}`)
        if (w.region) parts.push(`region: ${w.region}`)
        else if (w.country) parts.push(`country: ${w.country}`)
        if (w.vintage) parts.push(`vintage: ${w.vintage}`)
        return parts.join('  ')
      })
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Using your training knowledge, provide critic scores for each of the following wines. For each wine return integer scores from James Suckling (james_suckling), Robert Parker/Wine Advocate (robert_parker), and Wine Spectator (wine_spectator) where you are confident about the score for that specific wine and vintage. Use null for any critic whose score you genuinely do not know.

Wines:
${wineList}

Return ONLY a JSON array — one object per wine, preserving the exact id strings:
[
  { "id": "...", "james_suckling": 94, "robert_parker": 92, "wine_spectator": 91 },
  ...
]

Use null for unknown scores. Return nothing but the JSON array.`,
      }],
    })

    const text = response.content[0].text.trim()
    const match = text.match(/\[[\s\S]*\]/)

    // Build the full results array (null on parse failure)
    let results
    if (!match) {
      results = wines.map((w) => ({ id: w.id, james_suckling: null, robert_parker: null, wine_spectator: null }))
    } else {
      const parsed = JSON.parse(match[0])
      const resultMap = Object.fromEntries(parsed.map((r) => [r.id, r]))
      results = wines.map((w) => ({
        id:             w.id,
        james_suckling: resultMap[w.id]?.james_suckling ?? null,
        robert_parker:  resultMap[w.id]?.robert_parker  ?? null,
        wine_spectator: resultMap[w.id]?.wine_spectator ?? null,
      }))
    }

    // Persist directly to Supabase so results are saved even if the browser
    // navigates away before the frontend processes the response.
    // IMPORTANT: only write back the fields that were null for each wine —
    // never overwrite existing scores (real scores or -1 sentinels).
    try {
      const supabase = getSupabaseClient()
      await Promise.all(
        results.map((r) => {
          const wine = wines.find((w) => w.id === r.id)
          // Which fields to update for this specific wine
          const fieldsToUpdate = (Array.isArray(wine?.null_fields) && wine.null_fields.length > 0)
            ? wine.null_fields.filter(f => RATING_FIELDS.includes(f))
            : RATING_FIELDS  // fallback: update all three if not specified

          const updateObj = {}
          for (const field of fieldsToUpdate) {
            updateObj[field] = r[field] ?? -1   // -1 = tried, not found
          }
          if (Object.keys(updateObj).length === 0) return Promise.resolve()
          return supabase.from(table).update(updateObj).eq('id', r.id)
        })
      )
    } catch (saveErr) {
      // Non-fatal — log and return data anyway so the frontend can update local state
      console.error('get-ratings-batch: Supabase save failed:', saveErr.message)
    }

    return res.status(200).json({ results })
  } catch (err) {
    console.error('get-ratings-batch error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch batch ratings.' })
  }
}
