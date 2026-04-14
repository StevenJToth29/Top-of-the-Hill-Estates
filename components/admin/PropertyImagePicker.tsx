'use client'

import NextImage from 'next/image'
import { CheckIcon } from '@heroicons/react/24/solid'
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

  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant/60">
        {selectedImages.length} of {propertyImages.length} images selected
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
  )
}
