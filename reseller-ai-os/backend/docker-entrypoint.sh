#!/bin/sh
set -e
# Migrations appliquées avant le démarrage ; UN seul worker : le planificateur tourne dans le processus API.
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips="*"
