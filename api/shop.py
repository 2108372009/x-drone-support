import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .database import get_db
from .db import Product, Order, User
from .auth import SECRET_KEY, ALGORITHM
import jwt

router = APIRouter(prefix="/shop", tags=["shop"])

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少认证")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        return user
    except:
        raise HTTPException(status_code=401, detail="无效token")

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
    # 游客禁止购买
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
        status="active"
    )
    db.add(new_order)
    db.commit()
    return {"message": "购买成功", "order_id": order_id}

@router.get("/orders")
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.user_id == user.id, Order.status == "active").order_by(
        Order.created_at.desc()).all()
    result = []
    for o in orders:
        # 确保 created_at 不为 None，并转为 ISO 格式字符串
        if o.created_at:
            if hasattr(o.created_at, 'isoformat'):
                created_at_str = o.created_at.isoformat()
            else:
                # 如果是字符串，尝试解析
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(str(o.created_at))
                    created_at_str = dt.isoformat()
                except:
                    created_at_str = ""
        else:
            created_at_str = ""
        result.append({
            "id": o.id,
            "product_name": o.product_name,
            "quantity": o.quantity,
            "total_price": o.total_price,
            "created_at": created_at_str
        })
    return result

@router.delete("/orders/{order_id}")
def cancel_order(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "active":
        raise HTTPException(status_code=400, detail="订单已取消")
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if product:
        product.stock += order.quantity
    order.status = "cancelled"
    db.commit()
    return {"message": "订单已取消，库存已恢复"}