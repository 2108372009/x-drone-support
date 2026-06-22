# X-Drone 智能售后系统

X-Drone 无人机品牌的智能客服与商城系统，支持 AI 智能问答、无人机配件购买与订单管理。

## 本地开发

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量（创建 .env 文件）
cp .env.example .env

# 启动服务
python main.py
# 访问 http://localhost:8000
```

## 环境变量说明

在项目根目录创建 `.env` 文件：

```env
# 数据库连接（Supabase PostgreSQL）
DATABASE_URL=postgresql://用户名:密码@主机:5432/数据库名

# DeepSeek API（用于 AI 问答）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# JWT 密钥（建议随机字符串）
JWT_SECRET=your-secret-key-here

# 初始管理员账号（可选，不填则使用默认值）
ADMIN_USERNAME=阮志男
ADMIN_PASSWORD=your-password
```

## 部署到 Railway

1. 将项目 Push 到 GitHub
2. 在 [Railway](https://railway.app) 创建新项目，关联 GitHub 仓库
3. 在 Railway 环境变量中配置 `.env` 中的所有变量
4. 部署自动完成

## 技术栈

- **后端**：FastAPI + SQLAlchemy + PostgreSQL (Supabase)
- **前端**：原生 HTML/CSS/JavaScript
- **AI**：DeepSeek API
- **部署**：Railway
