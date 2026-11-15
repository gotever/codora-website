ALTER TABLE users
  ADD COLUMN IF NOT EXISTS learning_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
