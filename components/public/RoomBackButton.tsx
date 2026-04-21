'use client'

export default function RoomBackButton() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    const roomsParams = new URLSearchParams()
    const checkin = params.get('checkin')
    const checkout = params.get('checkout')
    const guests = params.get('guests')
    if (checkin) roomsParams.set('checkin', checkin)
    if (checkout) roomsParams.set('checkout', checkout)
    if (guests) roomsParams.set('guests', guests)
    const qs = roomsParams.toString()
    window.location.href = `/rooms${qs ? `?${qs}` : ''}`
  }

  return (
    <a
      href="/rooms"
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Back to rooms
    </a>
  )
}
