import { useEffect } from 'react'

export default function DuplicateWineModal({
  existingWine,
  newQuantity,
  onAddToExisting,
  onSaveAsNew,
  onCancel,
}) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const name = existingWine.name
  const vintage = existingWine.vintage ? ` ${existingWine.vintage}` : ''
  const existing = existingWine.quantity
  const total = existing + newQuantity
  const bottleWord = (n) => n === 1 ? 'bottle' : 'bottles'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-sm card space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + heading */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-100">Already in your cellar</p>
            <p className="text-sm text-neutral-400 mt-0.5">
              You have{' '}
              <span className="text-neutral-200 font-medium">{existing} {bottleWord(existing)}</span>
              {' '}of{' '}
              <span className="text-neutral-200 font-medium">{name}{vintage}</span>.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onAddToExisting}
            className="btn-primary w-full text-sm"
          >
            Add {newQuantity} to existing · {total} {bottleWord(total)} total
          </button>
          <button
            onClick={onSaveAsNew}
            className="btn-secondary w-full text-sm"
          >
            Save as separate entry
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors duration-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
