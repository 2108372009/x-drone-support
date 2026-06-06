import uuid
import hashlib
import os
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .db import User

SECRET_KEY = os.getenv("JWT_SECRET", "x-drone-secret-key-change-in-prod")
ALGORITHM = "HS256"

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256((password + "x-drone-salt").encode()).hexdigest()

def create_token(user_id: str, username: str) -> str:
    payload = {"sub": user_id, "username": username}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    new_user = User(
        id=user_id,
        username=req.username,
        password_hash=hash_password(req.password),
        is_guest="0"
    )
    db.add(new_user)
    db.commit()
    token = create_token(user_id, req.username)
    return {"token": token, "user_id": user_id, "username": req.username}

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_token(user.id, user.username)
    return {"token": token, "user_id": user.id, "username": user.username}

@router.post("/guest")
def guest_login(db: Session = Depends(get_db)):
    guest_name = f"guest_{uuid.uuid4().hex[:8]}"
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    new_user = User(
        id=user_id,
        username=guest_name,
        password_hash="",
        is_guest="1"
    )
    db.add(new_user)
    db.commit()
    token = create_token(user_id, guest_name)
    return {"token": token, "user_id": user_id, "username": guest_name}