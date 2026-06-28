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
const registerSuccessModal = document.getElementById('registerSuccessModal');
const registerSuccessConfirmBtn = document.getElementById('registerSuccessConfirmBtn');

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

function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('已复制到剪贴板', 'success');
        } catch (e) {
            showToast('复制失败，请手动复制', 'error');
        }
        document.body.removeChild(textarea);
    });
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
    messageDiv.className = `message ${isUser ? 'user' : 'ai'} ${isUser ? 'slide-in-right' : 'slide-in-left'}`;
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
    
    if (chatBox.querySelector('.chat-empty-state')) {
        chatBox.innerHTML = '';
    }
    
    addMessage('user', msg, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    showTypingIndicator();
    
    // 标记后台数据需要刷新（下次进入后台时刷新）
    adminDataCache.dirty = true;
    
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
    chatBox.innerHTML = createChatEmptyState();
    chatBox.scrollTop = chatBox.scrollHeight;
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
        
        const hasCache = productsCache !== null;
        productsCache = products;
        
        if (!products.length) {
            container.innerHTML = createEmptyState(
                '📦',
                '暂无商品',
                '商城还没有上架商品，敬请期待～',
                '去问问小智',
                "switchTab('chat')"
            );
            return;
        }
        
        const animationClass = hasCache ? '' : 'stagger-item fade-in-up';
        const animationDelay = hasCache ? '' : 'style="animation-delay: ${index * 0.05}s;"';
        
        container.innerHTML = products.map((p, index) => `
            <div class="product-card card-hover ${animationClass}" ${!hasCache ? `style="animation-delay: ${index * 0.05}s;"` : ''}>
                <h4>${escapeHtml(p.name)}</h4>
                <p>${escapeHtml(p.description)}</p>
                <div class="price">${p.price}</div>
                <div class="stock">库存: ${p.stock}</div>
                <div class="buy-action">
                    <input type="number" min="1" max="${p.stock}" value="1" id="qty-${p.id}" ${p.stock===0?'disabled':''}>
                    <button class="buy-btn btn-ripple" data-id="${p.id}" ${p.stock===0?'disabled':''}>购买</button>
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
    } catch(e) { 
        console.error(e); 
        const container = document.getElementById('productList');
        if (container && !productsCache) {
            container.innerHTML = createEmptyState(
                '😢',
                '加载失败',
                '商品数据加载失败，请检查网络连接后重试～',
                '重新加载',
                'loadProducts()'
            );
        }
    }
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
        document.getElementById('ordersList').innerHTML = createEmptyState(
            '🔒',
            '请先登录',
            '登录后即可查看您的订单记录～',
            '去登录',
            'showLoginModal()'
        );
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/shop/orders`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (!res.ok) throw new Error('加载失败');
        const orders = await res.json();
        const container = document.getElementById('ordersList');
        
        const hasCache = ordersCache !== null;
        ordersCache = orders;
        
        if (!orders.length) { 
            container.innerHTML = createEmptyState(
                '🛒',
                '暂无订单',
                '您还没有任何订单，快去商城选购心仪的商品吧～',
                '去逛逛',
                "switchTab('shop')"
            );
            return; 
        }
        
        const animationClass = hasCache ? '' : 'stagger-item fade-in-up';
        
        container.innerHTML = orders.map((o, index) => {
            const dateStr = o.created_at || '时间未知';
            const orderId = o.id || o.order_id || '';
            return `
                <div class="order-item card-hover ${animationClass}" ${!hasCache ? `style="animation-delay: ${index * 0.08}s;"` : ''}>
                    <div class="order-id-row">
                        <span class="order-id-label">订单号：</span>
                        <span class="order-id-text" title="点击复制" onclick="copyToClipboard('${orderId}')">${escapeHtml(orderId)}</span>
                        <i class="far fa-copy copy-icon" title="点击复制" onclick="copyToClipboard('${orderId}')"></i>
                    </div>
                    <div><strong>${escapeHtml(o.product_name)}</strong> × ${o.quantity}</div>
                    <div>总价 ${o.total_price}</div>
                    <div>状态：<span class="order-status ${o.status}">${escapeHtml(o.status)}</span></div>
                    <div>${dateStr}</div>
                    ${o.status !== '已取消' ? `<button class="btn-ripple" onclick="cancelOrder('${o.id}')">取消订单</button>` : ''}
                </div>
            `;
        }).join('');
    } catch(e) { 
        console.error(e); 
        if (!ordersCache) {
            document.getElementById('ordersList').innerHTML = createEmptyState(
                '😢',
                '加载失败',
                '订单数据加载失败，请检查网络连接后重试～',
                '重新加载',
                'loadOrders()'
            );
        }
    }
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
            setTimeout(() => showToast('登录成功！欢迎回来，' + data.username, 'success'), 150);
        } else {
            const err = await res.json();
            showToast('登录失败：' + (err.detail || '用户名或密码错误'), 'error');
        }
    } catch(e) { showToast('网络错误，请检查网络连接', 'error'); }
}

// ==================== 表单验证函数 ====================

// 用户名检查状态
let usernameCheckTimeout = null;
let usernameAvailable = null;

// 密码强度检查
function checkPasswordStrength(password) {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const reqLength = document.getElementById('reqLength');
    const reqLetter = document.getElementById('reqLetter');
    const reqNumber = document.getElementById('reqNumber');
    
    const checks = {
        length: password.length >= 6 && password.length <= 20,
        letter: /[a-zA-Z]/.test(password),
        number: /\d/.test(password)
    };
    
    // 更新要求清单
    const isEmpty = password.length === 0;
    
    reqLength.className = 'requirement ' + (isEmpty ? '' : (checks.length ? 'met' : 'unmet'));
    reqLength.querySelector('i').className = isEmpty ? 'far fa-circle' : (checks.length ? 'fas fa-check-circle' : 'fas fa-times-circle');
    
    reqLetter.className = 'requirement ' + (isEmpty ? '' : (checks.letter ? 'met' : 'unmet'));
    reqLetter.querySelector('i').className = isEmpty ? 'far fa-circle' : (checks.letter ? 'fas fa-check-circle' : 'fas fa-times-circle');
    
    reqNumber.className = 'requirement ' + (isEmpty ? '' : (checks.number ? 'met' : 'unmet'));
    reqNumber.querySelector('i').className = isEmpty ? 'far fa-circle' : (checks.number ? 'fas fa-check-circle' : 'fas fa-times-circle');
    
    // 计算强度
    const passedChecks = Object.values(checks).filter(Boolean).length;
    let strength = '';
    let level = '';
    
    if (password.length === 0) {
        strengthFill.className = 'strength-fill';
        strengthText.className = 'strength-text';
        strengthText.textContent = '';
        return { passed: false, level: '' };
    } else if (passedChecks === 1) {
        strength = '弱';
        level = 'weak';
    } else if (passedChecks === 2) {
        strength = '中等';
        level = 'medium';
    } else if (passedChecks === 3) {
        strength = '强';
        level = 'strong';
    }
    
    strengthFill.className = 'strength-fill ' + level;
    strengthText.className = 'strength-text ' + level;
    strengthText.textContent = password.length > 0 ? '强度：' + strength : '';
    
    return { passed: passedChecks === 3, level };
}

// 用户名实时检查
function checkUsernameAvailability(username) {
    const input = document.getElementById('regUsername');
    const feedback = document.getElementById('usernameFeedback');
    
    // 清除之前的检查
    if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout);
    
    // 清除状态
    input.classList.remove('valid', 'invalid', 'checking');
    feedback.classList.remove('show', 'success', 'error', 'loading');
    feedback.innerHTML = '';
    usernameAvailable = null;
    
    // 验证格式
    if (!username) return;
    
    if (username.length < 3) {
        input.classList.add('invalid');
        feedback.className = 'field-feedback show error';
        feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 用户名至少需要3个字符';
        usernameAvailable = false;
        return;
    }
    
    if (username.length > 20) {
        input.classList.add('invalid');
        feedback.className = 'field-feedback show error';
        feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 用户名最多20个字符';
        usernameAvailable = false;
        return;
    }
    
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(username)) {
        input.classList.add('invalid');
        feedback.className = 'field-feedback show error';
        feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 只能包含中文、字母、数字和下划线';
        usernameAvailable = false;
        return;
    }
    
    // 格式正确，开始检查可用性
    input.classList.add('checking');
    feedback.className = 'field-feedback show loading';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
    
    // 防抖：300ms后再检查
    usernameCheckTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/check-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            
            const data = await res.json();
            
            if (data.available) {
                input.classList.remove('checking');
                input.classList.add('valid');
                feedback.className = 'field-feedback show success';
                feedback.innerHTML = '<i class="fas fa-check-circle"></i> ✓ 用户名可用';
                usernameAvailable = true;
            } else {
                input.classList.remove('checking');
                input.classList.add('invalid');
                feedback.className = 'field-feedback show error';
                feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 该昵称已被占用，换一个试试呢～';
                usernameAvailable = false;
            }
        } catch (error) {
            console.error('Username check failed:', error);
            // 网络错误时不清除检查状态
            input.classList.remove('checking');
        }
    }, 300);
}

// 确认密码实时检查
function checkConfirmPassword() {
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    const input = document.getElementById('regConfirmPassword');
    const feedback = document.getElementById('confirmPasswordFeedback');
    
    if (!confirm) {
        input.classList.remove('valid', 'invalid');
        feedback.classList.remove('show');
        feedback.innerHTML = '';
        return false;
    }
    
    if (confirm === password && password.length >= 6) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        feedback.className = 'field-feedback show success';
        feedback.innerHTML = '<i class="fas fa-check-circle"></i> ✓ 密码一致';
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        feedback.className = 'field-feedback show error';
        if (password.length < 6) {
            feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 请先设置符合要求的密码';
        } else {
            feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 两次密码不一致';
        }
        return false;
    }
}

// 检查注册表单是否全部通过
function isRegisterFormValid() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    
    const passwordValid = password.length >= 6 && password.length <= 20 &&
                         /[a-zA-Z]/.test(password) && /\d/.test(password);
    const passwordsMatch = password === confirm && confirm.length > 0;
    
    return username.length >= 3 && username.length <= 20 &&
           /^[a-zA-Z0-9_]+$/.test(username) &&
           usernameAvailable === true &&
           passwordValid && passwordsMatch;
}

let registerValidationInited = false;

// 初始化注册表单验证事件
function initRegisterValidation() {
    if (registerValidationInited) return;
    
    const usernameInput = document.getElementById('regUsername');
    const passwordInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    
    // 用户名实时检查
    usernameInput.addEventListener('input', (e) => {
        checkUsernameAvailability(e.target.value.trim());
    });
    
    usernameInput.addEventListener('blur', (e) => {
        // 失去焦点时如果未检查则检查一次
        if (!usernameAvailable && e.target.value.trim()) {
            checkUsernameAvailability(e.target.value.trim());
        }
    });
    
    // 密码实时检查
    passwordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
        // 如果确认密码已有值，也更新确认状态
        if (confirmInput.value) {
            checkConfirmPassword();
        }
    });
    
    // 确认密码实时检查
    confirmInput.addEventListener('input', () => {
        checkConfirmPassword();
    });
    
    registerValidationInited = true;
}

async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

    // 检查昵称长度
    if (!username) {
        showToast('请输入昵称', 'warning');
        return;
    }
    if (username.length < 2) {
        showToast('昵称太短了亲，至少需要2个字符哦～', 'warning');
        return;
    }
    if (username.length > 20) {
        showToast('昵称太长了亲，最多只能20个字符哦～', 'warning');
        return;
    }

    // 检查密码长度：6-20位（管理员密码可以更长）
    if (!password) {
        showToast('请输入密码', 'warning');
        return;
    }
    if (password.length < 6) {
        showToast('密码太短了亲，至少需要6位哦～', 'warning');
        return;
    }
    if (password.length > 20) {
        showToast('密码太长了亲，最多只能20位哦～', 'warning');
        return;
    }
    if (password !== confirm) {
        showToast('两次输入的密码不一致', 'warning');
        return;
    }

    // 密码必须包含字母和数字
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
        showToast('密码必须同时包含字母和数字', 'warning');
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
            // 显示注册成功模态弹窗
            registerSuccessModal.style.display = 'flex';
        } else {
            const err = await res.json();
            
            // 昵称重复（409状态码）- 显示友好的弹窗提示
            if (res.status === 409) {
                showDuplicateUsernameModal(username);
            } else {
                // 其他错误，显示toast提示
                showToast(err.detail || '注册失败，请重试', 'error');
            }
        }
    } catch(e) {
        showToast('网络错误，请稍后重试', 'error');
    }
}

// 昵称重复提示弹窗
function showDuplicateUsernameModal(suggestedUsername) {
    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'duplicateUsernameModal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    // 生成建议的昵称
    const suggestions = [
        suggestedUsername + '2024',
        suggestedUsername + '_flyer',
        suggestedUsername + '_pro',
        suggestedUsername + Math.floor(Math.random() * 999)
    ];
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center; border-radius: 24px; overflow: hidden;">
            <div style="padding: 30px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">😢</div>
                <h3 style="color: #1e3c72; margin-bottom: 16px; font-size: 1.4rem;">改昵称已被占用</h3>
                <p style="color: #64748b; margin-bottom: 24px; line-height: 1.6;">
                    亲，"<strong style="color: #dc2626;">${escapeHtml(suggestedUsername)}</strong>" 已经被其他小伙伴使用啦～<br>
                    换一个试试呢？
                </p>
                
                <div style="text-align: left; background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="color: #64748b; margin-bottom: 12px; font-size: 0.9rem;">试试这些建议：</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${suggestions.map(name => `
                            <button onclick="useSuggestedUsername('${escapeHtml(name)}')" 
                                    style="background: white; border: 2px solid #e2e8f0; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; color: #1e3c72; transition: all 0.2s;">
                                ${escapeHtml(name)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <button onclick="closeDuplicateModal()" 
                        style="background: #1e3c72; color: white; border: none; padding: 14px 40px; border-radius: 30px; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 12px rgba(30, 60, 114, 0.3);">
                    我知道了，自己想想 😊
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击弹窗外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDuplicateModal();
        }
    });
}

// 使用建议的昵称
window.useSuggestedUsername = function(username) {
    closeDuplicateModal();
    // 清空并填入建议的昵称
    document.getElementById('regUsername').value = username;
    // 自动触发注册
    showToast('已填入新昵称：' + username, 'success');
};

// 关闭昵称重复弹窗
function closeDuplicateModal() {
    const modal = document.getElementById('duplicateUsernameModal');
    if (modal) {
        modal.remove();
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
            // 更新缓存中的库存
            if (adminDataCache.products) {
                const product = adminDataCache.products.find(p => p.id === productId);
                if (product) product.stock = data.stock;
            }
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
            const data = await res.json();
            showToast('新产品上架成功', 'success');
            document.getElementById('newProdName').value = '';
            document.getElementById('newProdDesc').value = '';
            document.getElementById('newProdPrice').value = '';
            document.getElementById('newProdPriceYuan').value = '';
            document.getElementById('newProdStock').value = '';
            document.getElementById('newProdImage').value = '';
            // 强制刷新后台数据
            loadAdminData(true);
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
            // 从缓存中移除
            if (adminDataCache.products) {
                adminDataCache.products = adminDataCache.products.filter(p => p.id !== productId);
            }
            loadAdminData(true);
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
            // 更新缓存中的订单状态
            if (adminDataCache.orders && adminDataCache.orders.items) {
                const order = adminDataCache.orders.items.find(o => o.order_id === orderId);
                if (order) order.status = newStatus;
            }
            renderOrdersFromCache();
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

// ==================== 后台管理数据缓存 ====================
let adminDataCache = {
    logs: null,
    faqs: null,
    products: null,
    orders: null,
    loaded: false,
    logsPage: 1,
    ordersPage: 1
};

// ==================== 刷新后台数据 ====================
window.refreshAdminData = function() {
    if (adminAccessDenied) {
        showToast('无权限访问后台', 'error');
        return;
    }
    showToast('正在刷新数据...', 'warning');
    loadAdminData(true).then(() => {
        adminDataCache.dirty = false;
        showToast('数据已刷新', 'success');
    }).catch(err => {
        console.error(err);
        showToast('刷新失败', 'error');
    });
};

// ==================== 分页状态 ====================
let logsPage = 1;
let logsPageSize = 20;
let logsTotalPages = 1;

let adminOrdersPage = 1;
let adminOrdersPageSize = 20;
let adminOrdersTotalPages = 1;

// ==================== 分页导航渲染 ====================
function renderPagination(containerId, currentPage, totalPages, onPrev, onNext) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px; padding:12px; background:#f8fafc; border-radius:12px;">
            <button class="small" id="${containerId}-prev" ${currentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>⬅ 上一页</button>
            <span style="color:#475569;">第 ${currentPage} / ${totalPages} 页</span>
            <button class="small" id="${containerId}-next" ${currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>下一页 ➡</button>
        </div>
    `;
    const prevBtn = document.getElementById(`${containerId}-prev`);
    const nextBtn = document.getElementById(`${containerId}-next`);
    if (prevBtn && currentPage > 1) prevBtn.onclick = onPrev;
    if (nextBtn && currentPage < totalPages) nextBtn.onclick = onNext;
}

// ==================== 加载后台数据（带缓存） ====================
async function loadAdminData(forceReload = false) {
    if (adminAccessDenied) {
        goToChat();
        return;
    }

    // 如果已有缓存且不强制刷新，直接渲染缓存数据
    if (adminDataCache.loaded && !forceReload) {
        renderAdminDataFromCache();
        return;
    }
    
    // 如果有缓存但需要强制刷新（dirty状态），先渲染旧数据，再静默刷新
    if (adminDataCache.loaded && forceReload && adminDataCache.dirty) {
        renderAdminDataFromCache();
    }

    try {
        const logsResp = await fetchWithAdminToken(
            `${API_BASE}/api/admin/conversations?page=${logsPage}&page_size=${logsPageSize}`
        );
        const logsData = await logsResp.json();
        adminDataCache.logs = logsData;
        logsTotalPages = logsData.total_pages || 1;

        const faqsResp = await fetchWithAdminToken(`${API_BASE}/api/admin/faqs`);
        adminDataCache.faqs = await faqsResp.json();

        const productsResp = await fetchWithAdminToken(`${API_BASE}/api/admin/products`);
        adminDataCache.products = await productsResp.json();

        const ordersResp = await fetchWithAdminToken(
            `${API_BASE}/api/admin/orders?page=${adminOrdersPage}&page_size=${adminOrdersPageSize}`
        );
        adminDataCache.orders = await ordersResp.json();
        adminOrdersTotalPages = adminDataCache.orders.total_pages || 1;

        adminDataCache.loaded = true;
        renderAdminDataFromCache();
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') {
            return;
        }
        console.error(e);
        showToast('加载后台数据失败', 'error');
    }
}

// 从缓存渲染后台数据
function renderAdminDataFromCache() {
    // 渲染对话记录
    const logTbody = document.querySelector('#logTable tbody');
    const logsData = adminDataCache.logs;
    const logItems = logsData?.items || [];
    if (!logItems.length) {
        logTbody.innerHTML = '<tr><td colspan="5" style="padding: 40px 0; color: #94a3b8; text-align: center;">暂无对话记录</td></tr>';
    } else {
        logTbody.innerHTML = logItems.map((l, i) => `
            <tr style="animation-delay: ${i * 0.03}s;" class="fade-in-up">
                <td>${escapeHtml(formatLocalTime(l.timestamp))}</td>
                <td>${escapeHtml(l.username || l.user_id)}</td>
                <td>${escapeHtml(l.session_id)}</td>
                <td>${escapeHtml(l.user_message)}</td>
                <td>${escapeHtml(l.ai_reply)}</td>
            </tr>
        `).join('');
    }
    renderPagination(
        'logsPagination',
        logsPage,
        logsTotalPages,
        () => { 
            if (logsPage <= 1) return;
            logsPage--; 
            loadAdminData(true); 
        },
        () => { 
            if (logsPage >= logsTotalPages) return;
            logsPage++; 
            loadAdminData(true); 
        }
    );

    // 渲染FAQ
    const faqBody = document.querySelector('#faqTable tbody');
    const faqs = adminDataCache.faqs || [];
    if (!faqs.length) {
        faqBody.innerHTML = '<tr><td colspan="3" style="padding: 40px 0; color: #94a3b8; text-align: center;">暂无FAQ，请添加常用问题</td></tr>';
    } else {
        faqBody.innerHTML = faqs.map((f, i) => `
            <tr style="animation-delay: ${i * 0.03}s;" class="fade-in-up">
                <td>${escapeHtml(f.question)}</td>
                <td>${escapeHtml(f.answer)}</td>
                <td><button class="delete-btn btn-ripple" onclick="deleteFaq('${f.question.replace(/'/g, "\\'")}')">删除</button></td>
            </tr>
        `).join('');
    }

    // 渲染商品
    renderProductsFromCache();

    // 渲染订单
    renderOrdersFromCache();
}

function renderProductsFromCache() {
    const tbody = document.querySelector('#productTable tbody');
    const products = adminDataCache.products || [];
    if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 40px 0; color: #94a3b8; text-align: center;">暂无商品，请点击"上架新产品"添加</td></tr>';
        return;
    }
    tbody.innerHTML = products.map((p, i) => `
        <tr style="animation-delay: ${i * 0.03}s;" class="fade-in-up">
            <td>${escapeHtml(p.name)}</td>
            <td>${p.price}</td>
            <td id="stock-${p.id}">${p.stock}</td>
            <td>
                <button class="small btn-ripple" onclick="adjustStock('${p.id}', 1)">+1</button>
                <button class="small btn-ripple" onclick="adjustStock('${p.id}', -1)">-1</button>
                <button class="small btn-ripple" onclick="adjustStock('${p.id}', 10)">+10</button>
                <button class="small btn-ripple" onclick="adjustStock('${p.id}', -10)">-10</button>
                <button class="small btn-ripple" style="background:#dc3545; margin-left:8px;" onclick="deleteProduct('${p.id}')">下架</button>
              </td>
        </tr>
    `).join('');
}

function renderOrdersFromCache() {
    const tbody = document.querySelector('#adminOrderTable tbody');
    const ordersData = adminDataCache.orders || {};
    const items = ordersData.items || [];
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 40px 0; color: #94a3b8; text-align: center;">暂无订单</td></tr>';
    } else {
        tbody.innerHTML = items.map((o, i) => `
            <tr style="animation-delay: ${i * 0.03}s;" class="fade-in-up">
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
    }
    renderPagination(
        'ordersPagination',
        adminOrdersPage,
        adminOrdersTotalPages,
        () => { 
            if (adminOrdersPage <= 1) return;
            adminOrdersPage--; 
            loadAdminData(true); 
        },
        () => { 
            if (adminOrdersPage >= adminOrdersTotalPages) return;
            adminOrdersPage++; 
            loadAdminData(true); 
        }
    );
}

window.deleteFaq = async function(question) {
    if (adminAccessDenied) return;
    try {
        // 安全修复：改为POST body传递参数
        await fetchWithAdminToken(`${API_BASE}/api/admin/faqs`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })  // 使用body传递
        });
        // 从缓存中移除
        if (adminDataCache.faqs) {
            adminDataCache.faqs = adminDataCache.faqs.filter(f => f.question !== question);
        }
        renderAdminDataFromCache();
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
        // 强制刷新FAQ数据
        loadAdminData(true);
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('添加失败', 'error');
    }
};

// ==================== 骨架屏生成函数 ====================
function createChatSkeleton(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        const isUser = i % 2 === 1;
        html += `
            <div class="skeleton-message ${isUser ? 'user' : ''}">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-bubble">
                    <div class="skeleton skeleton-text ${i === 0 ? 'long' : isUser ? 'medium' : 'long'}"></div>
                    <div class="skeleton skeleton-text ${isUser ? 'short' : 'medium'}" style="margin-bottom: 0;"></div>
                </div>
            </div>
        `;
    }
    return html;
}

function createProductSkeleton(count = 6) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-product-card stagger-item fade-in-up">
                <div class="skeleton-product-image"></div>
                <div class="skeleton-product-title"></div>
                <div class="skeleton-product-desc"></div>
                <div class="skeleton-product-price"></div>
                <div class="skeleton-product-stock"></div>
                <div class="skeleton-product-button"></div>
            </div>
        `;
    }
    return html;
}

function createOrderSkeleton(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-order-item stagger-item fade-in-up">
                <div class="skeleton-order-line" style="width: 180px;"></div>
                <div class="skeleton-order-line" style="width: 80px;"></div>
                <div class="skeleton-order-line" style="width: 100px;"></div>
                <div class="skeleton-order-line" style="width: 120px;"></div>
                <div class="skeleton-order-line" style="width: 80px;"></div>
            </div>
        `;
    }
    return html;
}

function createTableSkeleton(colCount = 5, rowCount = 5) {
    let html = '';
    for (let i = 0; i < rowCount; i++) {
        html += `<tr class="skeleton-table-row">`;
        for (let j = 0; j < colCount; j++) {
            html += `<td></td>`;
        }
        html += `</tr>`;
    }
    return html;
}

// ==================== 空状态生成函数 ====================
function createEmptyState(icon, title, description, buttonText, buttonAction) {
    return `
        <div class="empty-state scale-in">
            <div class="empty-state-icon float">${icon}</div>
            <h3>${title}</h3>
            <p>${description}</p>
            ${buttonText ? `<button class="empty-state-btn" onclick="${buttonAction}">${buttonText}</button>` : ''}
        </div>
    `;
}

function createChatEmptyState() {
    return `
        <div class="chat-empty-state scale-in">
            <div class="bot-avatar-large float">
                <i class="fas fa-robot"></i>
            </div>
            <h3>你好，我是小智 👋</h3>
            <p>有什么可以帮您的吗？<br>直接输入您的问题，我会尽力为您解答～</p>
        </div>
    `;
}

function sendQuickTip(msg) {
    userInput.value = msg;
    sendMessage();
}

let productsCache = null;
let ordersCache = null;

// ==================== 动画工具函数 ====================
function animateListItems(containerSelector, animationClass = 'fade-in-up') {
    const items = document.querySelectorAll(`${containerSelector} > *`);
    items.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.animation = 'none';
        setTimeout(() => {
            item.style.animation = '';
            item.classList.add(animationClass);
            item.classList.add('stagger-item');
            item.style.animationDelay = `${index * 0.05}s`;
        }, 10);
    });
}

function addViewTransition(viewId) {
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.remove('view-transition');
        void view.offsetWidth;
        view.classList.add('view-transition');
    }
}

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
        addViewTransition('chatMain');
    } else if (tabId === 'shop') {
        shopView.classList.remove('hidden');
        addViewTransition('shopView');
        const productList = document.getElementById('productList');
        if (!productsCache && productList && productList.children.length === 0) {
            productList.innerHTML = createProductSkeleton(6);
        }
        loadProducts();
    } else if (tabId === 'orders') {
        if (!requireLogin()) {
            switchTab('chat');
            return;
        }
        ordersView.classList.remove('hidden');
        addViewTransition('ordersView');
        const ordersList = document.getElementById('ordersList');
        if (!ordersCache && ordersList && ordersList.children.length === 0) {
            ordersList.innerHTML = createOrderSkeleton(3);
        }
        loadOrders();
    } else if (tabId === 'admin') {
        if (!requireLogin()) {
            switchTab('chat');
            return;
        }
        if (adminAccessDenied) {
            showToast('用户权限不够无法访问', 'error');
            goToChat();
            return;
        }
        adminView.classList.remove('hidden');
        addViewTransition('adminView');
        
        const needRefresh = !adminDataCache.loaded || adminDataCache.dirty;
        
        if (!adminDataCache.loaded) {
            document.querySelector('#adminOrderTable tbody').innerHTML = createTableSkeleton(7, 5);
            document.querySelector('#productTable tbody').innerHTML = createTableSkeleton(4, 5);
            document.querySelector('#logTable tbody').innerHTML = createTableSkeleton(5, 5);
            document.querySelector('#faqTable tbody').innerHTML = createTableSkeleton(3, 5);
        }
        
        if (needRefresh) {
            loadAdminData(true).then(() => {
                adminDataCache.dirty = false;
            }).catch(err => console.error(err));
        } else {
            loadAdminData(false).catch(err => console.error(err));
        }
    }
}

// ==================== 订单查询 ====================
async function queryOrder() {
    const orderId = document.getElementById('orderIdInput').value.trim();
    const resultDiv = document.getElementById('orderResult');
    if (!orderId) { 
        resultDiv.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 20px;">请输入订单号</div>'; 
        return; 
    }
    resultDiv.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <p style="margin-top: 12px; color: #64748b;">查询中...</p>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    try {
        const res = await fetch(`${API_BASE}/api/shop/order/public/${encodeURIComponent(orderId)}`);
        if (!res.ok) {
            const errData = await res.json();
            resultDiv.innerHTML = `
                <div class="scale-in" style="text-align: center; padding: 30px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">😕</div>
                    <h4 style="color: #475569; margin-bottom: 8px;">未找到订单</h4>
                    <p style="color: #94a3b8; font-size: 0.9rem;">${errData.detail || '请检查订单号是否正确'}</p>
                </div>
            `;
            return;
        }
        const data = await res.json();
        resultDiv.innerHTML = `
            <div class="scale-in" style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-weight: 600; color: #1e293b;">订单详情</span>
                    <span class="order-status ${data.status}" style="padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">${data.status}</span>
                </div>
                <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">订单号</span>
                        <span style="font-weight: 500; color: #1e293b;">${data.order_id}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">商品名称</span>
                        <span style="font-weight: 500; color: #1e293b;">${data.product_name}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">数量</span>
                        <span style="font-weight: 500; color: #1e293b;">× ${data.quantity}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">总价</span>
                        <span style="font-weight: 600; color: #dc2626;">${data.total_price}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">下单时间</span>
                        <span style="color: #475569;">${data.created_at || '-'}</span>
                    </div>
                </div>
            </div>
        `;
    } catch(e) { 
        console.error(e);
        resultDiv.innerHTML = `
            <div class="scale-in" style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 12px;">😢</div>
                <h4 style="color: #475569; margin-bottom: 8px;">查询失败</h4>
                <p style="color: #94a3b8; font-size: 0.9rem;">网络错误，请稍后重试</p>
            </div>
        `;
    }
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

    // 注册成功弹窗确认按钮
    if (registerSuccessConfirmBtn) {
        registerSuccessConfirmBtn.addEventListener('click', () => {
            registerSuccessModal.style.display = 'none';
            // 切换到聊天界面
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.tab[data-tab="chat"]').classList.add('active');
            document.getElementById('chatMain').classList.remove('hidden');
            document.getElementById('shopView').classList.add('hidden');
            document.getElementById('ordersView').classList.add('hidden');
            document.getElementById('adminView').classList.add('hidden');
        });
    }

    safeAddEventListener('closeHistoryBtn', 'click', closeHistoryModal);
    safeAddEventListener('closeOrderBtn', 'click', closeOrderModal);
    safeAddEventListener('queryOrderBtn', 'click', queryOrder);
    const orderIdInput = document.getElementById('orderIdInput');
    if (orderIdInput) {
        orderIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') queryOrder();
        });
    }
    safeAddEventListener('doLoginBtn', 'click', handleLogin);
    safeAddEventListener('showRegisterBtn', 'click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        // 切换到注册表单时初始化验证
        initRegisterValidation();
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

    // 折叠按钮事件（平滑动画版本）
    const toggleLogBtn = document.getElementById('toggleLogBtn');
    if (toggleLogBtn && !toggleLogBtn._listener) {
        toggleLogBtn._listener = true;
        toggleLogBtn.addEventListener('click', function() {
            const container = document.getElementById('logContainer');
            const isCollapsed = container.classList.contains('collapsed');
            container.classList.toggle('collapsed');
            toggleLogBtn.classList.toggle('collapsed');
        });
    }
    
    // 确保对话记录初始折叠状态（兼容缓存）
    const logContainer = document.getElementById('logContainer');
    if (logContainer && !logContainer.classList.contains('collapsed')) {
        logContainer.classList.add('collapsed');
        if (toggleLogBtn) toggleLogBtn.classList.add('collapsed');
    }
    
    const toggleOrderBtn = document.getElementById('toggleOrderBtn');
    if (toggleOrderBtn && !toggleOrderBtn._listener) {
        toggleOrderBtn._listener = true;
        toggleOrderBtn.addEventListener('click', function() {
            const container = document.getElementById('orderContainer');
            const isCollapsed = container.classList.contains('collapsed');
            container.classList.toggle('collapsed');
            toggleOrderBtn.classList.toggle('collapsed');
        });
    }
    
    // 上架新产品折叠按钮
    const toggleNewProductBtn = document.getElementById('toggleNewProductBtn');
    if (toggleNewProductBtn && !toggleNewProductBtn._listener) {
        toggleNewProductBtn._listener = true;
        toggleNewProductBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const container = document.getElementById('newProductContainer');
            container.classList.toggle('collapsed');
            toggleNewProductBtn.classList.toggle('collapsed');
        });
    }
    
    // 确保上架新产品初始折叠状态
    const newProductContainer = document.getElementById('newProductContainer');
    if (newProductContainer && !newProductContainer.classList.contains('collapsed')) {
        newProductContainer.classList.add('collapsed');
        if (toggleNewProductBtn) toggleNewProductBtn.classList.add('collapsed');
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
