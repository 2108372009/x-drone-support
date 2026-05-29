import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from contextlib import asynccontextmanager

print("--- 程序开始启动 ---")

load_dotenv()

from api.database import engine, Base
from api.chat import router as chat_router
from api.admin import router as admin_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 正在启动服务...")
    Base.metadata.create_all(bind=engine)
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

# 先挂载 API 路由，再挂载静态文件
app.include_router(chat_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

# 挂载静态文件（必须在路由之后，确保 /api/* 优先匹配）
app.mount("/", StaticFiles(directory="public", html=True), name="public")

print("--- 准备启动 Uvicorn 服务 ---")

if __name__ == "__main__":
    import uvicorn
    print("--- 正在运行 uvicorn.run ---")
    uvicorn.run(app, host="0.0.0.0", port=8000)