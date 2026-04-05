import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import WineForm, { EMPTY_FORM } from '../components/WineForm'
import { getWineById, updateWine } from '../lib/wines'

export default function EditWine() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getWineById(id)
      .then((wine) => {
        setForm({
          name:         wine.name ?? '',
          producer:     wine.producer ?? '',
          vintage:      wine.vintage ?? '',
          region:       wine.region ?? '',
          country:      wine.country ?? '',
          grape_variety: wine.grape_variety ?? '',
          colour:       wine.colour ?? 'red',
          quantity:     wine.quantity ?? 1,
          cost:           wine.cost ?? '',
          james_suckling: wine.james_suckling != null && wine.james_suckling > 0 ? String(wine.james_suckling) : '',
          robert_parker:  wine.robert_parker  != null && wine.robert_parker  > 0 ? String(wine.robert_parker)  : '',
          wine_spectator: wine.wine_spectator != null && wine.wine_spectator > 0 ? String(wine.wine_spectator) : '',
          notes:          wine.notes ?? '',
          coravin_count:    wine.coravin_count ?? 0,
          last_coravin_date: wine.last_coravin_date ?? '',
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => {
      const update = { ...f, [name]: value }
      // Auto-clear date when count is zeroed
      if (name === 'coravin_count' && (value === '0' || value === '')) {
        update.last_coravin_date = ''
      }
      return update
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await updateWine(id, {
        name: form.name.trim(),
        producer: form.producer.trim() || null,
        vintage: form.vintage ? Number(form.vintage) : null,
        region: form.region.trim() || null,
        country: form.country.trim() || null,
        grape_variety: form.grape_variety.trim() || null,
        colour: form.colour,
        quantity: Number(form.quantity),
        cost:           form.cost           !== '' ? Number(form.cost)           : null,
        james_suckling: form.james_suckling !== '' ? Number(form.james_suckling) : null,
        robert_parker:  form.robert_parker  !== '' ? Number(form.robert_parker)  : null,
        wine_spectator: form.wine_spectator !== '' ? Number(form.wine_spectator) : null,
        notes:          form.notes.trim() || null,
        coravin_count:    Number(form.coravin_count) || 0,
        last_coravin_date: form.last_coravin_date || null,
      })
      setSuccess(true)
      setTimeout(() => navigate('/inventory'), 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-neutral-800 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error && !form.name) {
    return (
      <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
        Could not load wine: {error}
      </div>
    )
  }

  return (
    <WineForm
      form={form}
      onChange={handleChange}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
      saving={saving}
      error={error}
      success={success}
      successMessage="Changes saved! Returning to inventory…"
      showCoravin
    />
  )
}
