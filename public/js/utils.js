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

function setButtonLoading(btn, loading, loadingText = '处理中...') {
    if (!btn) return;
    if (loading) {
        if (btn.dataset.originalText === undefined) {
            btn.dataset.originalText = btn.innerHTML;
        }
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
        btn.style.opacity = '';
        btn.style.cursor = '';
        delete btn.dataset.originalText;
    }
}

function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}

function throttle(fn, delay = 300) {
    let last = 0;
    let timer = null;
    return function(...args) {
        const now = Date.now();
        const remaining = delay - (now - last);
        if (remaining <= 0) {
            if (timer) { clearTimeout(timer); timer = null; }
            last = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

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

function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    else console.error(`元素 #${id} 不存在`);
}
