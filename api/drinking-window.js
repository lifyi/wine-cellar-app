import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseClient } from './_supabase.js'

function buildSystemPrompt() {
  const year = new Date().getFullYear()
  return `You are a wine expert estimating drinking windows. For each wine provided, estimate its ideal drinking window based on the region, grape variety, colour, vintage, and any tasting notes. Classify as: drink_now (at peak or window closing soon — drink within 6 months), ready (within ideal window, no urgency), hold (too young, will improve with more ageing), past_peak (likely declining based on typical ageing potential for this style). Provide a short note explaining your reasoning. Also provide start_year and end_year as integers representing the estimated drinking window range — for past_peak wines where the window has already closed, set start_year to the vintage year and end_year to the year the wine peaked. Be realistic — most everyday whites and rosés should be drunk young, simple reds within 3-5 years, only serious ageworthy reds and top dessert wines benefit from long ageing. The current year is ${year}. Respond only in JSON: { "wines": [{ "wine_id": "", "status": "", "note": "", "start_year": 0, "end_year": 0 }] }`
}

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

    const wineList = wines.map((w) => ({
      id: w.id,
      name: w.name,
      producer: w.producer ?? null,
      vintage: w.vintage ?? null,
      colour: w.colour ?? null,
      region: w.region ?? null,
      country: w.country ?? null,
      grape_variety: w.grape_variety ?? null,
      notes: w.notes ?? null,
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: `Estimate drinking windows for these ${wineList.length} wine${wineList.length === 1 ? '' : 's'}:\n${JSON.stringify(wineList, null, 2)}`,
        },
      ],
    })

    const text = response.content[0].text.trim()
    const match = text.match(/\{[\s\S]*\}/)

    if (!match) {
      return res.status(422).json({ error: 'Could not parse drinking window response.' })
    }

    const parsed = JSON.parse(match[0])

    // Persist directly to Supabase so results are saved even if the browser
    // navigates away before the frontend processes the response.
    try {
      const supabase = getSupabaseClient()
      await Promise.all(
        (parsed.wines ?? []).map(({ wine_id, status, note, start_year, end_year }) =>
          supabase.from('wines').update({
            drinking_window_status: status,
            drinking_window_note:   note       ?? null,
            drinking_window_start:  start_year ?? null,
            drinking_window_end:    end_year   ?? null,
          }).eq('id', wine_id)
        )
      )
    } catch (saveErr) {
      // Non-fatal — log and return data anyway so the frontend can update local state
      console.error('drinking-window: Supabase save failed:', saveErr.message)
    }

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('drinking-window error:', err)
    return res.status(500).json({ error: err.message || 'Failed to estimate drinking windows.' })
  }
}
