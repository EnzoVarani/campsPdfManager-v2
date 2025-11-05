"""
Rotas para gerenciamento de documentos com autenticação JWT
"""

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
import os
from datetime import datetime

from app.models import Document, AuditLog, db
from app.services.pdf_service import PDFService
from app.utils.helpers import generate_identifier, allowed_file
from app.utils.validators import admin_required, user_required

documents_bp = Blueprint('documents', __name__)

@documents_bp.route('/upload', methods=['POST'])
@jwt_required()
@user_required
def upload_documents():
    """Upload de múltiplos PDFs com autenticação"""
    current_user_id = get_jwt_identity()
    
    # Obter arquivos do request
    files = []
    if 'files[]' in request.files:
        files.extend(request.files.getlist('files[]'))
    if 'files' in request.files:
        files.extend(request.files.getlist('files'))
    if 'file' in request.files:
        files.append(request.files['file'])
    
    if not files:
        return jsonify({'success': False, 'message': 'Nenhum arquivo enviado'}), 400
    
    if files[0].filename == '':
        return jsonify({'success': False, 'message': 'Nenhum arquivo selecionado'}), 400
    
    results = []
    upload_folder = current_app.config['UPLOAD_FOLDER']
    pdf_service = PDFService()
    
    for file in files:
        if not isinstance(file, FileStorage) or not file or not file.filename:
            continue
            
        if not allowed_file(file.filename):
            results.append({
                'filename': file.filename,
                'success': False,
                'error': 'Apenas arquivos PDF são permitidos'
            })
            continue
        
        try:
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{timestamp}_{filename}"
            filepath = os.path.join(upload_folder, unique_filename)
            
            # Salvar arquivo
            file.save(filepath)
            
            # Validar PDF
            is_valid, message = pdf_service.validate_pdf(filepath)
            if not is_valid:
                os.remove(filepath)
                results.append({
                    'filename': filename,
                    'success': False,
                    'error': message
                })
                continue
            
            # Calcular informações do arquivo
            file_hash = pdf_service.calculate_hash(filepath)
            file_size = pdf_service.get_file_size(filepath)
            page_count = pdf_service.get_page_count(filepath)
            identifier = generate_identifier(current_app.config['ID_PREFIX'])
            
            # Criar registro no banco
            document = Document(
                identifier=identifier,
                title=filename.replace('.pdf', ''),
                author='',
                subject='',
                doc_type='',
                digitalization_date=datetime.utcnow(),
                digitalization_location=current_app.config['DEFAULT_LOCATION'],
                responsible='',
                original_filename=filename,
                original_path=filepath,
                hash_sha256=file_hash,
                file_size=file_size,
                created_by=current_user_id,
                status='uploaded'
            )
            
            db.session.add(document)
            db.session.flush()  # Força ID antes do log
            
            # Log de auditoria
            audit = AuditLog(
                document_id=document.id,
                user_id=current_user_id,
                action='upload',
                description=f'Documento {filename} enviado ({page_count} páginas)',
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent', '')[:500] if request.headers.get('User-Agent') else None
            )
            db.session.add(audit)
            db.session.commit()
            
            results.append({
                'filename': filename,
                'success': True,
                'document_id': document.id,
                'identifier': identifier,
                'hash': file_hash,
                'size': file_size,
                'pages': page_count
            })
            
        except Exception as e:
            db.session.rollback()
            results.append({
                'filename': getattr(file, 'filename', 'unknown'),
                'success': False,
                'error': str(e)
            })
    
    success_count = len([r for r in results if r.get('success')])
    
    return jsonify({
        'success': success_count > 0,
        'message': f'{success_count} de {len(results)} arquivos processados',
        'data': results
    }), 200

@documents_bp.route('/', methods=['GET'])
@jwt_required()
def list_documents():
    """Lista documentos com filtros e paginação"""
    current_user_id = get_jwt_identity()
    
    query = Document.query
    
    # Filtros
    search = request.args.get('search')
    if search:
        query = query.filter(
            db.or_(
                Document.title.ilike(f'%{search}%'),
                Document.author.ilike(f'%{search}%'),
                Document.identifier.ilike(f'%{search}%')
            )
        )
    
    doc_type = request.args.get('doc_type')
    if doc_type:
        query = query.filter(Document.doc_type == doc_type)
    
    status = request.args.get('status')
    if status:
        query = query.filter(Document.status == status)
    
    # Paginação
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    
    pagination = query.order_by(Document.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'success': True,
        'data': {
            'documents': [doc.to_dict() for doc in pagination.items],
            'pagination': {
                'total': pagination.total,
                'pages': pagination.pages,
                'current_page': page,
                'per_page': per_page
            }
        }
    }), 200

@documents_bp.route('/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_document(doc_id):
    """Retorna detalhes de um documento"""
    document = Document.query.get_or_404(doc_id)
    doc_dict = document.to_dict()
    
    # Incluir logs de auditoria recentes
    recent_logs = document.audit_logs.order_by(AuditLog.timestamp.desc()).limit(10).all()
    doc_dict['audit_logs'] = [log.to_dict() for log in recent_logs]
    
    return jsonify({
        'success': True,
        'data': doc_dict
    }), 200

@documents_bp.route('/<int:doc_id>/metadata', methods=['POST'])
@jwt_required()
@user_required
def add_metadata(doc_id):
    """Adiciona metadados a um documento"""
    current_user_id = get_jwt_identity()
    document = Document.query.get_or_404(doc_id)
    data = request.get_json() or {}
    
    required = ['title', 'author', 'doc_type', 'responsible']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({
            'success': False,
            'message': f'Campos obrigatórios: {", ".join(missing)}'
        }), 400
    
    try:
        # Atualizar metadados do documento
        document.title = data['title']
        document.subject = data.get('subject', '')
        document.author = data['author']
        document.doc_type = data['doc_type']
        document.responsible = data['responsible']
        document.status = 'metadata_added'
        
        # Preparar metadados para o PDF
        metadata = {
            'title': document.title,
            'subject': document.subject,
            'author': document.author,
            'identifier': document.identifier,
            'doc_type': document.doc_type,
            'digitalization_date': document.digitalization_date.isoformat(),
            'digitalization_location': document.digitalization_location,
            'responsible': document.responsible,
            'hash_sha256': document.hash_sha256
        }
        
        # Processar PDF
        pdf_service = PDFService()
        processed_folder = current_app.config['PROCESSED_FOLDER']
        output_filename = f"processed_{document.identifier}.pdf"
        output_path = os.path.join(processed_folder, output_filename)
        
        success, message = pdf_service.add_metadata(
            document.original_path,
            metadata,
            output_path
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': f'Erro ao processar PDF: {message}'
            }), 500
        
        document.processed_path = output_path
        
        # Log de auditoria
        audit = AuditLog(
            document_id=document.id,
            user_id=current_user_id,
            action='metadata_added',
            description=f'Metadados adicionados: {document.title}',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:500] if request.headers.get('User-Agent') else None
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Metadados adicionados com sucesso',
            'data': document.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        }), 500

@documents_bp.route('/<int:doc_id>/download', methods=['GET'])
@jwt_required()
def download_document(doc_id):
    """Download do PDF"""
    current_user_id = get_jwt_identity()
    document = Document.query.get_or_404(doc_id)
    
    # Escolher arquivo (processado tem prioridade)
    if document.processed_path and os.path.exists(document.processed_path):
        file_path = document.processed_path
        file_type = 'processed'
    elif document.original_path and os.path.exists(document.original_path):
        file_path = document.original_path
        file_type = 'original'
    else:
        return jsonify({
            'success': False,
            'message': 'Arquivo não encontrado'
        }), 404
    
    # Log de auditoria
    audit = AuditLog(
        document_id=document.id,
        user_id=current_user_id,
        action='download',
        description=f'Download do arquivo {file_type}',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:500] if request.headers.get('User-Agent') else None
    )
    db.session.add(audit)
    db.session.commit()
    
    return send_file(
        file_path,
        as_attachment=True,
        download_name=f"{document.identifier}.pdf"
    )

@documents_bp.route('/<int:doc_id>', methods=['DELETE'])
@jwt_required()
@user_required
def delete_document(doc_id):
    """Deleta um documento com auditoria completa"""
    current_user_id = get_jwt_identity()
    document = Document.query.get_or_404(doc_id)
    
    try:
        # Log de auditoria ANTES de deletar
        audit = AuditLog(
            document_id=document.id,
            user_id=current_user_id,
            action='document_deleted',
            description=f'Documento "{document.title or document.original_filename}" deletado',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:500] if request.headers.get('User-Agent') else None
        )
        db.session.add(audit)
        db.session.flush()  # Força inserção do log
        
        # Remover arquivos físicos
        files_removed = []
        if document.original_path and os.path.exists(document.original_path):
            os.remove(document.original_path)
            files_removed.append('original')
        
        if document.processed_path and os.path.exists(document.processed_path):
            os.remove(document.processed_path)
            files_removed.append('processed')
        
        # Salvar informações para resposta
        doc_info = {
            'id': document.id,
            'identifier': document.identifier,
            'title': document.title
        }
        
        # Deletar documento (cascata deleta logs)
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Documento deletado com sucesso',
            'data': {
                'document_id': doc_info['id'],
                'identifier': doc_info['identifier'],
                'files_removed': files_removed
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao deletar: {str(e)}'
        }), 500

@documents_bp.route('/stats', methods=['GET'])
@jwt_required()
def document_stats():
    """Estatísticas rápidas de documentos"""
    total = Document.query.count()
    signed = Document.query.filter_by(is_signed=True).count()
    today = Document.query.filter(
        db.func.date(Document.created_at) == datetime.utcnow().date()
    ).count()
    
    return jsonify({
        'success': True,
        'data': {
            'total_documents': total,
            'signed_documents': signed,
            'documents_today': today,
            'signing_rate': f"{(signed/total*100) if total > 0 else 0:.1f}%"
        }
    }), 200