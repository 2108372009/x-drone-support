import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from .database import get_db
from .db import FAQ, Conversation, User, Product, Order
from .auth import hash_password, verify_admin, get_current_user
from .chat import invalidate_faq_cache

router = APIRouter()

class FAQItem(BaseModel):
    question: str
    answer: str

class ProductCreate(BaseModel):
    name: str
    description: str
    price: str
    price_value: int
    stock: int
    image_url: Optional[str] = "/static/drone.jpg"

class StockUpdate(BaseModel):
    delta: int

class OrderStatusUpdate(BaseModel):
    status: str

class CreateAdminRequest(BaseModel):
    username: str
    password: str

@router.get("/admin/conversations")
async def get_conversations(user: User = Depends(verify_admin), db: Session = Depends(get_db)):
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
async def get_faqs(user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    return db.query(FAQ).all()

@router.post("/admin/faqs")
async def save_faq(item: FAQItem, user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    faq = db.query(FAQ).filter(FAQ.question == item.question).first()
    if faq:
        faq.answer = item.answer
    else:
        faq = FAQ(question=item.question, answer=item.answer)
        db.add(faq)
    db.commit()
    invalidate_faq_cache()
    return {"message": "保存成功"}

@router.delete("/admin/faqs")
async def delete_faq(question: str, user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    db.query(FAQ).filter(FAQ.question == question).delete()
    db.commit()
    invalidate_faq_cache()
    return {"message": "删除成功"}

@router.get("/admin/products")
async def list_products(user: User = Depends(verify_admin), db: Session = Depends(get_db)):
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
async def create_product(item: ProductCreate, user: User = Depends(verify_admin), db: Session = Depends(get_db)):
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
async def update_stock(product_id: str, update: StockUpdate, user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    new_stock = product.stock + update.delta
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="库存不能为负数")
    product.stock = new_stock
    db.commit()
    return {"id": product_id, "stock": product.stock}

@router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    db.delete(product)
    db.commit()
    return {"message": "商品已下架删除"}

@router.get("/admin/orders")
async def get_all_orders(user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    orders = db.query(Order, User.username).join(User, Order.user_id == User.id).order_by(Order.created_at.desc()).limit(100).all()
    result = []
    for order, username in orders:
        result.append({
            "order_id": order.id,
            "username": username,
            "product_name": order.product_name,
            "quantity": order.quantity,
            "total_price": order.total_price,
            "status": order.status,
            "created_at": order.created_at.strftime("%Y-%m-%d %H:%M:%S") if order.created_at else None
        })
    return result

@router.patch("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, update: OrderStatusUpdate, user: User = Depends(verify_admin), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    valid_statuses = ["待发货", "运输中", "已送达"]
    if update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="无效的状态值")
    order.status = update.status
    db.commit()
    return {"message": "状态更新成功", "new_status": order.status}

@router.post("/admin/users")
async def create_admin(req: CreateAdminRequest, current_admin: User = Depends(verify_admin), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    new_user = User(
        id=f"usr_{uuid.uuid4().hex[:12]}",
        username=req.username,
        password_hash=hash_password(req.password),
        is_guest="0",
        role="admin"
    )
    db.add(new_user)
    db.commit()
    return {"message": f"管理员 {req.username} 添加成功"}
