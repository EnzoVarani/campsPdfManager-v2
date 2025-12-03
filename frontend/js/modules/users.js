/**
 * CAMPS PDF Manager v2.0 - Users Module
 * Handles user management (Admin only)
 */

import { ROUTES } from '../config.js';
import { showToast } from '../utils/toast.js';

export class UsersModule {
    constructor(api) {
        this.api = api;
        this.users = [];
    }

    /**
     * Load users list
     */
    async load() {
        console.log('👥 Loading users...');
        
        try {
            const response = await this.api.get(ROUTES.AUTH.USERS);

            if (response.users) {
                this.users = response.users;
                this.renderTable();
                this.setupModals();
            } else {
                showToast('Erro ao carregar usuários', 'error');
            }

        } catch (error) {
            console.error('Load users error:', error);
            showToast('Erro de conexão', 'error');
        }
    }

    /**
     * Render users table
     */
    renderTable() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    <span class="badge ${this.getRoleBadgeClass(user.role)}">
                        ${user.role}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                        ${user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn-icon" onclick="window.app.modules.users.editUser(${user.id})" title="Editar">
                        ✏️
                    </button>
                    ${user.id !== window.app.auth.user.id ? `
                        <button class="btn-icon btn-danger" onclick="window.app.modules.users.deleteUser(${user.id})" title="Excluir">
                            🗑️
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    /**
     * Get badge class for role
     */
    getRoleBadgeClass(role) {
        switch (role) {
            case 'admin': return 'badge-danger';
            case 'user': return 'badge-primary';
            default: return 'badge-secondary';
        }
    }

    /**
     * Setup modal listeners
     */
    setupModals() {
        const createBtn = document.querySelector('button[onclick="openCreateUserModal()"]');
        if (createBtn) {
            createBtn.onclick = () => this.openCreateModal();
        }

        const createForm = document.getElementById('createUserForm');
        if (createForm && !createForm.dataset.bound) {
            createForm.addEventListener('submit', (e) => this.createUser(e));
            createForm.dataset.bound = 'true';
        }

        const editForm = document.getElementById('editUserForm');
        if (editForm && !editForm.dataset.bound) {
            editForm.addEventListener('submit', (e) => this.updateUser(e));
            editForm.dataset.bound = 'true';
        }
    }

    /**
     * Open create user modal
     */
    openCreateModal() {
        const modal = document.getElementById('createUserModal');
        const form = document.getElementById('createUserForm');
        if (modal && form) {
            form.reset();
            modal.style.display = 'flex';
        }
    }

    /**
     * Create new user
     */
    async createUser(event) {
        event.preventDefault();

        const userData = {
            name: document.getElementById('newUserName')?.value,
            email: document.getElementById('newUserEmail')?.value,
            password: document.getElementById('newUserPassword')?.value,
            role: document.getElementById('newUserRole')?.value || 'user',
            is_active: document.getElementById('newUserActive')?.checked !== false
        };

        try {
            const response = await this.api.post(ROUTES.AUTH.USERS, userData);

            if (response.user) {
                showToast('Usuário criado com sucesso', 'success');
                document.getElementById('createUserModal').style.display = 'none';
                this.load();
            } else {
                showToast(response.error || 'Erro ao criar usuário', 'error');
            }

        } catch (error) {
            console.error('Create user error:', error);
            showToast('Erro ao criar usuário', 'error');
        }
    }

    /**
     * Edit user
     */
    editUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const modal = document.getElementById('editUserModal');
        if (modal) {
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editUserName').value = user.name;
            document.getElementById('editUserEmail').value = user.email;
            document.getElementById('editUserRole').value = user.role;
            document.getElementById('editUserActive').checked = user.is_active;
            
            modal.style.display = 'flex';
        }
    }

    /**
     * Update user
     */
    async updateUser(event) {
        event.preventDefault();

        const userId = document.getElementById('editUserId')?.value;
        const userData = {
            name: document.getElementById('editUserName')?.value,
            email: document.getElementById('editUserEmail')?.value,
            role: document.getElementById('editUserRole')?.value,
            is_active: document.getElementById('editUserActive')?.checked
        };

        const password = document.getElementById('editUserPassword')?.value;
        if (password) userData.password = password;

        try {
            const response = await this.api.put(`${ROUTES.AUTH.USERS}/${userId}`, userData);

            if (response.success) {
                showToast('Usuário atualizado com sucesso', 'success');
                document.getElementById('editUserModal').style.display = 'none';
                this.load();
            } else {
                showToast(response.error || 'Erro ao atualizar usuário', 'error');
            }

        } catch (error) {
            console.error('Update user error:', error);
            showToast('Erro ao atualizar usuário', 'error');
        }
    }

    /**
     * Delete user
     */
    async deleteUser(userId) {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

        try {
            const response = await this.api.delete(`${ROUTES.AUTH.USERS}/${userId}`);

            if (response.success) {
                showToast('Usuário excluído com sucesso', 'success');
                this.load();
            } else {
                showToast(response.error || 'Erro ao excluir usuário', 'error');
            }

        } catch (error) {
            console.error('Delete user error:', error);
            showToast('Erro ao excluir usuário', 'error');
        }
    }
}
