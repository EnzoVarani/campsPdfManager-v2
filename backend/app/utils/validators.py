"""
Decorators e validadores
"""

import re
from functools import wraps
from flask import jsonify, current_app
from flask_jwt_extended import get_jwt_identity
from app.models import User, UserRole

# Validators

def validate_email(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email.strip()) is not None


def validate_password(password: str) -> dict:
    if not password or not isinstance(password, str):
        return {'valid': False, 'message': 'Senha é obrigatória'}
    if len(password) < 8:
        return {'valid': False, 'message': 'Senha deve ter pelo menos 8 caracteres'}
    if len(password) > 128:
        return {'valid': False, 'message': 'Senha muito longa (máximo 128)'}
    has_letter = re.search(r'[a-zA-Z]', password)
    has_number = re.search(r'\d', password)
    if not has_letter:
        return {'valid': False, 'message': 'Senha deve conter pelo menos uma letra'}
    if not has_number:
        return {'valid': False, 'message': 'Senha deve conter pelo menos um número'}
    return {'valid': True, 'message': 'Senha válida'}

# Decorators

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            uid = get_jwt_identity()
            user = User.query.get(uid)
            if not user or user.role != UserRole.ADMIN:
                return jsonify({'success': False, 'message': 'Acesso negado (admin)'}), 403
            return f(*args, **kwargs)
        except Exception as e:
            current_app.logger.error(f"admin_required error: {e}")
            return jsonify({'success': False, 'message': 'Erro interno'}), 500
    return decorated


def user_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            uid = get_jwt_identity()
            user = User.query.get(uid)
            if not user or user.role == UserRole.VIEWER:
                return jsonify({'success': False, 'message': 'Acesso negado (user)'}), 403
            return f(*args, **kwargs)
        except Exception as e:
            current_app.logger.error(f"user_required error: {e}")
            return jsonify({'success': False, 'message': 'Erro interno'}), 500
    return decorated
