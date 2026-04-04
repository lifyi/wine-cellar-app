import Anthropic from '@anthropic-ai/sdk'

// Fetches critic scores for a batch of wines in a SINGLE Claude call
// using training knowledge only (no web search, no per-wine API calls).
// Returns { results: [{ id, james_suckling, robert_parker, wine_spectator }] }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { wines } = req.body ?? {}
  if (!wines?.length) {
    return res.status(400).json({ error: 'No wines provided.' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const wineList = wines
      .map((w) => `- id: ${w.id}  name: ${w.name}${w.vintage ? `  vintage: ${w.vintage}` : ''}`)
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

    if (!match) {
      // Parsing failed — return all nulls so the caller can save -1 and move on
      return res.status(200).json({
        results: wines.map((w) => ({ id: w.id, james_suckling: null, robert_parker: null, wine_spectator: null })),
      })
    }

    const parsed = JSON.parse(match[0])
    const resultMap = Object.fromEntries(parsed.map((r) => [r.id, r]))

    return res.status(200).json({
      results: wines.map((w) => ({
        id:             w.id,
        james_suckling: resultMap[w.id]?.james_suckling ?? null,
        robert_parker:  resultMap[w.id]?.robert_parker  ?? null,
        wine_spectator: resultMap[w.id]?.wine_spectator ?? null,
      })),
    })
  } catch (err) {
    console.error('get-ratings-batch error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch batch ratings.' })
  }
}
