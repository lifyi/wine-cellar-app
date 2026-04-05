import { useState, useEffect, useRef } from 'react'

export default function DrinkConfirmModal({ wine, onConfirm, onCoravin, onCancel }) {
  const [step, setStep] = useState('choose') // 'choose' | 'note'
  const [note, setNote] = useState('')
  const textareaRef = useRef(null)

  // Auto-focus textarea when entering the note step
  useEffect(() => {
    if (step === 'note') {
      const t = setTimeout(() => textareaRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [step])

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

        {step === 'choose' ? (
          /* Step 1: Choose action */
          <div className="space-y-2">

            {/* Finished bottle */}
            <button
              onClick={() => setStep('note')}
              className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-neutral-700 hover:border-wine-600 hover:bg-wine-950/20 transition-colors duration-100"
            >
              <svg className="w-5 h-5 text-wine-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-neutral-100">Finished bottle</p>
                <p className="text-xs text-neutral-500 mt-0.5">Reduces quantity by 1 and logs to history</p>
              </div>
            </button>

            {/* Coravin pour */}
            <button
              onClick={onCoravin}
              className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-neutral-700 hover:border-purple-600 hover:bg-purple-950/20 transition-colors duration-100"
            >
              <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-neutral-100">Coravin pour</p>
                <p className="text-xs text-neutral-500 mt-0.5">Records the date — no quantity change, not logged to history</p>
              </div>
            </button>

            {/* Cancel */}
            <button
              onClick={onCancel}
              className="w-full btn-secondary text-sm py-2.5 mt-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* Step 2: Note for finished bottle */
          <>
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

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep('choose')}
                className="btn-secondary flex-1 text-sm py-2.5"
              >
                ← Back
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
          </>
        )}
      </div>
    </div>
  )
}
