CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(120) PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lessons (
  id VARCHAR(120) PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  course_id VARCHAR(120) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL,
  UNIQUE (course_id, order_index)
);

CREATE TABLE IF NOT EXISTS exercises (
  id VARCHAR(160) PRIMARY KEY,
  lesson_id VARCHAR(120) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  difficulty VARCHAR(32) NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  description TEXT NOT NULL DEFAULT '',
  function_name VARCHAR(120) NOT NULL,
  starter_code TEXT NOT NULL DEFAULT '',
  test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('lesson', 'exercise')),
  item_id VARCHAR(160) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, item_type, item_id),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL))
);

CREATE TABLE IF NOT EXISTS ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id VARCHAR(160) REFERENCES exercises(id) ON DELETE SET NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  code_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lessons_course_order_idx ON lessons(course_id, order_index);
CREATE INDEX IF NOT EXISTS exercises_lesson_idx ON exercises(lesson_id);
CREATE INDEX IF NOT EXISTS user_progress_user_idx ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS ai_chats_user_created_idx ON ai_chats(user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_chats_exercise_idx ON ai_chats(exercise_id);
