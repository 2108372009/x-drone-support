import os
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .db import FAQ, Conversation

router = APIRouter()

# 从环境变量读取管理员密钥，默认为 1234（仅用于演示，生产环境请务必修改）
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "1234")

class FAQItem(BaseModel):
    question: str
    answer: str

def verify_admin(x_admin_token: str = Header(...)):
    """验证管理员Token"""
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    return True

@router.get("/admin/conversations")
async def get_conversations(_: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    records = db.query(Conversation).order_by(Conversation.timestamp.desc()).limit(50).all()
    return [{
        "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "user_id": r.user_id,
        "session_id": r.session_id,
        "user_message": r.user_message,
        "ai_reply": r.ai_reply
    } for r in records]

@router.get("/admin/faqs")
async def get_faqs(_: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    return db.query(FAQ).all()

@router.post("/admin/faqs")
async def save_faq(item: FAQItem, _: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    faq = db.query(FAQ).filter(FAQ.question == item.question).first()
    if faq:
        faq.answer = item.answer
    else:
        faq = FAQ(question=item.question, answer=item.answer)
        db.add(faq)
    db.commit()
    return {"message": "保存成功"}

@router.delete("/admin/faqs")
async def delete_faq(question: str, _: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    db.query(FAQ).filter(FAQ.question == question).delete()
    db.commit()
    return {"message": "删除成功"}