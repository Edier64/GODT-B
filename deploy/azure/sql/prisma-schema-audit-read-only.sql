-- GODT Prisma/PostgreSQL audit. Read-only catalog and migration-history queries.
-- Run only through a dedicated audit session with a read-only database role.

SELECT
  id,
  migration_name,
  checksum,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count,
  logs
FROM public._prisma_migrations
ORDER BY started_at, id;

SELECT
  migration_name,
  COUNT(*) AS record_count,
  MIN(started_at) AS first_started_at,
  MAX(started_at) AS last_started_at,
  BOOL_OR(finished_at IS NULL AND rolled_back_at IS NULL) AS has_unresolved_record
FROM public._prisma_migrations
WHERE migration_name IN (
  '20261107210000_institutional_entities_and_scopes',
  '20261111013000_auth_credentials_and_sessions'
)
GROUP BY migration_name;

SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  character_maximum_length,
  datetime_precision,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'INSTITUTION_ENTITY',
    'INSTITUTION_ALIAS',
    'USER_INSTITUTION_SCOPE',
    'USER_CREDENTIAL',
    'AUTH_SESSION'
  )
ORDER BY table_name, ordinal_position;

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'INSTITUTION_ENTITY',
    'INSTITUTION_ALIAS',
    'USER_INSTITUTION_SCOPE',
    'USER_CREDENTIAL',
    'AUTH_SESSION'
  )
ORDER BY tablename, indexname;

SELECT
  c.conrelid::regclass AS table_name,
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND c.conrelid::regclass::text IN (
    '"INSTITUTION_ENTITY"',
    '"INSTITUTION_ALIAS"',
    '"USER_INSTITUTION_SCOPE"',
    '"USER_CREDENTIAL"',
    '"AUTH_SESSION"'
  )
ORDER BY table_name, constraint_type, constraint_name;
