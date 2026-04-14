interface Props {
  aboutText: string
}

export default function AboutSection({ aboutText }: Props) {
  return (
    <section className="bg-surface-low py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs uppercase tracking-widest text-secondary font-medium mb-4">
          About Us
        </p>
        <h2 className="font-display font-bold text-primary text-4xl mb-8 leading-tight">
          A Place to Call Home in the Valley
        </h2>
        <p className="text-on-surface-variant text-lg leading-relaxed">{aboutText}</p>
      </div>
    </section>
  )
}
