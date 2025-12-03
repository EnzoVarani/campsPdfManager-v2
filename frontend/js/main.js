/**
 * CAMPS PDF Manager v2.0 - Main Entry Point
 * Application initialization and module coordination
 */

import { AuthManager } from './core/auth.js';
import { ApiClient } from './core/api.js';
import { DashboardModule } from './modules/dashboard.js';
import { DocumentsModule } from './modules/documents.js';
import { UploadModule } from './modules/upload.js';
import { BatchModule } from './modules/batch.js';
import { UsersModule } from './modules/users.js';
import { showToast } from './utils/toast.js';

/**
 * Main Application Class
 */
class App {
    constructor() {
        this.auth = null;
        this.api = null;
        this.modules = {};
        this.currentSection = 'dashboard';
    }

    /**
     * Initialize application
     */
    async init() {
        console.log('🚀 CAMPS PDF Manager v2.0 - Initializing...');

        // Initialize auth
        this.auth = new AuthManager();
        window.auth = this.auth; // For backward compatibility if needed

        // Setup login form listener
        this.setupLoginForm();
        this.setupLogout();
        
        if (!this.auth.isAuthenticated()) {
            this.showLoginModal();
            return;
        }

        await this.startApp();
    }

    /**
     * Start the main application after auth
     */
    async startApp() {
        // Initialize API client
        this.api = new ApiClient(this.auth);

        // Load modules
        this.loadModules();

        // Setup navigation
        this.setupNavigation();

        // Setup modals
        this.setupModals();

        // Update user info display
        this.updateUserInfo();

        // Show app container
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';

        // Load initial section
        await this.loadSection('dashboard');

        console.log('✅ Application initialized successfully');
    }

    /**
     * Setup login form
     */
    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
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

                submitBtn.disabled = true;
                submitBtn.textContent = 'Entrando...';
                errorDiv.textContent = '';

                const result = await this.auth.login(email, password);

                if (result.success) {
                    showToast(`Bem-vindo, ${result.user.name}!`, 'success');
                    await this.startApp();
                } else {
                    errorDiv.textContent = result.message;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                }
            });
        }
    }

    /**
     * Setup logout
     */
    setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Deseja realmente sair?')) {
                    this.auth.logout();
                }
            });
        }
    }

    /**
     * Load all application modules
     */
    loadModules() {
        console.log('📦 Loading modules...');

        this.modules.dashboard = new DashboardModule(this.api);
        this.modules.documents = new DocumentsModule(this.api);
        this.modules.upload = new UploadModule(this.api);
        this.modules.batch = new BatchModule(this.api);
        
        // Users module only for admins
        if (this.auth.hasRole('admin')) {
            this.modules.users = new UsersModule(this.api);
        }

        console.log(`✅ Loaded ${Object.keys(this.modules).length} modules`);
    }

    /**
     * Setup navigation between sections
     */
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.content-section');

        navButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetSection = btn.dataset.section;

                // Update navigation
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update sections
                sections.forEach(s => s.classList.remove('active'));
                const section = document.getElementById(`${targetSection}Section`);
                if (section) {
                    section.classList.add('active');
                }

                // Load section data
                await this.loadSection(targetSection);
            });
        });
    }

    /**
     * Load specific section data
     */
    async loadSection(sectionName) {
        this.currentSection = sectionName;

        try {
            switch (sectionName) {
                case 'dashboard':
                    if (this.modules.dashboard) {
                        await this.modules.dashboard.load();
                    }
                    break;
                case 'documents':
                    if (this.modules.documents) {
                        await this.modules.documents.load();
                    }
                    break;
                case 'upload':
                    if (this.modules.upload) {
                        this.modules.upload.init();
                    }
                    break;
                case 'users':
                    if (this.modules.users) {
                        await this.modules.users.load();
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error loading section ${sectionName}:`, error);
            showToast(`Erro ao carregar ${sectionName}`, 'error');
        }
    }

    /**
     * Setup modal close handlers
     */
    setupModals() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Close modals with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    /**
     * Show login modal
     */
    showLoginModal() {
        const loadingScreen = document.getElementById('loadingScreen');
        const loginModal = document.getElementById('loginModal');
        const appContainer = document.getElementById('appContainer');

        if (loadingScreen) loadingScreen.style.display = 'none';
        if (loginModal) loginModal.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }

    /**
     * Update user info display
     */
    updateUserInfo() {
        const user = this.auth.getUserInfo();
        const userInfoDiv = document.getElementById('userInfo');

        if (user && userInfoDiv) {
            userInfoDiv.innerHTML = `
                <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">${user.name}</div>
                    <div class="user-role">${user.role.toUpperCase()}</div>
                </div>
            `;

            // Show users nav only for admins
            const usersNav = document.getElementById('usersNav');
            if (usersNav) {
                usersNav.style.display = this.auth.hasRole('admin') ? 'block' : 'none';
            }
        }
    }

    /**
     * Reload current section
     */
    async reloadCurrentSection() {
        await this.loadSection(this.currentSection);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new App();
    await window.app.init();
});

// ✅ Global helpers for HTML onclick events
window.closeDocumentModal = () => {
    document.getElementById('documentModal').style.display = 'none';
};

window.closeBatchModal = () => {
    document.getElementById('batchMetadataModal').style.display = 'none';
};

window.closeCreateUserModal = () => {
    document.getElementById('createUserModal').style.display = 'none';
};

window.closeEditUserModal = () => {
    document.getElementById('editUserModal').style.display = 'none';
};

window.openCreateUserModal = () => {
    if (window.app && window.app.modules.users) {
        window.app.modules.users.openCreateModal();
    }
};

window.toggleSelectAll = () => {
    if (window.app && window.app.modules.batch) {
        window.app.modules.batch.toggleSelectAll();
    }
};

window.sortDocuments = (field) => {
    if (window.app && window.app.modules.documents) {
        window.app.modules.documents.sort(field);
    }
};

window.loadDocuments = (page) => {
    if (window.app && window.app.modules.documents) {
        window.app.modules.documents.load(page);
    }
};

window.clearSelection = () => {
    if (window.app && window.app.modules.batch) {
        window.app.modules.batch.clearSelection();
    }
};

// Export for global access
export default App;
