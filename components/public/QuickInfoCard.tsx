interface Props {
  guestCapacity: number
  minNights: number
  cleaningFee?: number
  securityDeposit?: number
}

export default function QuickInfoCard({ guestCapacity, minNights, cleaningFee, securityDeposit }: Props) {
  const items = [
    { label: 'Guests', value: `Up to ${guestCapacity}` },
    { label: 'Min. Stay', value: `${minNights} night${minNights !== 1 ? 's' : ''}` },
    ...(cleaningFee ? [{ label: 'Cleaning Fee', value: `$${cleaningFee}` }] : []),
    ...(securityDeposit ? [{ label: 'Security Dep.', value: `$${securityDeposit}` }] : []),
  ]

  return (
    <div className="bg-surface-highest/40 border border-outline-variant/20 rounded-2xl p-4 grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body mb-0.5">
            {item.label}
          </p>
          <p className="text-sm font-bold text-on-surface">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
