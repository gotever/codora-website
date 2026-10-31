import './SectionHeader.css'

interface SectionHeaderProps {
  title: string
  tagline?: string
}

export default function SectionHeader({ title, tagline }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h2 className="section-header__title">{title}</h2>
      {tagline && (
        <p className="section-header__tagline">{tagline}</p>
      )}
    </div>
  )
}
