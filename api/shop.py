import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .database import get_db
from .db import Product, Order, User
from .auth import get_current_user
from datetime import datetime
from zoneinfo import ZoneInfo

router = APIRouter(prefix="/shop", tags=["shop"])

@router.get("/products")
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [{
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "stock": p.stock,
        "image_url": p.image_url
    } for p in products]

class PurchaseRequest(BaseModel):
    product_id: str
    quantity: int = 1

@router.post("/purchase")
def purchase(req: PurchaseRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.is_guest == "1":
        raise HTTPException(status_code=403, detail="亲，游客模式不能购物，请先注册/登录账号再进行购买哦～")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    if product.stock < req.quantity:
        raise HTTPException(status_code=400, detail=f"库存不足，当前库存 {product.stock}")
    product.stock -= req.quantity
    total_val = product.price_value * req.quantity
    total_str = f"¥{total_val / 100:.2f}"
    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    new_order = Order(
        id=order_id,
        user_id=user.id,
        product_id=product.id,
        product_name=product.name,
        quantity=req.quantity,
        total_price=total_str,
        total_value=total_val,
        status="待发货"
    )
    db.add(new_order)
    db.commit()
    return {"message": "购买成功", "order_id": order_id}

@router.get("/orders")
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(
        Order.user_id == user.id,
        Order.status != "已取消"
    ).order_by(Order.created_at.desc()).all()
    result = []
    for o in orders:
        if o.created_at:
            if o.created_at.tzinfo is None:
                utc_dt = o.created_at.replace(tzinfo=ZoneInfo("UTC"))
            else:
                utc_dt = o.created_at
            beijing_dt = utc_dt.astimezone(ZoneInfo("Asia/Shanghai"))
            created_at_str = beijing_dt.strftime("%Y-%m-%d %H:%M:%S")
        else:
            created_at_str = ""
        result.append({
            "id": o.id,
            "product_name": o.product_name,
            "quantity": o.quantity,
            "total_price": o.total_price,
            "created_at": created_at_str,
            "status": o.status
        })
    return result

@router.delete("/orders/{order_id}")
def cancel_order(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status == "已取消":
        raise HTTPException(status_code=400, detail="订单已取消")
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if product:
        product.stock += order.quantity
    order.status = "已取消"
    db.commit()
    return {"message": "订单已取消，库存已恢复"}
