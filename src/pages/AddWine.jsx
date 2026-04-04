import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WineForm, { EMPTY_FORM } from '../components/WineForm'
import { addWine } from '../lib/wines'

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
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scanned, setScanned] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function handleScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same photo can be re-scanned if needed
    e.target.value = ''

    setScanError(null)
    setScanned(false)
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

      // Pre-fill form — only overwrite fields Claude found; keep existing values otherwise
      setForm((f) => ({
        ...f,
        name:          data.name          != null ? String(data.name)          : f.name,
        producer:      data.producer      != null ? String(data.producer)      : f.producer,
        vintage:       data.vintage       != null ? String(data.vintage)       : f.vintage,
        region:        data.region        != null ? String(data.region)        : f.region,
        country:       data.country       != null ? String(data.country)       : f.country,
        grape_variety: data.grape_variety != null ? String(data.grape_variety) : f.grape_variety,
        colour:        data.colour        != null ? data.colour                : f.colour,
      }))
      setScanned(true)
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addWine({
        name: form.name.trim(),
        producer: form.producer.trim() || null,
        vintage: form.vintage ? Number(form.vintage) : null,
        region: form.region.trim() || null,
        country: form.country.trim() || null,
        grape_variety: form.grape_variety.trim() || null,
        colour: form.colour,
        quantity: Number(form.quantity),
        cost: form.cost !== '' ? Number(form.cost) : null,
      })
      setSuccess(true)
      setForm(EMPTY_FORM)
      setTimeout(() => {
        setSuccess(false)
        navigate('/')
      }, 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
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
          <p className="font-medium text-neutral-200 text-sm">Scan a wine label</p>
          <p className="text-xs text-neutral-500 mt-0.5">Take a photo — Claude will fill in the details automatically</p>
        </div>

        {/* Success message */}
        {scanned && !scanError && (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Label scanned — check the fields below and correct anything
          </div>
        )}

        {/* Error message */}
        {scanError && (
          <p className="text-xs text-red-400">{scanError}</p>
        )}

        {/* Camera trigger */}
        <label className={`btn-primary text-sm cursor-pointer inline-flex items-center gap-2 ${scanning ? 'opacity-60 pointer-events-none' : ''}`}>
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
    </div>
  )
}
