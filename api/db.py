from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from .database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    session_id = Column(String, index=True)
    user_message = Column(Text)
    ai_reply = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class FAQ(Base):
    __tablename__ = "faqs"

    question = Column(String, primary_key=True)
    answer = Column(Text)