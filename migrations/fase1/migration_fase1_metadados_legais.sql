-- =====================================================
-- CAMPS PDF Manager v2.0 - Migration FASE 1
-- Metadados e Conformidade Legal
-- Data: 19/11/2025
-- Conformidade: Decreto 10.278/2020
-- =====================================================

-- =====================================================
-- 1. ADICIONAR NOVOS CAMPOS NA TABELA USERS
-- =====================================================

-- CPF/CNPJ do usuário (para auto-preencher digitizer_cpf_cnpj)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(18);

-- =====================================================
-- 2. ADICIONAR NOVOS CAMPOS NA TABELA DOCUMENTS
-- =====================================================

-- METADADOS OBRIGATÓRIOS (Decreto 10.278/2020)
-- Responsável pela digitalização
ALTER TABLE documents ADD COLUMN IF NOT EXISTS digitizer_name VARCHAR(200) NOT NULL DEFAULT 'Nome Pendente';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS digitizer_cpf_cnpj VARCHAR(18) NOT NULL DEFAULT '00000000000';

-- Resolução da digitalização
ALTER TABLE documents ADD COLUMN IF NOT EXISTS resolution_dpi INTEGER NOT NULL DEFAULT 300;

-- Equipamento utilizado
ALTER TABLE documents ADD COLUMN IF NOT EXISTS equipment_info VARCHAR(200);

-- ORGANIZAÇÃO
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_cnpj VARCHAR(18);

-- TIPO E CATEGORIA DO DOCUMENTO
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_category VARCHAR(100);

-- DOCUSIGN (preparação para FASE 2)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS docusign_envelope_id VARCHAR(100) UNIQUE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS docusign_status VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS docusign_sent_date TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS docusign_signed_date TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_document_url VARCHAR(500);

-- =====================================================
-- 3. REMOVER CAMPOS NÃO OBRIGATÓRIOS
-- =====================================================

-- Remover keywords (não é obrigatório legalmente)
ALTER TABLE documents DROP COLUMN IF EXISTS keywords;

-- =====================================================
-- 4. ATUALIZAR DOCUMENTOS EXISTENTES
-- =====================================================

-- Atualizar documentos que ainda têm valores padrão
UPDATE documents 
SET 
    digitizer_name = 'Digitalizador Padrão',
    digitizer_cpf_cnpj = '00000000000000',
    resolution_dpi = 300,
    equipment_info = 'Scanner Digital',
    company_name = 'CAMPS Santos',
    document_type = 'Contrato de Aprendizagem',
    document_category = 'Trabalhista'
WHERE digitizer_name = 'Nome Pendente' OR digitizer_cpf_cnpj = '00000000000';

-- =====================================================
-- 5. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice para busca por responsável
CREATE INDEX IF NOT EXISTS idx_documents_digitizer_name 
ON documents(digitizer_name);

-- Índice para busca por CPF/CNPJ
CREATE INDEX IF NOT EXISTS idx_documents_digitizer_cpf_cnpj 
ON documents(digitizer_cpf_cnpj);

-- Índice para busca por tipo de documento
CREATE INDEX IF NOT EXISTS idx_documents_document_type 
ON documents(document_type);

-- Índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_documents_document_category 
ON documents(document_category);

-- Índice para status DocuSign
CREATE INDEX IF NOT EXISTS idx_documents_docusign_status 
ON documents(docusign_status);

-- =====================================================
-- 6. ADICIONAR CONSTRAINTS DE VALIDAÇÃO
-- =====================================================

-- Garantir que CPF/CNPJ tenha formato válido (11 ou 14 dígitos)
ALTER TABLE documents ADD CONSTRAINT chk_digitizer_cpf_cnpj_format
CHECK (LENGTH(REPLACE(digitizer_cpf_cnpj, '.', '')) IN (11, 14));

-- Garantir que resolução seja >= 150 DPI (mínimo recomendado)
ALTER TABLE documents ADD CONSTRAINT chk_resolution_dpi_minimum
CHECK (resolution_dpi >= 150);

-- =====================================================
-- 7. ATUALIZAR TRIGGERS (se existentes)
-- =====================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. VERIFICAR INTEGRIDADE DOS DADOS
-- =====================================================

-- Verificar documentos sem digitizer_name
SELECT COUNT(*) as documentos_sem_digitizer
FROM documents 
WHERE digitizer_name IS NULL OR digitizer_name = '';

-- Verificar documentos sem CPF/CNPJ
SELECT COUNT(*) as documentos_sem_cpf_cnpj
FROM documents 
WHERE digitizer_cpf_cnpj IS NULL OR digitizer_cpf_cnpj = '';

-- Verificar documentos com resolução baixa
SELECT COUNT(*) as documentos_resolucao_baixa
FROM documents 
WHERE resolution_dpi < 150;

-- =====================================================
-- 9. CRIAR VIEW PARA CONFORMIDADE LEGAL
-- =====================================================

CREATE OR REPLACE VIEW vw_documents_compliance AS
SELECT 
    d.id,
    d.filename,
    d.original_filename,
    d.digitizer_name,
    d.digitizer_cpf_cnpj,
    d.resolution_dpi,
    d.equipment_info,
    d.file_hash,
    d.company_name,
    d.company_cnpj,
    d.document_type,
    d.document_category,
    d.is_signed,
    d.docusign_status,
    d.uploaded_at,
    u.name as uploader_name,
    u.email as uploader_email,
    -- Verificação de conformidade
    CASE 
        WHEN d.digitizer_name IS NOT NULL 
         AND d.digitizer_cpf_cnpj IS NOT NULL 
         AND d.resolution_dpi >= 150 
         AND d.file_hash IS NOT NULL 
        THEN 'CONFORME'
        ELSE 'NÃO CONFORME'
    END as compliance_status
FROM documents d
LEFT JOIN users u ON d.uploaded_by = u.id;

-- =====================================================
-- 10. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN documents.digitizer_name IS 'Nome do responsável pela digitalização (Decreto 10.278/2020 Art. 5º)';
COMMENT ON COLUMN documents.digitizer_cpf_cnpj IS 'CPF/CNPJ do responsável pela digitalização (Decreto 10.278/2020 Art. 5º)';
COMMENT ON COLUMN documents.resolution_dpi IS 'Resolução da digitalização em DPI (mínimo 150, recomendado 300)';
COMMENT ON COLUMN documents.equipment_info IS 'Informações sobre o equipamento utilizado na digitalização';
COMMENT ON COLUMN documents.file_hash IS 'Hash SHA-256 para garantir integridade do documento';
COMMENT ON COLUMN documents.company_name IS 'Nome da organização responsável pelo documento';
COMMENT ON COLUMN documents.company_cnpj IS 'CNPJ da organização';
COMMENT ON COLUMN documents.document_type IS 'Tipo do documento (ex: Contrato de Aprendizagem)';
COMMENT ON COLUMN documents.document_category IS 'Categoria do documento (ex: Trabalhista)';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration FASE 1 concluída com sucesso!';
    RAISE NOTICE '📋 Novos campos adicionados para conformidade legal';
    RAISE NOTICE '❌ Campo keywords removido';
    RAISE NOTICE '🔒 Constraints de validação criados';
    RAISE NOTICE '📊 View de conformidade criada';
END $$;
