import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from .database import get_db
from .db import FAQ, Conversation, User, Product

router = APIRouter()

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "1234")

class FAQItem(BaseModel):
    question: str
    answer: str

class ProductCreate(BaseModel):
    name: str
    description: str
    price: str          # 显示价格如 "¥3,499"
    price_value: int    # 价格（分）
    stock: int
    image_url: Optional[str] = "/static/drone.jpg"

class StockUpdate(BaseModel):
    delta: int   # 正数增加库存，负数减少库存

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

# ==================== 新增商品管理接口 ====================
@router.get("/admin/products")
async def list_products(_: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [{
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "price_value": p.price_value,
        "stock": p.stock,
        "image_url": p.image_url
    } for p in products]

@router.post("/admin/products")
async def create_product(item: ProductCreate, _: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    new_id = f"prod_{uuid.uuid4().hex[:12]}"
    product = Product(
        id=new_id,
        name=item.name,
        description=item.description,
        price=item.price,
        price_value=item.price_value,
        stock=item.stock,
        image_url=item.image_url
    )
    db.add(product)
    db.commit()
    return {"id": new_id, "message": "新产品已上架"}

@router.patch("/admin/products/{product_id}/stock")
async def update_stock(product_id: str, update: StockUpdate, _: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    new_stock = product.stock + update.delta
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="库存不能为负数")
    product.stock = new_stock
    db.commit()
    return {"id": product_id, "stock": product.stock}