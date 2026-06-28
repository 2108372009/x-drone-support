let currentToken = localStorage.getItem('auth_token');
let currentUserId = localStorage.getItem('user_id');
let currentUsername = localStorage.getItem('username');

let adminAccessDenied = false;
let isAdminAlerting = false;

const loginModal = document.getElementById('loginModal');
const registerSuccessModal = document.getElementById('registerSuccessModal');
const registerSuccessConfirmBtn = document.getElementById('registerSuccessConfirmBtn');
const userNameSpan = document.getElementById('userNameDisplay');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

let usernameCheckTimeout = null;
let usernameAvailable = null;
let registerValidationInited = false;

function requireLogin() {
    if (!currentToken) {
        showToast('请先注册/登录账号再进行此操作', 'warning');
        showLoginModal();
        return false;
    }
    return true;
}

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

function goToChat() {
    const chatTab = document.querySelector('.tab[data-tab="chat"]');
    if (chatTab) {
        chatTab.click();
    } else {
        switchTab('chat');
    }
}

function showLoginModal() {
    loginModal.style.display = 'flex';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

function closeLoginModal() { loginModal.style.display = 'none'; }

async function handleLogin() {
    const btn = document.getElementById('doLoginBtn');
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { showToast('请输入用户名和密码', 'warning'); return; }
    setButtonLoading(btn, true, '登录中...');
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
    finally { setButtonLoading(btn, false); }
}

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
    
    const isEmpty = password.length === 0;
    
    reqLength.className = 'requirement ' + (isEmpty ? '' : (checks.length ? 'met' : 'unmet'));
    reqLength.querySelector('i').className = isEmpty ? 'far fa-circle' : (checks.length ? 'fas fa-check-circle' : 'fas fa-times-circle');
    
    reqLetter.className = 'requirement ' + (isEmpty ? '' : (checks.letter ? 'met' : 'unmet'));
    reqLetter.querySelector('i').className = isEmpty ? 'far fa-circle' : (checks.letter ? 'fas fa-check-circle' : 'fas fa-times-circle');
    
    reqNumber.className = 'requirement ' + (isEmpty ? '' : (checks.number ? 'met' : 'unmet'));
    reqNumber.querySelector('i').className = isEmpty ? 'far fa-circle' : (checks.number ? 'fas fa-check-circle' : 'fas fa-times-circle');
    
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

function checkUsernameAvailability(username) {
    const input = document.getElementById('regUsername');
    const feedback = document.getElementById('usernameFeedback');
    
    if (usernameCheckTimeout) clearTimeout(usernameCheckTimeout);
    
    input.classList.remove('valid', 'invalid', 'checking');
    feedback.classList.remove('show', 'success', 'error', 'loading');
    feedback.innerHTML = '';
    usernameAvailable = null;
    
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
    
    input.classList.add('checking');
    feedback.className = 'field-feedback show loading';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
    
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
            input.classList.remove('checking');
        }
    }, 300);
}

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

function initRegisterValidation() {
    if (registerValidationInited) return;
    
    const usernameInput = document.getElementById('regUsername');
    const passwordInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    
    usernameInput.addEventListener('input', (e) => {
        checkUsernameAvailability(e.target.value.trim());
    });
    
    usernameInput.addEventListener('blur', (e) => {
        if (!usernameAvailable && e.target.value.trim()) {
            checkUsernameAvailability(e.target.value.trim());
        }
    });
    
    passwordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
        if (confirmInput.value) {
            checkConfirmPassword();
        }
    });
    
    confirmInput.addEventListener('input', () => {
        checkConfirmPassword();
    });
    
    registerValidationInited = true;
}

async function handleRegister() {
    const btn = document.getElementById('doRegisterBtn');
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

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

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
        showToast('密码必须同时包含字母和数字', 'warning');
        return;
    }

    setButtonLoading(btn, true, '注册中...');
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
            registerSuccessModal.style.display = 'flex';
        } else {
            const err = await res.json();
            
            if (res.status === 409) {
                showDuplicateUsernameModal(username);
            } else {
                showToast(err.detail || '注册失败，请重试', 'error');
            }
        }
    } catch(e) {
        showToast('网络错误，请稍后重试', 'error');
    }
    finally { setButtonLoading(btn, false); }
}

function showDuplicateUsernameModal(suggestedUsername) {
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
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDuplicateModal();
        }
    });
}

window.useSuggestedUsername = function(username) {
    closeDuplicateModal();
    document.getElementById('regUsername').value = username;
    showToast('已填入新昵称：' + username, 'success');
};

function closeDuplicateModal() {
    const modal = document.getElementById('duplicateUsernameModal');
    if (modal) {
        modal.remove();
    }
}
