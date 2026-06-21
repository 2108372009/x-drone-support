const API_BASE = '';

// ==================== 全局状态 ====================
let currentToken = localStorage.getItem('auth_token');
let currentUserId = localStorage.getItem('user_id');
let currentUsername = localStorage.getItem('username');

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
}

// 权限拒绝标志
let adminAccessDenied = false;
let isAdminAlerting = false;

// DOM 元素
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const newSessionBtn = document.getElementById('newSessionBtn');
const historyBtn = document.getElementById('historyBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userNameSpan = document.getElementById('userNameDisplay');

const loginModal = document.getElementById('loginModal');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const historyModal = document.getElementById('historyModal');
const orderModal = document.getElementById('orderModal');

// ==================== 工具函数 ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

function formatLocalTime(utcString) {
    if (!utcString) return '';
    if (utcString.includes('-') && utcString.includes(':') && !utcString.includes('T')) {
        return utcString;
    }
    let date;
    if (utcString.includes('T')) {
        date = new Date(utcString);
    } else {
        date = new Date(utcString + 'Z');
    }
    if (isNaN(date.getTime())) return utcString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function requireLogin() {
    if (!currentToken) {
        showToast('请先注册/登录账号再进行此操作', 'warning');
        showLoginModal();
        return false;
    }
    return true;
}

// ==================== 用户认证 ====================
function updateUserUI() {
    if (currentToken && currentUserId) {
        userNameSpan.innerText = currentUsername || '用户';
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        userNameSpan.innerText = '未登录';
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
    }
}

function storeAuth(token, userId, username) {
    currentToken = token;
    currentUserId = userId;
    currentUsername = username;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('username', username);
    // 登录成功后重置权限标志
    adminAccessDenied = false;
    isAdminAlerting = false;
    updateUserUI();
}

function clearAuth() {
    currentToken = null;
    currentUserId = null;
    currentUsername = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    adminAccessDenied = false;
    isAdminAlerting = false;
    updateUserUI();
}

// 跳转到聊天标签
function goToChat() {
    const chatTab = document.querySelector('.tab[data-tab="chat"]');
    if (chatTab) {
        chatTab.click();
    } else {
        switchTab('chat');
    }
}

// ==================== 客服模块 ====================
function addMessage(role, text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    const avatar = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    const time = getCurrentTime();
    messageDiv.innerHTML = `
        <div class="avatar">${avatar}</div>
        <div class="bubble">
            ${escapeHtml(text)}
            <div class="message-meta">
                <span class="message-time">${time}</span>
                ${!isUser ? '<span class="read-receipt"><i class="fas fa-check-double"></i></span>' : ''}
            </div>
            ${!isUser ? `<div class="feedback-buttons"><i class="far fa-thumbs-up"></i><i class="far fa-thumbs-down"></i></div>` : ''}
        </div>
    `;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    if (!isUser) {
        const thumbsUp = messageDiv.querySelector('.fa-thumbs-up');
        const thumbsDown = messageDiv.querySelector('.fa-thumbs-down');
        if (thumbsUp) thumbsUp.addEventListener('click', function() {
            this.classList.add('active');
            this.style.color = '#10b981';
            alert('感谢您的认可！');
        });
        if (thumbsDown) thumbsDown.addEventListener('click', function() {
            this.classList.add('active');
            this.style.color = '#ef4444';
            alert('很抱歉没能帮到您，我们会努力改进。');
        });
    }
}

function showTypingIndicator() {
    const existing = document.getElementById('typing-indicator');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'message ai';
    div.id = 'typing-indicator';
    div.innerHTML = `<div class="avatar"><i class="fas fa-robot"></i></div><div class="bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

// Toast通知函数
function showToast(message, type = 'error', duration = 3000) {
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `error-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function sendMessage() {
    let msg = userInput.value.trim();
    if (!msg) return;
    addMessage('user', msg, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    showTypingIndicator();
    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId || 'guest', session_id: sessionId, message: msg })
        });
        if (!res.ok) {
            removeTypingIndicator();
            if (res.status === 429) {
                const errData = await res.json();
                addMessage('ai', errData.detail || '操作过于频繁，请稍后再试。', false);
            } else {
                const errData = await res.json();
                addMessage('ai', errData.detail || '请求失败，请重试。', false);
            }
            return;
        }
        const data = await res.json();
        removeTypingIndicator();
        let reply = data.response || data.detail || "抱歉，我暂时无法回答。";
        addMessage('ai', reply, false);
    } catch (err) {
        removeTypingIndicator();
        addMessage('ai', '网络错误，请检查网络连接后重试。', false);
    }
}

function newSession() {
    localStorage.removeItem('sessionId');
    location.reload();
}

function sendWelcomeMessage() {
    if (chatBox.children.length > 0) return;
    const welcomeMsg = `亲，您好！我是X-Drone售后专家小智 🤖。请问您遇到什么问题了？\n• 产品参数与价格\n• 故障代码排查\n• 保修政策与X-Care\n• 飞行安全建议\n• 开箱与物流问题\n我会尽力帮您解答～`;
    addMessage('ai', welcomeMsg, false);
}

// ==================== 历史对话 ====================
async function showHistoryModal() {
    if (!requireLogin()) return;
    const bodyDiv = document.getElementById('historyModalBody');
    bodyDiv.innerHTML = '加载中...';
    historyModal.style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE}/api/history`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!res.ok) {
            if (res.status === 401) {
                showToast('登录已过期，请重新登录', 'warning');
                clearAuth();
                showLoginModal();
                historyModal.style.display = 'none';
                return;
            }
            throw new Error('请求失败');
        }
        const history = await res.json();
        if (!history.length) { bodyDiv.innerHTML = '<p>暂无历史记录</p>'; return; }
        let html = '';
        for (let item of history) {
            html += `<div class="history-item"><div class="history-time">${formatLocalTime(item.timestamp)}</div><div class="history-q"><strong>问：</strong>${escapeHtml(item.user_message)}</div><div class="history-a"><strong>答：</strong>${escapeHtml(item.ai_reply)}</div></div>`;
        }
        bodyDiv.innerHTML = html;
    } catch(e) {
        console.error(e);
        bodyDiv.innerHTML = '<p>加载失败，请稍后重试</p>';
    }
}
function closeHistoryModal() { historyModal.style.display = 'none'; }
function showOrderModal() { orderModal.style.display = 'flex'; document.getElementById('orderIdInput').value = ''; document.getElementById('orderResult').innerHTML = ''; }
function closeOrderModal() { orderModal.style.display = 'none'; }

// ==================== 商城模块 ====================
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/api/shop/products`);
        const products = await res.json();
        const container = document.getElementById('productList');
        if (!container) return;
        container.innerHTML = products.map(p => `
            <div class="product-card">
                <h4>${escapeHtml(p.name)}</h4>
                <p>${escapeHtml(p.description)}</p>
                <div class="price">${p.price}</div>
                <div class="stock">库存: ${p.stock}</div>
                <div class="buy-action">
                    <input type="number" min="1" max="${p.stock}" value="1" id="qty-${p.id}" ${p.stock===0?'disabled':''}>
                    <button class="buy-btn" data-id="${p.id}" ${p.stock===0?'disabled':''}>购买</button>
                </div>
            </div>
        `).join('');
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = btn.getAttribute('data-id');
                if (btn.disabled) return;
                buyProduct(productId);
            });
        });
    } catch(e) { console.error(e); }
}

async function buyProduct(productId) {
    if (!requireLogin()) return;
    const qtyInput = document.getElementById(`qty-${productId}`);
    if (!qtyInput) { console.error('找不到数量输入框'); return; }
    const quantity = parseInt(qtyInput.value) || 1;
    const confirmMsg = `确认购买此商品吗？\n数量：${quantity}`;
    if (!confirm(confirmMsg)) return;
    try {
        const res = await fetch(`${API_BASE}/api/shop/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ product_id: productId, quantity })
        });
        if (res.ok) {
            showToast('购买成功！', 'success');
            loadProducts();
            if (document.querySelector('.tab.active')?.getAttribute('data-tab') === 'orders') loadOrders();
        } else {
            const err = await res.json();
            showToast('购买失败：' + (err.detail || '未知错误'), 'error');
        }
    } catch(e) { showToast('网络错误，请检查网络连接', 'error'); }
}

// ==================== 订单模块 ====================
async function loadOrders() {
    if (!requireLogin()) {
        document.getElementById('ordersList').innerHTML = '<p>请先登录查看订单</p>';
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/shop/orders`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (!res.ok) throw new Error('加载失败');
        const orders = await res.json();
        const container = document.getElementById('ordersList');
        if (!orders.length) { container.innerHTML = '<p>暂无订单</p>'; return; }
        container.innerHTML = orders.map(o => {
            const dateStr = o.created_at || '时间未知';
            return `
                <div class="order-item">
                    <div><strong>${escapeHtml(o.product_name)}</strong> × ${o.quantity}</div>
                    <div>总价 ${o.total_price}</div>
                    <div>状态：<span class="order-status ${o.status}">${escapeHtml(o.status)}</span></div>
                    <div>${dateStr}</div>
                    ${o.status !== '已取消' ? `<button onclick="cancelOrder('${o.id}')">取消订单</button>` : ''}
                </div>
            `;
        }).join('');
    } catch(e) { console.error(e); document.getElementById('ordersList').innerHTML = '<p>加载失败，请重试</p>'; }
}

window.cancelOrder = async (orderId) => {
    if (!requireLogin()) return;
    if (!confirm('确定要取消此订单吗？库存将恢复')) return;
    try {
        const res = await fetch(`${API_BASE}/api/shop/orders/${orderId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (res.ok) {
            showToast('订单已取消', 'success');
            loadOrders();
            loadProducts();
        } else showToast('取消失败', 'error');
    } catch(e) { showToast('网络错误', 'error'); }
};

// ==================== 登录/注册 ====================
function showLoginModal() {
    loginModal.style.display = 'flex';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

function closeLoginModal() { loginModal.style.display = 'none'; }

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { showToast('请输入用户名和密码', 'warning'); return; }
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            const data = await res.json();
            storeAuth(data.token, data.user_id, data.username);
            closeLoginModal();
            loadProducts();
            if (document.querySelector('.tab.active')?.getAttribute('data-tab') === 'orders') loadOrders();
        } else {
            const err = await res.json();
            showToast('登录失败：' + (err.detail || '用户名或密码错误'), 'error');
        }
    } catch(e) { showToast('网络错误，请检查网络连接', 'error'); }
}

async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

    if (!username || !password) {
        showToast('请填写完整信息', 'warning');
        return;
    }
    if (password !== confirm) {
        showToast('两次输入的密码不一致', 'warning');
        return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber || password.length < 6) {
        showToast('密码必须同时包含字母和数字，且长度至少6位', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, confirm_password: confirm })
        });
        if (res.ok) {
            const data = await res.json();
            storeAuth(data.token, data.user_id, data.username);
            closeLoginModal();
            loadProducts();
            if (document.querySelector('.tab.active')?.getAttribute('data-tab') === 'orders') loadOrders();
            showToast('注册成功！', 'success');
        } else {
            const err = await res.json();
            showToast('注册失败：' + (err.detail || '请重试'), 'error');
        }
    } catch(e) {
        showToast('网络错误，请稍后重试', 'error');
    }
}

// ==================== 后台管理（优化权限判断） ====================
// 带权限验证的请求，根据是否已登录决定提示内容
async function fetchWithAdminToken(url, options = {}) {
    if (!currentToken) {
        // 未登录 → 提示登录
        if (!adminAccessDenied && !isAdminAlerting) {
            isAdminAlerting = true;
            adminAccessDenied = true;
            showToast('请先登录再访问后台', 'warning');
            showLoginModal();
            goToChat();
        }
        throw new Error('NotLoggedIn');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${currentToken}`
    };
    const response = await fetch(url, { ...options, headers });

    // 如果返回 401 或 403，且当前用户已登录，则视为权限不足
    if (response.status === 401 || response.status === 403) {
        if (!adminAccessDenied && !isAdminAlerting) {
            isAdminAlerting = true;
            adminAccessDenied = true;
            showToast('用户权限不够无法访问', 'error');
            goToChat();
        }
        throw new Error('Forbidden');
    }
    return response;
}

// 显示无权限占位（但这里已改为跳转，保留作为备用）
function showNoPermission() {
    const tables = ['#logTable tbody', '#productTable tbody', '#adminOrderTable tbody', '#faqTable tbody'];
    tables.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#999;">无权限查看，请联系管理员</td></tr>`;
    });
}

async function loadProductManagement() {
    if (adminAccessDenied) return;
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/products`);
        const products = await res.json();
        const tbody = document.querySelector('#productTable tbody');
        if (!tbody) return;
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">暂无商品，请点击"上架新产品"添加</td></tr>';
            return;
        }
        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${escapeHtml(p.name)}</td>
                <td>${p.price}</td>
                <td id="stock-${p.id}">${p.stock}</td>
                <td>
                    <button class="small" onclick="adjustStock('${p.id}', 1)">+1</button>
                    <button class="small" onclick="adjustStock('${p.id}', -1)">-1</button>
                    <button class="small" onclick="adjustStock('${p.id}', 10)">+10</button>
                    <button class="small" onclick="adjustStock('${p.id}', -10)">-10</button>
                    <button class="small" style="background:#dc3545; margin-left:8px;" onclick="deleteProduct('${p.id}')">下架</button>
                  </td>
            </tr>
        `).join('');
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') {
            // 已由 fetchWithAdminToken 处理跳转
            return;
        }
        console.error(e);
        showToast('加载商品列表失败', 'error');
    }
}

window.adjustStock = async (productId, delta) => {
    if (adminAccessDenied) return;
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/products/${productId}/stock`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta })
        });
        if (res.ok) {
            const data = await res.json();
            const stockCell = document.getElementById(`stock-${productId}`);
            if (stockCell) {
                stockCell.innerText = data.stock;
            }
            loadProducts();
        } else {
            const err = await res.json();
            showToast('调整失败：' + (err.detail || '未知错误'), 'error');
        }
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('网络错误', 'error');
    }
};

window.addNewProduct = async () => {
    if (adminAccessDenied) return;
    const name = document.getElementById('newProdName').value.trim();
    const description = document.getElementById('newProdDesc').value.trim();
    const priceDisplay = document.getElementById('newProdPrice').value.trim();
    const priceYuan = parseFloat(document.getElementById('newProdPriceYuan').value);
    const stock = parseInt(document.getElementById('newProdStock').value);
    let imageUrl = document.getElementById('newProdImage').value.trim();

    if (!name || !description || !priceDisplay || isNaN(priceYuan) || isNaN(stock)) {
        showToast('请完整填写商品信息（名称、描述、显示价格、价格(元)、库存）', 'warning');
        return;
    }
    if (priceYuan <= 0) {
        showToast('价格必须大于0', 'warning');
        return;
    }
    const priceValue = Math.round(priceYuan * 100);
    if (!imageUrl) imageUrl = '/static/drone.jpg';

    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, price: priceDisplay, price_value: priceValue, stock, image_url: imageUrl })
        });
        if (res.ok) {
            showToast('新产品上架成功', 'success');
            document.getElementById('newProdName').value = '';
            document.getElementById('newProdDesc').value = '';
            document.getElementById('newProdPrice').value = '';
            document.getElementById('newProdPriceYuan').value = '';
            document.getElementById('newProdStock').value = '';
            document.getElementById('newProdImage').value = '';
            loadProductManagement();
            loadProducts();
        } else {
            const err = await res.json();
            showToast('上架失败：' + (err.detail || '未知错误'), 'error');
        }
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('网络错误', 'error');
    }
};

window.deleteProduct = async (productId) => {
    if (adminAccessDenied) return;
    if (!confirm('确定要下架并删除此商品吗？删除后不可恢复。')) return;
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/products/${productId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('商品已下架删除', 'success');
            loadProductManagement();
            loadProducts();
        } else {
            const err = await res.json();
            showToast('删除失败：' + (err.detail || '未知错误'), 'error');
        }
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('网络错误', 'error');
    }
};

// ==================== 管理员订单管理 ====================
async function loadAdminOrders() {
    if (adminAccessDenied) return;
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/orders`);
        const orders = await res.json();
        const tbody = document.querySelector('#adminOrderTable tbody');
        if (!tbody) return;
        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="7">暂无订单</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>${escapeHtml(o.order_id)}</td>
                <td>${escapeHtml(o.username)}</td>
                <td>${escapeHtml(o.product_name)}</td>
                <td>${o.quantity}</td>
                <td>${o.total_price}</td>
                <td><span class="order-status ${o.status}">${o.status}</span></td>
                <td>
                    <select onchange="updateOrderStatus('${o.order_id}', this.value)">
                        <option value="待发货" ${o.status==='待发货'?'selected':''}>待发货</option>
                        <option value="运输中" ${o.status==='运输中'?'selected':''}>运输中</option>
                        <option value="已送达" ${o.status==='已送达'?'selected':''}>已送达</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        console.error(e);
        showToast('加载订单列表失败', 'error');
    }
}

window.updateOrderStatus = async (orderId, newStatus) => {
    if (adminAccessDenied) return;
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            showToast('状态更新成功', 'success');
            loadAdminOrders();
            if (document.querySelector('.tab.active')?.getAttribute('data-tab') === 'orders') {
                loadOrders();
            }
        } else {
            const err = await res.json();
            showToast('更新失败：' + (err.detail || '未知错误'), 'error');
        }
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('网络错误', 'error');
    }
};

// ==================== 添加管理员功能 ====================
function showAddAdminModal() {
    if (adminAccessDenied) {
        showToast('用户权限不够无法访问', 'error');
        goToChat();
        return;
    }
    document.getElementById('addAdminModal').style.display = 'flex';
    document.getElementById('newAdminName').value = '';
    document.getElementById('newAdminPwd1').value = '';
    document.getElementById('newAdminPwd2').value = '';
}
function closeAddAdminModal() {
    document.getElementById('addAdminModal').style.display = 'none';
}

async function confirmAddAdmin() {
    if (adminAccessDenied) return;
    const username = document.getElementById('newAdminName').value.trim();
    const pwd1 = document.getElementById('newAdminPwd1').value;
    const pwd2 = document.getElementById('newAdminPwd2').value;
    if (!username) { showToast('请输入管理员昵称', 'warning'); return; }
    if (pwd1.length < 6) { showToast('密码至少6位', 'warning'); return; }
    if (pwd1 !== pwd2) { showToast('两次密码不一致', 'warning'); return; }
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: pwd1 })
        });
        if (res.ok) {
            showToast('系统已成功添加管理员', 'success');
            closeAddAdminModal();
        } else {
            const err = await res.json();
            showToast('添加失败：' + (err.detail || '未知错误'), 'error');
        }
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('网络错误', 'error');
    }
}

// ==================== 加载后台数据 ====================
async function loadAdminData() {
    if (adminAccessDenied) {
        goToChat();
        return;
    }

    try {
        const logsResp = await fetchWithAdminToken(`${API_BASE}/api/admin/conversations`);
        const logs = await logsResp.json();
        const tbody = document.querySelector('#logTable tbody');
        tbody.innerHTML = logs.map(l => `
            <tr>
                <td>${escapeHtml(formatLocalTime(l.timestamp))}</td>
                <td>${escapeHtml(l.username || l.user_id)}</td>
                <td>${escapeHtml(l.session_id)}</td>
                <td>${escapeHtml(l.user_message)}</td>
                <td>${escapeHtml(l.ai_reply)}</td>
            </tr>
        `).join('');
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') {
            // 已由 fetchWithAdminToken 处理
            return;
        }
        console.error(e);
        showToast('加载对话记录失败', 'error');
    }

    if (adminAccessDenied) return;

    try {
        const faqsResp = await fetchWithAdminToken(`${API_BASE}/api/admin/faqs`);
        const faqs = await faqsResp.json();
        const faqBody = document.querySelector('#faqTable tbody');
        faqBody.innerHTML = faqs.map(f => `
            <tr>
                <td>${escapeHtml(f.question)}</td>
                <td>${escapeHtml(f.answer)}</td>
                <td><button class="delete-btn" onclick="deleteFaq('${f.question.replace(/'/g, "\\'")}')">删除</button></td>
            </tr>
        `).join('');
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('加载FAQ失败', 'error');
    }

    await loadProductManagement();
    await loadAdminOrders();
}

window.deleteFaq = async function(question) {
    if (adminAccessDenied) return;
    try {
        await fetchWithAdminToken(`${API_BASE}/api/admin/faqs?question=${encodeURIComponent(question)}`, { method: 'DELETE' });
        loadAdminData();
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('删除失败', 'error');
    }
};

window.addFaq = async function() {
    if (adminAccessDenied) return;
    const q = document.getElementById('faqQ').value.trim();
    const a = document.getElementById('faqA').value.trim();
    if (!q || !a) return;
    try {
        await fetchWithAdminToken(`${API_BASE}/api/admin/faqs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q, answer: a })
        });
        document.getElementById('faqQ').value = '';
        document.getElementById('faqA').value = '';
        loadAdminData();
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('添加失败', 'error');
    }
};

// ==================== 页面切换 ====================
function switchTab(tabId) {
    const chatMain = document.getElementById('chatMain');
    const shopView = document.getElementById('shopView');
    const ordersView = document.getElementById('ordersView');
    const adminView = document.getElementById('adminView');
    const tabs = document.querySelectorAll('.tab');

    chatMain.classList.add('hidden');
    shopView.classList.add('hidden');
    ordersView.classList.add('hidden');
    adminView.classList.add('hidden');

    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (tabId === 'chat') {
        chatMain.classList.remove('hidden');
    } else if (tabId === 'shop') {
        shopView.classList.remove('hidden');
        loadProducts();
    } else if (tabId === 'orders') {
        if (!requireLogin()) {
            switchTab('chat');
            return;
        }
        ordersView.classList.remove('hidden');
        loadOrders();
    } else if (tabId === 'admin') {
        // 先检查是否登录
        if (!requireLogin()) {
            switchTab('chat');
            return;
        }
        // 如果已经被拒绝，直接提示并跳转
        if (adminAccessDenied) {
            showToast('用户权限不够无法访问', 'error');
            goToChat();
            return;
        }
        // 否则尝试加载后台数据
        adminView.classList.remove('hidden');
        const tables = ['#logTable tbody', '#productTable tbody', '#adminOrderTable tbody', '#faqTable tbody'];
        tables.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.innerHTML = '<tr><td colspan="10" style="text-align:center;">加载中...</td></tr>';
        });
        loadAdminData().catch(err => console.error(err));
    }
}

// ==================== 订单查询 ====================
async function queryOrder() {
    const orderId = document.getElementById('orderIdInput').value.trim();
    if (!orderId) { document.getElementById('orderResult').innerHTML = '<span style="color:red;">请输入订单号</span>'; return; }
    document.getElementById('orderResult').innerHTML = '查询中...';
    try {
        const res = await fetch(`${API_BASE}/api/order?order_id=${orderId}`);
        const data = await res.json();
        if (data.error) document.getElementById('orderResult').innerHTML = `<span style="color:red;">${data.error}</span>`;
        else {
            let html = `<div><p><strong>订单号：</strong>${data.order_id}</p><p><strong>状态：</strong>${data.status}</p><p><strong>产品：</strong>${data.product}</p><p><strong>金额：</strong>${data.amount}</p>${data.tracking_no ? `<p><strong>运单号：</strong>${data.tracking_no}</p>` : ''}</div>`;
            document.getElementById('orderResult').innerHTML = html;
        }
    } catch(e) { document.getElementById('orderResult').innerHTML = '<span style="color:red;">查询失败</span>'; }
}

// ==================== 事件绑定 ====================
function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    else console.error(`元素 #${id} 不存在`);
}

function init() {
    updateUserUI();

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (newSessionBtn) newSessionBtn.addEventListener('click', newSession);
    if (historyBtn) historyBtn.addEventListener('click', showHistoryModal);
    if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
    if (logoutBtn) logoutBtn.addEventListener('click', () => { clearAuth(); location.reload(); });
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLoginModal);

    safeAddEventListener('closeHistoryBtn', 'click', closeHistoryModal);
    safeAddEventListener('closeOrderBtn', 'click', closeOrderModal);
    safeAddEventListener('queryOrderBtn', 'click', queryOrder);
    safeAddEventListener('doLoginBtn', 'click', handleLogin);
    safeAddEventListener('showRegisterBtn', 'click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });
    safeAddEventListener('doRegisterBtn', 'click', handleRegister);
    safeAddEventListener('backToLoginBtn', 'click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    });
    safeAddEventListener('addFaqBtn', 'click', window.addFaq);

    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => window.addNewProduct());
    } else {
        console.error('找不到 addProductBtn 元素');
    }

    // 添加管理员按钮事件（仅绑定一次）
    const addAdminBtn = document.getElementById('addAdminBtn');
    if (addAdminBtn && !addAdminBtn._listener) {
        addAdminBtn._listener = true;
        addAdminBtn.addEventListener('click', showAddAdminModal);
    }
    const closeAddAdminBtn = document.getElementById('closeAddAdminBtn');
    if (closeAddAdminBtn && !closeAddAdminBtn._listener) {
        closeAddAdminBtn._listener = true;
        closeAddAdminBtn.addEventListener('click', closeAddAdminModal);
    }
    const confirmAddAdminBtn = document.getElementById('confirmAddAdminBtn');
    if (confirmAddAdminBtn && !confirmAddAdminBtn._listener) {
        confirmAddAdminBtn._listener = true;
        confirmAddAdminBtn.addEventListener('click', confirmAddAdmin);
    }

    // 折叠按钮事件（仅绑定一次）
    const toggleBtn = document.getElementById('toggleLogBtn');
    if (toggleBtn && !toggleBtn._listener) {
        toggleBtn._listener = true;
        toggleBtn.addEventListener('click', function() {
            const container = document.getElementById('logContainer');
            const arrow = document.getElementById('logArrow');
            container.classList.toggle('hidden');
            arrow.classList.toggle('fa-chevron-down');
            arrow.classList.toggle('fa-chevron-right');
        });
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.getAttribute('data-msg');
            if (msg === '订单查询') { showOrderModal(); return; }
            userInput.value = msg;
            sendMessage();
        });
    });

    userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    userInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });

    sendWelcomeMessage();
    window.onclick = function(event) {
        if (event.target === historyModal) closeHistoryModal();
        if (event.target === orderModal) closeOrderModal();
        if (event.target === loginModal) closeLoginModal();
        if (event.target === document.getElementById('addAdminModal')) closeAddAdminModal();
    };
}

document.addEventListener('DOMContentLoaded', init);
