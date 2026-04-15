'use client'

import { useState } from 'react'
import NextImage from 'next/image'
import { CheckIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid'
import { PhotoIcon } from '@heroicons/react/24/outline'

interface PropertyImagePickerProps {
  propertyImages: string[]
  selectedImages: string[]
  onChange: (images: string[]) => void
}

export default function PropertyImagePicker({
  propertyImages,
  selectedImages,
  onChange,
}: PropertyImagePickerProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  if (propertyImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-secondary/30 bg-surface-highest/20 p-8 text-center">
        <PhotoIcon className="w-8 h-8 text-on-surface-variant/40" />
        <p className="text-sm text-on-surface-variant/70">
          No images have been uploaded to this property yet.
        </p>
        <p className="text-xs text-on-surface-variant/50">
          Add images to the property first, then return here to select room images.
        </p>
      </div>
    )
  }

  function toggle(url: string) {
    if (selectedImages.includes(url)) {
      onChange(selectedImages.filter((u) => u !== url))
    } else {
      onChange([...selectedImages, url])
    }
  }

  // --- Drag-to-reorder handlers ---
  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setOverIdx(idx)
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) return
    const next = [...selectedImages]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    onChange(next)
    setDragIdx(null)
    setOverIdx(null)
  }

  function handleDragEnd() {
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <div className="space-y-5">
      {/* ── Display order (drag to reorder) ─────────────────────── */}
      {selectedImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Display order — drag to reorder
            </p>
            <p className="text-xs text-on-surface-variant/50">
              First image is the cover photo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedImages.map((url, idx) => (
              <div
                key={url}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={[
                  'relative group flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden ring-2 transition-all cursor-grab active:cursor-grabbing select-none',
                  dragIdx === idx
                    ? 'opacity-40 ring-secondary/30 scale-95'
                    : overIdx === idx && dragIdx !== null
                      ? 'ring-secondary scale-105'
                      : 'ring-secondary/60 hover:ring-secondary',
                ].join(' ')}
              >
                <NextImage src={url} alt={`Image ${idx + 1}`} fill className="object-cover pointer-events-none" />

                {/* Drag handle overlay */}
                <div className="absolute inset-0 flex flex-col justify-between p-1 bg-gradient-to-b from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <Bars3Icon className="w-3.5 h-3.5 text-white drop-shadow" />
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); toggle(url) }}
                      className="rounded-full bg-black/50 p-0.5 hover:bg-error/80 transition-colors"
                      aria-label="Remove image"
                    >
                      <XMarkIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>

                {/* Position badge */}
                <div className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                  {idx === 0 ? 'Cover' : `#${idx + 1}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All property images (click to add / remove) ──────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          {selectedImages.length > 0 ? 'All property images' : 'Select images'}
        </p>
        <p className="text-xs text-on-surface-variant/60">
          {selectedImages.length} of {propertyImages.length} selected — click to toggle
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {propertyImages.map((url, i) => {
            const isSelected = selectedImages.includes(url)
            return (
              <button
                key={url}
                type="button"
                onClick={() => toggle(url)}
                className={[
                  'relative rounded-xl overflow-hidden aspect-video transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected
                    ? 'ring-2 ring-secondary'
                    : 'ring-1 ring-surface-high opacity-70 hover:opacity-100',
                ].join(' ')}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} image ${i + 1}`}
              >
                <NextImage src={url} alt={`Property image ${i + 1}`} fill className="object-cover" />
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 rounded-full bg-secondary p-0.5">
                    <CheckIcon className="w-3.5 h-3.5 text-background" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
