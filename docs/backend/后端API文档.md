# X-Drone 后端API技术文档

## 1. 技术栈概览

### 1.1 核心框架
- **FastAPI**: 现代、高性能的Web框架，支持异步处理和自动API文档
- **SQLAlchemy ORM**: 数据库ORM，支持PostgreSQL和SQLite
- **Uvicorn**: ASGI服务器，用于运行FastAPI应用

### 1.2 认证与安全
- **JWT认证**: 使用PyJWT实现Token认证，有效期24小时
- **bcrypt密码加密**: 密码哈希存储，安全性强
- **环境变量管理**: 通过python-dotenv管理敏感配置

### 1.3 AI集成
- **DeepSeek API**: 智能对话生成
- **RAG检索增强**: 基于知识库的检索增强生成
- **FAQ智能匹配**: 精确匹配常见问题

### 1.4 数据库支持
- **PostgreSQL**: 生产环境（Supabase/Railway）
- **SQLite**: 开发环境
- **连接池优化**: 支持高并发场景

---

## 2. API路由设计

### 2.1 路由前缀
所有API接口统一使用 `/api` 前缀，按功能模块划分：

```
/api/auth/*    - 认证相关接口
/api/chat/*    - 聊天相关接口
/api/shop/*    - 商城相关接口
/api/admin/*   - 后台管理接口
```

### 2.2 健康检查
```
GET /health
```
用于服务监控和负载均衡健康检查。

---

## 3. 认证模块 (/api/auth)

### 3.1 检查用户名可用性

**接口**: `POST /api/auth/check-username`

**描述**: 检查用户名是否已被占用

**认证**: 无需认证

**请求参数**:
```json
{
  "username": "string"  // 待检查的用户名
}
```

**响应格式**:
```json
{
  "available": true,     // 是否可用
  "message": "string"     // 提示信息
}
```

**验证规则**:
- 用户名长度：3-20个字符
- 允许字符：中文、字母、数字、下划线

---

### 3.2 用户注册

**接口**: `POST /api/auth/register`

**描述**: 创建新用户账号

**认证**: 无需认证

**请求参数**:
```json
{
  "username": "string",
  "password": "string",
  "confirm_password": "string"
}
```

**响应格式**:
```json
{
  "token": "string",      // JWT Token
  "user_id": "string",    // 用户ID
  "username": "string"     // 用户名
}
```

**密码强度要求**:
- 最小长度：6位
- 最大长度：20位
- 必须包含字母
- 必须包含数字

**错误码**:
- `400`: 密码不符合要求或两次密码不一致
- `409`: 用户名已被占用

---

### 3.3 用户登录

**接口**: `POST /api/auth/login`

**描述**: 用户登录获取Token

**认证**: 无需认证

**请求参数**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应格式**:
```json
{
  "token": "string",
  "user_id": "string",
  "username": "string"
}
```

**特性**:
- 支持旧版SHA256密码自动升级为bcrypt
- Token有效期：24小时

**错误码**:
- `401`: 用户名或密码错误

---

### 3.4 游客登录

**接口**: `POST /api/auth/guest`

**描述**: 创建游客账号进行体验

**认证**: 无需认证

**请求参数**: 无

**响应格式**:
```json
{
  "token": "string",
  "user_id": "string",
  "username": "string"   // 格式：guest_xxxxxxxx
}
```

**限流规则**:
- 同一IP每小时最多5次游客登录
- 超过限制返回 `429` 错误

---

## 4. 聊天模块 (/api/chat)

### 4.1 智能对话

**接口**: `POST /api/chat`

**描述**: 与AI助手进行对话

**认证**: 无需认证（支持游客）

**请求参数**:
```json
{
  "message": "string",     // 用户消息
  "user_id": "string",     // 用户ID
  "session_id": "string"   // 会话ID
}
```

**响应格式**:
```json
{
  "response": "string"     // AI回复内容
}
```

**处理流程**:
1. 频率限制检查（用户每3秒最多1条消息）
2. FAQ精确匹配
3. RAG知识库检索
4. DeepSeek API调用
5. 对话历史保存

**限流规则**:
- 用户每3秒最多发送1条消息
- 游客模式基于session_id限流

**降级策略**:
- DeepSeek API不可用时，使用规则回复
- 无API Key时，自动使用fallback回复

---

### 4.2 获取对话历史

**接口**: `GET /api/chat/history`

**描述**: 获取当前用户的对话历史

**认证**: 需要JWT Token

**请求头**:
```
Authorization: Bearer <token>
```

**响应格式**:
```json
[
  {
    "id": "string",
    "timestamp": "string",      // ISO格式时间戳
    "user_message": "string",
    "ai_reply": "string",
    "session_id": "string"
  }
]
```

**限制**: 最多返回最近100条记录

---

### 4.3 订单查询（模拟）

**接口**: `GET /api/chat/order`

**描述**: 查询订单状态（演示用）

**认证**: 无需认证

**查询参数**:
- `order_id`: 订单ID

**响应格式**:
```json
{
  "order_id": "string",
  "status": "string",        // 已发货/已签收/待发货
  "product": "string",
  "amount": "string",
  "tracking_no": "string",
  "logistics": "string"
}
```

**错误响应**:
```json
{
  "error": "未找到该订单，请确认订单号是否正确"
}
```

---

## 5. 商城模块 (/api/shop)

### 5.1 公开订单查询

**接口**: `GET /api/shop/order/public/{order_id}`

**描述**: 无需登录查询订单状态

**认证**: 无需认证

**路径参数**:
- `order_id`: 订单ID

**响应格式**:
```json
{
  "order_id": "string",
  "product_name": "string",
  "quantity": 1,
  "total_price": "string",
  "status": "string",
  "created_at": "string"     // 北京时间格式
}
```

**限流规则**:
- 同一IP每60秒最多10次查询
- 超过限制返回 `429` 错误

**错误码**:
- `404`: 订单不存在

---

### 5.2 商品列表

**接口**: `GET /api/shop/products`

**描述**: 获取所有在售商品

**认证**: 无需认证

**响应格式**:
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "price": "string",
    "stock": 10,
    "image_url": "string"
  }
]
```

---

### 5.3 购买商品

**接口**: `POST /api/shop/purchase`

**描述**: 购买商品创建订单

**认证**: 需要JWT Token（不支持游客）

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**:
```json
{
  "product_id": "string",
  "quantity": 1
}
```

**响应格式**:
```json
{
  "message": "购买成功",
  "order_id": "string"
}
```

**错误码**:
- `403`: 游客模式无法购买
- `404`: 商品不存在
- `400`: 库存不足

---

### 5.4 我的订单

**接口**: `GET /api/shop/orders`

**描述**: 获取当前用户的订单列表

**认证**: 需要JWT Token

**请求头**:
```
Authorization: Bearer <token>
```

**响应格式**:
```json
[
  {
    "id": "string",
    "product_name": "string",
    "quantity": 1,
    "total_price": "string",
    "created_at": "string",
    "status": "string"
  }
]
```

**注意**: 不包含已取消的订单

---

### 5.5 取消订单

**接口**: `DELETE /api/shop/orders/{order_id}`

**描述**: 取消订单并恢复库存

**认证**: 需要JWT Token

**路径参数**:
- `order_id`: 订单ID

**响应格式**:
```json
{
  "message": "订单已取消，库存已恢复"
}
```

**错误码**:
- `404`: 订单不存在
- `400`: 订单已取消

---

## 6. 后台管理模块 (/api/admin)

**注意**: 所有后台接口均需要管理员权限

### 6.1 对话记录管理

#### 获取对话记录列表

**接口**: `GET /api/admin/conversations`

**认证**: 需要管理员Token

**查询参数**:
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20，最大100）

**响应格式**:
```json
{
  "items": [
    {
      "timestamp": "string",
      "user_id": "string",
      "username": "string",
      "session_id": "string",
      "user_message": "string",
      "ai_reply": "string"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

---

### 6.2 FAQ管理

#### 获取FAQ列表

**接口**: `GET /api/admin/faqs`

**认证**: 需要管理员Token

**响应格式**:
```json
[
  {
    "question": "string",
    "answer": "string"
  }
]
```

#### 添加/更新FAQ

**接口**: `POST /api/admin/faqs`

**认证**: 需要管理员Token

**请求参数**:
```json
{
  "question": "string",
  "answer": "string"
}
```

**响应格式**:
```json
{
  "message": "保存成功"
}
```

**特性**:
- 问题已存在时更新答案
- 新问题时创建记录
- 自动更新缓存

#### 删除FAQ

**接口**: `DELETE /api/admin/faqs`

**认证**: 需要管理员Token

**请求参数**:
```json
{
  "question": "string"
}
```

**响应格式**:
```json
{
  "message": "删除成功"
}
```

---

### 6.3 商品管理

#### 获取商品列表

**接口**: `GET /api/admin/products`

**认证**: 需要管理员Token

**响应格式**:
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "price": "string",
    "price_value": 899900,
    "stock": 10,
    "image_url": "string"
  }
]
```

#### 创建商品

**接口**: `POST /api/admin/products`

**认证**: 需要管理员Token

**请求参数**:
```json
{
  "name": "string",
  "description": "string",
  "price": "string",          // 显示价格，如 "¥8,999"
  "price_value": 899900,      // 分为单位的数值
  "stock": 10,
  "image_url": "string"       // 可选，默认 /static/drone.jpg
}
```

**响应格式**:
```json
{
  "id": "prod_xxxxxxxxxx",
  "message": "新产品已上架"
}
```

#### 更新库存

**接口**: `PATCH /api/admin/products/{product_id}/stock`

**认证**: 需要管理员Token

**路径参数**:
- `product_id`: 商品ID

**请求参数**:
```json
{
  "delta": 5    // 库存变化量，可正可负
}
```

**响应格式**:
```json
{
  "id": "string",
  "stock": 15   // 更新后的库存
}
```

**错误码**:
- `404`: 商品不存在
- `400`: 库存不能为负数

#### 删除商品

**接口**: `DELETE /api/admin/products/{product_id}`

**认证**: 需要管理员Token

**响应格式**:
```json
{
  "message": "商品已下架删除"
}
```

---

### 6.4 订单管理

#### 获取所有订单

**接口**: `GET /api/admin/orders`

**认证**: 需要管理员Token

**查询参数**:
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20，最大100）

**响应格式**:
```json
{
  "items": [
    {
      "order_id": "string",
      "username": "string",
      "product_name": "string",
      "quantity": 1,
      "total_price": "string",
      "status": "string",
      "created_at": "string"
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

#### 更新订单状态

**接口**: `PATCH /api/admin/orders/{order_id}/status`

**认证**: 需要管理员Token

**请求参数**:
```json
{
  "status": "运输中"    // 待发货/运输中/已送达
}
```

**响应格式**:
```json
{
  "message": "状态更新成功",
  "new_status": "运输中"
}
```

**错误码**:
- `404`: 订单不存在
- `400`: 无效的状态值

---

### 6.5 管理员管理

#### 创建管理员

**接口**: `POST /api/admin/users`

**认证**: 需要管理员Token

**请求参数**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应格式**:
```json
{
  "message": "管理员 xxx 添加成功"
}
```

**错误码**:
- `400`: 用户名已存在或密码不符合要求

---

## 7. 安全机制

### 7.1 JWT Token认证

**实现细节**:
- 算法：HS256
- 有效期：24小时
- 载荷包含：用户ID、用户名、签发时间、过期时间

**Token格式**:
```
Authorization: Bearer <token>
```

**验证流程**:
1. 检查Header中的Authorization字段
2. 解析Bearer Token
3. 验证签名和有效期
4. 从数据库查询用户是否存在

**错误响应**:
- `401`: 缺少认证、Token无效、Token过期
- `403`: 权限不足（需要管理员权限）

---

### 7.2 密码安全

**密码强度校验**:
```python
- 最小长度：6位
- 最大长度：20位
- 必须包含字母
- 必须包含数字
```

**密码加密**:
- 使用bcrypt进行哈希
- 自动加盐
- 支持旧版SHA256自动升级

**用户名验证**:
- 允许字符：中文、字母、数字、下划线
- 长度限制：3-20个字符

---

### 7.3 接口限流

**聊天接口**:
- 每个用户每3秒最多1条消息
- 游客基于session_id限流
- 返回错误码：429

**游客登录**:
- 同一IP每小时最多5次
- 返回错误码：429

**订单查询**:
- 同一IP每60秒最多10次
- 返回错误码：429

---

### 7.4 XSS防护

**措施**:
- FastAPI自动对响应进行JSON编码
- 所有用户输入通过Pydantic模型验证
- 管理员接口参数使用POST body而非URL参数

**示例**:
```python
# FAQ删除使用POST body，防止URL注入
class FAQDeleteRequest(BaseModel):
    question: str
```

---

### 7.5 CORS配置

**环境变量配置**:
```
ALLOWED_ORIGINS=http://localhost:8000,http://localhost:3000
```

**安全策略**:
- 限制允许的域名（不使用 `*`）
- 允许凭证传递
- 限制HTTP方法：GET, POST, PUT, DELETE, PATCH
- 限制请求头：Authorization, Content-Type

---

## 8. 缓存策略

### 8.1 FAQ缓存

**缓存结构**:
```python
_faq_cache = {
    "items": [(question_lower, answer), ...],
    "dirty": False,
    "loaded_at": timestamp
}
```

**缓存策略**:
- TTL：5分钟（300秒）
- 脏标记机制：FAQ更新时标记为dirty
- 自动重载：超时或脏标记触发重新加载

**失效机制**:
```python
def invalidate_faq_cache():
    _faq_cache["dirty"] = True
```

---

### 8.2 商品缓存

**实现**: 暂未实现应用层缓存，直接查询数据库

**优化建议**:
- 可添加Redis缓存层
- 使用商品ID作为缓存键
- 库存变更时主动失效

---

### 8.3 订单缓存

**实现**: 暂未实现应用层缓存，直接查询数据库

**优化建议**:
- 高频查询订单可缓存
- 使用订单ID作为缓存键
- 状态变更时主动失效

---

### 8.4 后台数据缓存

**对话记录**:
- 分页查询，无缓存
- 建议：添加计数缓存

**统计数据**:
- 暂未实现
- 建议：添加Redis缓存统计信息

---

## 9. 数据库设计

### 9.1 数据表结构

#### users表
```sql
id              VARCHAR PRIMARY KEY
username        VARCHAR UNIQUE NOT NULL
password_hash   VARCHAR NOT NULL
is_guest        VARCHAR DEFAULT '0'
role            VARCHAR DEFAULT 'user'
created_at      TIMESTAMP DEFAULT NOW()
```

#### products表
```sql
id              VARCHAR PRIMARY KEY
name            VARCHAR NOT NULL
description     TEXT
price           VARCHAR NOT NULL
price_value     INTEGER NOT NULL
stock           INTEGER DEFAULT 0
image_url       VARCHAR DEFAULT '/static/drone.jpg'
```

#### orders表
```sql
id              VARCHAR PRIMARY KEY
user_id         VARCHAR NOT NULL
product_id      VARCHAR NOT NULL
product_name    VARCHAR
quantity        INTEGER DEFAULT 1
total_price     VARCHAR
total_value     INTEGER
status          VARCHAR DEFAULT '待发货'
created_at      TIMESTAMP DEFAULT NOW()
```

#### conversations表
```sql
id              VARCHAR PRIMARY KEY
user_id         VARCHAR
session_id      VARCHAR
user_message    TEXT
ai_reply        TEXT
timestamp       TIMESTAMP DEFAULT NOW()
```

#### faqs表
```sql
question        VARCHAR PRIMARY KEY
answer          TEXT
```

---

## 10. 环境变量配置

### 10.1 必需配置

```bash
# JWT密钥（必需）
JWT_SECRET=your-secret-key-here

# 数据库连接（必需）
DATABASE_URL=postgresql://user:password@host:port/database

# DeepSeek API（必需）
DEEPSEEK_API_KEY=your-api-key

# 管理员账号（必需）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password

# CORS允许的域名（必需）
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 10.2 可选配置

```bash
# 本地开发数据库
DATABASE_URL=sqlite:///./local_database.db
```

---

## 11. 部署说明

### 11.1 生产环境检查清单

- [ ] 设置强JWT_SECRET
- [ ] 配置管理员账号密码
- [ ] 设置ALLOWED_ORIGINS
- [ ] 配置DeepSeek API Key
- [ ] 数据库连接池优化
- [ ] 启用HTTPS
- [ ] 配置日志记录
- [ ] 设置监控告警

### 11.2 性能优化建议

1. **数据库连接池**:
   - PostgreSQL: pool_size=5, max_overflow=10
   - SQLite: pool_size=1, max_overflow=0

2. **缓存层**:
   - 添加Redis缓存
   - 实现商品和订单缓存
   - 添加统计数据缓存

3. **限流**:
   - 使用Redis实现分布式限流
   - 支持更细粒度的限流策略

---

## 12. 错误处理

### 12.1 标准错误格式

```json
{
  "detail": "错误描述信息"
}
```

### 12.2 常见错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未认证或认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如用户名已存在）|
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 13. API测试示例

### 13.1 用户注册和登录

```bash
# 注册
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123",
    "confirm_password": "Test123"
  }'

# 登录
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123"
  }'
```

### 13.2 聊天接口

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好",
    "user_id": "usr_xxxx",
    "session_id": "session_xxxx"
  }'
```

### 13.3 需要认证的接口

```bash
# 获取对话历史
curl -X GET http://localhost:8000/api/chat/history \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 购买商品
curl -X POST http://localhost:8000/api/shop/purchase \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod_pro",
    "quantity": 1
  }'
```

---

## 14. 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 实现用户认证系统
- 实现智能聊天功能
- 实现商城购物功能
- 实现后台管理系统

---

## 15. 联系方式

如有问题或建议，请联系技术支持团队。

---

**文档版本**: v1.0
**最后更新**: 2024年
**维护团队**: X-Drone技术团队