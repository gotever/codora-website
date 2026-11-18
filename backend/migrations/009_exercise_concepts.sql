CREATE TABLE IF NOT EXISTS exercise_concepts (
  exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  concept_id VARCHAR(120) NOT NULL REFERENCES learning_concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, concept_id)
);

CREATE INDEX IF NOT EXISTS exercise_concepts_concept_idx ON exercise_concepts(concept_id);
