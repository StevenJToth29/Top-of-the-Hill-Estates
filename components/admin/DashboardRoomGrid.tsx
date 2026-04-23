interface RoomStatus {
  id: string
  name: string
  propertyName: string
  isOccupied: boolean
  isCheckoutToday: boolean
  isCheckinToday: boolean
  currentGuest?: string
  currentCheckout?: string
  nextGuest?: string
  nextCheckin?: string
  monthOccupancyPercent: number
}

interface Props {
  rooms: RoomStatus[]
}

function RoomCard({ room }: { room: RoomStatus }) {
  let statusLabel = 'Available'
  let statusColor = '#059669'
  let statusBg = 'rgba(5,150,105,0.08)'
  let statusBorder = 'rgba(5,150,105,0.2)'

  if (room.isOccupied) {
    statusLabel = 'Occupied'
    statusColor = '#1FB2A0'
    statusBg = 'rgba(45,212,191,0.08)'
    statusBorder = 'rgba(45,212,191,0.22)'
  } else if (room.isCheckoutToday) {
    statusLabel = 'Checking out'
    statusColor = '#D97706'
    statusBg = 'rgba(217,119,6,0.08)'
    statusBorder = 'rgba(217,119,6,0.2)'
  } else if (room.isCheckinToday) {
    statusLabel = 'Arriving today'
    statusColor = '#D97706'
    statusBg = 'rgba(217,119,6,0.08)'
    statusBorder = 'rgba(217,119,6,0.2)'
  }

  const occColor =
    room.monthOccupancyPercent > 75
      ? '#2DD4BF'
      : room.monthOccupancyPercent > 50
        ? '#D97706'
        : '#94A3B8'

  return (
    <div
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: '#E2E8F0' }}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[13px] font-bold" style={{ color: '#0F172A' }}>
            {room.name}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: '#94A3B8' }}>
            {room.propertyName}
          </p>
        </div>
        <span
          className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold"
          style={{
            background: statusBg,
            color: statusColor,
            border: `1px solid ${statusBorder}`,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {room.isOccupied && room.currentGuest && (
        <div
          className="mb-2 rounded-lg px-2.5 py-2"
          style={{
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.22)',
          }}
        >
          <p className="text-[12px] font-semibold" style={{ color: '#1FB2A0' }}>
            {room.currentGuest}
          </p>
          {room.currentCheckout && (
            <p className="mt-0.5 text-[11px]" style={{ color: '#64748B' }}>
              Checks out {room.currentCheckout}
            </p>
          )}
        </div>
      )}

      {!room.isOccupied && room.isCheckinToday && room.nextGuest && (
        <div
          className="mb-2 rounded-lg px-2.5 py-2"
          style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: '#D97706' }}>
            Arriving today: {room.nextGuest}
          </p>
        </div>
      )}

      {room.nextGuest && !room.isCheckinToday && (
        <p className="mb-2 text-[11px]" style={{ color: '#64748B' }}>
          Next:{' '}
          <strong style={{ color: '#0F172A' }}>{room.nextGuest}</strong>
          {room.nextCheckin && ` on ${room.nextCheckin}`}
        </p>
      )}

      {!room.currentGuest && !room.nextGuest && (
        <p className="mb-2 text-[11px]" style={{ color: '#94A3B8' }}>
          No upcoming bookings
        </p>
      )}

      <div className="flex items-center gap-2">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full"
          style={{ background: '#F1F5F9' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${room.monthOccupancyPercent}%`, background: occColor }}
          />
        </div>
        <span
          className="min-w-[30px] text-right text-[11px] font-bold"
          style={{ color: occColor }}
        >
          {room.monthOccupancyPercent}%
        </span>
      </div>
      <p className="mt-1 text-[10px]" style={{ color: '#94A3B8' }}>
        Occupancy this month
      </p>
    </div>
  )
}

export default function DashboardRoomGrid({ rooms }: Props) {
  return (
    <div>
      <p
        className="mb-3 font-display text-[15px] font-[800]"
        style={{ color: '#0F172A' }}
      >
        Unit Status
      </p>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
      >
        {rooms.map(room => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  )
}
