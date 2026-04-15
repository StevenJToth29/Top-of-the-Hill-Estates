'use client'

import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

interface Props {
  lat: number
  lng: number
}

const CIRCLE_RADIUS_M = 400

export default function LocationMap({ lat, lng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    setOptions({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      version: 'weekly',
    })

    importLibrary('maps').then(({ Map, Circle }) => {
      if (!containerRef.current || mapRef.current) return

      const map = new Map(containerRef.current, {
        center: { lat, lng },
        zoom: 14,
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      })

      new Circle({
        map,
        center: { lat, lng },
        radius: CIRCLE_RADIUS_M,
        strokeColor: '#2dd4bf',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#2dd4bf',
        fillOpacity: 0.15,
        clickable: false,
      })

      mapRef.current = map
    })
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      className="w-full h-64 rounded-xl overflow-hidden ring-1 ring-white/10"
    />
  )
}
