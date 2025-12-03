/**
 * CAMPS PDF Manager v2.0 - API Client
 * Generic HTTP client with authentication
 */

import { API_BASE } from '../config.js';

export class ApiClient {
    constructor(authManager) {
        this.baseURL = API_BASE;
        this.auth = authManager;
    }

    /**
     * Generic GET request
     */
    async get(endpoint, params = {}) {
        let url = `${this.baseURL}${endpoint}`;
        
        // Add query parameters
        if (Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams.toString()}`;
        }

        const response = await this.auth.fetchWithAuth(url);
        return await response.json();
    }

    /**
     * Generic POST request
     */
    async post(endpoint, data) {
        const url = `${this.baseURL}${endpoint}`;
        
        const response = await this.auth.fetchWithAuth(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        return await response.json();
    }

    /**
     * Generic PUT request
     */
    async put(endpoint, data) {
        const url = `${this.baseURL}${endpoint}`;
        
        const response = await this.auth.fetchWithAuth(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        return await response.json();
    }

    /**
     * Generic DELETE request
     */
    async delete(endpoint) {
        const url = `${this.baseURL}${endpoint}`;
        
        const response = await this.auth.fetchWithAuth(url, {
            method: 'DELETE'
        });
        
        return await response.json();
    }

    /**
     * Upload with FormData (for files)
     */
    async upload(endpoint, formData, onProgress = null) {
        const url = `${this.baseURL}${endpoint}`;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Progress tracking
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
            }
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });
            
            xhr.open('POST', url);
            xhr.setRequestHeader('Authorization', `Bearer ${this.auth.getToken()}`);
            xhr.send(formData);
        });
    }
}
