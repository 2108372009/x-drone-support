import os
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .db import FAQ, Conversation, User

router = APIRouter()

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "1234")

class FAQItem(BaseModel):
    question: str
    answer: str

def verify_admin(x_admin_token: str = Header(...)):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    return True

@router.get("/admin/conversations")
async def get_conversations(_: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    # 联表查询，获取用户名
    records = db.query(Conversation, User.username).outerjoin(User, Conversation.user_id == User.id).order_by(Conversation.timestamp.desc()).limit(50).all()
    result = []
    for conv, username in records:
        result.append({
            "timestamp": conv.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "user_id": conv.user_id,
            "username": username or "游客",
            "session_id": conv.session_id,
            "user_message": conv.user_message,
            "ai_reply": conv.ai_reply
        })
    return result

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