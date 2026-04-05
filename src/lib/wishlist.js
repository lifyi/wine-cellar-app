import { supabase } from './supabase'

// ── Fetch all wishlist items, newest first ────────────────────────────────
export async function getWishlist() {
  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .order('date_added', { ascending: false })
  if (error) throw error
  return data
}

// ── Add an item to the wishlist ───────────────────────────────────────────
export async function addToWishlist(item) {
  const { data, error } = await supabase
    .from('wishlist')
    .insert([item])
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Update an existing wishlist item ─────────────────────────────────────
export async function updateWishlistItem(id, updates) {
  const { data, error } = await supabase
    .from('wishlist')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Remove an item from the wishlist ─────────────────────────────────────
export async function removeFromWishlist(id) {
  const { error } = await supabase.from('wishlist').delete().eq('id', id)
  if (error) throw error
}

// ── Move a wishlist item into the wines table (quantity 1) ────────────────
export async function moveToWines(wishlistItem) {
  // Insert into wines
  const { data, error } = await supabase
    .from('wines')
    .insert([{
      name:                   wishlistItem.name,
      producer:               wishlistItem.producer               ?? null,
      vintage:                wishlistItem.vintage                ?? null,
      region:                 wishlistItem.region                 ?? null,
      country:                wishlistItem.country                ?? null,
      grape_variety:          wishlistItem.grape_variety          ?? null,
      colour:                 wishlistItem.colour                 ?? 'red',
      notes:                  wishlistItem.notes                  ?? null,
      james_suckling:         wishlistItem.james_suckling         ?? null,
      robert_parker:          wishlistItem.robert_parker          ?? null,
      wine_spectator:         wishlistItem.wine_spectator         ?? null,
      cost:                   wishlistItem.cost                   ?? null,
      quantity:               1,
      drinking_window_status: wishlistItem.drinking_window_status ?? null,
      drinking_window_start:  wishlistItem.drinking_window_start  ?? null,
      drinking_window_end:    wishlistItem.drinking_window_end    ?? null,
      drinking_window_note:   wishlistItem.drinking_window_note   ?? null,
    }])
    .select()
    .single()
  if (error) throw error

  // Remove from wishlist
  const { error: delError } = await supabase
    .from('wishlist')
    .delete()
    .eq('id', wishlistItem.id)
  if (delError) throw delError

  return data
}
