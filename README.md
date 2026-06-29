# X-Drone 销售售后服务AI聊天机器人

## 项目信息

- **课程名称**：大数据机器学习III
- **项目周期**：10周
- **任务类型**：小组项目

## 项目简介

本项目是一个针对无人机品牌"X-Drone"的销售售后服务AI聊天机器人系统，采用前后端分离架构，集成DeepSeek大语言模型，提供智能客服、商城购物、订单查询等功能。

## 功能特性

### 用户端功能
- **AI智能客服**：产品咨询、故障排查、退换货政策解答
- **商城系统**：商品浏览、在线购买、库存管理
- **订单查询**：公开订单查询、个人订单管理
- **用户系统**：注册登录、游客模式、管理员后台

### 后台管理功能
- **对话记录管理**：查看所有用户对话历史
- **订单管理**：订单状态更新、订单查询
- **商品管理**：上架商品、库存调整
- **FAQ管理**：知识库问答配置
- **管理员管理**：添加管理员账号

## 技术栈

### 后端
- **框架**：FastAPI
- **数据库**：PostgreSQL (生产) / SQLite (开发)
- **ORM**：SQLAlchemy
- **认证**：JWT + bcrypt
- **AI模型**：DeepSeek API

### 前端
- **语言**：纯JavaScript (无框架依赖)
- **样式**：CSS3 (响应式设计)
- **架构**：模块化设计 (6个独立模块)

### 部署
- **云平台**：Railway
- **数据库托管**：Supabase

## 项目结构

```
x-drone-support-system/
├── api/                    # 后端API模块
│   ├── auth.py            # 用户认证
│   ├── chat.py            # AI聊天
│   ├── shop.py            # 商城系统
│   ├── admin.py           # 后台管理
│   ├── database.py        # 数据库连接
│   └ db.py                # 数据模型
├── public/                 # 前端资源
│   ├── js/                # JavaScript模块
│   │   ├── utils.js       # 工具函数
│   │   ├── auth.js        # 认证模块
│   │   ├── chat.js        # 聊天模块
│   │   ├── shop.js        # 商城模块
│   │   ├── admin.js       # 后台模块
│   │   └ main.js          # 主入口
│   ├── css/               # 样式文件
│   └ index.html           # 主页面
├── docs/                   # 项目文档
│   ├── report/            # 项目报告
│   ├── ppt/               # PPT大纲
│   ├── frontend/          # 前端文档
│   ├── database/          # 数据库文档
│   ├── backend/           # 后端文档
├── main.py                 # 应用入口
├── requirements.txt        # Python依赖
└── README.md              # 项目说明
```

## 核心特性

### AI模型集成
- **提示词工程**：精心设计的系统提示词，确保回答专业、精准
- **FAQ优先匹配**：知识库问答优先响应，提高准确率
- **边界意识**：超出范围时引导人工客服

### 安全机制
- **JWT认证**：24小时有效期，HS256算法
- **密码强度校验**：前后端一致验证（6-20位，必须含字母和数字）
- **接口限流**：聊天、游客登录、订单查询三层限流
- **XSS防护**：输入输出编码过滤

### 移动端优化
- **响应式布局**：完美适配手机、平板、电脑
- **卡片式表格**：后台管理移动端卡片化
- **安全区域适配**：iPhone X刘海屏兼容
- **触摸反馈**：点击动效、最小点击区域44x44px

## 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/2108372009/x-drone-support.git
cd x-drone-support

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值

# 启动服务
python main.py
```

### 环境变量配置

| 变量名 | 说明 | 必填 |
|--------|------|------|
| DATABASE_URL | 数据库连接地址 | 是 |
| JWT_SECRET | JWT密钥（至少32位） | 是 |
| DEEPSEEK_API_KEY | DeepSeek API密钥 | 是 |
| ADMIN_USERNAME | 管理员用户名 | 是 |
| ADMIN_PASSWORD | 管理员密码 | 是 |
| ALLOWED_ORIGINS | 允许的跨域来源 | 是 |

## 访问地址

- **生产环境**：https://x-drone-support-production-60e7.up.railway.app
- **GitHub仓库**：https://github.com/2108372009/x-drone-support

## 项目文档

完整项目文档请查看 `docs/` 目录：

- [项目报告](docs/report/项目报告.md) - 完整课程报告（可转Word）
- [PPT大纲](docs/ppt/PPT大纲.md) - 答辩演示大纲
- [前端技术文档](docs/frontend/前端技术文档.md) - 前端架构与实现
- [数据库设计文档](docs/database/数据库设计文档.md) - 数据库ER图与表结构
- [后端API文档](docs/backend/后端API文档.md) - API接口文档

## 测试账号

- **管理员**：ADMIN_USERNAME / ADMIN_PASSWORD（见环境变量）
- **游客模式**：无需登录即可体验聊天功能

## 项目亮点

1. **提示词工程**：精心设计的系统提示词 + FAQ优先匹配策略
2. **安全机制**：JWT认证 + 密码强度校验 + 三层限流 + XSS防护
3. **移动端优化**：卡片式表格 + 安全区域适配 + 触摸反馈优化
4. **用户体验**：打字机效果 + 骨架屏 + Toast提示 + 实时验证
5. **代码质量**：模块化设计 + 缓存策略 + 性能优化

## License

MIT License