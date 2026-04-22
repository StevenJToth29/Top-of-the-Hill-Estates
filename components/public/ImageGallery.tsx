'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PhotoIcon } from '@heroicons/react/24/outline'

interface Props {
  images: string[]
  roomName: string
  descriptions?: Record<string, string>  // url → caption
}

export default function ImageGallery({ images, roomName, descriptions = {} }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const openLightbox = useCallback((i: number) => { setActiveIndex(i); setLightboxOpen(true) }, [])
  const closeLightbox = useCallback(() => setLightboxOpen(false), [])
  const prev = useCallback(() => setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1)), [images.length])
  const next = useCallback(() => setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1)), [images.length])

  if (images.length === 0) {
    return (
      <div className="w-full h-[360px] rounded-2xl bg-surface-highest/60 flex items-center justify-center border border-outline-variant/20">
        <span className="font-display text-2xl text-on-surface-variant">{roomName}</span>
      </div>
    )
  }

  const [main, ...rest] = images

  return (
    <>
      {/* ── Desktop: 2-column grid gallery ── */}
      <div className="hidden md:block relative">
        {images.length === 1 ? (
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="relative w-full h-[420px] rounded-2xl overflow-hidden cursor-zoom-in block group"
          >
            <Image src={main} alt={roomName} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" priority sizes="100vw" />
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 h-[440px] rounded-2xl overflow-hidden">
            {/* Main image — full height left */}
            <button
              type="button"
              onClick={() => openLightbox(0)}
              className="relative h-full cursor-zoom-in overflow-hidden group"
            >
              <Image src={main} alt={`${roomName} — main`} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" priority sizes="50vw" />
            </button>

            {/* Right thumbnails */}
            <div
              className="grid gap-1.5 h-full"
              style={{ gridTemplateRows: rest.length >= 3 ? '1fr 1fr' : '1fr' }}
            >
              {rest[0] && (
                <button type="button" onClick={() => openLightbox(1)} className="relative cursor-zoom-in overflow-hidden group">
                  <Image src={rest[0]} alt={`${roomName} — photo 2`} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" sizes="25vw" />
                </button>
              )}

              {rest.length >= 2 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {rest[1] && (
                    <button type="button" onClick={() => openLightbox(2)} className="relative cursor-zoom-in overflow-hidden group">
                      <Image src={rest[1]} alt={`${roomName} — photo 3`} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" sizes="12.5vw" />
                    </button>
                  )}
                  {rest[2] && (
                    <button type="button" onClick={() => openLightbox(3)} className="relative cursor-zoom-in overflow-hidden group">
                      <Image src={rest[2]} alt={`${roomName} — photo 4`} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" sizes="12.5vw" />
                      {images.length > 5 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-xl">+{images.length - 4}</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-surface/90 backdrop-blur-sm border border-outline-variant/30 rounded-lg px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface transition-colors shadow-lg"
          >
            <PhotoIcon className="w-3.5 h-3.5" />
            Show all {images.length} photos
          </button>
        )}
      </div>

      {/* ── Mobile: single image + strip ── */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => openLightbox(activeIndex)}
          className="relative w-full overflow-hidden cursor-zoom-in block rounded-xl"
          style={{ height: '260px' }}
        >
          <Image
            src={images[activeIndex]}
            alt={`${roomName} — photo ${activeIndex + 1}`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </button>
        {images.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`relative flex-shrink-0 w-16 h-11 rounded-lg overflow-hidden border-2 transition-all ${
                  i === activeIndex ? 'border-secondary' : 'border-transparent opacity-60'
                }`}
              >
                <Image src={src} alt="" fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${roomName} photo gallery`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl"
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

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" aria-live="polite">
            {descriptions[images[activeIndex]] && (
              <p className="text-sm text-white/90 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-center max-w-sm">
                {descriptions[images[activeIndex]]}
              </p>
            )}
            <span className="text-sm text-on-surface-variant">
              {activeIndex + 1} / {images.length}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
