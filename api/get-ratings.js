import Anthropic from '@anthropic-ai/sdk'

// Step 1: Try Claude's training knowledge first (cheap, fast)
async function getRatingsFromTraining(client, name, vintage) {
  const wineLabel = vintage ? `${name} ${vintage}` : name
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Using only your training knowledge, what are the critic scores for "${wineLabel}"?

Return ONLY this JSON: { "ratings": "JS: 94 | RP: 92 | WS: 91" }

Include only James Suckling (JS), Robert Parker/Wine Advocate (RP), and Wine Spectator (WS) scores you are confident about for this specific wine and vintage. Omit critics you are unsure about. If you have no knowledge of any scores, return { "ratings": null }. Return nothing but JSON.`,
      }],
    })
    const text = response.content[0]?.text?.trim()
    if (!text) return null
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]).ratings ?? null
  } catch {
    return null
  }
}

// Step 2: Web search fallback — only when training returns nothing
async function getRatingsFromWeb(client, name, vintage) {
  const wineLabel = vintage ? `${name} ${vintage}` : name
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search the web for critic ratings for the wine "${wineLabel}". Find scores from James Suckling (JS), Robert Parker/Wine Advocate (RP), and Wine Spectator (WS) for this specific wine and vintage.

Return ONLY this JSON: { "ratings": "JS: 94 | RP: 92 | WS: 91" }

Only include critics with confirmed scores found in search results. Omit critics not found or behind paywalls. If no ratings are found at all, return { "ratings": null }. Return nothing but JSON.`,
      }],
    })
    const textBlock = response.content.find(b => b.type === 'text')
    const text = textBlock?.text?.trim()
    if (!text) return null
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]).ratings ?? null
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

  const { name, vintage } = req.body ?? {}
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Missing wine name' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Step 1: Training knowledge (no extra cost)
    let ratings = await getRatingsFromTraining(client, name.trim(), vintage ?? null)

    // Step 2: Web search only if training returned nothing
    if (!ratings) {
      ratings = await getRatingsFromWeb(client, name.trim(), vintage ?? null)
    }

    return res.status(200).json({ ratings: ratings ?? null })
  } catch (err) {
    console.error('get-ratings error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch ratings' })
  }
}
