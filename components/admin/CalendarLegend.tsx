const items = [
  { label: 'Available', style: { background: '#fff', border: '1px solid #E2E8F0' } },
  { label: 'Booked', style: { background: 'rgba(45,212,191,0.14)', borderTop: '2px solid #2DD4BF' } },
  { label: 'Blocked', style: { background: 'rgba(100,116,139,0.1)', borderTop: '2px solid #CBD5E1' } },
  { label: 'iCal Block', style: { background: 'rgba(45,212,191,0.07)' } },
  { label: 'Selected', style: { background: 'rgba(45,212,191,0.28)', border: '2px solid #2DD4BF' } },
]

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 py-2 px-1 text-xs text-slate-500">
      {items.map(({ label, style }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-4 rounded-sm"
            style={style}
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
