'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

interface Props {
  address: string
}

const CIRCLE_RADIUS_M = 400

export default function LocationMap({ address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
    if (!apiKey) { setFailed(true); return }

    setOptions({ key: apiKey })

    Promise.all([
      fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
      ).then((r) => r.json()),
      importLibrary('maps'),
    ])
      .then(([geoData, { Map, Circle }]) => {
        if (!containerRef.current || mapRef.current) return
        const loc = geoData?.results?.[0]?.geometry?.location
        if (!loc) { setFailed(true); return }

        const map = new Map(containerRef.current, {
          center: { lat: loc.lat, lng: loc.lng },
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
          center: { lat: loc.lat, lng: loc.lng },
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
      .catch(() => setFailed(true))
  }, [address])

  if (failed) return null

  return (
    <div
      ref={containerRef}
      className="w-full h-64 rounded-xl overflow-hidden ring-1 ring-white/10"
    />
  )
}
