#!/bin/bash
BACKUP_DIR="/var/www/msp-ticketing/backups"
DB_FILE="/var/www/msp-ticketing/ticketing.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ticketing_$TIMESTAMP.db"

# Create backup
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Compress it
gzip "$BACKUP_FILE"

# Delete backups older than 7 days
find "$BACKUP_DIR" -name "*.db.gz" -mtime +7 -delete

echo "Backup created: ${BACKUP_FILE}.gz"
