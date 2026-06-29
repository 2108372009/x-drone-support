import uuid
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .database import get_db, format_beijing_time
from .db import Product, Order, User
from .auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/shop", tags=["shop"])

_order_query_rate_limit = defaultdict(list)
ORDER_QUERY_LIMIT = 10
ORDER_QUERY_WINDOW = 60

def _check_order_query_rate_limit(client_ip: str) -> bool:
    """检查订单查询频率，返回 True 表示允许查询"""
    now = time.time()
    timestamps = _order_query_rate_limit[client_ip]
    timestamps[:] = [t for t in timestamps if now - t < ORDER_QUERY_WINDOW]
    if len(timestamps) >= ORDER_QUERY_LIMIT:
        return False
    timestamps.append(now)
    return True

@router.get("/order/public/{order_id}")
def query_order_public(order_id: str, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_order_query_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="查询太频繁了，请稍后再试～")
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在，请检查订单号是否正确")
    return {
        "order_id": order.id,
        "product_name": order.product_name,
        "quantity": order.quantity,
        "total_price": order.total_price,
        "status": order.status,
        "created_at": format_beijing_time(order.created_at)
    }

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
        result.append({
            "id": o.id,
            "product_name": o.product_name,
            "quantity": o.quantity,
            "total_price": o.total_price,
            "created_at": format_beijing_time(o.created_at),
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
