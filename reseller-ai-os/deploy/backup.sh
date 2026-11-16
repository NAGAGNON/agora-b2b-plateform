#!/bin/sh
# Sauvegarde quotidienne : base (pg_dump compressé) + photos. Rotation par ancienneté. Journalise chaque exécution.
set -u
while true; do
  ts=$(date +%Y%m%d-%H%M%S)
  if pg_dump --no-owner | gzip > "/backups/db-$ts.sql.gz.tmp" && mv "/backups/db-$ts.sql.gz.tmp" "/backups/db-$ts.sql.gz"; then
    echo "[$(date -Iseconds)] sauvegarde base OK : db-$ts.sql.gz"
  else
    echo "[$(date -Iseconds)] ECHEC de la sauvegarde base" >&2; rm -f "/backups/db-$ts.sql.gz.tmp"
  fi
  tar -czf "/backups/photos-$ts.tar.gz" -C /data storage 2>/dev/null && echo "[$(date -Iseconds)] sauvegarde photos OK" || echo "[$(date -Iseconds)] ECHEC sauvegarde photos" >&2
  find /backups -name 'db-*.sql.gz' -mtime +"${RETENTION_DAYS:-14}" -delete
  find /backups -name 'photos-*.tar.gz' -mtime +"${RETENTION_DAYS:-14}" -delete
  sleep 86400
done
