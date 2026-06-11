from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.sql import func
from .database import Base
from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    session_id = Column(String, index=True)
    user_message = Column(Text)
    ai_reply = Column(Text)
    # 使用数据库服务器的 now() 函数，自动生成 UTC 时间
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class FAQ(Base):
    __tablename__ = "faqs"

    question = Column(String, primary_key=True)
    answer = Column(Text)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_guest = Column(String, default="0")   # "1" 表示游客
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    price = Column(String, nullable=False)         # 显示用 "¥xxx"
    price_value = Column(Integer, nullable=False)  # 价格（分）
    stock = Column(Integer, default=0)
    image_url = Column(String, default="/static/drone.jpg")

class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    product_id = Column(String, index=True, nullable=False)
    product_name = Column(String)
    quantity = Column(Integer, default=1)
    total_price = Column(String)       # 显示用
    total_value = Column(Integer)      # 分
    status = Column(String, default="active")  # active / cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)