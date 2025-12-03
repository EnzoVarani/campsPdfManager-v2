/**
 * CAMPS PDF Manager v2.0 - Toast Notifications
 * Simple toast notification system
 */

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', 'error', 'warning'
 */
export function showToast(message, type = 'info') {
    // Create container if doesn't exist
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 8px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        opacity: 0;
        transition: opacity 0.3s;
        max-width: 400px;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
