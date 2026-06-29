let productsCache = null;
let ordersCache = null;

const orderModal = document.getElementById('orderModal');

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
        
        container.innerHTML = products.map((p, index) => `
            <div class="product-card card-hover ${animationClass}" ${!hasCache ? `style="animation-delay: ${index * 0.05}s;"` : ''}>
                <h4>${escapeHtml(p.name)}</h4>
                <p>${escapeHtml(p.description)}</p>
                <div class="price">${p.price}</div>
                <div class="stock ${p.stock === 0 ? 'stock-out' : ''}">${p.stock === 0 ? '暂时缺货，补货中' : '库存: ' + p.stock}</div>
                <div class="buy-action">
                    <input type="number" min="1" max="${p.stock}" value="1" id="qty-${p.id}" ${p.stock===0?'disabled':''}>
                    <button class="buy-btn btn-ripple" data-id="${p.id}" ${p.stock===0?'disabled':''}>${p.stock === 0 ? '缺货' : '购买'}</button>
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
        
        // 减弱订单列表动画效果
        const animationClass = hasCache ? '' : 'fade-in-up';
        
        container.innerHTML = orders.map((o, index) => {
            const dateStr = o.created_at || '时间未知';
            const orderId = o.id || o.order_id || '';
            return `
                <div class="order-item card-hover ${animationClass}" ${!hasCache ? `style="animation-delay: ${index * 0.03}s;"` : ''} data-order-id="${escapeHtml(orderId)}">
                    <div class="order-id-row copy-order-row" title="点击复制订单号">
                        <span class="order-id-label">订单号：</span>
                        <span class="order-id-text">${escapeHtml(orderId)}</span>
                        <i class="far fa-copy copy-icon"></i>
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

function showOrderModal() { orderModal.style.display = 'flex'; document.getElementById('orderIdInput').value = ''; document.getElementById('orderResult').innerHTML = ''; }
function closeOrderModal() { orderModal.style.display = 'none'; }

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

// 事件委托：订单复制按钮 - 简化逻辑，任何点击都触发复制
document.addEventListener('click', function(e) {
    const copyRow = e.target.closest('.copy-order-row');
    if (copyRow) {
        const orderItem = copyRow.closest('.order-item');
        if (orderItem) {
            const orderId = orderItem.getAttribute('data-order-id');
            if (orderId) {
                copyToClipboard(orderId, copyRow);
            }
        }
    }
});
