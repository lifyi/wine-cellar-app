import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a sommelier advising on wine-food pairings from a personal wine collection. Only recommend wines actually in the provided inventory — never invent wines. Consider classic pairing principles: match weight of wine to weight of food, tannin with protein and fat, acidity with rich or creamy dishes, sweetness with spicy food. Consider each wine's region, grape variety, colour, vintage, and any tasting notes or food notes. If a wine has Notes mentioning food compatibility, weight that heavily. Factor in drinking windows: prioritise wines currently in their ideal drinking window over wines that should be held longer or are past peak. Use the vintage, region, and grape variety to estimate readiness. For each recommendation, note whether the wine is at peak drinking, still needs time, or should be drunk soon before it declines. Rank by quality of match and readiness, not price or prestige. For each recommendation give a specific 1-2 sentence explanation of the pairing logic and a separate 1 sentence note on drinking window status. If nothing pairs well, say so and suggest what style of wine the user should look for instead. Return maximum 3 recommendations, fewer if matches are weak. Respond only in JSON: { "recommendations": [{ "wine_id": "", "explanation": "", "drinking_window_note": "" }], "general_advice": "" }`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { meal, wines } = req.body ?? {}

  if (!meal?.trim()) {
    return res.status(400).json({ error: 'Please describe what you are eating.' })
  }

  if (!wines?.length) {
    return res.status(400).json({ error: 'Your inventory is empty — add some wines first.' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Send only the fields Claude needs (keep payload small)
    const inventorySummary = wines.map((w) => ({
      id: w.id,
      name: w.name,
      producer: w.producer ?? null,
      vintage: w.vintage ?? null,
      colour: w.colour ?? null,
      region: w.region ?? null,
      country: w.country ?? null,
      grape_variety: w.grape_variety ?? null,
      notes: w.notes ?? null,
      quantity: w.quantity,
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Meal: ${meal.trim()}\n\nInventory (${inventorySummary.length} wines):\n${JSON.stringify(inventorySummary, null, 2)}`,
        },
      ],
    })

    const text = response.content[0].text.trim()
    const match = text.match(/\{[\s\S]*\}/)

    if (!match) {
      return res.status(422).json({ error: 'Could not parse pairing recommendations — please try again.' })
    }

    return res.status(200).json(JSON.parse(match[0]))
  } catch (err) {
    console.error('pair-wine error:', err)
    return res.status(500).json({ error: err.message || 'Pairing failed — please try again.' })
  }
}
