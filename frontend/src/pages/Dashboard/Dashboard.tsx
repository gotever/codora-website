import { useEffect, useState } from 'react'
import AiNudgeBanner from '../../components/AiNudgeBanner/AiNudgeBanner'
import ExercisesCard from '../../components/ExercisesCard/ExercisesCard'
import Hero from '../../components/Hero/Hero'
import LearningCard from '../../components/LearningCard/LearningCard'
import SectionHeader from '../../components/SectionHeader/SectionHeader'
import { fetchCourses, fetchExercises } from '../../lib/api'
import './Dashboard.css'

export default function Dashboard() {
  const [courseStats, setCourseStats] = useState<{ courses: number; lessons: number } | null>()
  const [exerciseCount, setExerciseCount] = useState<number | null>()

  useEffect(() => {
    let active = true

    fetchCourses().then((courses) => {
      if (!active) return
      setCourseStats({
        courses: courses.length,
        lessons: courses.reduce((total, course) => total + course.lesson_count, 0),
      })
    }).catch(() => {
      if (active) setCourseStats(null)
    })

    fetchExercises().then((exercises) => {
      if (active) setExerciseCount(exercises.length)
    }).catch(() => {
      if (active) setExerciseCount(null)
    })

    return () => { active = false }
  }, [])

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
          <LearningCard databaseStats={courseStats} />
          <ExercisesCard databaseCount={exerciseCount} />
        </div>

        <AiNudgeBanner />
      </section>
    </main>
  )
}
