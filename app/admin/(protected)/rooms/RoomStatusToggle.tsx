'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface RoomStatusToggleProps {
  roomId: string
  isActive: boolean
}

export default function RoomStatusToggle({ roomId, isActive: initialActive }: RoomStatusToggleProps) {
  const [isActive, setIsActive] = useState(initialActive)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function toggle() {
    const next = !isActive
    setIsActive(next)
    startTransition(async () => {
      await fetch('/api/admin/rooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roomId, is_active: next }),
      })
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      onClick={toggle}
      disabled={isPending}
      title={isActive ? 'Deactivate room' : 'Activate room'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:ring-offset-1 focus:ring-offset-background disabled:opacity-50 ${
        isActive ? 'bg-secondary' : 'bg-surface-highest border border-on-surface/15'
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full transition-all ${
          isActive ? 'translate-x-5 bg-white' : 'translate-x-1 bg-on-surface-variant'
        }`}
      />
    </button>
  )
}
