from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.sql import func
from .database import Base

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    session_id = Column(String, index=True)
    user_message = Column(Text)
    ai_reply = Column(Text)
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
    is_guest = Column(String, default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    price = Column(String, nullable=False)
    price_value = Column(Integer, nullable=False)
    stock = Column(Integer, default=0)
    image_url = Column(String, default="/static/drone.jpg")

class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    product_id = Column(String, index=True, nullable=False)
    product_name = Column(String)
    quantity = Column(Integer, default=1)
    total_price = Column(String)
    total_value = Column(Integer)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)