import { supabase } from './supabase'

// ── Fetch all wines, newest first ──────────────────────────────────────────
export async function getWines() {
  const { data, error } = await supabase
    .from('wines')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ── Fetch a single wine by ID ──────────────────────────────────────────────
export async function getWineById(id) {
  const { data, error } = await supabase
    .from('wines')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ── Add a new wine ─────────────────────────────────────────────────────────
export async function addWine(wine) {
  const { data, error } = await supabase
    .from('wines')
    .insert([wine])
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Update an existing wine ────────────────────────────────────────────────
export async function updateWine(id, wine) {
  const { data, error } = await supabase
    .from('wines')
    .update(wine)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Reduce quantity by 1 and log to drinking history ──────────────────────
// bottleType: 'coravined' | 'untouched'
// - 'coravined': also reduces coravin_count by 1
// - 'untouched': clamps coravin_count to new quantity if needed
export async function drinkOne(wine, note = null, bottleType = 'untouched') {
  // Log the drink first (snapshot wine details so history survives deletions)
  const { error: histErr } = await supabase.from('drinking_history').insert([{
    wine_id:      wine.id,
    wine_name:    wine.name,
    producer:     wine.producer      || null,
    vintage:      wine.vintage       || null,
    colour:       wine.colour        || null,
    region:       wine.region        || null,
    country:      wine.country       || null,
    grape_variety: wine.grape_variety || null,
    quantity:     1,
    note:         note               || null,
    cost:         wine.cost          ?? null,
  }])
  if (histErr) throw histErr

  const newQty = wine.quantity - 1

  // Last bottle — remove the row entirely
  if (newQty <= 0) {
    const { error } = await supabase.from('wines').delete().eq('id', wine.id)
    if (error) throw error
    return null
  }

  // Build update: quantity always decreases; coravin_count adjusted by bottle type
  const coravinCount = wine.coravin_count ?? 0
  const newCoravinCount = bottleType === 'coravined'
    ? Math.max(0, coravinCount - 1)          // remove a Coravin'd bottle
    : Math.min(coravinCount, newQty)          // clamp if untouched bottle removed

  const { data, error } = await supabase
    .from('wines')
    .update({ quantity: newQty, coravin_count: newCoravinCount })
    .eq('id', wine.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Fetch drinking history, most recent first ──────────────────────────────
export async function getDrinkingHistory() {
  const { data, error } = await supabase
    .from('drinking_history')
    .select('*')
    .order('drunk_at', { ascending: false })
  if (error) throw error
  return data
}

// ── Save drinking window status + note for one wine ───────────────────────
export async function setDrinkingWindow(id, status, note) {
  const { error } = await supabase
    .from('wines')
    .update({ drinking_window_status: status, drinking_window_note: note })
    .eq('id', id)
  if (error) throw error
}

// ── Delete a wine entirely ─────────────────────────────────────────────────
export async function deleteWine(id) {
  const { error } = await supabase.from('wines').delete().eq('id', id)
  if (error) throw error
}

// ── Count total bottles drunk (fast — no row data returned) ───────────────
export async function getDrinkingHistoryCount() {
  const { count, error } = await supabase
    .from('drinking_history')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

// ── Record a Coravin pour — increments coravin_count (capped at qty) ──────
export async function coravinWine(wine) {
  const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
  const newCount = Math.min((wine.coravin_count ?? 0) + 1, wine.quantity)
  const { data, error } = await supabase
    .from('wines')
    .update({ coravin_count: newCount, last_coravin_date: today })
    .eq('id', wine.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Find an existing wine by name (case-insensitive) + vintage ────────────
export async function findDuplicateWine(name, vintage) {
  let query = supabase.from('wines').select('*').ilike('name', name.trim())
  if (vintage != null) {
    query = query.eq('vintage', vintage)
  } else {
    query = query.is('vintage', null)
  }
  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] ?? null
}
