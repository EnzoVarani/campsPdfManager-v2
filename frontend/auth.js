/**
 * Sistema de Autenticação JWT para CAMPS PDF Manager
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
                body: JSON.stringify({ email: email.toLowerCase().trim(), password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.data.tokens.access_token;
                this.refreshToken = data.data.tokens.refresh_token;
                this.user = data.data.user;

                localStorage.setItem('access_token', this.token);
                localStorage.setItem('refresh_token', this.refreshToken);
                localStorage.setItem('user', JSON.stringify(this.user));

                console.log('Login successful:', this.user.name);
                return { success: true, user: this.user };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Erro de conexão com o servidor' };
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

            if (data.success) {
                this.token = data.data.access_token;
                localStorage.setItem('access_token', this.token);
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
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

        // Se token expirou, tentar renovar
        if (response.status === 401) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                requestOptions.headers['Authorization'] = `Bearer ${this.token}`;
                response = await fetch(url, requestOptions);
            } else {
                throw new Error('Sessão expirada');
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
        
        console.log('Logout completed');
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
}

// Instância global do AuthManager
const auth = new AuthManager();

// Configurar interceptador para requests automáticos
const originalFetch = window.fetch;
window.fetchAuth = async (url, options = {}) => {
    return auth.fetchWithAuth(url, options);
};

// Funções utilitárias
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event listeners
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
            
            if (!email || !password) {
                errorDiv.textContent = 'Email e senha são obrigatórios';
                return;
            }
            
            errorDiv.textContent = '';
            
            const result = await auth.login(email, password);
            if (result.success) {
                document.getElementById('loginModal').style.display = 'none';
                initializeApp();
                showToast(`Bem-vindo, ${result.user.name}!`, 'success');
            } else {
                errorDiv.textContent = result.message;
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
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

function initializeApp() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    updateUserInfo();
    loadDashboard();
}

function updateUserInfo() {
    const user = auth.getUserInfo();
    if (user) {
        document.getElementById('userInfo').innerHTML = `
            <i class="fas fa-user-circle"></i> ${user.name} 
            <span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span>
        `;
        
        // Mostrar menu de usuários apenas para admins
        if (auth.hasRole('admin')) {
            document.getElementById('usersNav').style.display = 'block';
        }
    }
}