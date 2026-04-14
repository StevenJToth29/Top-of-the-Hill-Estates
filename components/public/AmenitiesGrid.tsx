import {
  WifiIcon,
  BoltIcon,
  TruckIcon,
  FireIcon,
  SparklesIcon,
  TvIcon,
  BeakerIcon,
  HomeIcon,
  SunIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline'

interface Props {
  amenities: string[]
}

function getAmenityIcon(amenity: string) {
  const lower = amenity.toLowerCase()
  if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet')) return WifiIcon
  if (lower.includes('ac') || lower.includes('air') || lower.includes('hvac') || lower.includes('cooling')) return BoltIcon
  if (lower.includes('parking') || lower.includes('garage') || lower.includes('carport')) return TruckIcon
  if (lower.includes('kitchen') || lower.includes('cook') || lower.includes('stove')) return FireIcon
  if (lower.includes('laundry') || lower.includes('washer') || lower.includes('dryer') || lower.includes('wash')) return SparklesIcon
  if (lower.includes('tv') || lower.includes('cable') || lower.includes('netflix') || lower.includes('streaming')) return TvIcon
  if (lower.includes('pool') || lower.includes('hot tub') || lower.includes('jacuzzi') || lower.includes('spa')) return BeakerIcon
  if (lower.includes('patio') || lower.includes('balcony') || lower.includes('deck') || lower.includes('yard')) return SunIcon
  if (lower.includes('storage') || lower.includes('closet') || lower.includes('locker')) return ArchiveBoxIcon
  return HomeIcon
}

export default function AmenitiesGrid({ amenities }: Props) {
  if (!amenities || amenities.length === 0) return null

  return (
    <section className="space-y-4">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
        Amenities
      </p>
      <div className="flex flex-wrap gap-2">
        {amenities.map((amenity) => {
          const Icon = getAmenityIcon(amenity)
          return (
            <span
              key={amenity}
              className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2 text-sm text-on-surface"
            >
              <Icon className="w-4 h-4 text-secondary flex-shrink-0" />
              {amenity}
            </span>
          )
        })}
      </div>
    </section>
  )
}
