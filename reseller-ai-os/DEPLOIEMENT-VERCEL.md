# Mise en ligne sur Vercel + Supabase

Deux projets Vercel (un par dossier) + une base Supabase **dédiée** à cette application.

| Projet Vercel | Dossier racine | Rôle |
|---|---|---|
| reseller-ai-os-api | `reseller-ai-os/backend` | API FastAPI (fonction serverless) + tâche planifiée `/api/cron/tick` toutes les 15 min |
| reseller-ai-os | `reseller-ai-os/frontend` | Interface Next.js ; relaie `/api/*` vers l'API (`BACKEND_URL`) |

## Variables — projet API
`DATABASE_URL` (pooler Supabase, port 6543, `postgresql+psycopg://…`), `ADMIN_PASSWORD`, `SECRET_KEY`, `CRON_SECRET`,
`STORAGE_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STORAGE_BUCKET=rai-files`, `COOKIE_SECURE=true`, (`ANTHROPIC_API_KEY` facultatif).

## Variables — projet interface
`BACKEND_URL` = URL du projet API (ex. `https://reseller-ai-os-api.vercel.app`).

## Base
Le schéma (migrations 0001 + 0002, RLS activée partout) s'applique sur la base Supabase ; un bucket privé `rai-files` stocke les photos.
Les tâches planifiées ne tournent pas en mémoire : Vercel Cron appelle `/api/cron/tick`, qui exécute les tâches échues (fréquence réglable dans l'application, résolution 15 min).
