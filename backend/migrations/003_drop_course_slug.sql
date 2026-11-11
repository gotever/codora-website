-- Numeric course IDs are the sole persisted course identifier.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_slug_key;
ALTER TABLE courses DROP COLUMN IF EXISTS slug;
