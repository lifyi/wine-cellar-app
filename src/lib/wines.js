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
export async function drinkOne(wine) {
  // Log the drink first (snapshot wine details so history survives deletions)
  const { error: histErr } = await supabase.from('drinking_history').insert([{
    wine_id:      wine.id,
    wine_name:    wine.name,
    producer:     wine.producer     || null,
    vintage:      wine.vintage      || null,
    colour:       wine.colour       || null,
    region:       wine.region       || null,
    country:      wine.country      || null,
    grape_variety: wine.grape_variety || null,
    quantity:     1,
  }])
  if (histErr) throw histErr

  // Then reduce quantity or remove the row
  if (wine.quantity <= 1) {
    const { error } = await supabase.from('wines').delete().eq('id', wine.id)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase
    .from('wines')
    .update({ quantity: wine.quantity - 1 })
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
