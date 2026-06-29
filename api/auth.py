import uuid
import hashlib
import os
import re
import time
from collections import defaultdict
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .db import User

import bcrypt

# 安全修复：JWT密钥从环境变量读取（运行时检查，避免Railway构建阶段报错）
SECRET_KEY = os.getenv("JWT_SECRET", "")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

router = APIRouter(prefix="/auth", tags=["auth"])

USERNAME_PATTERN = re.compile(r'^[\u4e00-\u9fa5a-zA-Z0-9_]+$')

PASSWORD_MIN_LEN = 6
PASSWORD_MAX_LEN = 20

def validate_password(password: str) -> tuple[bool, str]:
    """验证密码强度，返回 (是否通过, 错误信息)"""
    if len(password) < PASSWORD_MIN_LEN:
        return False, f"密码太短了亲，至少需要{PASSWORD_MIN_LEN}位哦～"
    if len(password) > PASSWORD_MAX_LEN:
        return False, f"密码太长了亲，最多只能{PASSWORD_MAX_LEN}位哦～"
    if not re.search(r'[a-zA-Z]', password):
        return False, "密码必须包含字母哦～"
    if not re.search(r'\d', password):
        return False, "密码必须包含数字哦～"
    return True, ""

_guest_rate_limit = defaultdict(list)
GUEST_LIMIT_PER_HOUR = 5

def _check_guest_rate_limit(client_ip: str) -> bool:
    """检查游客登录频率，返回 True 表示允许"""
    now = time.time()
    timestamps = _guest_rate_limit[client_ip]
    timestamps[:] = [t for t in timestamps if now - t < 3600]
    if len(timestamps) >= GUEST_LIMIT_PER_HOUR:
        return False
    timestamps.append(now)
    return True

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

def _ensure_secret_key():
    """运行时检查JWT密钥是否已配置"""
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="服务器配置错误：JWT_SECRET 未设置")

def create_token(user_id: str, username: str) -> str:
    _ensure_secret_key()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_EXPIRE_HOURS)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    _ensure_secret_key()
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

class CheckUsernameRequest(BaseModel):
    username: str

@router.post("/check-username")
def check_username(req: CheckUsernameRequest, db: Session = Depends(get_db)):
    """检查用户名是否可用"""
    # 验证格式
    if len(req.username) < 3:
        return {"available": False, "message": "用户名至少需要3个字符"}
    if len(req.username) > 20:
        return {"available": False, "message": "用户名最多20个字符"}
    if not USERNAME_PATTERN.match(req.username):
        return {"available": False, "message": "只能包含中文、字母、数字和下划线"}
    
    # 检查是否已被占用
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        return {"available": False, "message": "该用户名已被占用"}
    
    return {"available": True, "message": "用户名可用"}

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # 密码强度验证
    valid, err_msg = validate_password(req.password)
    if not valid:
        raise HTTPException(status_code=400, detail=err_msg)
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="该昵称已被占用，换一个试试呢～")
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
def guest_login(request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_guest_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="操作太频繁了，请稍后再试哦～")
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