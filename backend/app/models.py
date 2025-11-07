"""
Modelos do banco de dados (User, Document, AuditLog)
"""

from datetime import datetime
from enum import Enum
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token

from app import db, bcrypt

class UserRole(Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.USER)
    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    documents = db.relationship('Document', backref='created_by_user', lazy='dynamic')
    audit_logs = db.relationship('AuditLog', backref='user_ref', lazy='dynamic')

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def generate_tokens(self):
        claims = {"role": self.role.value, "name": self.name}
        return {
            'access_token': create_access_token(identity=self.id, additional_claims=claims),
            'refresh_token': create_refresh_token(identity=self.id)
        }

    def has_permission(self, permission: str) -> bool:
        permissions = {
            UserRole.ADMIN: ['create', 'read', 'update', 'delete', 'manage_users'],
            UserRole.USER: ['create', 'read', 'update'],
            UserRole.VIEWER: ['read']
        }
        return permission in permissions.get(self.role, [])

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role.value,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    identifier = db.Column(db.String(100), unique=True, nullable=False, index=True)

    title = db.Column(db.String(500), nullable=False, default='')
    subject = db.Column(db.Text)
    author = db.Column(db.String(255), nullable=False, default='')
    doc_type = db.Column(db.String(100), nullable=False, default='')
    digitalization_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    digitalization_location = db.Column(db.String(255), nullable=False)
    responsible = db.Column(db.String(255), nullable=False, default='')

    original_filename = db.Column(db.String(255), nullable=False)
    original_path = db.Column(db.String(500))
    processed_path = db.Column(db.String(500))

    hash_sha256 = db.Column(db.String(64))
    file_size = db.Column(db.Integer)

    is_signed = db.Column(db.Boolean, default=False)
    signature_date = db.Column(db.DateTime)
    signature_provider = db.Column(db.String(50))
    signature_id = db.Column(db.String(255))
    signature_url = db.Column(db.String(500))
    signature_status = db.Column(db.String(50))

    status = db.Column(db.String(50), default='uploaded')

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    audit_logs = db.relationship('AuditLog', backref='document', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'identifier': self.identifier,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'hash_sha256': self.hash_sha256,
            'title': self.title or None,
            'author': self.author or None,
            'subject': self.subject or None,
            'doc_type': self.doc_type or None,
            'responsible': self.responsible or None,
            'status': self.status,
            'is_signed': self.is_signed,
            'signature_status': self.signature_status,
            'signature_provider': self.signature_provider,
            'signature_date': self.signature_date.isoformat() if self.signature_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,  # ✅ Apenas o ID
            'digitalization_date': self.digitalization_date.isoformat() if self.digitalization_date else None,
            'digitalization_location': self.digitalization_location
        }

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'description': self.description,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'document_id': self.document_id,
            'user_id': self.user_id  # ✅ Apenas o ID (sem relationship)
        }
