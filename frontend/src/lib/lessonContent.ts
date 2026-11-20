import type { CourseNavigation, LessonDetail } from '../data/lessons'
import type { ApiCourse, ApiLesson, ApiProgressEntry } from './api'

const DETAIL_MARKER = /^<!-- codora-lesson:v1\r?\n([\s\S]*?)\r?\n-->\r?\n?/

export function parseLessonDetail(contentMarkdown: string, lessonId: string | number): LessonDetail | null {
  const match = contentMarkdown.match(DETAIL_MARKER)
  if (!match) return null

  try {
    const value: unknown = JSON.parse(match[1])
    if (!value || typeof value !== 'object') return null

    const detail = value as LessonDetail
    if (
      typeof detail.title !== 'string' ||
      typeof detail.description !== 'string' ||
      !Array.isArray(detail.sections) ||
      !['completed', 'in_progress', 'upcoming'].includes(detail.status)
    ) return null

    detail.id = String(lessonId)
    return detail
  } catch {
    return null
  }
}

export function resolveLessonNavigation(detail: LessonDetail, lesson: ApiLesson, lessons: ApiLesson[]): LessonDetail {
  const ordered = lessons.slice().sort((left, right) => left.order_index - right.order_index)
  const index = ordered.findIndex((item) => item.id === lesson.id)
  const previous = ordered[index - 1]
  const next = ordered[index + 1]

  if (detail.prevLesson && previous) detail.prevLesson.id = String(previous.id)
  if (detail.nextLesson && next) detail.nextLesson.id = String(next.id)
  return detail
}

export function buildCourseNavigation(
  course: ApiCourse,
  lessons: ApiLesson[],
  progress: ApiProgressEntry[] = [],
  activeLessonId?: string | number,
): CourseNavigation | null {
  const details = lessons
    .slice()
    .sort((left, right) => left.order_index - right.order_index)
    .map((lesson) => ({ lesson, detail: parseLessonDetail(lesson.content_markdown, lesson.id) }))

  if (details.some(({ detail }) => detail === null)) return null

  details.forEach(({ lesson, detail }) => {
    if (!detail) return
    resolveLessonNavigation(detail, lesson, lessons)
  })

  const modules = new Map<string, CourseNavigation['modules'][number]>()
  const lessonProgress = new Map(
    progress.filter((item) => item.item_type === 'lesson').map((item) => [String(item.item_id), item.status]),
  )
  for (const { detail } of details) {
    if (!detail) continue
    const moduleId = `module-${detail.moduleNumber}`
    let module = modules.get(moduleId)
    if (!module) {
      module = {
        id: moduleId,
        number: detail.moduleNumber,
        title: detail.moduleName,
        lessons: [],
      }
      modules.set(moduleId, module)
    }
    module.lessons.push({
      id: detail.id,
      number: String(detail.lessonNumber).padStart(2, '0'),
      title: detail.topic,
      duration: detail.duration,
      status: lessonProgress.get(detail.id) === 'completed'
        ? 'completed'
        : lessonProgress.get(detail.id) === 'in_progress' || detail.id === String(activeLessonId)
          ? 'in_progress'
          : 'upcoming',
    })
  }

  const lessonDetails = details.flatMap(({ detail }) => detail ? [detail] : [])
  const courseModules = Array.from(modules.values())
  return {
    id: String(course.id),
    title: course.title,
    description: course.description,
    totalLessons: lessonDetails.length,
    completedLessons: courseModules.reduce(
      (total, module) => total + module.lessons.filter((lesson) => lesson.status === 'completed').length,
      0,
    ),
    modules: courseModules,
  }
}
