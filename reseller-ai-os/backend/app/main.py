import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from .config import env, is_serverless
from .db import SessionLocal
from .routers import core, cron, finance_ai, operations, sourcing
from .security import require_auth
from .services import agents, ai, automation, importer, inventory, photos, purchasing, sales, vinted, documents

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not env().secret_key or not env().admin_password:
        logging.warning("SECRET_KEY et/ou ADMIN_PASSWORD non définis : la connexion sera impossible.")
    cron.ensure_seeded()
    if not is_serverless():  # en serverless, c'est /api/cron/tick (Vercel Cron) qui déclenche les tâches
        automation.start()
    yield
    automation.stop()


app = FastAPI(title="Reseller AI OS", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.include_router(core.public)
app.include_router(cron.router)
for r in (core.router, sourcing.router, operations.router, finance_ai.router):
    app.include_router(r, dependencies=[Depends(require_auth)])


def _err(status):
    async def h(_: Request, exc: Exception):
        return JSONResponse({"detail": str(exc)}, status_code=status)
    return h


for exc, code in ((purchasing.PurchaseError, 409), (sales.SaleError, 409), (inventory.InvalidTransition, 409), (vinted.VintedError, 409),
                  (photos.PhotoError, 400), (documents.DocError, 400), (importer.ImportError_, 400), (ai.AiUnavailable, 503),
                  (ai.AiBudgetExceeded, 429), (ValueError, 400)):
    app.add_exception_handler(exc, _err(code))


@app.get("/api/health")
def health():
    from sqlalchemy import text
    db = SessionLocal()
    try:
        db.execute(text("select 1"))
        return {"ok": True}
    finally:
        db.close()
