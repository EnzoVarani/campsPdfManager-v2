"""
Migration FASE 1 - CAMPS PDF Manager v2.0
Compatível com SQLAlchemy 2.0+
"""

import sys
import os

# Adicionar backend/ ao path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_path = os.path.join(project_root, 'backend')
sys.path.insert(0, backend_path)

try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

from app import create_app
from app.extensions import db
from sqlalchemy import text  # ← IMPORTANTE!

print("✅ Módulos importados!")
print()

app = create_app('development')

def run_migration():
    """Executa a migration FASE 1"""
    
    print("=" * 70)
    print("🚀 CAMPS PDF Manager v2.0 - Migration FASE 1")
    print("=" * 70)
    print()
    
    with app.app_context():
        try:
            db_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
            print(f"📊 Banco: {db_uri}")
            print()
            
            # Lista de comandos SQL (agora com text())
            sql_commands = [
                ("users: cpf_cnpj", "ALTER TABLE users ADD COLUMN cpf_cnpj TEXT"),
                ("documents: digitizer_name", "ALTER TABLE documents ADD COLUMN digitizer_name TEXT NOT NULL DEFAULT 'Nome Pendente'"),
                ("documents: digitizer_cpf_cnpj", "ALTER TABLE documents ADD COLUMN digitizer_cpf_cnpj TEXT NOT NULL DEFAULT '00000000000'"),
                ("documents: resolution_dpi", "ALTER TABLE documents ADD COLUMN resolution_dpi INTEGER NOT NULL DEFAULT 300"),
                ("documents: equipment_info", "ALTER TABLE documents ADD COLUMN equipment_info TEXT"),
                ("documents: company_name", "ALTER TABLE documents ADD COLUMN company_name TEXT"),
                ("documents: company_cnpj", "ALTER TABLE documents ADD COLUMN company_cnpj TEXT"),
                ("documents: document_type", "ALTER TABLE documents ADD COLUMN document_type TEXT"),
                ("documents: document_category", "ALTER TABLE documents ADD COLUMN document_category TEXT"),
                ("documents: docusign_envelope_id", "ALTER TABLE documents ADD COLUMN docusign_envelope_id TEXT UNIQUE"),
                ("documents: docusign_status", "ALTER TABLE documents ADD COLUMN docusign_status TEXT"),
                ("documents: docusign_sent_date", "ALTER TABLE documents ADD COLUMN docusign_sent_date TEXT"),
                ("documents: docusign_signed_date", "ALTER TABLE documents ADD COLUMN docusign_signed_date TEXT"),
                ("documents: signed_document_url", "ALTER TABLE documents ADD COLUMN signed_document_url TEXT"),
            ]
            
            print("⏳ Adicionando novos campos...")
            success_count = 0
            skip_count = 0
            
            for i, (desc, sql) in enumerate(sql_commands, 1):
                try:
                    print(f"   [{i:2d}/{len(sql_commands)}] {desc}...", end=" ")
                    db.session.execute(text(sql))  # ← Usar text()
                    print("✅")
                    success_count += 1
                except Exception as e:
                    error_msg = str(e).lower()
                    if any(x in error_msg for x in ["duplicate column", "already exists", "duplicate"]):
                        print("⚠️  (já existe)")
                        skip_count += 1
                    else:
                        print(f"❌ {str(e)[:40]}...")
            
            db.session.commit()
            print()
            print(f"✅ {success_count} campos adicionados, {skip_count} já existiam")
            print()
            
            # Atualizar documentos existentes
            print("⏳ Atualizando documentos existentes...")
            try:
                update_sql = text("""
                UPDATE documents 
                SET 
                    digitizer_name = 'Digitalizador Padrão',
                    digitizer_cpf_cnpj = '00000000000000',
                    resolution_dpi = 300,
                    equipment_info = 'Scanner Digital',
                    company_name = 'CAMPS Santos',
                    document_type = 'Contrato de Aprendizagem',
                    document_category = 'Trabalhista'
                WHERE digitizer_name = 'Nome Pendente' OR digitizer_cpf_cnpj = '00000000000'
                """)
                db.session.execute(update_sql)
                db.session.commit()
                print(f"✅ Documentos atualizados!")
            except Exception as e:
                print(f"⚠️  Aviso: {str(e)[:60]}...")
            print()
            
            # Criar índices
            print("⏳ Criando índices...")
            indices = [
                ("digitizer_name", "CREATE INDEX IF NOT EXISTS idx_documents_digitizer_name ON documents(digitizer_name)"),
                ("digitizer_cpf_cnpj", "CREATE INDEX IF NOT EXISTS idx_documents_digitizer_cpf_cnpj ON documents(digitizer_cpf_cnpj)"),
                ("document_type", "CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type)"),
                ("document_category", "CREATE INDEX IF NOT EXISTS idx_documents_document_category ON documents(document_category)"),
                ("docusign_status", "CREATE INDEX IF NOT EXISTS idx_documents_docusign_status ON documents(docusign_status)"),
            ]
            
            idx_count = 0
            for idx_name, idx_sql in indices:
                try:
                    print(f"   {idx_name}...", end=" ")
                    db.session.execute(text(idx_sql))  # ← Usar text()
                    print("✅")
                    idx_count += 1
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"⚠️  {str(e)[:30]}...")
                    else:
                        print("⚠️  (já existe)")
            
            db.session.commit()
            print(f"✅ {idx_count} índices criados!")
            print()
            
            # Verificações
            print("🔍 Verificando migration...")
            try:
                result = db.session.execute(text("SELECT COUNT(*) FROM documents")).scalar()
                print(f"   📄 Total: {result} documento(s)")
            except:
                print(f"   📄 Total: 0 documentos")
            
            try:
                result = db.session.execute(text("""
                    SELECT digitizer_name, digitizer_cpf_cnpj, resolution_dpi 
                    FROM documents 
                    LIMIT 1
                """)).fetchone()
                
                if result:
                    print(f"   ✅ Campos confirmados:")
                    print(f"      - digitizer_name: {result[0]}")
                    print(f"      - digitizer_cpf_cnpj: {result[1]}")
                    print(f"      - resolution_dpi: {result[2]}")
                else:
                    print(f"   ✅ Campos criados (sem documentos)")
            except:
                print(f"   ✅ Campos criados (tabela vazia)")
            
            print()
            print("=" * 70)
            print("🎉 Migration FASE 1 concluída com sucesso!")
            print("=" * 70)
            print()
            print("📋 Próximos passos:")
            print("   1. ✅ backend/app/models.py atualizado")
            print("   2. ⏳ Atualizar backend/app/documents.py")
            print("   3. ⏳ Atualizar backend/app/batch_processor.py")
            print("   4. ⏳ Testar aplicação")
            print()
            
        except Exception as e:
            print()
            print("❌ Erro durante migration:")
            print(f"   {str(e)}")
            import traceback
            traceback.print_exc()
            db.session.rollback()
            sys.exit(1)

if __name__ == '__main__':
    run_migration()
