import { useState, useEffect, useRef } from 'react'

export default function DrinkConfirmModal({ wine, onConfirm, onCancel }) {
  const [note, setNote] = useState('')
  const textareaRef = useRef(null)

  // Auto-focus the textarea when the modal opens
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      {/* Sheet */}
      <div className="card w-full max-w-sm space-y-4">

        {/* Header */}
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Log a drink</p>
          <p className="font-semibold text-neutral-100 leading-snug">
            {wine.name}
            {wine.vintage ? <span className="text-neutral-400 font-normal"> · {wine.vintage}</span> : null}
          </p>
          {wine.producer && (
            <p className="text-sm text-neutral-500 mt-0.5">{wine.producer}</p>
          )}
        </div>

        {/* Note input */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-neutral-300">
            Add a note <span className="text-neutral-600 font-normal">(optional)</span>
          </label>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Paired well with the steak, a bit too young, great with dessert…"
            rows={3}
            className="input-field resize-none text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 text-sm py-2.5"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim() || null)}
            className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
