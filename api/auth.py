import uuid
import hashlib
import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .db import User

import bcrypt

# 安全修复：强制要求配置JWT密钥
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise ValueError("⚠️ 安全警告：必须在环境变量中设置 JWT_SECRET！请参考 .env.example 文件配置")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _legacy_hash_password(password: str) -> str:
    return hashlib.sha256((password + "x-drone-salt").encode()).hexdigest()

def verify_password(plain_password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False

def is_legacy_hash(stored_hash: str) -> bool:
    return bool(stored_hash) and not stored_hash.startswith("$2b$") and len(stored_hash) == 64

def create_token(user_id: str, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_EXPIRE_HOURS)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少认证")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="无效token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效token")

def verify_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权限，仅管理员可访问")
    return current_user

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # 密码长度验证：6-10位
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码太短了亲，至少需要6位哦～")
    if len(req.password) > 10:
        raise HTTPException(status_code=400, detail="密码太长了亲，最多只能10位哦～")
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="改昵称已被占用，换一个试试呢亲～")
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    new_user = User(
        id=user_id,
        username=req.username,
        password_hash=hash_password(req.password),
        is_guest="0",
        role="user"
    )
    db.add(new_user)
    db.commit()
    token = create_token(user_id, req.username)
    return {"token": token, "user_id": user_id, "username": req.username}

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    auth_ok = False
    need_upgrade = False
    if is_legacy_hash(user.password_hash):
        if user.password_hash == _legacy_hash_password(req.password):
            auth_ok = True
            need_upgrade = True
    else:
        if verify_password(req.password, user.password_hash):
            auth_ok = True
    if not auth_ok:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if need_upgrade:
        user.password_hash = hash_password(req.password)
        db.commit()
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
        is_guest="1",
        role="user"
    )
    db.add(new_user)
    db.commit()
    token = create_token(user_id, guest_name)
    return {"token": token, "user_id": user_id, "username": guest_name}