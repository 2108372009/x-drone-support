# X-Drone 智能售后系统

X-Drone 无人机品牌的智能客服与商城系统，支持 AI 智能问答、无人机配件购买与订单管理。

## 功能特性

### 🤖 智能客服
- AI智能问答（基于DeepSeek API）
- RAG知识库检索
- FAQ精确匹配
- 对话历史记录

### 🛒 商城系统
- 商品展示与搜索
- 在线购买
- 订单管理
- 库存管理

### 👨‍💼 后台管理
- 用户管理
- 商品管理
- 订单管理
- FAQ管理
- 对话记录查看

## 技术栈

- **后端**：FastAPI + SQLAlchemy + PostgreSQL
- **前端**：原生 HTML/CSS/JavaScript
- **AI**：DeepSeek API
- **数据库**：PostgreSQL (Supabase) / SQLite

## 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd x-drone-support-system

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要的配置

# 4. 启动服务
python main.py
# 访问 http://localhost:8000
```

### 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 数据库连接（本地开发使用SQLite）
DATABASE_URL=sqlite:///./local_database.db

# 生产环境使用 PostgreSQL
# DATABASE_URL=postgresql://用户名:密码@主机:5432/数据库名

# DeepSeek API（用于 AI 问答）
DEEPSEEK_API_KEY=sk-your-api-key

# JWT 密钥（必填，建议32位随机字符串）
JWT_SECRET=your-32-char-secret-key

# 管理员账号（必填）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password

# CORS配置（允许的域名，多个用逗号分隔）
ALLOWED_ORIGINS=http://localhost:8000,http://localhost:3000
```

## 部署到 Railway

1. 将项目 Push 到 GitHub
2. 在 [Railway](https://railway.app) 创建新项目
3. 关联 GitHub 仓库
4. 在 Railway 环境变量中配置 `.env` 中的所有变量
5. 部署自动完成

## 项目结构

```
x-drone-support-system/
├── api/                    # API路由
│   ├── auth.py            # 认证相关API
│   ├── chat.py            # 客服聊天API
│   ├── shop.py            # 商城API
│   ├── admin.py           # 后台管理API
│   ├── database.py        # 数据库配置
│   └── db.py              # 数据模型
├── public/                 # 前端资源
│   ├── index.html         # 主页面
│   ├── css/style.css      # 样式文件
│   └── js/script.js       # 前端脚本
├── main.py                 # 应用入口
├── requirements.txt        # Python依赖
└── .env.example           # 环境变量示例
```

## 安全说明

⚠️ 重要安全配置：
- `.env` 文件包含敏感信息，**绝对不要**上传到GitHub
- JWT密钥必须使用强随机字符串
- 管理员密码必须符合强度要求
- CORS配置应限制为实际使用的域名

## 许可证

MIT License
