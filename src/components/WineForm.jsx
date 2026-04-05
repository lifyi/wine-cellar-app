// Shared form fields used by both AddWine and EditWine pages.

export const COLOURS = ['red', 'white', 'rosé', 'sparkling', 'dessert']

export const COLOUR_STYLES = {
  red:       'bg-red-950 text-red-300 border-red-800',
  white:     'bg-yellow-950 text-yellow-300 border-yellow-800',
  rosé:      'bg-pink-950 text-pink-300 border-pink-800',
  sparkling: 'bg-sky-950 text-sky-300 border-sky-800',
  dessert:   'bg-amber-950 text-amber-300 border-amber-800',
}

export const EMPTY_FORM = {
  name: '',
  producer: '',
  vintage: '',
  region: '',
  country: '',
  grape_variety: '',
  colour: 'red',
  quantity: 1,
  cost: '',
  james_suckling: '',
  robert_parker: '',
  wine_spectator: '',
  notes: '',
}

export default function WineForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  error,
  success,
  successMessage,
  showCoravin = false,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">

      {/* Success banner */}
      {success && (
        <div className="card border-green-900 bg-green-950/40 text-green-300 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="card border-red-900 bg-red-950/30 text-red-300 text-sm">
          <p className="font-medium">Failed to save</p>
          <p className="text-red-400/80 text-xs mt-1">{error}</p>
        </div>
      )}

      {/* Wine Name */}
      <Field label="Wine Name" required>
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          required
          placeholder="e.g. Château Margaux"
          className="input-field"
        />
      </Field>

      {/* Producer */}
      <Field label="Producer">
        <input
          name="producer"
          value={form.producer}
          onChange={onChange}
          placeholder="e.g. Château Margaux Estate"
          className="input-field"
        />
      </Field>

      {/* Vintage + Quantity */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vintage">
          <input
            name="vintage"
            type="number"
            min="1800"
            max={new Date().getFullYear()}
            value={form.vintage}
            onChange={onChange}
            placeholder="e.g. 2018"
            className="input-field"
          />
        </Field>
        <Field label="Quantity" required>
          <input
            name="quantity"
            type="number"
            min="1"
            max="9999"
            value={form.quantity}
            onChange={onChange}
            required
            className="input-field"
          />
        </Field>
      </div>

      {/* Region + Country */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Region">
          <input
            name="region"
            value={form.region}
            onChange={onChange}
            placeholder="e.g. Bordeaux"
            className="input-field"
          />
        </Field>
        <Field label="Country">
          <input
            name="country"
            value={form.country}
            onChange={onChange}
            placeholder="e.g. France"
            className="input-field"
          />
        </Field>
      </div>

      {/* Grape variety + Cost */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grape Variety">
          <input
            name="grape_variety"
            value={form.grape_variety}
            onChange={onChange}
            placeholder="e.g. Cab Sauv"
            className="input-field"
          />
        </Field>
        <Field label="Cost (SGD)">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">S$</span>
            <input
              name="cost"
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={onChange}
              placeholder="0.00"
              className="input-field pl-9"
            />
          </div>
          {form.name && (
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${form.producer ? form.producer + ' ' : ''}${form.name}${form.vintage ? ' ' + form.vintage : ''} wine price Singapore`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-wine-400 hover:text-wine-300 transition-colors duration-100"
            >
              Check prices →
            </a>
          )}
        </Field>
      </div>

      {/* Colour picker */}
      <Field label="Colour" required>
        <div className="flex flex-wrap gap-2">
          {COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ target: { name: 'colour', value: c } })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-100 capitalize ${
                form.colour === c
                  ? `${COLOUR_STYLES[c]} ring-2 ring-offset-2 ring-offset-neutral-900 ring-current`
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      {/* Critic Ratings — three separate score boxes */}
      <Field label="Critic Ratings">
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
                onChange={onChange}
                placeholder="–"
                className="input-field text-center font-mono px-1"
              />
            </div>
          ))}
        </div>
        {form.name && (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${form.producer ? form.producer + ' ' : ''}${form.name}${form.vintage ? ' ' + form.vintage : ''} wine rating`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-wine-400 hover:text-wine-300 transition-colors duration-100"
          >
            Check ratings →
          </a>
        )}
      </Field>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          name="notes"
          value={form.notes}
          onChange={onChange}
          placeholder="Tasting notes, food pairings, personal comments…"
          rows={4}
          className="input-field resize-none"
        />
      </Field>

      {/* Coravin — edit only */}
      {showCoravin && (
        <div className="space-y-3 pt-1 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p className="text-sm font-medium text-neutral-300">Coravin</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coravin'd bottles">
              <input
                name="coravin_count"
                type="number"
                min="0"
                max={form.quantity || 9999}
                value={form.coravin_count}
                onChange={onChange}
                className="input-field"
              />
            </Field>
            <Field label="Last Coravin date">
              <input
                name="last_coravin_date"
                type="date"
                value={form.last_coravin_date}
                onChange={onChange}
                disabled={!Number(form.coravin_count)}
                className="input-field disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving || success}
        className="btn-primary w-full"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

function Field({ label, required, children }) {
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
