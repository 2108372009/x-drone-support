import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from contextlib import asynccontextmanager

print("--- 程序开始启动 ---")

load_dotenv()

from api.database import engine, Base, SessionLocal
from api.chat import router as chat_router
from api.admin import router as admin_router
from api.auth import router as auth_router
from api.shop import router as shop_router
from api.db import Product

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 正在启动服务...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            items = [
                Product(id="prod_pro", name="X-Drone Pro 专业旗舰版", description="1英寸传感器，45分钟续航，全向避障", price="¥8,999", price_value=899900, stock=10),
                Product(id="prod_mini", name="X-Drone Mini 轻便入门版", description="249克，31分钟续航，前视避障", price="¥3,499", price_value=349900, stock=20),
                Product(id="bat_pro", name="X-Drone Pro 智能电池", description="5000mAh，续航45分钟", price="¥899", price_value=89900, stock=30),
                Product(id="bat_mini", name="X-Drone Mini 智能电池", description="2450mAh，续航31分钟", price="¥399", price_value=39900, stock=30),
                Product(id="nd_filter", name="ND滤镜套装", description="ND4/8/16", price="¥399", price_value=39900, stock=15),
            ]
            for p in items:
                db.add(p)
            db.commit()
            print("✅ 商品数据初始化完成")
    finally:
        db.close()
    print("✅ 数据库表检查/创建完成")
    yield
    print("👋 服务已关闭")

app = FastAPI(
    title="智能客服机器人",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(shop_router, prefix="/api")

app.mount("/", StaticFiles(directory="public", html=True), name="public")

print("--- 准备启动 Uvicorn 服务 ---")

if __name__ == "__main__":
    import uvicorn
    print("--- 正在运行 uvicorn.run ---")
    uvicorn.run(app, host="0.0.0.0", port=8000)