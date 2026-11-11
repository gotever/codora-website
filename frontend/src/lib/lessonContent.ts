import type { CourseNavigation, LessonDetail } from '../data/lessons'
import type { ApiCourse, ApiLesson } from './api'

const DETAIL_MARKER = /^<!-- codora-lesson:v1\r?\n([\s\S]*?)\r?\n-->\r?\n?/

export function parseLessonDetail(contentMarkdown: string, lessonId: string): LessonDetail | null {
  const match = contentMarkdown.match(DETAIL_MARKER)
  if (!match) return null

  try {
    const value: unknown = JSON.parse(match[1])
    if (!value || typeof value !== 'object') return null

    const detail = value as LessonDetail
    if (
      detail.id !== lessonId ||
      typeof detail.title !== 'string' ||
      typeof detail.description !== 'string' ||
      !Array.isArray(detail.sections) ||
      !['completed', 'in_progress', 'upcoming'].includes(detail.status)
    ) return null

    return detail
  } catch {
    return null
  }
}

export function buildCourseNavigation(course: ApiCourse, lessons: ApiLesson[]): CourseNavigation | null {
  const details = lessons
    .slice()
    .sort((left, right) => left.order_index - right.order_index)
    .map((lesson) => ({ lesson, detail: parseLessonDetail(lesson.content_markdown, lesson.id) }))

  if (details.some(({ detail }) => detail === null)) return null

  const modules = new Map<string, CourseNavigation['modules'][number]>()
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
      status: detail.status,
    })
  }

  const lessonDetails = details.flatMap(({ detail }) => detail ? [detail] : [])
  return {
    id: String(course.id),
    title: course.title,
    description: course.description,
    totalLessons: lessonDetails.length,
    completedLessons: lessonDetails.filter((detail) => detail.status === 'completed').length,
    modules: Array.from(modules.values()),
  }
}
