CREATE TABLE IF NOT EXISTS assessments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
 status VARCHAR(16) NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','passed','failed')),
 profile_snapshot JSONB NOT NULL,
 questions JSONB NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions)=10),
 answers JSONB NOT NULL DEFAULT '{}'::jsonb,
 results JSONB,
 score NUMERIC(4,2) CHECK(score BETWEEN 0 AND 10),
 pass_score NUMERIC(4,2) NOT NULL DEFAULT 8 CHECK(pass_score BETWEEN 0 AND 10),
 model_name TEXT NOT NULL,
 prompt_version TEXT NOT NULL DEFAULT 'promotion-v1',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 submitted_at TIMESTAMPTZ,
 CHECK ((status='in_progress' AND submitted_at IS NULL AND score IS NULL AND results IS NULL)
 OR (status IN ('passed','failed') AND submitted_at IS NOT NULL AND score IS NOT NULL AND results IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS assessments_one_active_idx ON assessments(user_id) WHERE status='in_progress';
CREATE INDEX IF NOT EXISTS assessments_history_idx ON assessments(user_id,created_at DESC);
