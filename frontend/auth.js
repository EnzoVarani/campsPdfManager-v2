/**
 * Sistema de Autenticação JWT para CAMPS PDF Manager
 * Integrado com Flask Backend
 */

class AuthManager {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        this.token = localStorage.getItem('access_token');
        this.refreshToken = localStorage.getItem('refresh_token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: email.toLowerCase().trim(), 
                    password 
                })
            });

            const data = await response.json();

            // ✅ CORREÇÃO: Backend retorna tokens na raiz, não em data.data.tokens
            if (response.ok) {
                this.token = data.access_token;  // ✅ Direto da raiz
                this.refreshToken = data.refresh_token;  // ✅ Direto da raiz
                this.user = data.user;  // ✅ Direto da raiz

                // Salvar no localStorage
                localStorage.setItem('access_token', this.token);
                localStorage.setItem('refresh_token', this.refreshToken);
                localStorage.setItem('user', JSON.stringify(this.user));

                console.log('✅ Login successful:', this.user.name);
                return { success: true, user: this.user };
            } else {
                return { 
                    success: false, 
                    message: data.error || 'Falha no login' 
                };
            }

        } catch (error) {
            console.error('❌ Login error:', error);
            return { 
                success: false, 
                message: 'Erro de conexão com o servidor' 
            };
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) {
            this.logout();
            return false;
        }

        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.refreshToken}`
                }
            });

            const data = await response.json();

            // ✅ CORREÇÃO: Backend retorna access_token na raiz
            if (response.ok) {
                this.token = data.access_token;  // ✅ Direto da raiz
                localStorage.setItem('access_token', this.token);
                console.log('✅ Token renovado com sucesso');
                return true;
            } else {
                console.log('❌ Falha ao renovar token');
                this.logout();
                return false;
            }

        } catch (error) {
            console.error('❌ Token refresh error:', error);
            this.logout();
            return false;
        }
    }

    async fetchWithAuth(url, options = {}) {
        if (!this.token) {
            throw new Error('Não autenticado');
        }

        const requestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...options.headers
            }
        };

        let response = await fetch(url, requestOptions);

        // Se token expirou (401), tentar renovar
        if (response.status === 401) {
            console.log('⚠️ Token expirado, tentando renovar...');
            const refreshed = await this.refreshAccessToken();
            
            if (refreshed) {
                // Tentar novamente com novo token
                requestOptions.headers['Authorization'] = `Bearer ${this.token}`;
                response = await fetch(url, requestOptions);
            } else {
                throw new Error('Sessão expirada. Faça login novamente.');
            }
        }

        return response;
    }

    logout() {
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        console.log('👋 Logout completed');
        window.location.reload();
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    hasRole(role) {
        return this.user && this.user.role === role;
    }

    hasPermission(permission) {
        if (!this.user) return false;
        
        const permissions = {
            'admin': ['create', 'read', 'update', 'delete', 'manage_users'],
            'user': ['create', 'read', 'update'],
            'viewer': ['read']
        };
        
        return permissions[this.user.role]?.includes(permission) || false;
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    getUserInfo() {
        return this.user;
    }

    // ✅ NOVO: Método para verificar se usuário é admin
    isAdmin() {
        return this.hasRole('admin');
    }

    // ✅ NOVO: Método para pegar apenas o token
    getToken() {
        return this.token;
    }
}

// Instância global do AuthManager
const auth = new AuthManager();

// ✅ Configurar interceptador para requests automáticos
window.fetchAuth = async (url, options = {}) => {
    return auth.fetchWithAuth(url, options);
};

// ========== FUNÇÕES UTILITÁRIAS ==========

function showToast(message, type = 'info') {
    // Criar container se não existir
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 8px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        opacity: 0;
        transition: opacity 0.3s;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    // Animação de entrada
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);

    // Remover após 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');

    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            if (!email || !password) {
                errorDiv.textContent = 'Email e senha são obrigatórios';
                return;
            }

            // Desabilitar botão durante login
            submitBtn.disabled = true;
            submitBtn.textContent = 'Entrando...';
            errorDiv.textContent = '';

            const result = await auth.login(email, password);

            if (result.success) {
                document.getElementById('loginModal').style.display = 'none';
                initializeApp();
                showToast(`Bem-vindo, ${result.user.name}!`, 'success');
            } else {
                errorDiv.textContent = result.message;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';
            }
        });
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente sair?')) {
                auth.logout();
            }
        });
    }

    // Verificar autenticação inicial
    if (!auth.isAuthenticated()) {
        showLoginModal();
    } else {
        initializeApp();
    }
});

function showLoginModal() {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginModal = document.getElementById('loginModal');
    const appContainer = document.getElementById('appContainer');

    if (loadingScreen) loadingScreen.style.display = 'none';
    if (loginModal) loginModal.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function initializeApp() {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginModal = document.getElementById('loginModal');
    const appContainer = document.getElementById('appContainer');

    if (loadingScreen) loadingScreen.style.display = 'none';
    if (loginModal) loginModal.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';

    updateUserInfo();
    
    // Carregar dashboard se a função existir
    if (typeof loadDashboard === 'function') {
        loadDashboard();
    }
}

function updateUserInfo() {
    const user = auth.getUserInfo();
    const userInfoDiv = document.getElementById('userInfo');

    if (user && userInfoDiv) {
        userInfoDiv.innerHTML = `
            <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="user-details">
                <div class="user-name">${user.name}</div>
                <div class="user-role">${user.role.toUpperCase()}</div>
            </div>
        `;

        // Mostrar menu de usuários apenas para admins
        const usersNav = document.getElementById('usersNav');
        if (usersNav) {
            usersNav.style.display = auth.hasRole('admin') ? 'block' : 'none';
        }
    }
}

// ✅ Exportar auth para ser usado em outros scripts
window.auth = auth;
window.showToast = showToast;
