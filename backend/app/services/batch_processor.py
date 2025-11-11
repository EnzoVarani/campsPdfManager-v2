"""
Processador em Lote de Metadados
Sistema de fila com threading para processar múltiplos arquivos
"""
import os
import threading
import queue
import logging
from datetime import datetime
from typing import Dict, List, Optional
from flask import current_app
from app.extensions import db
from app.models import Document, AuditLog
from app.services.metadata_validator import MetadataValidator

logger = logging.getLogger(__name__)

class BatchProcessor:
    """Processador de lote com sistema de fila e threading"""
    
    def __init__(self, app=None, max_workers: int = 3):
        self.app = app
        self.max_workers = max_workers
        self.task_queue = queue.Queue()
        self.active_tasks = {}
        self.workers = []
        self._lock = threading.Lock()
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Inicializa com a aplicação Flask"""
        self.app = app
        self._start_workers()
    
    def _start_workers(self):
        """Inicia workers para processar tarefas"""
        for i in range(self.max_workers):
            worker = threading.Thread(
                target=self._worker,
                name=f"BatchWorker-{i}",
                daemon=True
            )
            worker.start()
            self.workers.append(worker)
            logger.info(f"✅ Worker {i} iniciado")
    
    def _worker(self):
        """Worker que processa tarefas da fila"""
        while True:
            try:
                task = self.task_queue.get(timeout=1)
                if task is None:
                    break
                
                task_id = task['task_id']
                logger.info(f"📋 Processando tarefa {task_id}")
                
                try:
                    self._update_task_status(task_id, 'processing')
                    
                    # Executar dentro do contexto Flask
                    with self.app.app_context():
                        result = self._process_task(task)
                    
                    self._update_task_result(task_id, result)
                    self._update_task_status(task_id, 'completed')
                    logger.info(f"✅ Tarefa {task_id} concluída")
                    
                except Exception as e:
                    logger.error(f"❌ Erro na tarefa {task_id}: {str(e)}", exc_info=True)
                    self._update_task_result(task_id, {
                        'success': 0,
                        'failed': task.get('total', 0),
                        'error': str(e)
                    })
                    self._update_task_status(task_id, 'failed')
                finally:
                    self.task_queue.task_done()
                    
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"❌ Erro crítico no worker: {str(e)}", exc_info=True)
    
    def _process_task(self, task: Dict) -> Dict:
        """Processa uma tarefa individual"""
        document_ids = task['document_ids']
        metadata = task['metadata']
        user_id = task['user_id']
        ip_address = task['ip_address']
        
        results = []
        validator = MetadataValidator()
        
        for doc_id in document_ids:
            try:
                # Buscar documento
                document = Document.query.get(doc_id)
                if not document:
                    results.append({
                        'document_id': doc_id,
                        'success': False,
                        'error': 'Documento não encontrado'
                    })
                    continue
                
                # Validar metadados
                validation = validator.validate_metadata(metadata, document)
                if not validation['valid']:
                    results.append({
                        'document_id': doc_id,
                        'document_title': document.title or document.original_filename,
                        'success': False,
                        'error': f"Validação falhou: {', '.join(validation['errors'])}"
                    })
                    continue
                
                # Guardar metadados antigos
                old_metadata = {
                    'title': document.title,
                    'author': document.author,
                    'subject': document.subject,
                    'keywords': document.keywords,
                    'doc_type': document.doc_type
                }
                
                # Atualizar documento
                document.title = metadata.get('title', document.title)
                document.author = metadata.get('author', document.author)
                document.subject = metadata.get('subject', document.subject)
                document.keywords = metadata.get('keywords', document.keywords)
                document.doc_type = metadata.get('doc_type', document.doc_type)
                document.updated_at = datetime.utcnow()
                document.status = 'metadata_added'
                
                db.session.flush()
                
                # Log de auditoria
                audit = AuditLog(
                    document_id=document.id,
                    user_id=user_id,
                    action='metadata_batch_update',
                    description=f'Metadados aplicados em lote: "{document.title}"',
                    ip_address=ip_address,
                    metadata_changes=f"Antes: {old_metadata} | Depois: {metadata}"
                )
                db.session.add(audit)
                db.session.commit()
                
                results.append({
                    'document_id': doc_id,
                    'document_title': document.title,
                    'success': True
                })
                
                logger.info(f"✅ Documento {doc_id} processado")
                
            except Exception as e:
                logger.error(f"❌ Erro no documento {doc_id}: {str(e)}")
                db.session.rollback()
                results.append({
                    'document_id': doc_id,
                    'success': False,
                    'error': str(e)
                })
        
        success_count = len([r for r in results if r.get('success')])
        
        return {
            'total': len(document_ids),
            'success': success_count,
            'failed': len(document_ids) - success_count,
            'results': results
        }
    
    def submit_task(self, task_id: str, document_ids: List[int], 
                    metadata: Dict, user_id: int, ip_address: str) -> str:
        """Adiciona tarefa à fila"""
        task = {
            'task_id': task_id,
            'document_ids': document_ids,
            'metadata': metadata,
            'user_id': user_id,
            'ip_address': ip_address,
            'total': len(document_ids),
            'submitted_at': datetime.utcnow()
        }
        
        with self._lock:
            self.active_tasks[task_id] = {
                'status': 'queued',
                'submitted_at': task['submitted_at'],
                'result': None
            }
        
        self.task_queue.put(task)
        logger.info(f"📝 Tarefa {task_id} adicionada ({len(document_ids)} docs)")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[Dict]:
        """Retorna status da tarefa"""
        with self._lock:
            return self.active_tasks.get(task_id)
    
    def _update_task_status(self, task_id: str, status: str):
        """Atualiza status da tarefa"""
        with self._lock:
            if task_id in self.active_tasks:
                self.active_tasks[task_id]['status'] = status
                self.active_tasks[task_id]['updated_at'] = datetime.utcnow()
    
    def _update_task_result(self, task_id: str, result: Dict):
        """Atualiza resultado da tarefa"""
        with self._lock:
            if task_id in self.active_tasks:
                self.active_tasks[task_id]['result'] = result

# Instância global
batch_processor = BatchProcessor(max_workers=3)
