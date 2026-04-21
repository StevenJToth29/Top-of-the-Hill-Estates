'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Props {
  images: string[]
  roomName: string
}

export default function ImageGallery({ images, roomName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const openLightbox = useCallback(() => setLightboxOpen(true), [])
  const closeLightbox = useCallback(() => setLightboxOpen(false), [])

  const prev = useCallback(() => {
    setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1))
  }, [images.length])

  const next = useCallback(() => {
    setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1))
  }, [images.length])

  if (images.length === 0) {
    return (
      <div className="w-full aspect-video rounded-2xl bg-surface-highest flex items-center justify-center ring-1 ring-white/10">
        <span className="font-display text-2xl text-on-surface-variant">{roomName}</span>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label={`View ${roomName} photos — click to enlarge`}
        className="w-full aspect-video relative rounded-2xl overflow-hidden ring-1 ring-white/10 cursor-zoom-in"
        onClick={openLightbox}
      >
        <Image
          src={images[activeIndex]}
          alt={`${roomName} — photo ${activeIndex + 1} of ${images.length}`}
          fill
          className="object-cover"
          priority={activeIndex === 0}
          sizes="(max-width: 1024px) 100vw, 66vw"
        />
      </button>

      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1" role="tablist" aria-label={`${roomName} photo thumbnails`}>
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`${roomName} photo ${i + 1} of ${images.length}`}
              onClick={() => setActiveIndex(i)}
              className={`relative flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden ring-1 transition-all ${
                i === activeIndex
                  ? 'ring-secondary scale-105'
                  : 'ring-white/10 opacity-60 hover:opacity-90'
              }`}
            >
              <Image
                src={src}
                alt={`${roomName} thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${roomName} photo gallery`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-xl"
          onClick={closeLightbox}
          onKeyDown={(e) => { if (e.key === 'Escape') closeLightbox() }}
        >
          <button
            type="button"
            aria-label="Close photo gallery"
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-surface-highest/60 text-on-surface hover:bg-surface-highest transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {images.length > 1 && (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-4 p-2 rounded-full bg-surface-highest/60 text-on-surface hover:bg-surface-highest transition-colors"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
          )}

          <div
            className="relative w-full max-w-5xl aspect-video mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[activeIndex]}
              alt={`${roomName} — photo ${activeIndex + 1} of ${images.length}`}
              fill
              className="object-contain rounded-2xl"
              sizes="100vw"
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-4 p-2 rounded-full bg-surface-highest/60 text-on-surface hover:bg-surface-highest transition-colors"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          )}

          {images.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-on-surface-variant" aria-live="polite">
              {activeIndex + 1} / {images.length}
            </span>
          )}
        </div>
      )}
    </>
  )
}
