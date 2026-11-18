CREATE TABLE IF NOT EXISTS exercise_workspace_state (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  draft_code TEXT NOT NULL DEFAULT '',
  latest_run_code TEXT,
  latest_run_result JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);
