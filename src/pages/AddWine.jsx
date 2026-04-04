import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WineForm, { EMPTY_FORM } from '../components/WineForm'
import { addWine, updateWine, findDuplicateWine } from '../lib/wines'
import { estimateInBackground } from '../lib/drinkingWindow'
import DuplicateWineModal from '../components/DuplicateWineModal'

// Resize image to max 1280px wide/tall and return a base64 JPEG string
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1280
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
}

export default function AddWine() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const uploadInputRef = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scanned, setScanned] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [scanDrinkingWindow, setScanDrinkingWindow] = useState(null)
  const [scanInferred, setScanInferred] = useState([])
  const [priceRange, setPriceRange] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [duplicateWine, setDuplicateWine] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  // Shared: apply Claude API response to form state
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
  }

  async function handleScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanError(null); setScanned(false); setScanDrinkingWindow(null); setScanInferred([]); setPriceRange(null)
    setScanning(true)
    try {
      const imageBase64 = await compressImage(file)
      const res = await fetch('/api/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      applyApiData(data)
    } catch (err) { setScanError(err.message) }
    finally { setScanning(false) }
  }

  async function handleParseText() {
    if (!textInput.trim()) return
    setParseError(null); setScanned(false); setScanDrinkingWindow(null); setScanInferred([]); setPriceRange(null)
    setParsing(true)
    try {
      const res = await fetch('/api/parse-wine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: textInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      applyApiData(data)
      setTextInput('')
    } catch (err) { setParseError(err.message) }
    finally { setParsing(false) }
  }

  // Core save — called after duplicate check is resolved
  async function saveNewWine() {
    setSaving(true)
    setError(null)
    try {
      const saved = await addWine({
        name: form.name.trim(),
        producer: form.producer.trim() || null,
        vintage: form.vintage ? Number(form.vintage) : null,
        region: form.region.trim() || null,
        country: form.country.trim() || null,
        grape_variety: form.grape_variety.trim() || null,
        colour: form.colour,
        quantity: Number(form.quantity),
        cost: form.cost !== '' ? Number(form.cost) : null,
        ratings: form.ratings.trim() || null,
        notes: form.notes.trim() || null,
      })
      // Use drinking window from scan if available; otherwise estimate in background
      if (scanDrinkingWindow?.status) {
        updateWine(saved.id, {
          drinking_window_status: scanDrinkingWindow.status,
          drinking_window_note:   scanDrinkingWindow.note       ?? null,
          drinking_window_start:  scanDrinkingWindow.start_year ?? null,
          drinking_window_end:    scanDrinkingWindow.end_year   ?? null,
        }).catch(() => {})
      } else {
        estimateInBackground(saved)
      }
      setSuccess(true)
      setForm(EMPTY_FORM)
      setTimeout(() => { setSuccess(false); navigate('/') }, 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    // Check for a duplicate before saving
    try {
      const dup = await findDuplicateWine(form.name.trim(), form.vintage ? Number(form.vintage) : null)
      if (dup) {
        setDuplicateWine(dup)
        setSaving(false)
        return // pause — wait for user decision in modal
      }
    } catch {
      // duplicate check failed — just proceed with save
    }
    setSaving(false)
    saveNewWine()
  }

  // Modal: merge quantity into existing wine
  async function handleAddToExisting() {
    const dup = duplicateWine
    setDuplicateWine(null)
    setSaving(true)
    try {
      await updateWine(dup.id, { quantity: dup.quantity + Number(form.quantity) })
      setSuccess(true)
      setForm(EMPTY_FORM)
      setTimeout(() => { setSuccess(false); navigate('/') }, 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Modal: ignore duplicate, create a new separate record
  function handleSaveAsNew() {
    setDuplicateWine(null)
    saveNewWine()
  }

  return (
    <div className="space-y-5">

      {/* Scan Label card */}
      <div className="card flex flex-col items-center gap-3 py-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-wine-950 flex items-center justify-center">
          <svg className="w-6 h-6 text-wine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <div>
          <p className="font-medium text-neutral-200 text-sm">Scan a wine label or image</p>
          <p className="text-xs text-neutral-500 mt-0.5">Labels, menus, screenshots, tasting notes — Claude will extract the details</p>
        </div>

        {/* Success message */}
        {scanned && !scanError && (
          <div className="w-full space-y-1.5 text-left">
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Scanned — check the fields below and correct anything
            </div>
            {scanInferred.length > 0 && (
              <p className="text-xs text-neutral-500">
                <span className="text-neutral-400">Inferred:</span>{' '}
                {scanInferred.join(', ')}
              </p>
            )}
            {priceRange && (
              <p className="text-xs text-neutral-500">
                Est. retail S${priceRange.min}–S${priceRange.max} · cost pre-filled with midpoint
              </p>
            )}
          </div>
        )}

        {/* Error message */}
        {scanError && (
          <p className="text-xs text-red-400">{scanError}</p>
        )}

        {/* Two buttons side by side */}
        <div className="flex gap-2 w-full">

          {/* Camera */}
          <label className={`btn-primary text-sm cursor-pointer inline-flex flex-1 justify-center items-center gap-2 ${scanning ? 'opacity-60 pointer-events-none' : ''}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleScan}
              disabled={scanning}
            />
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {scanned ? 'Scan Again' : 'Open Camera'}
              </>
            )}
          </label>

          {/* Photo library */}
          <label className={`btn-secondary text-sm cursor-pointer inline-flex flex-1 justify-center items-center gap-2 ${scanning ? 'opacity-60 pointer-events-none' : ''}`}>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleScan}
              disabled={scanning}
            />
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload Photo
              </>
            )}
          </label>

        </div>

        {/* Text / URL paste */}
        <div className="w-full space-y-1.5">
          <p className="text-xs text-neutral-500">Or paste a wine name, description, or product URL</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleParseText()}
              placeholder="e.g. Opus One 2019 or paste URL"
              className="input-field flex-1 text-sm"
              disabled={scanning || parsing}
            />
            <button
              type="button"
              onClick={handleParseText}
              disabled={!textInput.trim() || scanning || parsing}
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
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-neutral-800" />
        <span className="text-xs text-neutral-600">or fill in manually</span>
        <div className="flex-1 h-px bg-neutral-800" />
      </div>

      {/* The form */}
      <WineForm
        form={form}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel="Save to Cellar"
        saving={saving}
        error={error}
        success={success}
        successMessage="Wine added! Returning to dashboard…"
      />

      {/* Duplicate wine modal */}
      {duplicateWine && (
        <DuplicateWineModal
          existingWine={duplicateWine}
          newQuantity={Number(form.quantity)}
          onAddToExisting={handleAddToExisting}
          onSaveAsNew={handleSaveAsNew}
          onCancel={() => setDuplicateWine(null)}
        />
      )}
    </div>
  )
}
