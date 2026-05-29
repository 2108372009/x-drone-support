from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .db import FAQ, Conversation

router = APIRouter()

class FAQItem(BaseModel):
    question: str
    answer: str

@router.get("/admin/conversations")
async def get_conversations(db: Session = Depends(get_db)):
    records = db.query(Conversation).order_by(Conversation.timestamp.desc()).limit(50).all()
    return [{
        "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "user_id": r.user_id,
        "session_id": r.session_id,   # 新增
        "user_message": r.user_message,
        "ai_reply": r.ai_reply
    } for r in records]

@router.get("/admin/faqs")
async def get_faqs(db: Session = Depends(get_db)):
    return db.query(FAQ).all()

@router.post("/admin/faqs")
async def save_faq(item: FAQItem, db: Session = Depends(get_db)):
    faq = db.query(FAQ).filter(FAQ.question == item.question).first()
    if faq:
        faq.answer = item.answer
    else:
        faq = FAQ(question=item.question, answer=item.answer)
        db.add(faq)
    db.commit()
    return {"message": "保存成功"}

@router.delete("/admin/faqs")
async def delete_faq(question: str, db: Session = Depends(get_db)):
    db.query(FAQ).filter(FAQ.question == question).delete()
    db.commit()
    return {"message": "删除成功"}