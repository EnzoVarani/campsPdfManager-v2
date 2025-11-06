"""
Inicialização da aplicação Flask
"""

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy
import os
from pathlib import Path
from datetime import datetime

# Inicializar extensões
db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()

def create_app(config_name=None):
    """Factory para criar a aplicação"""
    
    app = Flask(__name__)
    
    # Configurar ambiente
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    from app.config import config
    app.config.from_object(config[config_name])
    
    # Obter caminho base do projeto (pasta backend/)
    BASE_DIR = Path(__file__).resolve().parent.parent
    STORAGE_DIR = BASE_DIR / 'storage'
    
    # Pastas de storage - USANDO CAMINHOS ABSOLUTOS
    app.config['UPLOAD_FOLDER'] = str(STORAGE_DIR / 'temp')
    app.config['ORIGINALS_FOLDER'] = str(STORAGE_DIR / 'originals')
    app.config['PROCESSED_FOLDER'] = str(STORAGE_DIR / 'processed')
    
    # Inicializar extensões
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    CORS(app, origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "*"  # Remover em produção
    ])
    
    # Criar diretórios de storage
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['ORIGINALS_FOLDER'], exist_ok=True)
    os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)
    
    # Configurar JWT
    @jwt.additional_claims_loader
    def add_claims_to_access_token(identity):
        from app.models import User
        user = User.query.get(identity)
        if user:
            return {
                'role': user.role.value,
                'name': user.name
            }
        return {}
    
    @jwt.user_identity_loader  
    def user_identity_lookup(user):
        return user 
    
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from app.models import User
        identity = jwt_data["sub"]
        return User.query.filter_by(id=identity).one_or_none()
    
    # Registrar blueprints
    from app.routes.documents import documents_bp
    from app.routes.analytics import analytics_bp
    from app.auth import auth_bp
    
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    # Rotas de teste e saúde
    @app.route('/')
    def index():
        return {
            'message': 'CAMPS PDF Manager API v2.0',
            'version': '2.0.0',
            'company': app.config.get('COMPANY_NAME', 'CAMPS Santos'),
            'status': 'running',
            'features': [
                'JWT Authentication',
                'Role-based Authorization',
                'Document Management',
                'DocuSign Integration',
                'Analytics Dashboard',
                'Audit Logging'
            ]
        }
    
    @app.route('/health')
    def health():
        try:
            # Testar conexão com o banco
            db.session.execute('SELECT 1')
            db_status = 'ok'
        except Exception:
            db_status = 'error'
        
        return {
            'status': 'ok',
            'database': db_status,
            'timestamp': datetime.utcnow().isoformat()
        }, 200
    
    # Inicializar banco e dados
    with app.app_context():
        db.create_all()
        if app.config.get('CREATE_ADMIN_ON_STARTUP', True):
            create_initial_data(app)
    
    return app

def create_initial_data(app):
    """Criar dados iniciais (usuário admin)"""
    try:
        from app.models import User, UserRole
        
        # Verificar se já existe um admin
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()
        
        if not admin_user:
            # Criar usuário administrador inicial
            admin = User(
                name='Administrador CAMPS',
                email=app.config.get('ADMIN_EMAIL', 'admin@camps.com'),
                role=UserRole.ADMIN,
                is_active=True
            )
            admin.set_password(app.config.get('ADMIN_PASSWORD', 'admin123'))
            
            db.session.add(admin)
            db.session.commit()
            
            app.logger.info(f"Usuário administrador criado: {admin.email}")
            print(f"✅ Admin criado: {admin.email} | Senha: {app.config.get('ADMIN_PASSWORD', 'admin123')}")
            
    except Exception as e:
        app.logger.error(f"Erro ao criar dados iniciais: {str(e)}")
        db.session.rollback()