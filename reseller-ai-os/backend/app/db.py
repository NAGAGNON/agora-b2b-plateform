from typing import Annotated
from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from .config import env


class Base(DeclarativeBase):
    pass


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
