-- PostgreSQL Table Lister
-- Paste this into n8n PostgreSQL node (Execute Query operation)

-- List all tables in current database
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Alternative (PostgreSQL-specific):
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- To see columns of a specific table:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'screensaver_prompts';

-- To see all databases you can access:
-- SELECT datname FROM pg_database WHERE datistemplate = false;
