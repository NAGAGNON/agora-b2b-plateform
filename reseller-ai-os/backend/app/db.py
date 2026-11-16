from typing import Annotated
from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool
from .config import env, is_serverless


class Base(DeclarativeBase):
    pass


if is_serverless():
    # Fonctions serverless + pooler Supabase (mode transaction) : pas de pool local, pas de requêtes préparées.
    engine = create_engine(env().database_url, poolclass=NullPool, connect_args={"prepare_threshold": None})
else:
    engine = create_engine(env().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    """Une transaction par requête : commit si succès, rollback sinon.
    scope="function" : le commit a lieu avant l'envoi de la réponse (la requête suivante voit les données)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


DB = Annotated[Session, Depends(get_db, scope="function")]
