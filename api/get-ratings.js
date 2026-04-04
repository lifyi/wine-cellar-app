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
async function getRatingsFromWeb(client, name, vintage) {
  const wineLabel = vintage ? `${name} ${vintage}` : name
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

  const { name, vintage } = req.body ?? {}
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Missing wine name' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Step 1: Training knowledge (no extra cost)
    let result = await getRatingsFromTraining(client, name.trim(), vintage ?? null)

    // Step 2: Web search only if training returned nothing at all
    if (!result) {
      result = await getRatingsFromWeb(client, name.trim(), vintage ?? null)
    }

    // Return individual fields; null means not found by either method
    return res.status(200).json({
      james_suckling: result?.james_suckling ?? null,
      robert_parker:  result?.robert_parker  ?? null,
      wine_spectator: result?.wine_spectator ?? null,
    })
  } catch (err) {
    console.error('get-ratings error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch ratings' })
  }
}
