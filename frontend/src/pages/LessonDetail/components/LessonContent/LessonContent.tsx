import { Link } from 'react-router-dom'
import type { LessonDetail } from '../../../../data/lessons'
import CodeBlock from './CodeBlock'
import EmbeddedChallenge from '../EmbeddedChallenge/EmbeddedChallenge'
import './LessonContent.css'

interface LessonContentProps {
  lesson: LessonDetail
  onAskAIHint?: (challengeTitle: string) => void
}

export default function LessonContent({
  lesson,
  onAskAIHint,
}: LessonContentProps) {
  return (
    <main className="lesson-content" id="main-content">
      {/* 1. Lesson Header */}
      <header className="lesson-content__header">
        <div className="lesson-content__breadcrumb-row">
          <span className="lesson-content__breadcrumb">
            {lesson.moduleName} / LESSON {String(lesson.lessonNumber).padStart(2, '0')}
          </span>
          <span className="lesson-content__topic">{lesson.topic}</span>
        </div>

        <h1 className="lesson-content__title">{lesson.title}</h1>
        <p className="lesson-content__desc">{lesson.description}</p>

        <div className="lesson-content__meta-row">
          <div className="lesson-content__badges">
            <span className="lesson-content__badge">{lesson.duration}</span>
            <span className="lesson-content__badge">
              {lesson.exerciseCount} coding {lesson.exerciseCount === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
          <span className="lesson-content__lang">{lesson.language}</span>
        </div>
      </header>

      {/* 2. Lesson Sections */}
      <div className="lesson-content__sections">
        {lesson.sections.map((sec) => (
          <section key={sec.id} className="lesson-content__section">
            <div className="lesson-content__section-header">
              <span className="lesson-content__section-num">{sec.number}</span>
              <h2 className="lesson-content__section-title">{sec.title}</h2>
            </div>

            {sec.paragraphs.map((p, idx) => (
              <p key={idx} className="lesson-content__paragraph">
                {p}
              </p>
            ))}

            {/* Code example if present */}
            {sec.codeExample && (
              <CodeBlock
                filename={sec.codeExample.filename}
                language={sec.codeExample.language}
                code={sec.codeExample.code}
                caption={sec.codeExample.caption}
              />
            )}

            {/* Embedded coding challenge if present */}
            {sec.challenge && (
              <EmbeddedChallenge
                key={sec.challenge.id}
                challenge={sec.challenge}
                onAskAIHint={onAskAIHint}
              />
            )}

            {/* Takeaway card if present */}
            {sec.takeaway && (
              <div className="lesson-content__takeaway-card">
                <span className="lesson-content__takeaway-label">
                  {sec.takeaway.label}
                </span>
                <p className="lesson-content__takeaway-text">
                  {sec.takeaway.text}
                </p>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* 3. Lesson Bottom Navigation */}
      <footer className="lesson-content__footer">
        <div className="lesson-content__footer-hint-row">
          <span className="lesson-content__footer-hint">
            Up next: a hands-on challenge
          </span>
        </div>

        <div className="lesson-content__nav-row">
          {lesson.prevLesson ? (
            <Link
              to={`/lessons/${lesson.prevLesson.id}`}
              className="lesson-content__prev-link"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>{lesson.prevLesson.title}</span>
            </Link>
          ) : (
            <div />
          )}

          {lesson.nextLesson ? (
            <Link
              to={`/lessons/${lesson.nextLesson.id}`}
              className="lesson-content__continue-btn"
            >
              <span>Continue lesson</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          ) : (
            <Link to="/learning" className="lesson-content__continue-btn">
              <span>Finish module</span>
            </Link>
          )}
        </div>
      </footer>
    </main>
  )
}
