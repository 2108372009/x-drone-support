let adminDataCache = {
    logs: null,
    faqs: null,
    products: null,
    orders: null,
    loaded: false,
    logsPage: 1,
    ordersPage: 1
};

let logsPage = 1;
let logsPageSize = 20;
let logsTotalPages = 1;

let adminOrdersPage = 1;
let adminOrdersPageSize = 20;
let adminOrdersTotalPages = 1;

async function fetchWithAdminToken(url, options = {}) {
    if (!currentToken) {
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
    if (!confirm('确定要下架并删除此商品吗？删除后无法恢复。')) return;
    try {
        const res = await fetchWithAdminToken(`${API_BASE}/api/admin/products/${productId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('商品已下架删除', 'success');
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

function showTableLoading(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const wrapper = table.parentElement;
    if (!wrapper) return;
    
    wrapper.classList.add('table-loading-overlay');
    
    let loadingContent = wrapper.querySelector('.table-loading-content');
    if (!loadingContent) {
        loadingContent = document.createElement('div');
        loadingContent.className = 'table-loading-content';
        loadingContent.innerHTML = `
            <div class="table-loading-spinner"></div>
            <div class="table-loading-text">加载中...</div>
        `;
        wrapper.appendChild(loadingContent);
    }
    loadingContent.style.display = 'flex';
}

function hideTableLoading(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const wrapper = table.parentElement;
    if (!wrapper) return;
    
    wrapper.classList.remove('table-loading-overlay');
    
    const loadingContent = wrapper.querySelector('.table-loading-content');
    if (loadingContent) {
        loadingContent.style.display = 'none';
    }
}

function scrollToTableTop(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const adminView = document.getElementById('adminView');
    if (adminView) {
        const tableRect = table.getBoundingClientRect();
        const adminViewRect = adminView.getBoundingClientRect();
        const relativeTop = tableRect.top - adminViewRect.top + adminView.scrollTop - 20;
        adminView.scrollTo({
            top: Math.max(0, relativeTop),
            behavior: 'smooth'
        });
    }
}

function renderPagination(containerId, currentPage, totalPages, onPrev, onNext) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="pagination-container">
            <button class="pagination-btn" id="${containerId}-prev" ${currentPage <= 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> 上一页
            </button>
            <div class="pagination-info">
                第 <span class="current-page">${currentPage}</span> / <span class="total-pages">${totalPages}</span> 页
            </div>
            <button class="pagination-btn" id="${containerId}-next" ${currentPage >= totalPages ? 'disabled' : ''}>
                下一页 <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
    const prevBtn = document.getElementById(`${containerId}-prev`);
    const nextBtn = document.getElementById(`${containerId}-next`);
    if (prevBtn && currentPage > 1) prevBtn.onclick = onPrev;
    if (nextBtn && currentPage < totalPages) nextBtn.onclick = onNext;
}

async function loadAdminData(forceReload = false) {
    if (adminAccessDenied) {
        goToChat();
        return;
    }

    if (adminDataCache.loaded && !forceReload) {
        renderAdminDataFromCache();
        return;
    }
    
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
        
        hideTableLoading('logTable');
        hideTableLoading('adminOrderTable');
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') {
            return;
        }
        console.error(e);
        showToast('加载后台数据失败', 'error');
        
        hideTableLoading('logTable');
        hideTableLoading('adminOrderTable');
    }
}

function renderAdminDataFromCache() {
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
            showTableLoading('logTable');
            scrollToTableTop('logTable');
            loadAdminData(true); 
        },
        () => { 
            if (logsPage >= logsTotalPages) return;
            logsPage++;
            showTableLoading('logTable');
            scrollToTableTop('logTable');
            loadAdminData(true); 
        }
    );

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

    renderProductsFromCache();

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
                <button class="small btn-ripple delete-btn" style="margin-left:8px;" onclick="deleteProduct('${p.id}')">下架</button>
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
            showTableLoading('adminOrderTable');
            scrollToTableTop('adminOrderTable');
            loadAdminData(true); 
        },
        () => { 
            if (adminOrdersPage >= adminOrdersTotalPages) return;
            adminOrdersPage++;
            showTableLoading('adminOrderTable');
            scrollToTableTop('adminOrderTable');
            loadAdminData(true); 
        }
    );
}

window.deleteFaq = async function(question) {
    if (adminAccessDenied) return;
    if (!confirm('确定要删除此FAQ吗？删除后无法恢复。')) return;
    try {
        await fetchWithAdminToken(`${API_BASE}/api/admin/faqs`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
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
        loadAdminData(true);
    } catch(e) {
        if (e.message === 'Forbidden' || e.message === 'NotLoggedIn') return;
        showToast('添加失败', 'error');
    }
};
