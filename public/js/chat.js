let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
}

let currentTypingController = null;

const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const newSessionBtn = document.getElementById('newSessionBtn');
const historyBtn = document.getElementById('historyBtn');

const historyModal = document.getElementById('historyModal');

function typeMessage(element, text, speed = 30) {
    if (currentTypingController) {
        currentTypingController.cancel();
    }

    let isCancelled = false;
    let index = 0;

    const controller = {
        cancel: function() {
            isCancelled = true;
        }
    };

    currentTypingController = controller;

    return new Promise((resolve) => {
        element.innerHTML = '<span class="typing-cursor"></span>';
        const cursor = element.querySelector('.typing-cursor');

        function typeNext() {
            if (isCancelled) {
                element.innerHTML = escapeHtml(text);
                currentTypingController = null;
                resolve();
                return;
            }

            if (index < text.length) {
                const textNode = document.createTextNode(text[index]);
                element.insertBefore(textNode, cursor);
                index++;
                chatBox.scrollTop = chatBox.scrollHeight;
                setTimeout(typeNext, speed);
            } else {
                cursor.remove();
                currentTypingController = null;
                resolve();
            }
        }

        setTimeout(typeNext, speed);
    });
}

function cancelTyping() {
    if (currentTypingController) {
        currentTypingController.cancel();
        currentTypingController = null;
    }
}

async function addMessage(role, text, isUser = false, useTypingEffect = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'} ${isUser ? 'slide-in-right' : 'slide-in-left'}`;
    const avatar = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    const time = getCurrentTime();
    
    if (isUser || !useTypingEffect) {
        messageDiv.innerHTML = `
            <div class="avatar">${avatar}</div>
            <div class="bubble">
                <span class="message-text">${escapeHtml(text)}</span>
                <div class="message-meta">
                    <span class="message-time">${time}</span>
                    ${!isUser ? '<span class="read-receipt"><i class="fas fa-check-double"></i></span>' : ''}
                </div>
                ${!isUser ? `<div class="feedback-buttons"><i class="far fa-thumbs-up"></i><i class="far fa-thumbs-down"></i></div>` : ''}
            </div>
        `;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    } else {
        messageDiv.innerHTML = `
            <div class="avatar">${avatar}</div>
            <div class="bubble">
                <span class="message-text"></span>
                <div class="message-meta" style="display: none;">
                    <span class="message-time">${time}</span>
                    <span class="read-receipt"><i class="fas fa-check-double"></i></span>
                </div>
                <div class="feedback-buttons" style="display: none;"><i class="far fa-thumbs-up"></i><i class="far fa-thumbs-down"></i></div>
            </div>
        `;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        const textElement = messageDiv.querySelector('.message-text');
        await typeMessage(textElement, text, 30);
        
        const metaDiv = messageDiv.querySelector('.message-meta');
        const feedbackDiv = messageDiv.querySelector('.feedback-buttons');
        if (metaDiv) metaDiv.style.display = 'flex';
        if (feedbackDiv) feedbackDiv.style.display = 'flex';
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
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

async function sendMessage() {
    const btn = document.getElementById('sendBtn');
    let msg = userInput.value.trim();
    if (!msg) return;
    
    cancelTyping();
    
    if (chatBox.querySelector('.chat-empty-state')) {
        chatBox.innerHTML = '';
    }
    
    addMessage('user', msg, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    showTypingIndicator();
    
    if (typeof adminDataCache !== 'undefined') {
        adminDataCache.dirty = true;
    }
    
    setButtonLoading(btn, true, '发送中...');
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
                addMessage('ai', errData.detail || '操作过于频繁，请稍后再试。', false, true);
            } else {
                const errData = await res.json();
                addMessage('ai', errData.detail || '请求失败，请重试。', false, true);
            }
            return;
        }
        const data = await res.json();
        removeTypingIndicator();
        let reply = data.response || data.detail || "抱歉，我暂时无法回答。";
        addMessage('ai', reply, false, true);
    } catch (err) {
        removeTypingIndicator();
        addMessage('ai', '网络错误，请检查网络连接后重试。', false, true);
    }
    finally { setButtonLoading(btn, false); }
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

function sendQuickTip(msg) {
    userInput.value = msg;
    sendMessage();
}
