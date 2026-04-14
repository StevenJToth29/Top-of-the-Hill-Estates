'use client'

import { useRef, useState } from 'react'
import { ArrowUpIcon, ArrowDownIcon, TrashIcon, PhotoIcon } from '@heroicons/react/24/outline'
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
  roomId: string
  onChange: (images: string[]) => void
}

export default function ImageUploader({ images, roomId, onChange }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    const supabase = createClient()
    setError(null)
    setUploading(true)

    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const compressed = await compressImage(file)
        const path = `${roomId}/${Date.now()}-${file.name}`
        const { data, error: uploadError } = await supabase.storage
          .from('room-images')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from('room-images').getPublicUrl(data.path)
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
    const match = url.match(/room-images\/(.+)$/)
    if (match) {
      await supabase.storage.from('room-images').remove([match[1]])
    }
    onChange(images.filter((img) => img !== url))
  }

  function moveImage(index: number, direction: 'up' | 'down') {
    const next = [...images]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    onChange(next)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
          isDragging
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

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((url, i) => (
            <div key={url} className="relative group rounded-xl overflow-hidden bg-surface-container aspect-video">
              <NextImage src={url} alt={`Room image ${i + 1}`} fill className="object-cover" />
              <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveImage(i, 'up') }}
                  disabled={i === 0}
                  className="p-1.5 rounded-lg bg-surface-container/80 text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move up"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveImage(i, 'down') }}
                  disabled={i === images.length - 1}
                  className="p-1.5 rounded-lg bg-surface-container/80 text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move down"
                >
                  <ArrowDownIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteImage(url) }}
                  className="p-1.5 rounded-lg bg-error-container/80 text-error hover:text-on-surface transition-colors"
                  aria-label="Delete image"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <span className="absolute top-1.5 left-1.5 text-xs bg-background/70 text-on-surface-variant rounded-lg px-1.5 py-0.5">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
