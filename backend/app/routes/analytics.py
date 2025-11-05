"""
Rotas para analytics e dashboard
"""

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func, desc, extract
from app.models import Document, AuditLog, User, db
from app.utils.validators import admin_required

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/dashboard/summary', methods=['GET'])
@jwt_required()
def dashboard_summary():
    """Resumo geral do dashboard"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        # Contadores básicos
        total_documents = Document.query.count()
        signed_documents = Document.query.filter_by(is_signed=True).count()
        
        # Documentos por período
        today = datetime.utcnow().date()
        documents_today = Document.query.filter(
            func.date(Document.created_at) == today
        ).count()
        
        week_ago = datetime.utcnow() - timedelta(days=7)
        documents_week = Document.query.filter(
            Document.created_at >= week_ago
        ).count()
        
        month_ago = datetime.utcnow() - timedelta(days=30)
        documents_month = Document.query.filter(
            Document.created_at >= month_ago
        ).count()
        
        # Estatísticas por status
        status_counts = db.session.query(
            Document.status,
            func.count(Document.id).label('count')
        ).group_by(Document.status).all()
        
        status_summary = {status: count for status, count in status_counts}
        
        # Documentos recentes (baseado na permissão)
        recent_query = Document.query.order_by(desc(Document.created_at)).limit(5)
        if user and not user.has_permission('manage_users'):
            recent_query = recent_query.filter_by(created_by=current_user_id)
        
        recent_docs = [{
            'id': doc.id,
            'identifier': doc.identifier,
            'title': doc.title or doc.original_filename,
            'status': doc.status,
            'created_at': doc.created_at.isoformat()
        } for doc in recent_query.all()]
        
        # Usuários ativos (apenas admins)
        active_users = None
        total_users = None
        if user and user.has_permission('manage_users'):
            active_users = User.query.filter_by(is_active=True).count()
            total_users = User.query.count()
        
        return jsonify({
            'success': True,
            'data': {
                'totals': {
                    'documents': total_documents,
                    'signed_documents': signed_documents,
                    'documents_today': documents_today,
                    'documents_week': documents_week,
                    'documents_month': documents_month,
                    'active_users': active_users,
                    'total_users': total_users
                },
                'status_summary': status_summary,
                'recent_documents': recent_docs,
                'signing_rate': round((signed_documents / total_documents * 100) if total_documents > 0 else 0, 1)
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Dashboard error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Erro interno do servidor'
        }), 500

@analytics_bp.route('/charts/documents-timeline', methods=['GET'])
@jwt_required()
def documents_timeline():
    """Gráfico de documentos ao longo do tempo"""
    try:
        # Parâmetros de período
        days = request.args.get('days', 30, type=int)
        days = min(days, 365)  # Máximo 1 ano
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        results = db.session.query(
            func.date(Document.created_at).label('date'),
            func.count(Document.id).label('count')
        ).filter(
            Document.created_at >= start_date
        ).group_by(
            func.date(Document.created_at)
        ).order_by('date').all()
        
        chart_data = [{
            'date': date.isoformat(),
            'count': count,
            'day_name': date.strftime('%a')
        } for date, count in results]
        
        return jsonify({
            'success': True,
            'data': {
                'period_days': days,
                'total_points': len(chart_data),
                'timeline': chart_data
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@analytics_bp.route('/charts/documents-by-type', methods=['GET'])
@jwt_required()
def documents_by_type():
    """Gráfico de documentos por tipo"""
    try:
        results = db.session.query(
            Document.doc_type,
            func.count(Document.id).label('count')
        ).filter(
            Document.doc_type != ''
        ).group_by(
            Document.doc_type
        ).order_by(desc('count')).all()
        
        chart_data = [{
            'type': doc_type or 'Sem tipo',
            'count': count
        } for doc_type, count in results]
        
        return jsonify({
            'success': True,
            'data': chart_data
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@analytics_bp.route('/charts/signature-status', methods=['GET'])
@jwt_required()
def signature_status():
    """Gráfico de status de assinaturas"""
    try:
        signed = Document.query.filter_by(is_signed=True).count()
        unsigned = Document.query.filter_by(is_signed=False).count()
        
        # Status detalhado se existir
        detailed = db.session.query(
            Document.signature_status,
            func.count(Document.id).label('count')
        ).filter(
            Document.signature_status.isnot(None)
        ).group_by(Document.signature_status).all()
        
        return jsonify({
            'success': True,
            'data': {
                'basic': [
                    {'status': 'Assinados', 'count': signed},
                    {'status': 'Não Assinados', 'count': unsigned}
                ],
                'detailed': [{
                    'status': status or 'Indefinido',
                    'count': count
                } for status, count in detailed]
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@analytics_bp.route('/reports/export', methods=['GET'])
@jwt_required()
def export_report():
    """Exportar dados para relatório"""
    try:
        report_type = request.args.get('type', 'documents')  
        format_type = request.args.get('format', 'json')    
        
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if report_type == 'documents':
            query = Document.query
            if user and not user.has_permission('manage_users'):
                query = query.filter_by(created_by=current_user_id)
            
            documents = query.order_by(desc(Document.created_at)).all()
            export_data = [doc.to_dict() for doc in documents]
            
        elif report_type == 'audit_log':
            query = AuditLog.query
            if user and not user.has_permission('manage_users'):
                user_docs = Document.query.filter_by(created_by=current_user_id).subquery()
                query = query.filter(AuditLog.document_id.in_(
                    db.session.query(user_docs.c.id)
                ))
            
            logs = query.order_by(desc(AuditLog.timestamp)).limit(1000).all()
            export_data = [log.to_dict() for log in logs]
            
        else:
            return jsonify({'success': False, 'message': 'Tipo inválido'}), 400
        
        return jsonify({
            'success': True,
            'data': {
                'report_type': report_type,
                'format': format_type,
                'generated_at': datetime.utcnow().isoformat(),
                'records_count': len(export_data),
                'exported_by': user.email if user else 'unknown',
                'data': export_data
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500