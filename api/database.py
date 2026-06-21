import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_database.db")

connect_args = {}
pool_size = 5
max_overflow = 10

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    pool_size = 1
    max_overflow = 0

# 针对 Supabase/Railway PostgreSQL 的 SSL 和连接池优化
engine_kwargs = {
    "pool_size": pool_size,
    "max_overflow": max_overflow,
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}

if DATABASE_URL.startswith("postgresql"):
    # Supabase 需要 SSL 连接
    engine_kwargs["connect_args"] = {"sslmode": "require"}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
