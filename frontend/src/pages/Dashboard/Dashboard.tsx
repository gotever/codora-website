import AiNudgeBanner from '../../components/AiNudgeBanner/AiNudgeBanner'
import ExercisesCard from '../../components/ExercisesCard/ExercisesCard'
import Hero from '../../components/Hero/Hero'
import LearningCard from '../../components/LearningCard/LearningCard'
import SectionHeader from '../../components/SectionHeader/SectionHeader'
import './Dashboard.css'

export default function Dashboard() {
  return (
    <main className="dashboard" id="main-content">
      {/* Hero */}
      <Hero />

      {/* Cards section */}
      <section className="dashboard__cards-section" aria-labelledby="start-section-heading">
        <SectionHeader
          title="Where would you like to start?"
          tagline="Two ways to learn. One step forward."
        />

        <div className="dashboard__cards-grid">
          <LearningCard />
          <ExercisesCard />
        </div>

        <AiNudgeBanner />
      </section>
    </main>
  )
}
