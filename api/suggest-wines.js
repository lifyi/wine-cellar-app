import Anthropic from '@anthropic-ai/sdk'

// On-demand buy recommendations — called only when the user taps "Suggest what to buy".
// Receives a pre-computed taste profile (built client-side from Supabase data),
// current wine names and wishlist names so Claude avoids suggesting what is already owned.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { tasteProfile, currentWines = [], wishlistWines = [] } = req.body ?? {}

  if (!tasteProfile) {
    return res.status(400).json({ error: 'No taste profile provided.' })
  }

  // Build a compact, token-efficient prompt
  const colourPrefs = tasteProfile.colourSplit?.length
    ? tasteProfile.colourSplit.map((c) => `${c.colour} ${c.pct}%`).join(', ')
    : 'not yet known'

  const topGrapes = tasteProfile.topGrapes?.length
    ? tasteProfile.topGrapes.map((g) => g.name).join(', ')
    : 'not yet known'

  const topCountries = tasteProfile.topCountries?.length
    ? tasteProfile.topCountries.map((c) => c.name).join(', ')
    : 'not yet known'

  const avgSpend = tasteProfile.avgPrice
    ? `S$${Math.round(tasteProfile.avgPrice)} per bottle`
    : 'not yet known'

  // Limit avoid list to keep payload small
  const avoidList = [...currentWines, ...wishlistWines].slice(0, 30)
  const avoidSection = avoidList.length > 0
    ? `\nDo NOT suggest these wines (already owned or on wishlist):\n${avoidList.map((n) => `- ${n}`).join('\n')}`
    : ''

  const prompt = `You are a Singapore wine sommelier. Suggest 3–5 wines this collector would love but does not yet own.

Taste profile (based on ${tasteProfile.totalDrunk ?? 0} bottles drunk):
- Favourite grape varieties: ${topGrapes}
- Favourite countries: ${topCountries}
- Colour preference: ${colourPrefs}
- Typical spend: ${avgSpend}
${avoidSection}

Requirements:
- Focus on wines genuinely available in Singapore
- Suggest a mix — some safe bets matching their taste, one or two adventurous picks
- Include realistic Singapore retail price ranges
- Mention specific Singapore retailers or platforms where available

Return ONLY a JSON array of 3–5 suggestions:
[
  {
    "name": "Full wine name",
    "producer": "Producer",
    "grape_variety": "Grape(s)",
    "region": "Region, Country",
    "why": "One sentence — why this matches their taste",
    "price_sgd_min": 45,
    "price_sgd_max": 65,
    "where_to_buy": "e.g. Vivino, Wine Connection, Cellarbration, Grand Cru"
  }
]

Return nothing but the JSON array.`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text  = response.content[0].text.trim()
    const match = text.match(/\[[\s\S]*\]/)

    if (!match) {
      return res.status(422).json({ error: 'Could not parse suggestions — please try again.' })
    }

    return res.status(200).json({ suggestions: JSON.parse(match[0]) })
  } catch (err) {
    console.error('suggest-wines error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate suggestions.' })
  }
}
