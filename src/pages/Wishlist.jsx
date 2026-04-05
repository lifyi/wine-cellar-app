import { useEffect, useRef, useState } from 'react'
import WishlistCard from '../components/WishlistCard'
import { getWishlist, addToWishlist, updateWishlistItem, removeFromWishlist, moveToWines } from '../lib/wishlist'
import { getWines, getDrinkingHistory } from '../lib/wines'
import { estimateInBackground } from '../lib/drinkingWindow'
import { buildTasteProfile } from '../lib/tasteProfile'

// ── Colour picker data ──────────────────────────────────────────────────────
const COLOURS = ['red', 'white', 'rosé', 'sparkling', 'dessert']
const COLOUR_PICKER = {
  red:       'bg-red-950 text-red-300 border-red-800',
  white:     'bg-yellow-950 text-yellow-300 border-yellow-800',
  rosé:      'bg-pink-950 text-pink-300 border-pink-800',
  sparkling: 'bg-sky-950 text-sky-300 border-sky-800',
  dessert:   'bg-amber-950 text-amber-300 border-amber-800',
}

// ── Image compression (same as AddWine) ────────────────────────────────────
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1280
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
}

const EMPTY_FORM = {
  name: '', producer: '', vintage: '', region: '', country: '',
  grape_variety: '', colour: 'red', cost: '',
  james_suckling: '', robert_parker: '', wine_spectator: '',
  notes: '', source: '',
}

export default function Wishlist() {
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)

  // List state
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [addingId, setAddingId]   = useState(null)
  const [removingId, setRemovingId] = useState(null)

  // Bulk refresh ratings state
  const [refreshing, setRefreshing]         = useState(false)
  const [refreshProgress, setRefreshProgress] = useState(null) // { done, total }
  const [refreshDone, setRefreshDone]       = useState(false)

  // Buy suggestions state
  const [suggesting, setSuggesting]     = useState(false)
  const [suggestions, setSuggestions]   = useState(null)
  const [suggestError, setSuggestError] = useState(null)

  // Add / edit form state
  const [showForm, setShowForm]       = useState(false)
  const [editingItem, setEditingItem] = useState(null)   // non-null = editing mode
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  // Scan state
  const [scanning, setScanning]     = useState(false)
  const [scanError, setScanError]   = useState(null)
  const [scanned, setScanned]       = useState(false)
  const [scanInferred, setScanInferred] = useState([])
  const [priceRange, setPriceRange] = useState(null)
  const [scanDrinkingWindow, setScanDrinkingWindow] = useState(null)

  // Text / URL parse state
  const [textInput, setTextInput]   = useState('')
  const [parsing, setParsing]       = useState(false)
  const [parseError, setParseError] = useState(null)

  useEffect(() => {
    getWishlist()
      .then(setItems)
      .catch((err) => setListError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  // ── Apply API response (scan or text parse) to form ──────────────────────
  function applyApiData(data) {
    setForm((f) => ({
      ...f,
      name:          data.name          != null ? String(data.name)          : f.name,
      producer:      data.producer      != null ? String(data.producer)      : f.producer,
      vintage:       data.vintage       != null ? String(data.vintage)       : f.vintage,
      region:        data.region        != null ? String(data.region)        : f.region,
      country:       data.country       != null ? String(data.country)       : f.country,
      grape_variety: data.grape_variety != null ? String(data.grape_variety) : f.grape_variety,
      colour:         data.colour        != null ? data.colour                : f.colour,
      notes:          data.notes         != null ? String(data.notes)         : f.notes,
      cost:           data.cost          != null ? String(data.cost)          : f.cost,
      james_suckling: data.james_suckling != null ? String(data.james_suckling) : f.james_suckling,
      robert_parker:  data.robert_parker  != null ? String(data.robert_parker)  : f.robert_parker,
      wine_spectator: data.wine_spectator != null ? String(data.wine_spectator) : f.wine_spectator,
    }))
    if (data.drinking_window_status) {
      setScanDrinkingWindow({
        status:     data.drinking_window_status,
        note:       data.drinking_window_note   ?? null,
        start_year: data.drinking_window_start  ?? null,
        end_year:   data.drinking_window_end    ?? null,
      })
    }
    setScanInferred(Array.isArray(data.inferred) ? data.inferred : [])
    if (data.price_range_sgd?.min != null && data.price_range_sgd?.max != null) {
      setPriceRange(data.price_range_sgd)
    }
    setScanned(true)
    setShowForm(true)
  }

  // ── Image scan ────────────────────────────────────────────────────────────
  async function handleScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanError(null); setScanned(false); setScanInferred([]); setPriceRange(null); setScanDrinkingWindow(null)
    setScanning(true)
    try {
      const imageBase64 = await compressImage(file)
      const res = await fetch('/api/scan-label', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      applyApiData(data)
    } catch (err) { setScanError(err.message) }
    finally { setScanning(false) }
  }

  // ── Text / URL parse ──────────────────────────────────────────────────────
  async function handleParseText() {
    if (!textInput.trim()) return
    setParseError(null); setScanned(false); setScanInferred([]); setPriceRange(null); setScanDrinkingWindow(null)
    setParsing(true)
    try {
      const res = await fetch('/api/parse-wine-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: textInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      applyApiData(data)
      setTextInput('')
    } catch (err) { setParseError(err.message) }
    finally { setParsing(false) }
  }

  // ── Open edit form pre-filled with existing item data ────────────────────
  function handleEdit(item) {
    setEditingItem(item)
    setForm({
      name:           item.name          ?? '',
      producer:       item.producer      ?? '',
      vintage:        item.vintage       ? String(item.vintage) : '',
      region:         item.region        ?? '',
      country:        item.country       ?? '',
      grape_variety:  item.grape_variety ?? '',
      colour:         item.colour        ?? 'red',
      cost:           item.cost != null  ? String(item.cost) : '',
      james_suckling: item.james_suckling > 0 ? String(item.james_suckling) : '',
      robert_parker:  item.robert_parker  > 0 ? String(item.robert_parker)  : '',
      wine_spectator: item.wine_spectator > 0 ? String(item.wine_spectator) : '',
      notes:          item.notes  ?? '',
      source:         item.source ?? '',
    })
    setScanDrinkingWindow(item.drinking_window_status ? {
      status:     item.drinking_window_status,
      note:       item.drinking_window_note  ?? null,
      start_year: item.drinking_window_start ?? null,
      end_year:   item.drinking_window_end   ?? null,
    } : null)
    setScanned(false); setScanInferred([]); setPriceRange(null)
    setScanError(null); setParseError(null); setSaveError(null)
    setShowForm(true)
  }

  function handleCancelEdit() {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setScanned(false); setScanInferred([]); setPriceRange(null); setScanDrinkingWindow(null)
    setSaveError(null)
    setShowForm(false)
  }

  // ── Save to wishlist ──────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setSaveError(null)
    try {
      const payload = {
        name:          form.name.trim(),
        producer:      form.producer.trim()      || null,
        vintage:       form.vintage ? Number(form.vintage) : null,
        region:        form.region.trim()        || null,
        country:       form.country.trim()       || null,
        grape_variety: form.grape_variety.trim() || null,
        colour:        form.colour,
        notes:          form.notes.trim()         || null,
        james_suckling: form.james_suckling !== '' ? Number(form.james_suckling) : null,
        robert_parker:  form.robert_parker  !== '' ? Number(form.robert_parker)  : null,
        wine_spectator: form.wine_spectator !== '' ? Number(form.wine_spectator) : null,
        cost:           form.cost !== '' ? Number(form.cost) : null,
        source:        form.source.trim()        || null,
        drinking_window_status: scanDrinkingWindow?.status    ?? null,
        drinking_window_note:   scanDrinkingWindow?.note      ?? null,
        drinking_window_start:  scanDrinkingWindow?.start_year ?? null,
        drinking_window_end:    scanDrinkingWindow?.end_year   ?? null,
      }

      if (editingItem) {
        // ── Update existing item ───────────────────────────────────────────
        const saved = await updateWishlistItem(editingItem.id, payload)
        setItems((prev) => prev.map((w) => (w.id === saved.id ? saved : w)))
        setEditingItem(null)
        setSaveSuccessMsg('Wishlist item updated!')
      } else {
        // ── Insert new item ────────────────────────────────────────────────
        const saved = await addToWishlist(payload)
        setItems((prev) => [saved, ...prev])
        setSaveSuccessMsg('Added to your wishlist!')

        // Fire background ratings fetch for any null fields — server writes to
        // Supabase directly so result persists even if the user navigates away.
        const nullFields = ['james_suckling', 'robert_parker', 'wine_spectator']
          .filter((f) => saved[f] === null)
        if (nullFields.length > 0) {
          fetch('/api/get-ratings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wine_id:     saved.id,
              name:        saved.name,
              producer:    saved.producer ?? null,
              vintage:     saved.vintage  ?? null,
              region:      saved.region   ?? null,
              country:     saved.country  ?? null,
              null_fields: nullFields,
              table:       'wishlist',
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              const update = {}
              for (const f of nullFields) { update[f] = data[f] ?? -1 }
              setItems((prev) => prev.map((w) => (w.id === saved.id ? { ...w, ...update } : w)))
            })
            .catch(() => {})
        }
      }

      setForm(EMPTY_FORM)
      setScanned(false); setScanInferred([]); setPriceRange(null); setScanDrinkingWindow(null)
      setSaveSuccess(true)
      setShowForm(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) { setSaveError(err.message) }
    finally { setSaving(false) }
  }

  // Items where at least one critic field has never been attempted (null = not yet tried)
  const missingRatings = items.filter(
    (w) => w.james_suckling === null || w.robert_parker === null || w.wine_spectator === null
  )

  // Bulk refresh — only processes items with null fields, in batches of 20
  const RATINGS_BATCH_SIZE = 20
  const RATINGS_DELAY_MS   = 2000

  async function handleRefreshRatings() {
    if (missingRatings.length === 0 || refreshing) return
    setRefreshing(true)
    setRefreshDone(false)
    setRefreshProgress({ done: 0, total: missingRatings.length })

    let done = 0
    for (let i = 0; i < missingRatings.length; i += RATINGS_BATCH_SIZE) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, RATINGS_DELAY_MS))

      const batch = missingRatings.slice(i, i + RATINGS_BATCH_SIZE)

      try {
        const res = await fetch('/api/get-ratings-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'wishlist',
            wines: batch.map((w) => ({
              id:          w.id,
              name:        w.name,
              producer:    w.producer  ?? null,
              vintage:     w.vintage   ?? null,
              region:      w.region    ?? null,
              country:     w.country   ?? null,
              null_fields: ['james_suckling', 'robert_parker', 'wine_spectator'].filter((f) => w[f] === null),
            })),
          }),
        })
        const data = await res.json()
        const results = data.results ?? []

        // Server already saved — just update local React state for null fields only
        for (const result of results) {
          const wine = batch.find((w) => w.id === result.id)
          const nullFields = wine ? ['james_suckling', 'robert_parker', 'wine_spectator'].filter((f) => wine[f] === null) : []
          const update = {}
          for (const field of nullFields) { update[field] = result[field] ?? -1 }
          if (Object.keys(update).length > 0) {
            setItems((prev) => prev.map((w) => (w.id === result.id ? { ...w, ...update } : w)))
          }
          done += 1
          setRefreshProgress({ done, total: missingRatings.length })
        }
      } catch {
        done += batch.length
        setRefreshProgress({ done, total: missingRatings.length })
      }
    }

    setRefreshing(false)
    setRefreshDone(true)
    setRefreshProgress(null)
    setTimeout(() => setRefreshDone(false), 4000)
  }

  // ── Buy suggestions ───────────────────────────────────────────────────────
  async function handleSuggest() {
    if (suggesting) return
    setSuggesting(true)
    setSuggestError(null)
    setSuggestions(null)
    try {
      const [wines, history] = await Promise.all([getWines(), getDrinkingHistory().catch(() => [])])
      const tasteProfile = buildTasteProfile(history)
      const currentWineNames = wines.map((w) => w.name)
      const wishlistWineNames = items.map((w) => w.name)
      const res = await fetch('/api/suggest-wines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasteProfile, currentWines: currentWineNames, wishlistWines: wishlistWineNames }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate suggestions.')
      setSuggestions(data.suggestions ?? [])
    } catch (err) {
      setSuggestError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  // ── Move to cellar ────────────────────────────────────────────────────────
  async function handleAddToCellar(item) {
    setAddingId(item.id)
    try {
      const wine = await moveToWines(item)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
      // Kick off drinking window estimation if needed
      if (!wine.drinking_window_status) estimateInBackground(wine)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setAddingId(null) }
  }

  // ── Remove from wishlist ──────────────────────────────────────────────────
  async function handleRemove(id) {
    if (!confirm('Remove from wishlist?')) return
    setRemovingId(id)
    try {
      await removeFromWishlist(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (err) { alert('Error: ' + err.message) }
    finally { setRemovingId(null) }
  }

  const isBusy = scanning || parsing

  return (
    <div className="space-y-5">

      {/* ── Add section ─────────────────────────────────────────────────── */}
      <div className="card space-y-0 overflow-hidden">

        {/* Header — toggle when adding, cancel button when editing */}
        {editingItem ? (
          <div className="w-full flex items-center justify-between py-1 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-neutral-200 truncate">Editing: {editingItem.name}</span>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex-shrink-0 text-xs text-neutral-500 hover:text-neutral-300 transition-colors duration-100 px-2 py-1 rounded hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-full flex items-center justify-between py-1 gap-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-wine-950 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-wine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-neutral-200">Add a wine to your wishlist</span>
            </div>
            <svg
              className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${showForm ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Expanded add form */}
        {showForm && (
          <div className="space-y-4 pt-4 mt-3 border-t border-neutral-800">

            {/* Scan buttons */}
            <div className="flex gap-2">
              <label className={`btn-primary text-sm cursor-pointer inline-flex flex-1 justify-center items-center gap-2 ${isBusy ? 'opacity-60 pointer-events-none' : ''}`}>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                  className="sr-only" onChange={handleScan} disabled={isBusy} />
                {scanning ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Scanning…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Scan Label</>
                )}
              </label>
              <label className={`btn-secondary text-sm cursor-pointer inline-flex flex-1 justify-center items-center gap-2 ${isBusy ? 'opacity-60 pointer-events-none' : ''}`}>
                <input ref={uploadRef} type="file" accept="image/*"
                  className="sr-only" onChange={handleScan} disabled={isBusy} />
                {scanning ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Scanning…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Upload Photo</>
                )}
              </label>
            </div>

            {/* Text / URL paste */}
            <div className="space-y-1.5">
              <p className="text-xs text-neutral-500">Or paste a wine name, description, or product URL</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleParseText()}
                  placeholder="e.g. Penfolds Grange 2015 or paste a URL"
                  className="input-field flex-1 text-sm"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={!textInput.trim() || isBusy}
                  className="btn-secondary text-sm px-3 flex-shrink-0"
                >
                  {parsing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : 'Analyse'}
                </button>
              </div>
              {parseError && <p className="text-xs text-red-400">{parseError}</p>}
            </div>

            {/* Scan / parse feedback */}
            {scanError && <p className="text-xs text-red-400">{scanError}</p>}
            {scanned && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Fields pre-filled — check below and correct anything
                </div>
                {scanInferred.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    <span className="text-neutral-400">Inferred:</span> {scanInferred.join(', ')}
                  </p>
                )}
                {priceRange && (
                  <p className="text-xs text-neutral-500">
                    Est. retail S${priceRange.min}–S${priceRange.max} · cost pre-filled with midpoint
                  </p>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-xs text-neutral-600">fill in details</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Manual form */}
            <form onSubmit={handleSave} className="space-y-4">

              {/* Name */}
              <FormField label="Wine Name" required>
                <input name="name" value={form.name} onChange={handleChange} required
                  placeholder="e.g. Château Pétrus" className="input-field" />
              </FormField>

              {/* Producer */}
              <FormField label="Producer">
                <input name="producer" value={form.producer} onChange={handleChange}
                  placeholder="e.g. Pétrus Estate" className="input-field" />
              </FormField>

              {/* Vintage + Cost */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Vintage">
                  <input name="vintage" type="number" min="1800" max={new Date().getFullYear()}
                    value={form.vintage} onChange={handleChange} placeholder="e.g. 2018" className="input-field" />
                </FormField>
                <FormField label="Est. Cost (SGD)">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">S$</span>
                    <input name="cost" type="number" min="0" step="0.01"
                      value={form.cost} onChange={handleChange} placeholder="0.00"
                      className="input-field pl-9" />
                  </div>
                </FormField>
              </div>

              {/* Region + Country */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Region">
                  <input name="region" value={form.region} onChange={handleChange}
                    placeholder="e.g. Pomerol" className="input-field" />
                </FormField>
                <FormField label="Country">
                  <input name="country" value={form.country} onChange={handleChange}
                    placeholder="e.g. France" className="input-field" />
                </FormField>
              </div>

              {/* Grape variety */}
              <FormField label="Grape Variety">
                <input name="grape_variety" value={form.grape_variety} onChange={handleChange}
                  placeholder="e.g. Merlot" className="input-field" />
              </FormField>

              {/* Colour */}
              <FormField label="Colour" required>
                <div className="flex flex-wrap gap-2">
                  {COLOURS.map((c) => (
                    <button key={c} type="button"
                      onClick={() => handleChange({ target: { name: 'colour', value: c } })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-100 capitalize ${
                        form.colour === c
                          ? `${COLOUR_PICKER[c]} ring-2 ring-offset-2 ring-offset-neutral-900 ring-current`
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Critic ratings */}
              <FormField label="Critic Ratings">
                <div className="flex gap-2">
                  {[
                    { name: 'james_suckling', label: 'JS' },
                    { name: 'robert_parker',  label: 'RP' },
                    { name: 'wine_spectator', label: 'WS' },
                  ].map(({ name, label }) => (
                    <div key={name} className="flex-1 space-y-1">
                      <p className="text-xs text-neutral-500 text-center">{label}</p>
                      <input
                        name={name}
                        type="number"
                        min="50"
                        max="100"
                        value={form[name]}
                        onChange={handleChange}
                        placeholder="–"
                        className="input-field text-center font-mono px-1"
                      />
                    </div>
                  ))}
                </div>
              </FormField>

              {/* Source */}
              <FormField label="Where did you try or see this?">
                <input name="source" value={form.source} onChange={handleChange}
                  placeholder="e.g. Restaurant Odette, Wine.com, friend's cellar"
                  className="input-field" />
              </FormField>

              {/* Notes */}
              <FormField label="Notes">
                <textarea name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Tasting notes, why you want it…" rows={3}
                  className="input-field resize-none" />
              </FormField>

              {saveError && (
                <p className="text-sm text-red-400">{saveError}</p>
              )}

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add to Wishlist'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Save success toast ───────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="card border-green-900 bg-green-950/40 text-green-300 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {saveSuccessMsg}
        </div>
      )}

      {/* ── Refresh Ratings — shown when items are missing ratings ─────── */}
      {!loading && missingRatings.length > 0 && (
        <button
          onClick={handleRefreshRatings}
          disabled={refreshing}
          className="w-full flex items-center justify-center gap-2 btn-secondary text-sm disabled:opacity-60"
        >
          {refreshing ? (
            <>
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {refreshProgress?.done > 0
                ? `${refreshProgress.done} / ${refreshProgress.total} done…`
                : 'Fetching ratings…'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Refresh Ratings ({missingRatings.length} missing)
            </>
          )}
        </button>
      )}

      {/* ── Refresh done banner ──────────────────────────────────────────── */}
      {refreshDone && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ratings updated — wines already rated were left unchanged
        </div>
      )}

      {/* ── Suggest what to buy ──────────────────────────────────────────── */}
      {!loading && (
        <button
          onClick={handleSuggest}
          disabled={suggesting}
          className="w-full flex items-center justify-center gap-2 btn-secondary text-sm disabled:opacity-60"
        >
          {suggesting ? (
            <>
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Finding recommendations…
            </>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Suggest what to buy
            </>
          )}
        </button>
      )}

      {/* Suggest error */}
      {suggestError && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          {suggestError}
        </div>
      )}

      {/* Suggestion results */}
      {suggestions !== null && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Recommended for you
          </p>
          {suggestions.length === 0 ? (
            <div className="card text-center text-sm text-neutral-500 py-6">
              No suggestions generated — try again after drinking more wines!
            </div>
          ) : (
            suggestions.map((s, i) => (
              <div key={i} className="card space-y-2.5 border-wine-900/40 bg-wine-950/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-100 leading-snug">{s.name}</p>
                    {s.producer && (
                      <p className="text-xs text-neutral-400 mt-0.5">{s.producer}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-wine-300">
                      S${s.price_sgd_min}–{s.price_sgd_max}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.grape_variety && (
                    <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
                      {s.grape_variety}
                    </span>
                  )}
                  {s.region && (
                    <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
                      {s.region}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed">{s.why}</p>
                {s.where_to_buy && (
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {s.where_to_buy}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Error loading list ───────────────────────────────────────────── */}
      {listError && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          Could not load wishlist: {listError}
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-4 bg-neutral-800 rounded w-2/3" />
              <div className="h-3 bg-neutral-800 rounded w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-3 bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && !listError && items.length === 0 && (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-wine-950 flex items-center justify-center">
            <svg className="w-7 h-7 text-wine-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-neutral-200">Your wishlist is empty</p>
            <p className="text-sm text-neutral-500 mt-1">Scan a label or tap "Add a wine" to start your list.</p>
          </div>
        </div>
      )}

      {/* ── Count ────────────────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <p className="text-xs text-neutral-500">
          {items.length} {items.length === 1 ? 'wine' : 'wines'} on your wishlist
        </p>
      )}

      {/* ── Wishlist cards ───────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onAddToCellar={handleAddToCellar}
              onRemove={handleRemove}
              addingId={addingId}
              removingId={removingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-300">
        {label}
        {required && <span className="text-wine-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
