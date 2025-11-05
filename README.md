# 🏢 CAMPS PDF Manager v2.0

## 📋 Visão Geral

Sistema completo de gerenciamento de PDFs com certificação digital, autenticação JWT e dashboard analytics para CAMPS Santos.

### 🚀 Funcionalidades Principais

- **Autenticação JWT** com controle de roles (Admin/User/Viewer)
- **Upload múltiplo** de PDFs com validação
- **Gestão de metadados** com padrões brasileiros
- **Dashboard analytics** com gráficos interativos
- **Sistema de auditoria** completo
- **Interface moderna** e responsiva
- **Integração DocuSign** para assinaturas digitais

---

## 🛠️ Instalação Rápida

### 1. Clone o Repositório
```bash
git clone https://github.com/EnzoVarani/campsPdfManager-v2.git
cd campsPdfManager-v2
```

### 2. Configure o Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edite .env com suas configurações
```

### 3. Execute a Aplicação
```bash
python run.py
```

### 4. Acesse o Frontend
Abra `frontend/index.html` no navegador ou configure um servidor local.

**Credenciais padrão:** admin@camps.com / admin123

---

## 📁 Estrutura do Projeto

```
campsPdfManager-v2/
├── backend/
│   ├── app/
│   │   ├── auth/           # Autenticação JWT
│   │   ├── routes/         # Endpoints da API
│   │   ├── services/       # Lógica de negócio
│   │   ├── utils/          # Utilitários e validadores
│   │   ├── models.py       # Modelos do banco
│   │   ├── config.py       # Configurações
│   │   └── __init__.py     # Factory da aplicação
│   ├── tests/              # Testes automatizados
│   ├── storage/            # Armazenamento de arquivos
│   ├── requirements.txt    # Dependências Python
│   ├── .env.example        # Template de configuração
│   └── run.py             # Entrada da aplicação
└── frontend/
    ├── index.html          # Interface principal
    ├── auth.js            # Sistema de autenticação
    ├── app.js             # Lógica da aplicação
    └── styles.css         # Estilos modernos
```

---

## 🔐 Sistema de Autenticação

### Roles Disponíveis:

| Role | Permissões |
|------|------------|
| **Admin** | Acesso total, gestão de usuários |
| **User** | Upload, edição, visualização |
| **Viewer** | Apenas visualização |

### Endpoints de Auth:

```http
POST /api/auth/login          # Login com email/senha
POST /api/auth/refresh        # Renovar token
GET  /api/auth/profile        # Dados do usuário atual
POST /api/auth/users          # Criar usuário (admin only)
GET  /api/auth/users          # Listar usuários (admin only)
```

---

## 📄 Gestão de Documentos

### Endpoints Principais:

```http
POST /api/documents/upload              # Upload de PDFs
GET  /api/documents                     # Listar com filtros
GET  /api/documents/{id}               # Detalhes do documento
POST /api/documents/{id}/metadata      # Adicionar metadados
GET  /api/documents/{id}/download      # Download do PDF
DELETE /api/documents/{id}            # Deletar documento
GET  /api/documents/stats              # Estatísticas rápidas
```

### Fluxo de Upload:
1. **Upload** → Validação → Hash → Banco
2. **Metadados** → Processamento → PDF com metadata
3. **Auditoria** → Log de todas as ações

---

## 📊 Dashboard e Analytics

### Métricas Disponíveis:
- Total de documentos
- Documentos assinados
- Uploads por período
- Distribuição por tipo
- Status de assinaturas
- Usuários ativos

### Gráficos Interativos:
- **Timeline:** Documentos ao longo do tempo
- **Tipos:** Distribuição por categoria
- **Assinaturas:** Status de certificação

---

## 🧪 Testes

```bash
# Executar testes
cd backend
pytest tests/ -v

# Testes específicos
pytest tests/test_auth.py -v
```

**Cobertura de Testes:**
- Autenticação e autorização
- Operações CRUD de documentos
- Validações de entrada
- Sistema de roles

---

## 🚀 Deploy

### Desenvolvimento:
```bash
python run.py
```
**URL:** http://localhost:5000

### Produção:
1. Configure PostgreSQL
2. Atualize `DATABASE_URL` no .env
3. Use `gunicorn` para servir a aplicação

---

## ⚙️ Configurações

### Variáveis de Ambiente Essenciais:

```env
# Flask
SECRET_KEY=sua_chave_super_secreta
JWT_SECRET_KEY=sua_jwt_chave_super_secreta

# Database
DATABASE_URL=sqlite:///camps.db

# CAMPS
COMPANY_NAME=CAMPS Santos
DEFAULT_LOCATION=Santos, SP, Brasil
ID_PREFIX=CAMPS

# Admin
ADMIN_EMAIL=admin@camps.com
ADMIN_PASSWORD=admin123

# DocuSign (opcional)
DOCUSIGN_INTEGRATION_KEY=seu_integration_key
DOCUSIGN_USER_ID=seu_user_id
DOCUSIGN_ACCOUNT_ID=seu_account_id
```

---

## 📋 Status do Desenvolvimento

### ✅ Implementado:
- [x] Sistema de autenticação JWT
- [x] Gestão de usuários e roles
- [x] Upload e validação de PDFs
- [x] Adição de metadados
- [x] Dashboard com gráficos
- [x] Interface frontend completa
- [x] Sistema de auditoria
- [x] Testes automatizados
- [x] API REST organizada

### 🔄 Próximas Melhorias:
- [ ] Integração DocuSign funcional
- [ ] Sistema de backup
- [ ] Relatórios em PDF
- [ ] Configuração Docker
- [ ] Deploy automático

---

## 🤝 Contribuição

Projeto desenvolvido para CAMPS Santos com foco em:
- **Segurança:** Autenticação robusta e controle de acesso
- **Usabilidade:** Interface intuitiva e moderna
- **Escalabilidade:** Arquitetura preparada para crescimento
- **Auditoria:** Rastreamento completo de ações

---

## 📞 Suporte

**Desenvolvido por:** Perplexity AI + Enzo Varani  
**Empresa:** CAMPS Santos  
**Versão:** 2.0.0  
**Python:** 3.12+ recomendado  
**License:** Uso interno CAMPS Santos  

---

**🎯 Sistema pronto para uso em produção!**