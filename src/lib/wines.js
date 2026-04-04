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

// ── Reduce quantity by 1 (remove row when it hits 0) ──────────────────────
export async function drinkOne(id, currentQuantity) {
  if (currentQuantity <= 1) {
    const { error } = await supabase.from('wines').delete().eq('id', id)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase
    .from('wines')
    .update({ quantity: currentQuantity - 1 })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Delete a wine entirely ─────────────────────────────────────────────────
export async function deleteWine(id) {
  const { error } = await supabase.from('wines').delete().eq('id', id)
  if (error) throw error
}
