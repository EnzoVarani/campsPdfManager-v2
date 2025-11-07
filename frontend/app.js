/**
 * CAMPS PDF Manager v2.0 - Main Application Logic
 * VERSÃO CORRIGIDA - Timezone Brasília
 */

const API_BASE = 'http://localhost:5000/api';
let currentPage = 1;
let documentsData = [];
let chartsInstances = {};

// =============================================================================
// NAVIGATION
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
    setupModals();
    setupUploadSystem();
});

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;
            
            // Update navigation
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update sections
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`${targetSection}Section`).classList.add('active');
            
            // Load section data
            switch(targetSection) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'documents':
                    loadDocuments();
                    break;
                case 'users':
                    if (auth.hasRole('admin')) {
                        loadUsers();
                    }
                    break;
            }
        });
    });
}

// =============================================================================
// DASHBOARD
// =============================================================================

async function loadDashboard() {
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/analytics/dashboard/summary`);
        const data = await response.json();

        if (data.success) {
            updateDashboardStats(data.data);
            loadCharts();
            updateRecentDocuments(data.data.recent_documents);
        } else {
            showToast('Erro ao carregar dashboard', 'error');
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('Erro de conexão', 'error');
    }
}

function updateDashboardStats(data) {
    const stats = data.totals;
    
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-icon"><i class="fas fa-file-pdf"></i></div>
            <div class="stat-content">
                <h3>Total de Documentos</h3>
                <p class="stat-number">${stats.documents || 0}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class="fas fa-signature"></i></div>
            <div class="stat-content">
                <h3>Documentos Assinados</h3>
                <p class="stat-number">${stats.signed_documents || 0}</p>
                <small>${data.signing_rate || 0}% do total</small>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
            <div class="stat-content">
                <h3>Hoje</h3>
                <p class="stat-number">${stats.documents_today || 0}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class="fas fa-calendar-week"></i></div>
            <div class="stat-content">
                <h3>Esta Semana</h3>
                <p class="stat-number">${stats.documents_week || 0}</p>
            </div>
        </div>
        ${auth.hasRole('admin') && stats.active_users !== null ? `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <div class="stat-content">
                    <h3>Usuários Ativos</h3>
                    <p class="stat-number">${stats.active_users}/${stats.total_users}</p>
                </div>
            </div>
        ` : ''}
    `;
    
    document.getElementById('dashboardStats').innerHTML = statsHTML;
}

function updateRecentDocuments(documents) {
    if (!documents || documents.length === 0) {
        document.getElementById('recentDocuments').innerHTML = '<p>Nenhum documento encontrado</p>';
        return;
    }
    
    const docsHTML = documents.map(doc => `
        <div class="doc-item" onclick="showDocumentDetails(${doc.id})">
            <div class="doc-icon">
                <i class="fas fa-file-pdf"></i>
            </div>
            <div class="doc-info">
                <h4>${doc.title || 'Sem título'}</h4>
                <p>ID: ${doc.identifier}</p>
                <small>Status: ${doc.status} | ${formatDate(doc.created_at)}</small>
            </div>
        </div>
    `).join('');
    
    document.getElementById('recentDocuments').innerHTML = docsHTML;
}

// =============================================================================
// CHARTS
// =============================================================================

async function loadCharts() {
    try {
        await Promise.all([
            loadTimelineChart(),
            loadTypeChart(),
            loadSignatureChart()
        ]);
    } catch (error) {
        console.error('Charts error:', error);
    }
}

async function loadTimelineChart() {
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/analytics/charts/documents-timeline?days=30`);
        const data = await response.json();
        
        if (data.success) {
            const ctx = document.getElementById('timelineChart').getContext('2d');
            
            if (chartsInstances.timeline) {
                chartsInstances.timeline.destroy();
            }
            
            chartsInstances.timeline = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.data.timeline.map(item => formatDate(item.date, 'short')),
                    datasets: [{
                        label: 'Documentos por Dia',
                        data: data.data.timeline.map(item => item.count),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Timeline chart error:', error);
    }
}

async function loadTypeChart() {
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/analytics/charts/documents-by-type`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            const ctx = document.getElementById('typeChart').getContext('2d');
            
            if (chartsInstances.type) {
                chartsInstances.type.destroy();
            }
            
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
            ];
            
            chartsInstances.type = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.data.map(item => item.type || 'Sem Tipo'),
                    datasets: [{
                        data: data.data.map(item => item.count),
                        backgroundColor: colors.slice(0, data.data.length),
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } else {
            document.getElementById('typeChart').parentElement.innerHTML = '<p>Nenhum dado disponível</p>';
        }
    } catch (error) {
        console.error('Type chart error:', error);
    }
}

async function loadSignatureChart() {
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/analytics/charts/signature-status`);
        const data = await response.json();
        
        if (data.success) {
            const ctx = document.getElementById('signatureChart').getContext('2d');
            
            if (chartsInstances.signature) {
                chartsInstances.signature.destroy();
            }
            
            chartsInstances.signature = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: data.data.basic.map(item => item.status),
                    datasets: [{
                        data: data.data.basic.map(item => item.count),
                        backgroundColor: ['#28a745', '#dc3545'],
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Signature chart error:', error);
    }
}

// =============================================================================
// UPLOAD SYSTEM
// =============================================================================

function setupUploadSystem() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    let selectedFiles = [];

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        addFilesToList(files);
    });

    // File selection
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        addFilesToList(files);
    });

    // Upload button
    uploadBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            showToast('Selecione pelo menos um arquivo', 'error');
            return;
        }
        
        await uploadFiles(selectedFiles);
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        selectedFiles = [];
        updateFileList();
        uploadBtn.disabled = true;
    });

    function addFilesToList(files) {
        files.forEach(file => {
            if (file.type === 'application/pdf' && !selectedFiles.find(f => f.name === file.name)) {
                selectedFiles.push(file);
            }
        });
        updateFileList();
        uploadBtn.disabled = selectedFiles.length === 0;
    }

    function updateFileList() {
        const fileList = document.getElementById('fileList');
        
        if (selectedFiles.length === 0) {
            fileList.innerHTML = '';
            return;
        }
        
        const filesHTML = selectedFiles.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <i class="fas fa-file-pdf"></i>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
                <button class="btn-remove" onclick="removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        fileList.innerHTML = `
            <h4>Arquivos Selecionados (${selectedFiles.length})</h4>
            ${filesHTML}
        `;
    }

    window.removeFile = (index) => {
        selectedFiles.splice(index, 1);
        updateFileList();
        uploadBtn.disabled = selectedFiles.length === 0;
    };
}

async function uploadFiles(files) {
    const uploadBtn = document.getElementById('uploadBtn');
    const resultsDiv = document.getElementById('uploadResults');
    
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files[]', file);
        });
        
        const response = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showUploadResults(data.data);
            showToast(data.message, 'success');
            
            selectedFiles = [];
            updateFileList();
            
            if (document.getElementById('dashboardSection').classList.contains('active')) {
                loadDashboard();
            }
        } else {
            showToast(data.message || 'Erro no upload', 'error');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Erro ao enviar arquivos', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Enviar PDFs';
    }
}

function showUploadResults(results) {
    const resultsDiv = document.getElementById('uploadResults');
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    let resultsHTML = `
        <div class="results-summary ${successCount === totalCount ? 'success' : 'warning'}">
            <h3>
                <i class="fas fa-${successCount === totalCount ? 'check-circle' : 'exclamation-triangle'}"></i>
                Resultado: ${successCount}/${totalCount} arquivos processados
            </h3>
        </div>
        <div class="results-details">
    `;
    
    results.forEach(result => {
        resultsHTML += `
            <div class="result-item ${result.success ? 'success' : 'error'}">
                <i class="fas fa-${result.success ? 'check-circle' : 'exclamation-circle'}"></i>
                <div class="result-info">
                    <strong>${result.filename}</strong>
                    ${result.success ? 
                        `<p>ID: ${result.identifier} | Hash: ${result.hash?.substring(0, 8)}... | ${formatFileSize(result.size)}</p>` :
                        `<p class="error">${result.error}</p>`
                    }
                </div>
            </div>
        `;
    });
    
    resultsHTML += '</div>';
    resultsDiv.innerHTML = resultsHTML;
}

// =============================================================================
// DOCUMENTS MANAGEMENT
// =============================================================================

async function loadDocuments(page = 1) {
    try {
        const search = document.getElementById('searchInput')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const docType = document.getElementById('typeFilter')?.value || '';
        
        const params = new URLSearchParams({
            page: page,
            per_page: 20,
            ...(search && { search }),
            ...(status && { status }),
            ...(docType && { doc_type: docType })
        });
        
        const response = await auth.fetchWithAuth(`${API_BASE}/documents/?${params}`);
        const data = await response.json();
        
        if (data.success) {
            documentsData = data.data.documents;
            displayDocuments(data.data.documents);
            updatePagination(data.data.pagination);
        } else {
            showToast('Erro ao carregar documentos', 'error');
        }
    } catch (error) {
        console.error('Documents error:', error);
        showToast('Erro de conexão', 'error');
    }
}

function displayDocuments(documents) {
    const grid = document.getElementById('documentsGrid');
    
    if (!documents || documents.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>Nenhum documento encontrado</h3>
                <p>Faça upload de alguns PDFs para começar</p>
            </div>
        `;
        return;
    }
    
    const docsHTML = documents.map(doc => `
        <div class="document-card" data-id="${doc.id}">
            <div class="doc-header">
                <h3>${doc.title || doc.original_filename}</h3>
                <span class="doc-id">${doc.identifier}</span>
            </div>
            <div class="doc-meta">
                <p><i class="fas fa-user"></i> ${doc.author || 'N/A'}</p>
                <p><i class="fas fa-calendar"></i> ${formatDate(doc.created_at)}</p>
                <p><i class="fas fa-tag"></i> ${doc.doc_type || 'Sem tipo'}</p>
            </div>
            <div class="doc-status">
                <span class="status-badge status-${doc.status}">${doc.status}</span>
                ${doc.is_signed ? '<i class="fas fa-signature signed" title="Assinado"></i>' : '<i class="fas fa-signature unsigned" title="Não assinado"></i>'}
            </div>
            <div class="doc-actions">
                <button onclick="showDocumentDetails(${doc.id})" class="btn-info">
                    <i class="fas fa-eye"></i> Detalhes
                </button>
                <button onclick="downloadDocument(${doc.id})" class="btn-primary">
                    <i class="fas fa-download"></i> Download
                </button>
                ${auth.hasPermission('delete') ? `
                    <button onclick="deleteDocument(${doc.id})" class="btn-danger">
                        <i class="fas fa-trash"></i> Deletar
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    grid.innerHTML = docsHTML;
}

// =============================================================================
// DOCUMENT ACTIONS
// =============================================================================

async function showDocumentDetails(docId) {
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}`);
        const data = await response.json();
        
        if (data.success) {
            displayDocumentModal(data.data);
        } else {
            showToast('Erro ao carregar detalhes', 'error');
        }
    } catch (error) {
        console.error('Detalhes error:', error);
        showToast('Erro ao carregar detalhes', 'error');
    }
}

function displayDocumentModal(doc) {
    const modal = document.getElementById('documentModal');
    const details = document.getElementById('documentDetails');
    
    let auditLogsHTML = '<div class="empty-state-small"><i class="fas fa-info-circle"></i> Nenhum registro encontrado</div>';
    
    try {
        if (doc.audit_logs && Array.isArray(doc.audit_logs) && doc.audit_logs.length > 0) {
            const sortedLogs = [...doc.audit_logs].sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);
                return dateB - dateA;
            });
            
            auditLogsHTML = sortedLogs.map(log => {
                const actionIcon = log.action === 'upload' ? 'cloud-upload-alt' : 
                                 log.action === 'download' ? 'cloud-download-alt' : 
                                 log.action === 'update' ? 'edit' : 
                                 log.action === 'delete' ? 'trash' : 'history';
                
                let description = log.description || 'Sem descrição';
                
                if (log.action === 'upload' && description.includes('enviado')) {
                    const match = description.match(/Documento (.+?) enviado/);
                    if (match) {
                        description = `Upload do documento ${match[1]}`;
                    }
                }
                
                return `
                    <div class="audit-item">
                        <div class="audit-icon">
                            <i class="fas fa-${actionIcon}"></i>
                        </div>
                        <div class="audit-content">
                            <div class="audit-description">${description}</div>
                            <div class="audit-meta">
                                <i class="fas fa-clock"></i> ${log.timestamp ? formatDate(log.timestamp) : 'Data desconhecida'}
                                ${log.ip_address ? ' • <i class="fas fa-network-wired"></i> ' + log.ip_address : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Erro ao processar audit logs:', error);
        auditLogsHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Erro ao carregar histórico</div>';
    }
    
    const statusMap = {
        'uploaded': { class: 'info', icon: 'cloud-upload-alt', text: 'Enviado' },
        'processing': { class: 'warning', icon: 'spinner', text: 'Processando' },
        'completed': { class: 'success', icon: 'check-circle', text: 'Concluído' },
        'error': { class: 'danger', icon: 'exclamation-circle', text: 'Erro' }
    };
    
    const statusInfo = statusMap[doc.status] || { class: 'secondary', icon: 'info-circle', text: doc.status || 'Desconhecido' };
    
    details.innerHTML = `
        <div class="modal-content-wrapper">
            <div class="modal-header-section">
                <div class="modal-title-area">
                    <h2 class="modal-title">
                        <i class="fas fa-file-pdf"></i>
                        ${doc.title || doc.original_filename || 'Documento sem título'}
                    </h2>
                    <span class="badge badge-${statusInfo.class}">
                        <i class="fas fa-${statusInfo.icon}"></i>
                        ${statusInfo.text}
                    </span>
                </div>
            </div>

            <div class="modal-body-section">
                <div class="info-section">
                    <h3 class="section-title">
                        <i class="fas fa-info-circle"></i>
                        Informações do Documento
                    </h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">ID do Documento</span>
                            <span class="info-value">${doc.identifier || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Nome do Arquivo</span>
                            <span class="info-value">${doc.original_filename || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Tamanho</span>
                            <span class="info-value">${doc.file_size ? formatFileSize(doc.file_size) : 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Assinado</span>
                            <span class="info-value">
                                ${doc.is_signed ? 
                                    '<span class="badge badge-success"><i class="fas fa-check"></i> Sim</span>' : 
                                    '<span class="badge badge-secondary"><i class="fas fa-times"></i> Não</span>'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="info-section">
                    <h3 class="section-title">
                        <i class="fas fa-tags"></i>
                        Metadados
                    </h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Autor</span>
                            <span class="info-value">${doc.author || 'Não informado'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Assunto</span>
                            <span class="info-value">${doc.subject || 'Não informado'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Tipo</span>
                            <span class="info-value">${doc.doc_type || 'Não classificado'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Criado por</span>
                            <span class="info-value">Usuário #${doc.created_by || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="info-section">
                    <h3 class="section-title">
                        <i class="fas fa-clock"></i>
                        Datas
                    </h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Criado em</span>
                            <span class="info-value">${doc.created_at ? formatDate(doc.created_at) : 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Atualizado em</span>
                            <span class="info-value">${doc.updated_at ? formatDate(doc.updated_at) : 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="info-section">
                    <h3 class="section-title">
                        <i class="fas fa-shield-alt"></i>
                        Segurança
                    </h3>
                    <div class="info-item full-width">
                        <span class="info-label">Hash SHA-256</span>
                        <code class="hash-code">${doc.hash_sha256 || 'N/A'}</code>
                    </div>
                </div>

                <div class="info-section">
                    <h3 class="section-title">
                        <i class="fas fa-history"></i>
                        Histórico de Ações
                    </h3>
                    <div class="audit-logs-container">
                        ${auditLogsHTML}
                    </div>
                </div>
            </div>

            <div class="modal-footer-section">
                <button onclick="downloadDocument(${doc.id})" class="btn btn-primary">
                    <i class="fas fa-download"></i>
                    Download
                </button>
                ${auth.hasPermission('update') && doc.status === 'uploaded' ? `
                    <button onclick="addMetadataForm(${doc.id})" class="btn btn-success">
                        <i class="fas fa-edit"></i>
                        Adicionar Metadados
                    </button>
                ` : ''}
                <button onclick="document.getElementById('documentModal').style.display='none';" class="btn btn-secondary">
                    <i class="fas fa-times"></i>
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

downloadDocument = async function(docId) {
    try {
        // Buscar dados do documento para pegar o nome do arquivo
        const responseData = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}`);
        const jsonData = await responseData.json();
        let filename = `documento_${docId}.pdf`;
        if (jsonData.success && jsonData.data && jsonData.data.original_filename) {
            filename = jsonData.data.original_filename;
            // Forçar extensão PDF se não houver
            if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
        }
        const response = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}/download`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Download iniciado', 'success');
        } else {
            showToast('Erro no download', 'error');
        }
    } catch(error) {
        console.error('Download error:', error);
        showToast('Erro no download', 'error');
    }
}

async function deleteDocument(docId) {
    if (!confirm('Tem certeza que deseja deletar este documento?')) {
        return;
    }
    
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Documento deletado com sucesso', 'success');
            
            loadDocuments(currentPage);
            
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection && dashboardSection.classList.contains('active')) {
                loadDashboard();
            }
            
        } else {
            showToast(data.message || 'Erro ao deletar', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Erro ao deletar documento', 'error');
    }
}

// =============================================================================
// USERS MANAGEMENT (Admin only)
// =============================================================================

async function loadUsers() {
    if (!auth.hasRole('admin')) return;
    
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/auth/users`);
        const data = await response.json();
        
        if (data.success) {
            displayUsers(data.data);
        }
    } catch (error) {
        showToast('Erro ao carregar usuários', 'error');
    }
}

function displayUsers(users) {
    const grid = document.getElementById('usersGrid');
    
    const usersHTML = users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <h3>${user.name}</h3>
                <p>${user.email}</p>
                <span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span>
                <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="user-meta">
                <small>Criado: ${formatDate(user.created_at)}</small>
                ${user.last_login ? `<small>Último login: ${formatDate(user.last_login)}</small>` : ''}
            </div>
        </div>
    `).join('');
    
    grid.innerHTML = usersHTML;
}

// =============================================================================
// MODALS SYSTEM
// =============================================================================

function setupModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    const addUserBtn = document.getElementById('addUserBtn');
    const addUserModal = document.getElementById('addUserModal');
    const addUserForm = document.getElementById('addUserForm');
    
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            addUserModal.style.display = 'flex';
        });
    }
    
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createUser();
        });
    }
}

async function createUser() {
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/auth/users`, {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Usuário criado com sucesso', 'success');
            document.getElementById('addUserModal').style.display = 'none';
            document.getElementById('addUserForm').reset();
            loadUsers();
        } else {
            showToast(data.message || 'Erro ao criar usuário', 'error');
        }
    } catch (error) {
        showToast('Erro ao criar usuário', 'error');
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDate(dateString, format = 'long') {
    if (!dateString) return 'N/A';

    try {
        // Garante parse ISO UTC (mesmo sem especificar Z)
        let date = new Date(dateString);
        if (typeof dateString === 'string' && !dateString.endsWith('Z')) {
            // Força interpretação como UTC se o ISO não tiver 'Z' (algumas libs omitem)
            date = new Date(dateString + 'Z');
        }

        if (isNaN(date.getTime())) {
            return 'Data inválida';
        }

        const timezoneOptions = {
            timeZone: 'America/Sao_Paulo',
            hour12: false
        };

        if (format === 'short') {
            return date.toLocaleDateString('pt-BR', {
                ...timezoneOptions,
                day: '2-digit',
                month: '2-digit'
            });
        }
        return date.toLocaleString('pt-BR', {
            ...timezoneOptions,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'N/A';
    }
}


function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'N/A';
    
    try {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    } catch (error) {
        console.error('Erro ao formatar tamanho:', error);
        return 'N/A';
    }
}

function updatePagination(pagination) {
    const paginationDiv = document.getElementById('pagination');
    
    if (!pagination || pagination.pages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let paginationHTML = `
        <div class="pagination-info">
            Página ${pagination.current_page} de ${pagination.pages} 
            (${pagination.total} documentos)
        </div>
        <div class="pagination-buttons">
    `;
    
    if (pagination.current_page > 1) {
        paginationHTML += `
            <button onclick="loadDocuments(${pagination.current_page - 1})" class="btn-secondary">
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
        `;
    }
    
    const startPage = Math.max(1, pagination.current_page - 2);
    const endPage = Math.min(pagination.pages, pagination.current_page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="loadDocuments(${i})" class="btn-${i === pagination.current_page ? 'primary' : 'secondary'}">
                ${i}
            </button>
        `;
    }
    
    if (pagination.current_page < pagination.pages) {
        paginationHTML += `
            <button onclick="loadDocuments(${pagination.current_page + 1})" class="btn-secondary">
                Próximo <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationHTML += '</div>';
    paginationDiv.innerHTML = paginationHTML;
}

setTimeout(() => {
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            loadDocuments(1);
        });
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentPage = 1;
                loadDocuments(1);
            }
        });
    }
}, 1000);