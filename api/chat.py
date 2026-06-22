import os
import uuid
import time
import requests
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from .database import get_db
from .db import Conversation, FAQ, User
from .auth import get_current_user

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    user_id: str
    session_id: str

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
knowledge_path = os.path.join(base_dir, "knowledge_base.txt")
with open(knowledge_path, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read().strip()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

_user_last_time = defaultdict(float)

_faq_cache: dict = {"items": [], "dirty": True, "loaded_at": 0.0}
FAQ_CACHE_TTL = 300

def reload_faq_cache(db: Session) -> List[FAQ]:
    faqs = db.query(FAQ).all()
    _faq_cache["items"] = [(f.question.lower(), f.answer) for f in faqs]
    _faq_cache["dirty"] = False
    _faq_cache["loaded_at"] = time.time()
    return faqs

def invalidate_faq_cache():
    _faq_cache["dirty"] = True

def get_conversation_history(db: Session, user_id: str, session_id: str, limit: int = 5) -> List[dict]:
    history = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.session_id == session_id
    ).order_by(Conversation.timestamp.asc()).limit(limit).all()
    messages = []
    for h in history:
        messages.append({"role": "user", "content": h.user_message})
        messages.append({"role": "assistant", "content": h.ai_reply})
    return messages

def find_faq_match(db: Session, user_message: str) -> str | None:
    msg_lower = user_message.lower().strip()
    now = time.time()
    if _faq_cache["dirty"] or now - _faq_cache["loaded_at"] > FAQ_CACHE_TTL:
        reload_faq_cache(db)
    for question_lower, answer in _faq_cache["items"]:
        if question_lower in msg_lower or msg_lower in question_lower:
            return answer
    return None

@router.post("/chat")
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    key = request.user_id if request.user_id != 'guest' else request.session_id
    now = time.time()
    if key in _user_last_time and now - _user_last_time[key] < 3:
        raise HTTPException(status_code=429, detail="亲，您发言太频繁啦，请休息3秒后再试～")
    _user_last_time[key] = now

    faq_answer = find_faq_match(db, request.message)
    if faq_answer:
        ai_message = faq_answer
        conv = Conversation(
            id=str(uuid.uuid4()),
            user_id=request.user_id,
            session_id=request.session_id,
            user_message=request.message,
            ai_reply=ai_message
        )
        db.add(conv)
        db.commit()
        return {"response": ai_message}

    history_messages = get_conversation_history(db, request.user_id, request.session_id, limit=5)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history_messages)
    messages.append({"role": "user", "content": request.message})

    if not DEEPSEEK_API_KEY:
        ai_message = fallback_reply(request.message)
    else:
        try:
            headers = {
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "deepseek-chat",
                "messages": messages,
                "stream": False
            }
            response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            ai_message = data['choices'][0]['message']['content']
        except Exception as e:
            print(f"DeepSeek API 调用失败: {e}")
            ai_message = fallback_reply(request.message)

    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=request.user_id,
        session_id=request.session_id,
        user_message=request.message,
        ai_reply=ai_message
    )
    db.add(conv)
    db.commit()

    return {"response": ai_message}

def fallback_reply(message: str) -> str:
    msg_lower = message.lower()
    if "无法开机" in msg_lower or "开不了机" in msg_lower:
        return "请检查电池是否安装正确，电池是否有电，尝试长按电源键3秒。"
    elif "图传" in msg_lower and ("弱" in msg_lower or "信号" in msg_lower):
        return "请检查天线是否展开，周围是否有强电磁干扰，尝试切换频段。"
    elif "遥控器" in msg_lower and "配对" in msg_lower:
        return "请在无人机开机状态下，长按遥控器配对键5秒，直到听到提示音。"
    elif "保修" in msg_lower:
        return "整机保修1年，电池保修6个月，人为损坏不在保修范围内。"
    else:
        return f'您好，我是X-Drone售后助手。您的问题是："{message}"。我会尽力为您解答。如需更多帮助，请拨打客服热线。'

@router.get("/history")
def get_user_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.timestamp.desc()).limit(100).all()
    return [{
        "id": c.id,
        "timestamp": c.timestamp.isoformat(),
        "user_message": c.user_message,
        "ai_reply": c.ai_reply,
        "session_id": c.session_id
    } for c in convs]

@router.get("/order")
def query_order(order_id: str):
    mock_orders = {
        "XD123456789": {
            "order_id": "XD123456789",
            "status": "已发货",
            "product": "X-Drone Mini 标准套装",
            "amount": "¥3,499",
            "tracking_no": "SF1234567890",
            "logistics": "顺丰速运"
        },
        "XD987654321": {
            "order_id": "XD987654321",
            "status": "已签收",
            "product": "X-Drone Pro 畅飞套装",
            "amount": "¥9,999",
            "tracking_no": "SF9876543210",
            "logistics": "顺丰速运"
        },
        "XD555555555": {
            "order_id": "XD555555555",
            "status": "待发货",
            "product": "X-Care 随心换 1年版",
            "amount": "¥399",
            "tracking_no": None,
            "logistics": None
        }
    }
    if order_id in mock_orders:
        return mock_orders[order_id]
    else:
        return {"error": "未找到该订单，请确认订单号是否正确"}
