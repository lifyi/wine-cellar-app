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

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
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
              text: `Analyse this wine label and extract the wine details. Return ONLY a JSON object with these exact keys (use null for anything you cannot determine with confidence):

{
  "name": "wine name",
  "producer": "producer or winery name",
  "vintage": 2018,
  "region": "wine region",
  "country": "country of origin",
  "grape_variety": "grape variety or blend",
  "colour": "one of: red, white, rosé, sparkling, dessert"
}

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

    const data = JSON.parse(match[0])
    return res.status(200).json(data)
  } catch (err) {
    console.error('scan-label error:', err)
    return res.status(500).json({ error: err.message || 'Failed to scan label' })
  }
}
