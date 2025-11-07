async function downloadDocument(docId) {
    try {
        // Pega dados do documento para obter o nome original
        const responseData = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}`);
        const jsonData = await responseData.json();
        let filename = `documento_${docId}.pdf`;
        if (jsonData.success && jsonData.data && jsonData.data.original_filename) {
            filename = jsonData.data.original_filename;
            if (!filename.toLowerCase().endsWith('.pdf')) {
                filename += '.pdf';
            }
        }
        // Download do arquivo
        const response = await auth.fetchWithAuth(`${API_BASE}/documents/${docId}/download`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Download iniciado', 'success');
        } else {
            showToast('Erro no download', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Erro no download', 'error');
    }
}
