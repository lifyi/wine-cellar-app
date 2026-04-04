import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WineForm, { EMPTY_FORM } from '../components/WineForm'
import { addWine } from '../lib/wines'

export default function AddWine() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
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
  )
}
