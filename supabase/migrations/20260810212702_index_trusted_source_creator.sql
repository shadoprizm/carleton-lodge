-- Cover the optional creator foreign key for administrator-managed sources.
CREATE INDEX IF NOT EXISTS trusted_knowledge_sources_created_by_idx
  ON public.trusted_knowledge_sources(created_by)
  WHERE created_by IS NOT NULL;
