const API_BASE = '';

const closeLoginBtn = document.getElementById('closeLoginBtn');

function switchTab(tabId) {
    const chatMain = document.getElementById('chatMain');
    const shopView = document.getElementById('shopView');
    const ordersView = document.getElementById('ordersView');
    const adminView = document.getElementById('adminView');
    const tabs = document.querySelectorAll('.tab');
    const allViews = [chatMain, shopView, ordersView, adminView];

    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    let targetView = null;
    if (tabId === 'chat') {
        targetView = chatMain;
    } else if (tabId === 'shop') {
        targetView = shopView;
    } else if (tabId === 'orders') {
        if (!requireLogin()) {
            switchTab('chat');
            return;
        }
        targetView = ordersView;
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
        targetView = adminView;
    }

    if (!targetView) return;

    allViews.forEach(view => {
        if (view && view !== targetView) {
            view.classList.remove('visible');
        }
    });

    setTimeout(() => {
        allViews.forEach(view => {
            if (view && view !== targetView) {
                view.classList.add('hidden');
            }
        });

        targetView.classList.remove('hidden');
        targetView.classList.add('view-fade');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                targetView.classList.add('visible');
            });
        });

        if (tabId === 'shop') {
            const productList = document.getElementById('productList');
            if (!productsCache && productList && productList.children.length === 0) {
                productList.innerHTML = createProductSkeleton(6);
            }
            loadProducts();
        } else if (tabId === 'orders') {
            const ordersList = document.getElementById('ordersList');
            if (!ordersCache && ordersList && ordersList.children.length === 0) {
                ordersList.innerHTML = createOrderSkeleton(3);
            }
            loadOrders();
        } else if (tabId === 'admin') {
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
    }, 150);
}

function init() {
    const chatMain = document.getElementById('chatMain');
    const shopView = document.getElementById('shopView');
    const ordersView = document.getElementById('ordersView');
    const adminView = document.getElementById('adminView');
    
    [chatMain, shopView, ordersView, adminView].forEach(view => {
        if (view) view.classList.add('view-fade');
    });
    if (chatMain) chatMain.classList.add('visible');

    updateUserUI();

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (newSessionBtn) newSessionBtn.addEventListener('click', newSession);
    if (historyBtn) historyBtn.addEventListener('click', showHistoryModal);
    if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
    if (logoutBtn) logoutBtn.addEventListener('click', () => { clearAuth(); location.reload(); });
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLoginModal);

    if (registerSuccessConfirmBtn) {
        registerSuccessConfirmBtn.addEventListener('click', () => {
            registerSuccessModal.style.display = 'none';
            switchTab('chat');
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
