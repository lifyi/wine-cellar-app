import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { input } = req.body ?? {}
  if (!input?.trim()) {
    return res.status(400).json({ error: 'Missing input' })
  }

  let content = input.trim()

  // If it looks like a URL, try to fetch and extract the page text
  if (/^https?:\/\//i.test(content)) {
    try {
      const pageRes = await fetch(content, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WineBot/1.0)' },
        signal: AbortSignal.timeout(6000),
      })
      const html = await pageRes.text()
      // Strip style/script blocks, then all tags, then collapse whitespace
      const text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 6000)
      if (text.length > 50) content = text
    } catch {
      // URL fetch failed — fall through and pass the URL text to Claude as-is
    }
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
          content: `Extract wine details from the following text. The current year is ${currentYear}.

Do two things:
1. Extract any wine details visible in the text (name, producer, vintage, region, country, grape variety, colour).
2. INFER any missing fields using wine knowledge. Track which fields were inferred vs found in the text.

Also provide:
- A 2–3 sentence tasting note and food pairing suggestion.
- An estimated drinking window based on the wine type and vintage.
- A rough Singapore retail price estimate.

Return ONLY this JSON (use null for anything you cannot determine):

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
  "drinking_window_note": "one-sentence reason",
  "price_range_sgd": { "min": 35, "max": 55 },
  "james_suckling": 94,
  "robert_parker": 92,
  "wine_spectator": 91,
  "inferred": ["field names inferred from wine knowledge, not found in the text"]
}

For cost, use the midpoint of price_range_sgd rounded to the nearest dollar.
For james_suckling, robert_parker, wine_spectator: actively search your training knowledge for James Suckling, Robert Parker/Wine Advocate, and Wine Spectator scores for this specific wine and vintage. Use an integer score (e.g. 94) if you are confident about it. Use null if you genuinely have no knowledge of that critic's score. These fields should almost always be filled for any named wine — a known partial result is far better than null.
Return only the JSON, no explanation.

Text to analyse:
${content}`,
        },
      ],
    })

    const text = response.content[0].text.trim()
    const match = text.match(/\{[\s\S]*\}/)

    if (!match) {
      return res.status(422).json({ error: 'Could not extract wine details — try a more specific description.' })
    }

    return res.status(200).json(JSON.parse(match[0]))
  } catch (err) {
    console.error('parse-wine-text error:', err)
    return res.status(500).json({ error: err.message || 'Failed to parse wine details' })
  }
}
