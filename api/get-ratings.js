import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseClient } from './_supabase.js'

const ALLOWED_TABLES   = ['wines', 'wishlist']
const RATING_FIELDS    = ['james_suckling', 'robert_parker', 'wine_spectator']

// Build the most specific wine identity string possible for prompts / searches
function buildWineLabel(name, producer, vintage, region, country) {
  const parts = []
  if (producer) parts.push(producer)
  parts.push(name)
  // Add region; fall back to country if no region
  if (region) parts.push(region)
  else if (country) parts.push(country)
  if (vintage) parts.push(String(vintage))
  return parts.join(' ')
}

// Step 1: Try Claude's training knowledge first (cheap, fast)
async function getRatingsFromTraining(client, wineLabel) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Using only your training knowledge, what are the critic scores for "${wineLabel}"?

Return ONLY this JSON:
{ "james_suckling": 94, "robert_parker": 92, "wine_spectator": 91 }

Use an integer for each critic whose score you are confident about for this specific wine and vintage. Use null for any critic whose score you genuinely do not know. Return nothing but JSON.`,
      }],
    })
    const text = response.content[0]?.text?.trim()
    if (!text) return null
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    // Return null if all three are null (nothing found)
    if (parsed.james_suckling == null && parsed.robert_parker == null && parsed.wine_spectator == null) return null
    return parsed
  } catch {
    return null
  }
}

// Step 2: Web search fallback — only when training returns nothing
async function getRatingsFromWeb(client, wineLabel) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search the web for critic ratings for the wine "${wineLabel}". Find scores from James Suckling, Robert Parker/Wine Advocate, and Wine Spectator for this specific wine and vintage.

Return ONLY this JSON:
{ "james_suckling": 94, "robert_parker": 92, "wine_spectator": 91 }

Use an integer for each critic with a confirmed score found in search results. Use null for critics not found or behind paywalls. Return nothing but JSON.`,
      }],
    })
    const textBlock = response.content.find(b => b.type === 'text')
    const text = textBlock?.text?.trim()
    if (!text) return null
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (parsed.james_suckling == null && parsed.robert_parker == null && parsed.wine_spectator == null) return null
    return parsed
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  // wine_id    — if provided, save result directly to Supabase
  // table      — 'wines' (default) or 'wishlist'
  // null_fields — which fields to update (defaults to all three if omitted)
  // producer, region, country — optional; used to make the search more specific
  const { name, producer, vintage, region, country, wine_id, table = 'wines', null_fields } = req.body ?? {}

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Missing wine name' })
  }
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Invalid table' })
  }

  // Which fields to write back — if null_fields not provided, update all three
  const fieldsToUpdate = (Array.isArray(null_fields) && null_fields.length > 0)
    ? null_fields.filter(f => RATING_FIELDS.includes(f))
    : RATING_FIELDS

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const wineLabel = buildWineLabel(
      name.trim(),
      producer?.trim() || null,
      vintage ?? null,
      region?.trim()  || null,
      country?.trim() || null,
    )

    // Step 1: Training knowledge (no extra cost)
    let result = await getRatingsFromTraining(client, wineLabel)

    // Step 2: Web search only if training returned nothing at all
    if (!result) {
      result = await getRatingsFromWeb(client, wineLabel)
    }

    // Build payload — null means not found
    const payload = {
      james_suckling: result?.james_suckling ?? null,
      robert_parker:  result?.robert_parker  ?? null,
      wine_spectator: result?.wine_spectator ?? null,
    }

    // Save directly to Supabase so the result is persisted even if the browser
    // navigates away before the frontend can call updateWine().
    // Only update fieldsToUpdate — never overwrite fields that already had a value.
    if (wine_id) {
      try {
        const supabase = getSupabaseClient()
        const updateObj = {}
        for (const field of fieldsToUpdate) {
          updateObj[field] = payload[field] ?? -1   // -1 = tried, not found
        }
        if (Object.keys(updateObj).length > 0) {
          await supabase.from(table).update(updateObj).eq('id', wine_id)
        }
      } catch (saveErr) {
        // Non-fatal — log and continue; caller still gets the data
        console.error('get-ratings: Supabase save failed:', saveErr.message)
      }
    }

    // Return individual fields; null means not found by either method
    return res.status(200).json(payload)
  } catch (err) {
    console.error('get-ratings error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch ratings' })
  }
}
