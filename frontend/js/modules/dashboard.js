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
            const summary = await this.api.get(ROUTES.ANALYTICS.SUMMARY);
            this.updateStats(summary);

            // Load charts
            await Promise.all([
                this.loadTimelineChart(),
                this.loadTypeChart(),
                this.loadSignatureChart()
            ]);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            // Don't show toast here to avoid spamming on init
        }
    }

    /**
     * Update summary statistics cards
     */
    updateStats(data) {
        this.animateValue('totalDocs', data.total_documents);
        this.animateValue('totalSize', formatFileSize(data.total_size), true);
        this.animateValue('signedDocs', data.signed_documents);
        this.animateValue('pendingDocs', data.pending_documents);
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
        const duration = 1000;
        const range = end - start;
        let current = start;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / range));
        
        const timer = setInterval(() => {
            current += increment;
            element.textContent = current;
            if (current == end) {
                clearInterval(timer);
            }
        }, Math.max(stepTime, 10));
        
        // Fallback for very large numbers or 0
        if (range === 0) element.textContent = end;
    }

    /**
     * Load timeline chart data
     */
    async loadTimelineChart() {
        const data = await this.api.get(ROUTES.ANALYTICS.TIMELINE);
        
        const labels = data.map(item => {
            const [year, month, day] = item.date.split('-');
            return `${day}/${month}`;
        });
        
        const values = data.map(item => item.count);
        
        this.charts.timeline.render(values, labels);
    }

    /**
     * Load document type chart data
     */
    async loadTypeChart() {
        const data = await this.api.get(ROUTES.ANALYTICS.BY_TYPE);
        
        const labels = data.map(item => item.type || 'Sem Tipo');
        const values = data.map(item => item.count);
        
        this.charts.type.render(values, labels);
    }

    /**
     * Load signature status chart data
     */
    async loadSignatureChart() {
        const data = await this.api.get(ROUTES.ANALYTICS.SIGNATURE_STATUS);
        
        const labels = ['Assinados', 'Pendentes'];
        const values = [data.signed, data.pending];
        
        this.charts.signature.render(values, labels, {
            backgroundColor: ['#16a34a', '#9ca3af']
        });
    }
}
