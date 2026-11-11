ALTER TABLE users
  ADD COLUMN IF NOT EXISTS level VARCHAR(16) NOT NULL DEFAULT 'beginner';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_level_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_level_check
      CHECK (level IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS score NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_progress_score_check'
      AND conrelid = 'user_progress'::regclass
  ) THEN
    ALTER TABLE user_progress ADD CONSTRAINT user_progress_score_check
      CHECK (score IS NULL OR score BETWEEN 0 AND 10);
  END IF;
END $$;
