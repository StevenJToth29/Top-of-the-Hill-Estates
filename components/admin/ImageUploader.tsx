'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { TrashIcon, PhotoIcon, Bars2Icon, ArrowsPointingOutIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase-browser'
import NextImage from 'next/image'

async function compressImage(file: File, maxWidth = 1200): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

interface ImageUploaderProps {
  images: string[]
  bucket: string
  uploadFolder: string
  onChange: (images: string[]) => void
}

export default function ImageUploader({ images, bucket, uploadFolder, onChange }: ImageUploaderProps) {
  const [isFileDragging, setIsFileDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const prevImage = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), [])
  const nextImage = useCallback(() => setLightboxIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i)), [images.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') prevImage()
      if (e.key === 'ArrowRight') nextImage()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, closeLightbox, prevImage, nextImage])

  async function uploadFiles(files: FileList | File[]) {
    const supabase = createClient()
    setError(null)
    setUploading(true)

    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const compressed = await compressImage(file)
        const path = `${uploadFolder}/${Date.now()}-${file.name}`
        const { data, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(data.path)
        newUrls.push(publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    }

    onChange([...images, ...newUrls])
    setUploading(false)
  }

  async function deleteImage(url: string) {
    const supabase = createClient()
    const bucketMarker = `/object/public/${bucket}/`
    const idx = url.indexOf(bucketMarker)
    if (idx !== -1) {
      const path = url.slice(idx + bucketMarker.length)
      await supabase.storage.from(bucket).remove([path])
    }
    onChange(images.filter((img) => img !== url))
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsFileDragging(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  // — Image reorder drag handlers —

  function handleImageDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Keep a minimal ghost (browser default)
  }

  function handleImageDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.stopPropagation() // don't bubble to file drop zone
    e.dataTransfer.dropEffect = 'move'
    if (index !== dragOverIndex) setDragOverIndex(index)
  }

  function handleImageDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault()
    e.stopPropagation()
    if (dragIndex === null || dragIndex === toIndex) return
    const next = [...images]
    const [item] = next.splice(dragIndex, 1)
    next.splice(toIndex, 0, item)
    onChange(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleImageDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-4">
      {/* File drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsFileDragging(true) }}
        onDragLeave={() => setIsFileDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
          isFileDragging
            ? 'border-secondary/60 bg-surface-container/60'
            : 'border-secondary/30 bg-surface-highest/20 hover:border-secondary/50 hover:bg-surface-highest/30'
        }`}
      >
        {uploading ? (
          <div className="flex items-center gap-3 text-on-surface-variant">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Uploading…
          </div>
        ) : (
          <>
            <PhotoIcon className="w-8 h-8 text-on-surface-variant/50" />
            <p className="text-sm text-on-surface-variant/70 text-center">
              Drag and drop images here, or <span className="text-secondary">click to browse</span>
            </p>
            <p className="text-xs text-on-surface-variant/50">JPEG, PNG, or WebP — compressed on upload</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files) }}
        />
      </div>

      {error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* Thumbnails — drag to reorder */}
      {images.length > 0 && (
        <>
          <p className="text-xs text-on-surface-variant/50 -mb-1">Drag to reorder · first image is the cover</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            {images.map((url, i) => (
              <div
                key={url}
                draggable
                onDragStart={(e) => handleImageDragStart(e, i)}
                onDragOver={(e) => handleImageDragOver(e, i)}
                onDrop={(e) => handleImageDrop(e, i)}
                onDragEnd={handleImageDragEnd}
                className={`relative group rounded-xl overflow-hidden bg-surface-container aspect-video cursor-grab active:cursor-grabbing transition-all duration-150 ${
                  dragIndex === i
                    ? 'opacity-40 scale-95'
                    : dragOverIndex === i && dragIndex !== null
                    ? 'ring-2 ring-secondary ring-offset-2 ring-offset-background scale-[1.02]'
                    : ''
                }`}
              >
                <NextImage src={url} alt={`Image ${i + 1}`} fill className="object-cover pointer-events-none" />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-container/80 backdrop-blur-sm">
                    <Bars2Icon className="w-3.5 h-3.5 text-on-surface-variant/60 mx-0.5" title="Drag to reorder" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
                      className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-high transition-colors"
                      aria-label="Expand image"
                    >
                      <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteImage(url) }}
                      className="p-1 rounded-lg bg-error-container/80 text-error hover:bg-error hover:text-on-error transition-colors"
                      aria-label="Delete image"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Position badge */}
                <span className="absolute top-1.5 left-1.5 text-xs bg-background/70 text-on-surface-variant rounded-lg px-1.5 py-0.5 pointer-events-none">
                  {i === 0 ? 'Cover' : i + 1}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prevImage() }}
              className="absolute left-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative max-w-5xl max-h-[85vh] w-full mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[lightboxIndex]}
              alt={`Image ${lightboxIndex + 1}`}
              className="w-full h-full object-contain max-h-[85vh] rounded-xl"
            />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/60 bg-black/40 px-2.5 py-1 rounded-full">
              {lightboxIndex + 1} / {images.length}
            </span>
          </div>

          {/* Next */}
          {lightboxIndex < images.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); nextImage() }}
              className="absolute right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Next image"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
