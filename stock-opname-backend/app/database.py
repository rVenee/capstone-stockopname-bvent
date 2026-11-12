from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_db():
    """Membuka koneksi ke database untuk satu permintaan, lalu menutupnya."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()