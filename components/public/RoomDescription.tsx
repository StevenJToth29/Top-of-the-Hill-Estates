import RoomExpandToggle from './RoomExpandToggle'

interface Props {
  description: string | null
  propertyDescription?: string | null
  houseRules: string | null
}

export default function RoomDescription({ description, propertyDescription, houseRules }: Props) {
  if (!description && !propertyDescription && !houseRules) return null

  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
        About this room
      </p>
      {description && (
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {description}
        </p>
      )}
      {propertyDescription && (
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {propertyDescription}
        </p>
      )}

      {houseRules && <RoomExpandToggle houseRules={houseRules} />}
    </section>
  )
}
