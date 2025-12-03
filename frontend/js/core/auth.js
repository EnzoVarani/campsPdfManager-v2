/**
 * Sistema de Autenticação JWT para CAMPS PDF Manager
 * Integrado com Flask Backend
 */

export class AuthManager {
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

// Export only the class
export default AuthManager;
