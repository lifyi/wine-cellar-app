import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { imageBase64, mimeType } = req.body ?? {}

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing image data' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const currentYear = new Date().getFullYear()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Analyse this wine label. The current year is ${currentYear}.

Do two things:
1. Extract what is VISIBLE on the label (name, producer, vintage, region, country, grape variety, colour).
2. INFER any missing fields using wine knowledge — e.g. if the label says "Barolo" infer grape_variety="Nebbiolo", region="Piedmont", country="Italy". Track which fields were inferred vs read from the label.

Also provide:
- A 2–3 sentence tasting note and food pairing suggestion to pre-fill the Notes field (friendly, practical tone).
- An estimated drinking window (status, year range, one-sentence reason) based on the wine type, vintage, and typical producer quality.
- A rough Singapore retail price estimate for a single bottle.

Return ONLY this JSON object (use null for anything you truly cannot determine):

{
  "name": "wine name",
  "producer": "producer or winery name",
  "vintage": 2018,
  "region": "wine region",
  "country": "country of origin",
  "grape_variety": "grape variety or blend",
  "colour": "one of: red, white, rosé, sparkling, dessert",
  "notes": "2–3 sentence tasting note and food pairing",
  "cost": 45.00,
  "drinking_window_status": "one of: drink_now, ready, hold, past_peak",
  "drinking_window_start": 2024,
  "drinking_window_end": 2030,
  "drinking_window_note": "one-sentence reason for the drinking window",
  "price_range_sgd": { "min": 35, "max": 55 },
  "james_suckling": 94,
  "robert_parker": 92,
  "wine_spectator": 91,
  "inferred": ["field names inferred from wine knowledge, not visible on label"]
}

For cost, use the midpoint of price_range_sgd rounded to the nearest dollar.
For inferred, list only field names NOT visible on the label (e.g. ["grape_variety", "region", "country"]).
For james_suckling, robert_parker, wine_spectator: actively search your training knowledge for James Suckling, Robert Parker/Wine Advocate, and Wine Spectator scores for this specific wine and vintage. Use an integer score (e.g. 94) if you are confident about it. Use null if you genuinely have no knowledge of that critic's score for this wine. These fields should almost always be filled for any named wine — a known partial result is far better than null.
Return only the JSON, no explanation.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].text.trim()
    const match = text.match(/\{[\s\S]*\}/)

    if (!match) {
      return res.status(422).json({ error: 'Could not read the label — try a clearer photo.' })
    }

    return res.status(200).json(JSON.parse(match[0]))
  } catch (err) {
    console.error('scan-label error:', err)
    return res.status(500).json({ error: err.message || 'Failed to scan label' })
  }
}
