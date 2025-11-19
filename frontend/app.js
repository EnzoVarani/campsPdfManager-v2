/**
 * CAMPS PDF Manager v2.0 - Main Application Logic
 * INTEGRADO COM FLASK BACKEND
 */

const API_BASE = "http://localhost:5000/api";

// Estado global
let currentPage = 1;
let documentsData = [];
let chartsInstances = {};
let selectedDocuments = new Set(); // IDs dos documentos selecionados
let selectedFiles = []; // Arquivos para upload


// =============================================================================
// FUNÇÕES AUXILIARES - HISTÓRICO DE AUDITORIA
// =============================================================================

/**
 * Traduz ações de auditoria para português com formatação adequada
 */
function formatAuditAction(action) {
    const actions = {
        'upload': 'Upload',
        'metadata_batch_update': 'Atualização em Lote',
        'metadata_update': 'Atualização de Metadados',
        'download': 'Download',
        'delete': 'Exclusão',
        'sign': 'Assinatura Digital',
        'view': 'Visualização',
        'edit': 'Edição'
    };

    return actions[action] || action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ');
}

/**
 * Retorna ícone emoji e cor para cada tipo de ação
 */
function getAuditIconAndColor(action) {
    const types = {
        'upload': { icon: '📤', color: 'blue' },
        'metadata_batch_update': { icon: '📝', color: 'purple' },
        'metadata_update': { icon: '✏️', color: 'orange' },
        'download': { icon: '📥', color: 'green' },
        'delete': { icon: '🗑️', color: 'red' },
        'sign': { icon: '✍️', color: 'teal' },
        'view': { icon: '👁️', color: 'gray' },
        'edit': { icon: '📋', color: 'yellow' }
    };

    return types[action] || { icon: '🔔', color: 'gray' };
}

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================

document.addEventListener("DOMContentLoaded", function () {
  // Verificar autenticação
  if (!auth.isAuthenticated()) {
    showLoginModal();
    return;
  }

  setupNavigation();
  setupModals();
  setupUploadSystem();
  setupBatchActions();
  updateUserInfo();

  // Carregar dashboard inicial
  loadDashboard();
});

// =============================================================================
// NAVIGATION
// =============================================================================

function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll(".content-section");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSection = btn.dataset.section;

      // Update navigation
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update sections
      sections.forEach((s) => s.classList.remove("active"));
      const section = document.getElementById(`${targetSection}Section`);
      if (section) {
        section.classList.add("active");
      }

      // Load section data
      switch (targetSection) {
        case "dashboard":
          loadDashboard();
          break;
        case "documents":
          loadDocuments();
          break;
        case "users":
          if (auth.isAdmin()) {
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
    // Carregar estatísticas
    const statsResponse = await auth.fetchWithAuth(
      `${API_BASE}/documents/stats`
    );
    const statsData = await statsResponse.json();

    if (statsData.success) {
      updateDashboardStats(statsData.data);
    }

    // Carregar documentos recentes
    const docsResponse = await auth.fetchWithAuth(
      `${API_BASE}/documents/?per_page=5`
    );
    const docsData = await docsResponse.json();

    if (docsData.success) {
      updateRecentDocuments(docsData.data.documents);
    }

    // Carregar gráficos
    loadCharts();
  } catch (error) {
    console.error("Dashboard error:", error);
    showToast("Erro ao carregar dashboard", "error");
  }
}

function updateDashboardStats(stats) {
  // Atualizar cards de estatísticas
  document.getElementById("totalDocs").textContent = stats.total_documents || 0;
  document.getElementById("signedDocs").textContent =
    stats.signed_documents || 0;
  document.getElementById("todayDocs").textContent = stats.documents_today || 0;

  // Taxa de assinatura
  const signingRate = document.getElementById("signingRate");
  if (signingRate) {
    signingRate.textContent = stats.signing_rate || "0%";
  }
}

function updateRecentDocuments(documents) {
  const container = document.getElementById("recentDocuments");

  if (!documents || documents.length === 0) {
    container.innerHTML = '<p class="no-data">Nenhum documento recente</p>';
    return;
  }

  const docsHTML = documents
    .map(
      (doc) => `
        <div class="recent-doc-item">
            <div class="doc-icon">📄</div>
            <div class="doc-info">
                <strong>${doc.title || doc.original_filename}</strong>
                <small>${doc.author || "Sem autor"} • ${formatDate(
        doc.uploaded_at
      )}</small>
            </div>
            <span class="doc-badge ${doc.is_signed ? "signed" : "unsigned"}">
                ${doc.is_signed ? "✓ Assinado" : "⋯ Pendente"}
            </span>
        </div>
    `
    )
    .join("");

  container.innerHTML = docsHTML;
}

async function loadCharts() {
  await loadTimelineChart();
  await loadTypeChart();
  await loadSignatureChart();
}

async function loadTimelineChart() {
    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/analytics/charts/documents-timeline`);
        const data = await response.json();

        if (!data.success || !data.data || !data.data.basic || data.data.basic.length === 0) {
            console.log('📊 Timeline chart: sem dados disponíveis');
            const container = document.getElementById('timelineChart')?.parentElement;
            if (container) {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 280px; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                        <p style="font-size: 14px; margin: 0;">Nenhum upload nos últimos 30 dias</p>
                    </div>
                `;
            }
            return;
        }

        const ctx = document.getElementById('timelineChart');
        if (!ctx) return;

        // ✅ Destruir chart anterior
        if (chartsInstances.timeline) {
            chartsInstances.timeline.destroy();
        }

        // ✅ FORÇAR altura do canvas antes de criar o chart
        ctx.style.height = '280px';
        ctx.style.width = '100%';

        chartsInstances.timeline = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                // ✅ CORREÇÃO: Parse manual da data (sem timezone)
                labels: data.data.basic.map(item => {
                    // item.date vem como "2025-11-17"
                    const parts = item.date.split('-');
                    const day = parts[2];
                    const month = parts[1];
                    return `${day}/${month}`;
                }),
                datasets: [{
                    label: 'Documentos Enviados',
                    data: data.data.basic.map(item => item.count),
                    backgroundColor: 'rgba(33, 150, 243, 0.8)',
                    borderColor: '#2196F3',
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: 'rgba(33, 150, 243, 1)',
                    hoverBorderColor: '#1976D2',
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 16,
                        displayColors: false,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            title: function(context) {
                                const index = context[0].dataIndex;
                                const dateStr = data.data.basic[index].date;
                                
                                // ✅ CORREÇÃO: Parse manual da data
                                const parts = dateStr.split('-');
                                const year = parseInt(parts[0]);
                                const month = parseInt(parts[1]) - 1; // JavaScript mês começa em 0
                                const day = parseInt(parts[2]);
                                
                                // Criar data sem conversão de timezone
                                const date = new Date(year, month, day);
                                
                                return date.toLocaleDateString('pt-BR', { 
                                    weekday: 'long', 
                                    day: '2-digit', 
                                    month: 'long' 
                                });
                            },
                            label: function(context) {
                                const count = context.parsed.y;
                                return `${count} documento${count !== 1 ? 's' : ''} enviado${count !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#999',
                            font: {
                                size: 12
                            },
                            callback: function(value) {
                                return Math.floor(value);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#999',
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });

        // ✅ Forçar resize após criação
        setTimeout(() => {
            if (chartsInstances.timeline) {
                chartsInstances.timeline.resize();
            }
        }, 100);

    } catch (error) {
        console.error('Timeline chart error:', error);
    }
}

async function loadTypeChart() {
  try {
    const response = await auth.fetchWithAuth(
      `${API_BASE}/analytics/charts/documents-by-type`
    );
    const data = await response.json();

    if (data.success && data.data.basic.length > 0) {
      const ctx = document.getElementById("typeChart");
      if (!ctx) return;

      if (chartsInstances.type) {
        chartsInstances.type.destroy();
      }

      chartsInstances.type = new Chart(ctx.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: data.data.basic.map((item) => item.type || "Sem tipo"),
          datasets: [
            {
              data: data.data.basic.map((item) => item.count),
              backgroundColor: [
                "#FF6384",
                "#36A2EB",
                "#FFCE56",
                "#4BC0C0",
                "#9966FF",
                "#FF9F40",
                "#FF6384",
                "#C9CBCF",
              ],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "right" },
          },
        },
      });
    }
  } catch (error) {
    console.error("Type chart error:", error);
  }
}

async function loadSignatureChart() {
  try {
    const response = await auth.fetchWithAuth(
      `${API_BASE}/analytics/charts/signature-status`
    );
    const data = await response.json();

    if (data.success) {
      const ctx = document.getElementById("signatureChart");
      if (!ctx) return;

      if (chartsInstances.signature) {
        chartsInstances.signature.destroy();
      }

      chartsInstances.signature = new Chart(ctx.getContext("2d"), {
        type: "pie",
        data: {
          labels: data.data.basic.map((item) => item.status),
          datasets: [
            {
              data: data.data.basic.map((item) => item.count),
              backgroundColor: ["#28a745", "#dc3545"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
          },
        },
      });
    }
  } catch (error) {
    console.error("Signature chart error:", error);
  }
}

// =============================================================================
// UPLOAD SYSTEM
// =============================================================================

function setupUploadSystem() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const clearBtn = document.getElementById("clearBtn");

  if (!dropZone || !fileInput || !uploadBtn) return;

  // Drag & Drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    addFilesToList(files);
  });

  // File selection
  fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    addFilesToList(files);
  });

  // Upload button
  uploadBtn.addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
      showToast("Selecione pelo menos um arquivo", "error");
      return;
    }
    await uploadFiles();
  });

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selectedFiles = [];
      updateFileList();
      uploadBtn.disabled = true;
    });
  }
}

function addFilesToList(files) {
  files.forEach((file) => {
    if (
      file.type === "application/pdf" &&
      !selectedFiles.find((f) => f.name === file.name)
    ) {
      selectedFiles.push(file);
    }
  });
  updateFileList();

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) {
    uploadBtn.disabled = selectedFiles.length === 0;
  }
}

function updateFileList() {
  const fileList = document.getElementById("fileList");
  if (!fileList) return;

  if (selectedFiles.length === 0) {
    fileList.innerHTML =
      '<p class="empty-state">Nenhum arquivo selecionado</p>';
    return;
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const filesHTML = selectedFiles
    .map((file, index) => {
      const isTooBig = file.size > MAX_FILE_SIZE;
      const sizeClass = isTooBig ? "text-danger" : "";

      return `
            <div class="file-item ${isTooBig ? "file-error" : ""}">
                <div class="file-icon">📄</div>
                <div class="file-info">
                    <strong>${file.name}</strong>
                    <small class="${sizeClass}">
                        ${formatFileSize(file.size)} 
                        ${isTooBig ? "⚠️ Muito grande (máx 50MB)" : ""}
                    </small>
                </div>
                <button class="btn-icon" onclick="removeFile(${index})" title="Remover">
                    🗑️
                </button>
            </div>
        `;
    })
    .join("");

  const warningHTML = selectedFiles.some((f) => f.size > MAX_FILE_SIZE)
    ? '<p class="warning">⚠️ Alguns arquivos excedem 50MB e não serão enviados</p>'
    : "";

  fileList.innerHTML = warningHTML + filesHTML;
}

window.removeFile = (index) => {
  selectedFiles.splice(index, 1);
  updateFileList();

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) {
    uploadBtn.disabled = selectedFiles.length === 0;
  }
};

async function uploadFiles() {
  const uploadBtn = document.getElementById("uploadBtn");
  const resultsDiv = document.getElementById("uploadResults");

  // Validar tamanho máximo
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const validFiles = selectedFiles.filter((f) => f.size <= MAX_FILE_SIZE);

  if (validFiles.length === 0) {
    showToast("Todos os arquivos excedem o tamanho máximo", "error");
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<span class="spinner"></span> Enviando...';

  try {
    const formData = new FormData();
    validFiles.forEach((file) => {
      formData.append("files[]", file);
    });

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.getToken()}`,
      },
      body: formData,
    });

    const data = await response.json();

    // ✅ CORREÇÃO: Backend retorna { success, message, data }
    if (data.success) {
      showUploadResults(data.data);
      showToast(data.message, "success");

      // Limpar arquivos selecionados
      selectedFiles = [];
      updateFileList();

      // Recarregar dashboard se estiver ativo
      const dashboardSection = document.getElementById("dashboardSection");
      if (dashboardSection && dashboardSection.classList.contains("active")) {
        loadDashboard();
      }
    } else {
      showToast(data.message || "Erro no upload", "error");
    }
  } catch (error) {
    console.error("Upload error:", error);
    showToast("Erro ao enviar arquivos", "error");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = "📤 Enviar PDFs";
  }
}

function showUploadResults(results) {
  const resultsDiv = document.getElementById("uploadResults");
  if (!resultsDiv) return;

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  let resultsHTML = `
        <div class="results-summary ${
          successCount === totalCount ? "success" : "partial"
        }">
            <strong>✅ ${successCount} de ${totalCount} arquivos enviados com sucesso!</strong>
        </div>
        <div class="results-list">
    `;

  results.forEach((result) => {
    resultsHTML += `
            <div class="result-item ${result.success ? "success" : "error"}">
                <span class="result-icon">${result.success ? "✓" : "✗"}</span>
                <div class="result-info">
                    <strong>${result.filename}</strong>
                    ${
                      result.success
                        ? `<small>ID: ${result.document_id} | ${formatFileSize(
                            result.size
                          )} | ${result.pages} páginas</small>`
                        : `<small class="error-text">${result.error}</small>`
                    }
                </div>
            </div>
        `;
  });

  resultsHTML += "</div>";
  resultsDiv.innerHTML = resultsHTML;
  resultsDiv.style.display = "block";

  // Auto-hide após 5 segundos
  setTimeout(() => {
    resultsDiv.style.display = "none";
  }, 5000);
}

// =============================================================================
// DOCUMENTS LIST
// =============================================================================

async function loadDocuments(page = 1) {
  try {
    const search = document.getElementById("searchInput")?.value || "";
    const docType = document.getElementById("typeFilter")?.value || "";

    let url = `${API_BASE}/documents/?page=${page}&per_page=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (docType) url += `&doc_type=${encodeURIComponent(docType)}`;

    const response = await auth.fetchWithAuth(url);
    const data = await response.json();

    // ✅ CORREÇÃO: Backend retorna { success, data: { documents, pagination } }
    if (data.success) {
      documentsData = data.data.documents;
      currentPage = page;
      renderDocuments(documentsData);
      renderPagination(data.data.pagination);
    } else {
      showToast("Erro ao carregar documentos", "error");
    }
  } catch (error) {
    console.error("Load documents error:", error);
    showToast("Erro de conexão", "error");
  }
}

function renderDocuments(documents) {
  const tbody = document.getElementById("documentsTableBody");
  if (!tbody) return;

  if (!documents || documents.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Nenhum documento encontrado. Faça upload de PDFs para começar.
                </td>
            </tr>
        `;
    return;
  }

  const rows = documents
    .map(
      (doc) => `
        <tr data-doc-id="${doc.id}">
            <td>
                <input type="checkbox" 
                       class="doc-checkbox" 
                       value="${doc.id}" 
                       onchange="toggleDocumentSelection(${doc.id})">
            </td>
            <td>${doc.id}</td>
            <td>
                <strong>${doc.title || doc.original_filename}</strong>
                <br><small>${doc.original_filename}</small>
            </td>
            <td>${doc.author || "-"}</td>
            <td>${doc.doc_type || "-"}</td>
            <td>${formatFileSize(doc.file_size)}</td>
            <td>
                <span class="badge ${
                  doc.is_signed ? "badge-success" : "badge-secondary"
                }">
                    ${doc.is_signed ? "✓ Assinado" : "⋯ Pendente"}
                </span>
            </td>
            <td>${formatDate(doc.uploaded_at)}</td>
            <td class="actions">
                <button class="btn-icon" onclick="viewDocument(${
                  doc.id
                })" title="Visualizar">
                    👁️
                </button>
                <button class="btn-icon" onclick="downloadDocument(${
                  doc.id
                })" title="Download">
                    📥
                </button>
                ${
                  auth.hasPermission("delete")
                    ? `
                    <button class="btn-icon btn-danger" onclick="deleteDocument(${doc.id})" title="Deletar">
                        🗑️
                    </button>
                `
                    : ""
                }
            </td>
        </tr>
    `
    )
    .join("");

  tbody.innerHTML = rows;
}

function renderPagination(pagination) {
  const paginationDiv = document.getElementById("pagination");
  if (!paginationDiv) return;

  const { current_page, pages, total } = pagination;

  if (pages <= 1) {
    paginationDiv.innerHTML = "";
    return;
  }

  let paginationHTML = '<div class="pagination-controls">';

  // Previous button
  paginationHTML += `
        <button class="btn-pagination" 
                onclick="loadDocuments(${current_page - 1})" 
                ${current_page === 1 ? "disabled" : ""}>
            ← Anterior
        </button>
    `;

  // Page numbers
  for (let i = 1; i <= Math.min(pages, 5); i++) {
    paginationHTML += `
            <button class="btn-pagination ${
              i === current_page ? "active" : ""
            }" 
                    onclick="loadDocuments(${i})">
                ${i}
            </button>
        `;
  }

  // Next button
  paginationHTML += `
        <button class="btn-pagination" 
                onclick="loadDocuments(${current_page + 1})" 
                ${current_page === pages ? "disabled" : ""}>
            Próxima →
        </button>
    `;

  paginationHTML += `<span class="pagination-info">Total: ${total} documentos</span></div>`;
  paginationDiv.innerHTML = paginationHTML;
}

// =============================================================================
// BATCH ACTIONS
// =============================================================================

function setupBatchActions() {
  // Botão "Selecionar Todos"
  const selectAllBtn = document.getElementById("selectAllBtn");
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", toggleSelectAll);
  }

  // Botão "Adicionar Metadados"
  const batchMetadataBtn = document.getElementById("batchMetadataBtn");
  if (batchMetadataBtn) {
    batchMetadataBtn.addEventListener("click", openBatchMetadataModal);
  }

  // Botão "Deletar Selecionados"
  const batchDeleteBtn = document.getElementById("batchDeleteBtn");
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener("click", deleteManyDocuments);
  }
}

function toggleDocumentSelection(docId) {
  if (selectedDocuments.has(docId)) {
    selectedDocuments.delete(docId);
  } else {
    selectedDocuments.add(docId);
  }
  updateBatchActionsBar();
}

function toggleSelectAll() {
  const checkboxes = document.querySelectorAll(".doc-checkbox");

  if (selectedDocuments.size === documentsData.length) {
    // Desmarcar todos
    selectedDocuments.clear();
    checkboxes.forEach((cb) => (cb.checked = false));
  } else {
    // Marcar todos
    selectedDocuments.clear();
    documentsData.forEach((doc) => selectedDocuments.add(doc.id));
    checkboxes.forEach((cb) => (cb.checked = true));
  }

  updateBatchActionsBar();
}

function updateBatchActionsBar() {
  const bar = document.getElementById("batchActionsBar");
  const countSpan = document.getElementById("selectedCount");

  if (!bar) return;

  if (selectedDocuments.size > 0) {
    bar.style.display = "flex";
    if (countSpan) {
      countSpan.textContent = selectedDocuments.size;
    }
  } else {
    bar.style.display = "none";
  }
}

function openBatchMetadataModal() {
  if (selectedDocuments.size === 0) {
    showToast("Selecione pelo menos um documento", "error");
    return;
  }

  const modal = document.getElementById("batchMetadataModal");
  const count = document.getElementById("batchDocCount");

  if (modal && count) {
    count.textContent = selectedDocuments.size;
    modal.style.display = "flex";
  }
}

async function submitBatchMetadata(event) {
  event.preventDefault();

  const metadata = {
    author: document.getElementById("batchAuthor")?.value || "",
    subject: document.getElementById("batchSubject")?.value || "",
    doc_type: document.getElementById("batchDocType")?.value || "",
    keywords: document.getElementById("batchKeywords")?.value || "",
  };

  // Validação: pelo menos um campo preenchido
  if (
    !metadata.author &&
    !metadata.subject &&
    !metadata.doc_type &&
    !metadata.keywords
  ) {
    showToast("Preencha pelo menos um campo", "error");
    return;
  }

  // Mostrar progress
  const progressDiv = document.getElementById("batchProgress");
  if (progressDiv) {
    progressDiv.style.display = "block";
  }

  try {
    const response = await fetch(`${API_BASE}/documents/batch/metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.getToken()}`,
      },
      body: JSON.stringify({
        document_ids: Array.from(selectedDocuments),
        metadata: metadata,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Iniciar polling do status
      pollBatchStatus(data.task_id);
    } else {
      throw new Error(data.message || "Erro ao processar");
    }
  } catch (error) {
    console.error("Batch metadata error:", error);
    showToast(`Erro: ${error.message}`, "error");
    if (progressDiv) {
      progressDiv.style.display = "none";
    }
  }
}

async function pollBatchStatus(taskId) {
  const maxAttempts = 30;
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    try {
      const response = await fetch(
        `${API_BASE}/documents/batch/status/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        const status = data.status;
        const result = data.result;

        // Atualizar UI
        updateBatchProgress(status, result);

        // Verificar se concluído
        if (status === "completed" || status === "failed") {
          clearInterval(interval);
          showBatchResults(status, result);

          // Recarregar documentos
          setTimeout(() => {
            loadDocuments(currentPage);
          }, 1500);
        }
      }

      // Timeout
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        showToast("Timeout: processamento demorou muito", "error");
      }
    } catch (error) {
      console.error("Poll error:", error);
      clearInterval(interval);
      showToast("Erro ao verificar status", "error");
    }
  }, 1000); // Verificar a cada 1 segundo
}

function updateBatchProgress(status, result) {
  const progressText = document.getElementById("batchProgressText");
  const progressBar = document.getElementById("batchProgressBar");

  if (progressText) {
    if (result && result.total) {
      const processed = result.success || 0;
      progressText.textContent = `Processando: ${processed}/${result.total} documentos`;

      if (progressBar) {
        const percentage = (processed / result.total) * 100;
        progressBar.style.width = `${percentage}%`;
      }
    } else {
      progressText.textContent = `Status: ${status}`;
    }
  }
}

function showBatchResults(status, result) {
  const progressDiv = document.getElementById("batchProgress");
  const resultsDiv = document.getElementById("batchResults");

  if (progressDiv) progressDiv.style.display = "none";
  if (!resultsDiv) return;

  if (status === "completed") {
    resultsDiv.innerHTML = `
            <div class="success-message">
                ✅ ${result.success} de ${result.total} documentos processados com sucesso!
            </div>
            <button class="btn-primary" onclick="closeBatchModal()">
                Fechar e Atualizar
            </button>
        `;
    resultsDiv.style.display = "block";
    showToast("Batch processing concluído!", "success");
  } else {
    resultsDiv.innerHTML = `
            <div class="error-message">
                ❌ Erro no processamento
                <p>${result.error || "Erro desconhecido"}</p>
            </div>
            <button class="btn-secondary" onclick="closeBatchModal()">
                Fechar
            </button>
        `;
    resultsDiv.style.display = "block";
    showToast("Erro no batch processing", "error");
  }

  // Limpar seleção
  selectedDocuments.clear();
  updateBatchActionsBar();
}

function closeBatchModal() {
  const modal = document.getElementById("batchMetadataModal");
  const form = document.getElementById("batchMetadataForm");
  const progressDiv = document.getElementById("batchProgress");
  const resultsDiv = document.getElementById("batchResults");

  if (modal) modal.style.display = "none";
  if (form) form.reset();
  if (progressDiv) progressDiv.style.display = "none";
  if (resultsDiv) resultsDiv.style.display = "none";

  // Recarregar documentos
  loadDocuments(currentPage);
}

// =============================================================================
// DOCUMENT ACTIONS
// =============================================================================

async function viewDocument(docId) {
  try {
    console.log("📄 Carregando documento ID:", docId);

    const response = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}`);
    const data = await response.json();

    console.log("✅ Resposta do backend:", data);

    if (data.success && data.data) {
      showDocumentModal(data.data);
    } else {
      console.error("❌ Resposta sem sucesso:", data);
      showToast(data.message || "Erro ao carregar documento", "error");
    }
  } catch (error) {
    console.error("❌ View document error:", error);
    showToast("Erro de conexão", "error");
  }
}

async function downloadDocument(docId) {
  try {
    const response = await fetch(`${API_BASE}/documents/${docId}/download`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.getToken()}`,
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Pegar filename do header Content-Disposition
      const disposition = response.headers.get("Content-Disposition");
      let filename = "document.pdf";
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?(.+)"?/);
        if (filenameMatch) filename = filenameMatch[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast("Download iniciado", "success");
    } else {
      showToast("Erro ao baixar documento", "error");
    }
  } catch (error) {
    console.error("Download error:", error);
    showToast("Erro de conexão", "error");
  }
}

async function deleteDocument(docId) {
  if (!confirm("Tem certeza que deseja deletar este documento?")) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/documents/${docId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${auth.getToken()}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      showToast("Documento deletado com sucesso", "success");
      loadDocuments(currentPage);
    } else {
      showToast(data.message || "Erro ao deletar", "error");
    }
  } catch (error) {
    console.error("Delete error:", error);
    showToast("Erro de conexão", "error");
  }
}

async function deleteManyDocuments() {
  if (selectedDocuments.size === 0) {
    showToast("Selecione documentos para deletar", "error");
    return;
  }

  if (!confirm(`Deletar ${selectedDocuments.size} documentos selecionados?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/documents/delete_many`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.getToken()}`,
      },
      body: JSON.stringify({
        document_ids: Array.from(selectedDocuments),
      }),
    });

    const data = await response.json();

    if (data.success) {
      showToast(data.message, "success");
      selectedDocuments.clear();
      updateBatchActionsBar();
      loadDocuments(currentPage);
    } else {
      showToast(data.message || "Erro ao deletar", "error");
    }
  } catch (error) {
    console.error("Delete many error:", error);
    showToast("Erro de conexão", "error");
  }
}

// =============================================================================
// MODALS
// =============================================================================

function setupModals() {
  // Fechar modals ao clicar fora
  window.onclick = (event) => {
    if (event.target.classList.contains("modal")) {
      event.target.style.display = "none";
    }
  };

  // Form de batch metadata
  const batchForm = document.getElementById("batchMetadataForm");
  if (batchForm) {
    batchForm.addEventListener("submit", submitBatchMetadata);
  }
}

function showDocumentModal(doc) {
  // ✅ Mudou de 'document' para 'doc'
  console.log("🔍 Abrindo modal para documento:", doc);

  const modal = document.getElementById("documentModal"); // ✅ Agora funciona!
  const content = document.getElementById("documentModalContent");

  if (!modal) {
    console.error("❌ Modal #documentModal não encontrado no HTML");
    return;
  }

  if (!content) {
    console.error("❌ Content #documentModalContent não encontrado no HTML");
    return;
  }

  const modalHTML = `
        <div class="document-details">
            <div class="detail-row">
                <strong>ID:</strong>
                <span>${doc.id}</span>
            </div>
            <div class="detail-row">
                <strong>Título:</strong>
                <span>${doc.title || "-"}</span>
            </div>
            <div class="detail-row">
                <strong>Arquivo Original:</strong>
                <span>${doc.original_filename}</span>
            </div>
            <div class="detail-row">
                <strong>Autor:</strong>
                <span>${doc.author || "-"}</span>
            </div>
            <div class="detail-row">
                <strong>Assunto:</strong>
                <span>${doc.subject || "-"}</span>
            </div>
            <div class="detail-row">
                <strong>Tipo:</strong>
                <span>${doc.doc_type || "-"}</span>
            </div>
            <div class="detail-row">
                <strong>Palavras-chave:</strong>
                <span>${doc.keywords || "-"}</span>
            </div>
            <div class="detail-row">
                <strong>Tamanho:</strong>
                <span>${formatFileSize(doc.file_size)}</span>
            </div>
            <div class="detail-row">
                <strong>Hash SHA-256:</strong>
                <span><code style="font-size: 11px; word-break: break-all;">${
                  doc.file_hash
                }</code></span>
            </div>
            <div class="detail-row">
                <strong>Upload:</strong>
                <span>${formatDate(doc.uploaded_at)}</span>
            </div>
            <div class="detail-row">
                <strong>Última Atualização:</strong>
                <span>${formatDate(doc.updated_at)}</span>
            </div>
            <div class="detail-row">
                <strong>Assinado:</strong>
                <span class="badge ${
                  doc.is_signed ? "badge-success" : "badge-secondary"
                }">
                    ${doc.is_signed ? "✓ Sim" : "✗ Não"}
                </span>
            </div>
            ${
              doc.signed_at
                ? `
                <div class="detail-row">
                    <strong>Data da Assinatura:</strong>
                    <span>${formatDate(doc.signed_at)}</span>
                </div>
            `
                : ""
            }
        </div>

        ${
          doc.audit_logs && doc.audit_logs.length > 0
            ? `
            <div class="audit-logs-section">
                <div class="audit-header">
                    <h3>
                        <span class="audit-icon">📋</span>
                        Histórico de Auditoria
                    </h3>
                    <span class="audit-count">${doc.audit_logs.length} ${doc.audit_logs.length === 1 ? 'evento' : 'eventos'}</span>
                </div>
                <div class="audit-timeline">
                    ${doc.audit_logs
                      .map((log, index) => {
                        const { icon, color } = getAuditIconAndColor(log.action);
                        const actionName = formatAuditAction(log.action);
                        const isFirst = index === 0;
                        const isLast = index === doc.audit_logs.length - 1;

                        return `
                        <div class="audit-item ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}">
                            <div class="audit-connector"></div>
                            <div class="audit-icon-badge ${color}">
                                <span>${icon}</span>
                            </div>
                            <div class="audit-content">
                                <div class="audit-content-header">
                                    <strong class="audit-action">${actionName}</strong>
                                    <span class="audit-timestamp">${formatDate(log.timestamp)}</span>
                                </div>
                                ${log.description ? `
                                    <p class="audit-description">${log.description}</p>
                                ` : ''}
                                <div class="audit-meta">
                                    ${log.user_id ? `<span class="audit-meta-item">
                                        <span class="meta-icon">👤</span>
                                        <span>User ID: ${log.user_id}</span>
                                    </span>` : ''}
                                    ${log.ip_address ? `<span class="audit-meta-item">
                                        <span class="meta-icon">🌐</span>
                                        <span>IP: ${log.ip_address}</span>
                                    </span>` : ''}
                                </div>
                            </div>
                        </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>
        `
            : `
            <div class="audit-logs-section">
                <div class="audit-header">
                    <h3>
                        <span class="audit-icon">📋</span>
                        Histórico de Auditoria
                    </h3>
                </div>
                <div class="audit-empty">
                    <div class="empty-icon">📭</div>
                    <p>Nenhum evento de auditoria registrado</p>
                </div>
            </div>
        `
        }
        
        <div class="modal-actions">
            <button class="btn-primary" onclick="downloadDocument(${doc.id})">
                📥 Download
            </button>
            ${
              auth.hasPermission("delete")
                ? `
                <button class="btn-danger" onclick="if(confirm('Deletar documento?')) { deleteDocument(${doc.id}); closeDocumentModal(); }">
                    🗑️ Deletar
                </button>
            `
                : ""
            }
            <button class="btn-secondary" onclick="closeDocumentModal()">
                Fechar
            </button>
        </div>
    `;

  content.innerHTML = modalHTML;
  modal.style.display = "flex";

  console.log("✅ Modal exibido com sucesso");
}

function closeDocumentModal() {
  const modal = document.getElementById("documentModal");
  if (modal) {
    modal.style.display = "none";
    console.log("✅ Modal fechado");
  }
}

// ========================================
// USERS MANAGEMENT - ADMIN ONLY
// ========================================

async function loadUsers() {
    if (!auth.isAdmin()) {
        showToast('Acesso negado', 'error');
        return;
    }

    try {
        const response = await auth.fetchWithAuth(`${API_BASE}/auth/users`);
        const data = await response.json();

        if (response.ok && data.users) {
            renderUsers(data.users);
        } else {
            showToast('Erro ao carregar usuários', 'error');
        }
    } catch (error) {
        console.error('Load users error:', error);
        showToast('Erro de conexão', 'error');
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">Nenhum usuário encontrado</td></tr>`;
        return;
    }

    const currentUserId = auth.getUserInfo()?.id;

    const rows = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${user.role.toUpperCase()}</span></td>
            <td>
                <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                    ${user.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td class="actions">
                <button class="btn-icon" onclick="editUser(${user.id})" title="Editar">✏️</button>
                ${user.id !== currentUserId ? `
                    <button class="btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Deletar">🗑️</button>
                ` : ''}
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = rows;
}

function openCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    const form = document.getElementById('createUserForm');
    
    if (!modal) {
        console.error('Modal createUserModal não encontrado');
        return;
    }

    if (form) {
        form.reset();
    }

    modal.style.display = 'flex';
}

function closeCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    const form = document.getElementById('createUserForm');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (form) {
        form.reset();
    }
}

async function createUser(event) {
    event.preventDefault();

    const userData = {
        name: document.getElementById('newUserName')?.value,
        email: document.getElementById('newUserEmail')?.value,
        password: document.getElementById('newUserPassword')?.value,
        role: document.getElementById('newUserRole')?.value || 'user',
        is_active: document.getElementById('newUserActive')?.checked !== false
    };

    // Validação
    if (!userData.name || !userData.email || !userData.password) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.getToken()}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok && data.user) {
            showToast('Usuário criado com sucesso!', 'success');
            closeCreateUserModal();
            loadUsers(); // Recarregar lista
        } else {
            showToast(data.error || 'Erro ao criar usuário', 'error');
        }
    } catch (error) {
        console.error('Create user error:', error);
        showToast('Erro de conexão', 'error');
    }
}

async function editUser(userId) {
    try {
        // Buscar dados do usuário
        const response = await auth.fetchWithAuth(`${API_BASE}/auth/users`);
        const data = await response.json();

        if (!response.ok || !data.users) {
            showToast('Erro ao carregar usuário', 'error');
            return;
        }

        const user = data.users.find(u => u.id === userId);
        if (!user) {
            showToast('Usuário não encontrado', 'error');
            return;
        }

        // Abrir modal de edição
        openEditUserModal(user);
    } catch (error) {
        console.error('Edit user error:', error);
        showToast('Erro de conexão', 'error');
    }
}

function openEditUserModal(user) {
    const modal = document.getElementById('editUserModal');
    
    if (!modal) {
        console.error('Modal editUserModal não encontrado');
        return;
    }

    // Preencher campos
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserName').value = user.name;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserRole').value = user.role;
    document.getElementById('editUserActive').checked = user.is_active;

    modal.style.display = 'flex';
}

function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (form) {
        form.reset();
    }
}

async function updateUser(event) {
    event.preventDefault();

    const userId = document.getElementById('editUserId')?.value;
    const userData = {
        name: document.getElementById('editUserName')?.value,
        email: document.getElementById('editUserEmail')?.value,
        role: document.getElementById('editUserRole')?.value,
        is_active: document.getElementById('editUserActive')?.checked
    };

    const newPassword = document.getElementById('editUserPassword')?.value;
    if (newPassword) {
        userData.password = newPassword;
    }

    if (!userId || !userData.name || !userData.email) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.getToken()}`
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Usuário atualizado com sucesso!', 'success');
            closeEditUserModal();
            loadUsers(); // Recarregar lista
        } else {
            showToast(data.error || 'Erro ao atualizar usuário', 'error');
        }
    } catch (error) {
        console.error('Update user error:', error);
        showToast('Erro de conexão', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${auth.getToken()}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Usuário deletado com sucesso!', 'success');
            loadUsers(); // Recarregar lista
        } else {
            showToast(data.error || 'Erro ao deletar usuário', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast('Erro de conexão', 'error');
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Relativo para datas recentes
  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;

  // Data formatada para mais antigos
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// EXPORTAR FUNÇÕES GLOBAIS
// =============================================================================

window.loadDocuments = loadDocuments;
window.toggleDocumentSelection = toggleDocumentSelection;
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.deleteDocument = deleteDocument;
window.closeBatchModal = closeBatchModal;
window.closeDocumentModal = closeDocumentModal;
window.loadUsers = loadUsers;
window.openCreateUserModal = openCreateUserModal;
window.closeCreateUserModal = closeCreateUserModal;
window.createUser = createUser;
window.editUser = editUser;
window.closeEditUserModal = closeEditUserModal;
window.updateUser = updateUser;
window.deleteUser = deleteUser;