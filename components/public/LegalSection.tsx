export default function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-primary mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
