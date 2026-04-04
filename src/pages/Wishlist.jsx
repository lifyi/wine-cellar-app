import { useEffect, useRef, useState } from 'react'
import WishlistCard from '../components/WishlistCard'
import { getWishlist, addToWishlist, removeFromWishlist, moveToWines } from '../lib/wishlist'
import { estimateInBackground } from '../lib/drinkingWindow'

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
  grape_variety: '', colour: 'red', cost: '', ratings: '', notes: '', source: '',
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

  // Add-form state
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

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
      colour:        data.colour        != null ? data.colour                : f.colour,
      notes:         data.notes         != null ? String(data.notes)         : f.notes,
      cost:          data.cost          != null ? String(data.cost)          : f.cost,
      ratings:       data.ratings       != null ? String(data.ratings)       : f.ratings,
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

  // ── Save to wishlist ──────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setSaveError(null)
    try {
      const saved = await addToWishlist({
        name:          form.name.trim(),
        producer:      form.producer.trim()      || null,
        vintage:       form.vintage ? Number(form.vintage) : null,
        region:        form.region.trim()        || null,
        country:       form.country.trim()       || null,
        grape_variety: form.grape_variety.trim() || null,
        colour:        form.colour,
        notes:         form.notes.trim()         || null,
        ratings:       form.ratings.trim()       || null,
        cost:          form.cost !== '' ? Number(form.cost) : null,
        source:        form.source.trim()        || null,
        drinking_window_status: scanDrinkingWindow?.status    ?? null,
        drinking_window_note:   scanDrinkingWindow?.note      ?? null,
        drinking_window_start:  scanDrinkingWindow?.start_year ?? null,
        drinking_window_end:    scanDrinkingWindow?.end_year   ?? null,
      })
      setItems((prev) => [saved, ...prev])
      setForm(EMPTY_FORM)
      setScanned(false); setScanInferred([]); setPriceRange(null); setScanDrinkingWindow(null)
      setSaveSuccess(true)
      setShowForm(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) { setSaveError(err.message) }
    finally { setSaving(false) }
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

        {/* Header toggle */}
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
                <input name="ratings" value={form.ratings} onChange={handleChange}
                  placeholder="e.g. JS: 94 | RP: 92 | WS: 91"
                  className="input-field font-mono" />
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
                {saving ? 'Saving…' : 'Add to Wishlist'}
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
          Added to your wishlist!
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
