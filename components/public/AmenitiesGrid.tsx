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
      <div>
        <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">What's included</p>
        <p className="font-display text-lg font-bold text-on-surface mt-1">Amenities</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {amenities.map((amenity) => {
          const Icon = getAmenityIcon(amenity)
          return (
            <div
              key={amenity}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-highest/40 border border-outline-variant/20 text-sm font-semibold text-on-surface"
            >
              <Icon className="w-4 h-4 text-secondary flex-shrink-0" />
              {amenity}
            </div>
          )
        })}
      </div>
    </section>
  )
}
