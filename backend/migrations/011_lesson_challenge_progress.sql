CREATE TABLE IF NOT EXISTS lesson_challenge_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  challenge_id VARCHAR(160) NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS lesson_challenge_progress_user_idx
  ON lesson_challenge_progress(user_id, completed_at DESC);
