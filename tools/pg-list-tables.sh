#!/bin/bash
# PostgreSQL Table Lister
# Run from n8n node to check available tables

# Configuration - Edit these
DB_HOST="${PG_HOST:-192.168.1.56}"
DB_PORT="${PG_PORT:-5432}"
DB_NAME="${PG_DATABASE:-mission_control}"
DB_USER="${PG_USER:-alfred}"
DB_PASSWORD="${PG_PASSWORD:-AlfredDB2026Secure}"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "=== PostgreSQL Table Lister ==="
echo "Host:     $DB_HOST"
echo "Port:     $DB_PORT"
echo "Database: $DB_NAME"
echo "User:     $DB_USER"
echo "================================"
echo ""

# Test connection and list tables
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"

# Capture exit status
STATUS=$?

if [ $STATUS -eq 0 ]; then
    echo ""
    echo "✅ Connection successful!"
else
    echo ""
    echo "❌ Connection failed (exit code: $STATUS)"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check pg_hba.conf on PostgreSQL server allows your IP"
    echo "2. Verify PostgreSQL is listening on network (not just localhost)"
    echo "3. Check firewall allows port 5432"
    echo "4. Try: PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c '\l'"
fi

# Cleanup
unset PGPASSWORD

exit $STATUS
