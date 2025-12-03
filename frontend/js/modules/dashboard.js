/**
 * CAMPS PDF Manager v2.0 - Dashboard Module
 * Analytics and statistics display
 */

import { TimelineChart, TypeChart, SignatureChart } from '../components/charts.js';
import { ROUTES } from '../config.js';
import { formatFileSize } from '../utils/formatters.js';

export class DashboardModule {
    constructor(api) {
        this.api = api;
        this.charts = {
            timeline: new TimelineChart('timelineChart'),
            type: new TypeChart('typeChart'),
            signature: new SignatureChart('signatureChart')
        };
    }

    /**
     * Load dashboard data
     */
    async load() {
        console.log('📊 Loading dashboard...');
        
        try {
            // Load summary stats
            const summaryResponse = await this.api.get(ROUTES.ANALYTICS.SUMMARY);
            if (summaryResponse.success && summaryResponse.data) {
                this.updateStats(summaryResponse.data.totals);
            }

            // Load charts
            await Promise.all([
                this.loadTimelineChart(),
                this.loadTypeChart(),
                this.loadSignatureChart(),
                this.loadRecentDocuments()
            ]);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    /**
     * Load recent documents
     */
    async loadRecentDocuments() {
        try {
            const response = await this.api.get(ROUTES.DOCUMENTS.LIST, {
                page: 1,
                per_page: 5,
                sort_by: 'uploaded_at',
                order: 'desc'
            });

            const container = document.getElementById('recentDocuments');
            if (!container) return;

            if (response.success && response.data.documents.length > 0) {
                container.innerHTML = response.data.documents.map(doc => `
                    <div class="recent-doc-item" onclick="window.app.modules.documents.viewDocument(${doc.id})">
                        <div class="doc-icon">📄</div>
                        <div class="doc-info">
                            <h4>${doc.title || doc.original_filename}</h4>
                            <span>${new Date(doc.uploaded_at).toLocaleDateString()} • ${formatFileSize(doc.file_size)}</span>
                        </div>
                        <div class="doc-status">
                            <span class="badge ${doc.is_signed ? 'badge-success' : 'badge-secondary'}">
                                ${doc.is_signed ? 'Assinado' : 'Pendente'}
                            </span>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="empty-state-small">Nenhum documento recente</div>';
            }
        } catch (error) {
            console.error('Error loading recent docs:', error);
        }
    }

    /**
     * Update summary statistics cards
     */
    updateStats(totals) {
        if (!totals) return;
        this.animateValue('totalDocs', totals.documents || 0);
        // Assuming total_size isn't in totals based on python code, checking...
        // Python code: 'totals': { 'documents': ..., 'signed_documents': ... }
        // It doesn't seem to have total_size in the python response I saw?
        // Let's check the python code again. It has total_documents, signed_documents, etc.
        // It does NOT have total_size in the 'totals' dict in analytics.py!
        // I will remove totalSize animation for now or fix backend later.
        // For now, let's just handle what exists.
        this.animateValue('signedDocs', totals.signed_documents || 0);
        this.animateValue('todayDocs', totals.documents_today || 0);
        
        // Calculate rate if not provided
        const rate = totals.documents > 0 ? ((totals.signed_documents / totals.documents) * 100).toFixed(1) : '0.0';
        this.animateValue('signingRate', `${rate}%`, true);
    }

    /**
     * Animate number counting
     */
    animateValue(elementId, value, isString = false) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (isString) {
            element.textContent = value;
            return;
        }

        const start = 0;
        const end = parseInt(value);
        
        // Safety check
        if (isNaN(end)) {
            element.textContent = '0';
            return;
        }

        const duration = 1000;
        const range = end - start;
        let current = start;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / range));
        
        // If range is 0, just set text
        if (range === 0) {
            element.textContent = end;
            return;
        }

        const timer = setInterval(() => {
            current += increment;
            element.textContent = current;
            if (current == end) {
                clearInterval(timer);
            }
        }, Math.max(stepTime, 10));
    }

    /**
     * Load timeline chart data
     */
    async loadTimelineChart() {
        const response = await this.api.get(ROUTES.ANALYTICS.TIMELINE);
        
        if (response.success && response.data && response.data.basic) {
            const data = response.data.basic;
            const labels = data.map(item => {
                // Handle date format YYYY-MM-DD
                if (item.date) {
                    const parts = item.date.split('-');
                    if (parts.length === 3) {
                        return `${parts[2]}/${parts[1]}`;
                    }
                }
                return item.date;
            });
            
            const values = data.map(item => item.count);
            this.charts.timeline.render(values, labels);
        }
    }

    /**
     * Load document type chart data
     */
    async loadTypeChart() {
        const response = await this.api.get(ROUTES.ANALYTICS.BY_TYPE);
        
        if (response.success && response.data && response.data.basic) {
            const data = response.data.basic;
            const labels = data.map(item => item.type || 'Sem Tipo');
            const values = data.map(item => item.count);
            this.charts.type.render(values, labels);
        }
    }

    /**
     * Load signature status chart data
     */
    async loadSignatureChart() {
        const response = await this.api.get(ROUTES.ANALYTICS.SIGNATURE_STATUS);
        
        if (response.success && response.data && response.data.basic) {
            const data = response.data.basic;
            // Data is array of objects: [{status: 'Assinados', count: 1}, ...]
            // We need to map it correctly or use fixed order
            
            const signedItem = data.find(i => i.status === 'Assinados');
            const pendingItem = data.find(i => i.status === 'Não Assinados');
            
            const signedCount = signedItem ? signedItem.count : 0;
            const pendingCount = pendingItem ? pendingItem.count : 0;
            
            const labels = ['Assinados', 'Pendentes'];
            const values = [signedCount, pendingCount];
            
            this.charts.signature.render(values, labels, {
                backgroundColor: ['#16a34a', '#9ca3af']
            });
        }
    }
}
