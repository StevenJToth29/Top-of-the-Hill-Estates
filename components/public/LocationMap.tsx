'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface Props {
  lat: number
  lng: number
}

const CIRCLE_RADIUS_M = 400

export default function LocationMap({ lat, lng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        touchZoom: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.75,
      }).addTo(map)

      L.circle([lat, lng], {
        radius: CIRCLE_RADIUS_M,
        color: '#2dd4bf',
        fillColor: '#2dd4bf',
        fillOpacity: 0.15,
        weight: 2,
        opacity: 0.7,
      }).addTo(map)

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapRef.current as any).remove()
        mapRef.current = null
      }
    }
  }, [lat, lng])

  return <div ref={containerRef} className="w-full h-64 rounded-xl overflow-hidden ring-1 ring-white/10" />
}
