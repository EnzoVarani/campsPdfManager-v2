"""
Script de diagnóstico do JWT
"""

from app import create_app
from app.models import User
from flask_jwt_extended import decode_token
import json

app = create_app()

with app.app_context():
    # 1. Buscar usuário admin
    user = User.query.filter_by(email='admin@camps.com').first()
    
    if not user:
        print("❌ Usuário não encontrado!")
        exit(1)
    
    print(f"✅ Usuário encontrado: {user.email}")
    print(f"   ID: {user.id}")
    print(f"   Nome: {user.name}")
    print(f"   Role: {user.role.value}")
    
    # 2. Gerar tokens
    print("\n🔑 Gerando tokens...")
    try:
        tokens = user.generate_tokens()
        print("✅ Tokens gerados com sucesso!")
        print(f"   Access Token (primeiros 50 chars): {tokens['access_token'][:50]}...")
    except Exception as e:
        print(f"❌ Erro ao gerar tokens: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
    
    # 3. Decodificar o token para ver os claims
    print("\n🔍 Decodificando token para análise...")
    try:
        decoded = decode_token(tokens['access_token'])
        print("✅ Token decodificado:")
        print(json.dumps(decoded, indent=2))
        
        # Verificar se há algum claim "subject" ou "sub"
        if 'sub' in decoded:
            print(f"\n📋 Claim 'sub' encontrado: {decoded['sub']} (tipo: {type(decoded['sub'])})")
        
        if 'subject' in decoded:
            print(f"\n📋 Claim 'subject' encontrado: {decoded['subject']} (tipo: {type(decoded['subject'])})")
            
    except Exception as e:
        print(f"❌ Erro ao decodificar token: {e}")
        import traceback
        traceback.print_exc()
    
    # 4. Testar a rota /me internamente
    print("\n🧪 Testando rota /me internamente...")
    from flask import g
    from flask_jwt_extended import create_access_token, get_jwt_identity
    
    with app.test_client() as client:
        # Fazer login
        response = client.post('/api/auth/login', 
                              json={'email': 'admin@camps.com', 'password': 'admin123'},
                              headers={'Content-Type': 'application/json'})
        
        print(f"   Login status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.get_json()
            token = data.get('access_token')
            
            # Testar /me
            me_response = client.get('/api/auth/me',
                                     headers={'Authorization': f'Bearer {token}'})
            
            print(f"   /me status: {me_response.status_code}")
            print(f"   /me response: {me_response.get_json()}")
        else:
            print(f"   Login falhou: {response.get_json()}")
