-- =====================================================
-- CAMPS PDF Manager v2.0 - Migração FASE 1
-- Decreto 10.278/2020 - Metadados Obrigatórios
-- =====================================================
-- Data: 2025-12-03
-- Objetivo: Adicionar campos FASE 1 ao modelo Document
-- =====================================================

-- 1. Adicionar campo CPF/CNPJ ao User (para auto-preenchimento)
ALTER TABLE users ADD COLUMN cpf_cnpj VARCHAR(18);

-- 2. Adicionar campos FASE 1 OBRIGATÓRIOS ao Document
-- Nota: Usamos nullable para compatibilidade com docs existentes
ALTER TABLE documents ADD COLUMN digitizer_name VARCHAR(200);
ALTER TABLE documents ADD COLUMN digitizer_cpf_cnpj VARCHAR(18);
ALTER TABLE documents ADD COLUMN resolution_dpi INTEGER DEFAULT 300;

-- 3. Adicionar campos RECOMENDADOS
ALTER TABLE documents ADD COLUMN equipment_info VARCHAR(200);
ALTER TABLE documents ADD COLUMN company_name VARCHAR(200);
ALTER TABLE documents ADD COLUMN company_cnpj VARCHAR(18);
ALTER TABLE documents ADD COLUMN document_category VARCHAR(100);

-- 4. Renomear campo doc_type para document_type (padron ização)
-- SQLite não suporta ALTER COLUMN, então usamos uma abordagem alternativa
ALTER TABLE documents ADD COLUMN document_type VARCHAR(100);

-- Copiar dados existentes de doc_type para document_type
UPDATE documents SET document_type = doc_type WHERE doc_type IS NOT NULL;

-- 5. Adicionar campos DocuSign (preparação FASE 2)
ALTER TABLE documents ADD COLUMN docusign_envelope_id VARCHAR(100) UNIQUE;
ALTER TABLE documents ADD COLUMN docusign_status VARCHAR(50);
ALTER TABLE documents ADD COLUMN docusign_sent_date DATETIME;
ALTER TABLE documents ADD COLUMN docusign_signed_date DATETIME;
ALTER TABLE documents ADD COLUMN signed_document_url VARCHAR(500);

-- 6. IMPORTANTE: Atualizar documentos existentes com valores padrão
UPDATE documents 
SET digitizer_name = 'Digitalizador Não Informado'
WHERE digitizer_name IS NULL;

UPDATE documents 
SET digitizer_cpf_cnpj = '00000000000'
WHERE digitizer_cpf_cnpj IS NULL;

UPDATE documents 
SET resolution_dpi = 300
WHERE resolution_dpi IS NULL OR resolution_dpi = 0;

UPDATE documents 
SET company_name = 'CAMPS Santos'
WHERE company_name IS NULL;

-- =====================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- =====================================================

-- Verificar estrutura da tabela users
SELECT sql FROM sqlite_master WHERE type='table' AND name='users';

-- Verificar estrutura da tabela documents
SELECT sql FROM sqlite_master WHERE type='table' AND name='documents';

-- Contar documentos com campos FASE 1 preenchidos
SELECT 
    COUNT(*) as total_docs,
    COUNT(digitizer_name) as with_digitizer,
    COUNT(resolution_dpi) as with_dpi,
    AVG(resolution_dpi) as avg_dpi
FROM documents;

-- =====================================================
-- INSTRUÇÕES DE USO
-- =====================================================
-- 
-- 1. Faça backup do banco antes de executar:
--    cp camps.db camps.db.backup_$(date +%Y%m%d_%H%M%S)
--
-- 2. Execute este script:
--    sqlite3 camps.db < add_fase1_fields.sql
--
-- 3. Verifique os resultados:
--    SELECT * FROM documents LIMIT 1;
--
-- 4. Reinicie a aplicação Flask
--
-- =====================================================
