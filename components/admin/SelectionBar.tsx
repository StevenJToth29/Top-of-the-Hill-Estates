'use client'

interface SelectionBarProps {
  selectedCount: number
  roomName: string
  onBook: () => void
  onBlock: () => void
  onSetPrice: () => void
  onClear: () => void
}

export function SelectionBar({
  selectedCount,
  roomName,
  onBook,
  onBlock,
  onSetPrice,
  onClear,
}: SelectionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full px-5 py-3 shadow-xl text-sm font-medium"
      style={{ background: '#0F172A', color: '#F8FAFC' }}
    >
      <span className="text-slate-300">
        {selectedCount} {selectedCount === 1 ? 'day' : 'days'} selected
        {roomName ? ` · ${roomName}` : ''}
      </span>

      <div className="w-px h-4 bg-slate-600" />

      <button
        onClick={onBook}
        className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
        style={{ background: '#2DD4BF', color: '#0F172A' }}
      >
        + Book
      </button>

      <button
        onClick={onBlock}
        className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        🚫 Block
      </button>

      <button
        onClick={onSetPrice}
        className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        $ Set Price
      </button>

      <button
        onClick={onClear}
        className="ml-1 rounded-full w-6 h-6 flex items-center justify-center bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300 hover:text-white"
        aria-label="Clear selection"
      >
        ×
      </button>
    </div>
  )
}
