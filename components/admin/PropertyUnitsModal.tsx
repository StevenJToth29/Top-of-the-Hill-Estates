'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface Unit {
  id: string
  name: string
  nightly_rate: number
  is_active: boolean
}

interface Props {
  propertyName: string
  units: Unit[]
  visibleCount?: number
}

export default function PropertyUnitsModal({ propertyName, units, visibleCount = 4 }: Props) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const overflow = units.length - visibleCount

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [open])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handleClose = () => setOpen(false)
    el.addEventListener('close', handleClose)
    return () => el.removeEventListener('close', handleClose)
  }, [])

  function closeAndNavigate(href: string) {
    const el = dialogRef.current
    if (el?.open) el.close()
    setOpen(false)
    router.push(href)
  }

  if (overflow <= 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary/30 text-xs font-semibold text-secondary hover:bg-secondary/5 transition-colors"
      >
        +{overflow} more
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          const rect = dialogRef.current?.getBoundingClientRect()
          if (!rect) return
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            setOpen(false)
          }
        }}
        className="rounded-2xl border border-outline-variant/20 bg-surface shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm p-0 w-full max-w-md"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
          <div>
            <h2 className="font-display text-base font-bold text-on-surface">{propertyName}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {units.length} unit{units.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <ul className="divide-y divide-outline-variant/10 max-h-96 overflow-y-auto">
          {units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                onClick={() => closeAndNavigate(`/admin/rooms/${unit.id}/edit`)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container transition-colors text-left"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${unit.is_active ? 'bg-green-400' : 'bg-on-surface-variant/30'}`}
                />
                <span className="flex-1 text-sm font-medium text-on-surface truncate">{unit.name}</span>
                <span className="text-xs text-on-surface-variant/60 shrink-0">${unit.nightly_rate}/night</span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  )
}
