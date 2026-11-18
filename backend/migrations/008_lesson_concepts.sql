CREATE TABLE IF NOT EXISTS learning_concepts (
  id VARCHAR(120) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS preknowledge JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS new_concepts JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_preknowledge_array_check'
      AND conrelid = 'lessons'::regclass
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_preknowledge_array_check
      CHECK (jsonb_typeof(preknowledge) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_new_concepts_array_check'
      AND conrelid = 'lessons'::regclass
  ) THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_new_concepts_array_check
      CHECK (jsonb_typeof(new_concepts) = 'array');
  END IF;
END $$;
