ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_tutor_memory JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_chats
  ADD COLUMN IF NOT EXISTS context_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(16) NOT NULL DEFAULT 'chat';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_chats_event_type_check'
      AND conrelid = 'ai_chats'::regclass
  ) THEN
    ALTER TABLE ai_chats ADD CONSTRAINT ai_chats_event_type_check
      CHECK (event_type IN ('chat', 'submission'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_chats_user_context_created_idx
  ON ai_chats(user_id, context_key, created_at);
