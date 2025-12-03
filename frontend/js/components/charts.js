/**
 * CAMPS PDF Manager v2.0 - Charts Component
 * Wrapper for Chart.js visualizations
 */

export class ChartComponent {
    constructor(canvasId, type, options = {}) {
        this.canvasId = canvasId;
        this.type = type;
        this.options = options;
        this.chart = null;
    }

    /**
     * Destroy existing chart
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    /**
     * Create or update chart
     */
    render(data, labels, customOptions = {}) {
        const ctx = document.getElementById(this.canvasId);
        if (!ctx) return;

        this.destroy();

        const config = {
            type: this.type,
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    ...this.options
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                ...customOptions
            }
        };

        this.chart = new Chart(ctx, config);
    }
}

export class TimelineChart extends ChartComponent {
    constructor(canvasId) {
        super(canvasId, 'line', {
            label: 'Documentos por Dia',
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
            fill: true
        });
    }
}

export class TypeChart extends ChartComponent {
    constructor(canvasId) {
        super(canvasId, 'doughnut', {
            backgroundColor: [
                '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'
            ]
        });
    }
}

export class SignatureChart extends ChartComponent {
    constructor(canvasId) {
        super(canvasId, 'pie', {
            backgroundColor: ['#16a34a', '#9ca3af']
        });
    }
}
