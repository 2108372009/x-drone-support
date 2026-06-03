const API_BASE = '';
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);
}
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
}
let loadingElement = null;

const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const newSessionBtn = document.getElementById('newSessionBtn');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const orderModal = document.getElementById('orderModal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const closeOrderBtn = document.getElementById('closeOrderBtn');
const queryOrderBtn = document.getElementById('queryOrderBtn');
const orderIdInput = document.getElementById('orderIdInput');
const orderResult = document.getElementById('orderResult');

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatLocalTime(utcString) {
    if (!utcString) return '';
    const [datePart, timePart] = utcString.split(' ');
    if (!datePart || !timePart) return utcString;
    const [year, month, day] = datePart.split('-');
    const [hours, minutes, seconds] = timePart.split(':');
    const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month)-1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds)));
    if (isNaN(utcDate.getTime())) return utcString;
    const y = utcDate.getFullYear();
    const m = String(utcDate.getMonth() + 1).padStart(2, '0');
    const d = String(utcDate.getDate()).padStart(2, '0');
    const h = String(utcDate.getHours()).padStart(2, '0');
    const mi = String(utcDate.getMinutes()).padStart(2, '0');
    const s = String(utcDate.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${mi}:${s}`;
}

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

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
        if (thumbsUp) thumbsUp.addEventListener('click', () => alert('感谢您的认可！'));
        if (thumbsDown) thumbsDown.addEventListener('click', () => alert('很抱歉没能帮到您，我们会努力改进。'));
    }
}

function showTypingIndicator() {
    if (loadingElement) removeTypingIndicator();
    const div = document.createElement('div');
    div.className = 'message ai';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="avatar"><i class="fas fa-robot"></i></div>
        <div class="bubble">
            <div class="loading-indicator">
                <span class="dot-floating"></span>
                <span>正在输入</span>
            </div>
        </div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    loadingElement = div;
}

function removeTypingIndicator() {
    if (loadingElement && loadingElement.parentNode) {
        loadingElement.remove();
        loadingElement = null;
    }
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
            body: JSON.stringify({ user_id: userId, session_id: sessionId, message: msg })
        });
        const data = await res.json();
        removeTypingIndicator();
        let reply = data.response || data.detail || "抱歉，我暂时无法回答，请稍后再试。";
        addMessage('ai', reply, false);
    } catch (err) {
        removeTypingIndicator();
        addMessage('ai', '网络错误，请稍后再试。', false);
    }
}

function initQuickButtons() {
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.getAttribute('data-msg');
            if (msg === '订单查询') {
                showOrderModal();
                return;
            }
            userInput.value = msg;
            sendMessage();
        });
    });
}

function newSession() {
    localStorage.removeItem('sessionId');
    location.reload();
}

function sendWelcomeMessage() {
    if (chatBox.children.length > 0) return;
    const welcomeMsg = `亲，您好！我是X-Drone售后专家小智 🤖。请问您遇到什么问题了？例如：
• 产品参数与价格
• 故障代码排查
• 保修政策与X-Care
• 飞行安全建议
• 开箱与物流问题
我会尽力帮您解答～`;
    addMessage('ai', welcomeMsg, false);
}

function getAdminToken() {
    return sessionStorage.getItem('admin_token');
}
function setAdminToken(token) {
    sessionStorage.setItem('admin_token', token);
}
async function fetchWithAdminToken(url, options = {}) {
    let token = getAdminToken();
    if (!token) {
        const pwd = prompt("请输入管理员密码：");
        if (pwd === "1234") {
            setAdminToken(pwd);
            token = pwd;
        } else {
            alert("权限不够，拒绝访问！");
            throw new Error("Unauthorized");
        }
    }
    const headers = { ...options.headers, 'X-Admin-Token': token };
    return fetch(url, { ...options, headers });
}

async function loadAdminData() {
    try {
        const logsResp = await fetchWithAdminToken(`${API_BASE}/api/admin/conversations`);
        if (!logsResp.ok) throw new Error();
        const logs = await logsResp.json();
        const tbody = document.querySelector('#logTable tbody');
        tbody.innerHTML = logs.map(l => `
            <tr><td>${escapeHtml(formatLocalTime(l.timestamp))}</td><td>${escapeHtml(l.user_id)}</td><td>${escapeHtml(l.session_id)}</td><td>${escapeHtml(l.user_message)}</td><td>${escapeHtml(l.ai_reply)}</td></tr>
        `).join('');
    } catch(e) { alert("加载对话记录失败，请检查权限"); }
    try {
        const faqsResp = await fetchWithAdminToken(`${API_BASE}/api/admin/faqs`);
        const faqs = await faqsResp.json();
        const faqBody = document.querySelector('#faqTable tbody');
        faqBody.innerHTML = faqs.map(f => `
            <tr><td>${escapeHtml(f.question)}</td><td>${escapeHtml(f.answer)}</td><td><button class="delete-btn" onclick="deleteFaq('${f.question.replace(/'/g, "\\'")}')">删除</button></td></tr>
        `).join('');
    } catch(e) { alert("加载FAQ失败"); }
}

window.addFaq = async function() {
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
    } catch(e) { alert("添加失败，权限不足"); }
};

window.deleteFaq = async function(question) {
    try {
        await fetchWithAdminToken(`${API_BASE}/api/admin/faqs?question=${encodeURIComponent(question)}`, { method: 'DELETE' });
        loadAdminData();
    } catch(e) { alert("删除失败"); }
};

function switchTab(tabId) {
    const chatMain = document.getElementById('chatMain');
    const adminView = document.getElementById('adminView');
    const tabs = document.querySelectorAll('.tab');
    if (tabId === 'chat') {
        chatMain.classList.remove('hidden');
        adminView.classList.add('hidden');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else if (tabId === 'admin') {
        let token = getAdminToken();
        if (!token) {
            const pwd = prompt("请输入管理员密码：");
            if (pwd === "1234") {
                setAdminToken(pwd);
            } else {
                alert("权限不够，拒绝访问！");
                return;
            }
        }
        chatMain.classList.add('hidden');
        adminView.classList.remove('hidden');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        loadAdminData();
    }
}

async function showHistoryModal() {
    const bodyDiv = document.getElementById('historyModalBody');
    bodyDiv.innerHTML = '<div style="text-align:center; padding:20px;">加载中...</div>';
    historyModal.style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE}/api/history?user_id=${encodeURIComponent(userId)}`);
        const history = await res.json();
        if (!history.length) {
            bodyDiv.innerHTML = '<div style="text-align:center; padding:20px;">暂无历史记录，快去和小智聊聊天吧～</div>';
            return;
        }
        let html = '';
        for (let item of history) {
            html += `
                <div class="history-item">
                    <div class="history-time">📅 ${formatLocalTime(item.timestamp.replace('T', ' ').replace(/\.\d+Z?$/, ''))}</div>
                    <div class="history-q"><strong>👤 问：</strong>${escapeHtml(item.user_message)}</div>
                    <div class="history-a"><strong>🤖 答：</strong>${escapeHtml(item.ai_reply)}</div>
                </div>
            `;
        }
        bodyDiv.innerHTML = html;
    } catch (err) {
        bodyDiv.innerHTML = '<div style="text-align:center; padding:20px; color:red;">加载失败，请稍后再试。</div>';
    }
}
function closeHistoryModal() { historyModal.style.display = 'none'; }
function showOrderModal() {
    orderModal.style.display = 'flex';
    orderIdInput.value = '';
    orderResult.innerHTML = '';
}
function closeOrderModal() { orderModal.style.display = 'none'; }
async function queryOrder() {
    const orderId = orderIdInput.value.trim();
    if (!orderId) {
        orderResult.innerHTML = '<span style="color:red;">请输入订单号</span>';
        return;
    }
    orderResult.innerHTML = '查询中...';
    try {
        const res = await fetch(`${API_BASE}/api/order?order_id=${encodeURIComponent(orderId)}`);
        const data = await res.json();
        if (data.error) {
            orderResult.innerHTML = `<span style="color:red;">${data.error}</span>`;
        } else {
            let html = `<div style="background:#f8f9fa; padding:12px; border-radius:12px;">`;
            html += `<p><strong>订单号：</strong>${data.order_id}</p>`;
            html += `<p><strong>状态：</strong>${data.status}</p>`;
            html += `<p><strong>产品：</strong>${data.product}</p>`;
            html += `<p><strong>金额：</strong>${data.amount}</p>`;
            if (data.tracking_no) html += `<p><strong>运单号：</strong>${data.tracking_no}</p>`;
            if (data.logistics) html += `<p><strong>物流公司：</strong>${data.logistics}</p>`;
            html += `</div>`;
            orderResult.innerHTML = html;
        }
    } catch (err) {
        orderResult.innerHTML = '<span style="color:red;">查询失败，请稍后再试</span>';
    }
}

function init() {
    sendBtn.addEventListener('click', sendMessage);
    newSessionBtn.addEventListener('click', newSession);
    historyBtn.addEventListener('click', showHistoryModal);
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryModal);
    if (closeOrderBtn) closeOrderBtn.addEventListener('click', closeOrderModal);
    if (queryOrderBtn) queryOrderBtn.addEventListener('click', queryOrder);
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });
    const addFaqBtn = document.getElementById('addFaqBtn');
    if (addFaqBtn) addFaqBtn.addEventListener('click', window.addFaq);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    initQuickButtons();
    sendWelcomeMessage();
    window.onclick = function(event) {
        if (event.target === historyModal) closeHistoryModal();
        if (event.target === orderModal) closeOrderModal();
    };
}

document.addEventListener('DOMContentLoaded', init);