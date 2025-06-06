class WebhookDiagnostics {
    constructor() {
        this.webhookUrl = 'https://n8n-lab.web-magic.space/webhook/2ab88b52-1566-44cc-98cb-d76917bdf022/chat';
        this.results = {
            connectivity: {},
            methods: {},
            ssl: {},
            websocket: {},
            detailed: {}
        };
        
        this.init();
    }

    init() {
        this.runDiagnostics();
        this.setupManualTesting();
    }

    async runDiagnostics() {
        console.log('Starting webhook diagnostics...');
        
        // Run all diagnostic tests
        await Promise.all([
            this.testBasicConnectivity(),
            this.testHttpMethods(),
            this.testSSLCertificate(),
            this.testWebSocketSupport()
        ]);
        
        this.generateDetailedAnalysis();
        this.generateRecommendations();
    }

    async testBasicConnectivity() {
        const resultsContainer = document.getElementById('connectivityResults');
        
        try {
            // Test basic reachability
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(this.webhookUrl, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors' // Handle CORS issues
            });
            
            clearTimeout(timeoutId);
            
            this.results.connectivity = {
                reachable: true,
                status: response.status || 'Unknown (CORS)',
                responseTime: Date.now()
            };
            
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>Endpoint Reachable</span>
                    <span class="status-success">✓ Yes</span>
                </div>
                <div class="flex items-center justify-between">
                    <span>Response Status</span>
                    <span class="status-info">${response.status || 'CORS Blocked'}</span>
                </div>
            `;
            
        } catch (error) {
            this.results.connectivity = {
                reachable: false,
                error: error.message,
                errorType: error.name
            };
            
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>Endpoint Reachable</span>
                    <span class="status-error">✗ No</span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    }

    async testHttpMethods() {
        const resultsContainer = document.getElementById('methodResults');
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'];
        const methodResults = {};
        
        for (const method of methods) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(this.webhookUrl, {
                    method: method,
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: method !== 'GET' ? JSON.stringify({
                        test: true,
                        message: 'Diagnostic test',
                        timestamp: new Date().toISOString()
                    }) : undefined
                });
                
                clearTimeout(timeoutId);
                methodResults[method] = {
                    supported: true,
                    status: response.status,
                    statusText: response.statusText
                };
                
            } catch (error) {
                methodResults[method] = {
                    supported: false,
                    error: error.message
                };
            }
        }
        
        this.results.methods = methodResults;
        
        let html = '';
        for (const [method, result] of Object.entries(methodResults)) {
            const statusClass = result.supported ? 'status-success' : 'status-error';
            const statusIcon = result.supported ? '✓' : '✗';
            html += `
                <div class="flex items-center justify-between">
                    <span>${method}</span>
                    <span class="${statusClass}">${statusIcon} ${result.status || 'Failed'}</span>
                </div>
            `;
        }
        
        resultsContainer.innerHTML = html;
    }

    async testSSLCertificate() {
        const resultsContainer = document.getElementById('sslResults');
        
        try {
            // Test SSL by making a secure request
            const response = await fetch(this.webhookUrl, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            
            this.results.ssl = {
                valid: true,
                protocol: 'HTTPS',
                secure: true
            };
            
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>SSL Certificate</span>
                    <span class="status-success">✓ Valid</span>
                </div>
                <div class="flex items-center justify-between">
                    <span>Protocol</span>
                    <span class="status-info">HTTPS</span>
                </div>
                <div class="flex items-center justify-between">
                    <span>Secure Connection</span>
                    <span class="status-success">✓ Yes</span>
                </div>
            `;
            
        } catch (error) {
            this.results.ssl = {
                valid: false,
                error: error.message
            };
            
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>SSL Certificate</span>
                    <span class="status-error">✗ Invalid</span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    }

    async testWebSocketSupport() {
        const resultsContainer = document.getElementById('websocketResults');
        
        try {
            // Convert HTTP URL to WebSocket URL
            const wsUrl = this.webhookUrl.replace('https://', 'wss://').replace('http://', 'ws://');
            
            const ws = new WebSocket(wsUrl);
            
            const testPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('WebSocket connection timeout'));
                }, 5000);
                
                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ supported: true });
                };
                
                ws.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(error);
                };
                
                ws.onclose = (event) => {
                    if (event.code === 1006) {
                        clearTimeout(timeout);
                        reject(new Error('WebSocket connection failed - endpoint may not support WebSocket'));
                    }
                };
            });
            
            await testPromise;
            
            this.results.websocket = {
                supported: true,
                url: wsUrl
            };
            
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>WebSocket Support</span>
                    <span class="status-success">✓ Supported</span>
                </div>
                <div class="flex items-center justify-between">
                    <span>WebSocket URL</span>
                    <span class="status-info text-xs">Available</span>
                </div>
            `;
            
        } catch (error) {
            this.results.websocket = {
                supported: false,
                error: error.message
            };
            
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>WebSocket Support</span>
                    <span class="status-error">✗ Not Supported</span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                    <strong>Issue:</strong> ${error.message}
                </div>
            `;
        }
    }

    generateDetailedAnalysis() {
        const container = document.getElementById('detailedResults');
        
        const analysis = {
            overallStatus: this.getOverallStatus(),
            corsIssues: this.checkCorsIssues(),
            networkIssues: this.checkNetworkIssues(),
            configurationIssues: this.checkConfigurationIssues()
        };
        
        this.results.detailed = analysis;
        
        let html = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-medium text-gray-800 mb-2">Overall Status</h3>
                    <div class="flex items-center space-x-2">
                        <span class="${analysis.overallStatus.class}">${analysis.overallStatus.icon}</span>
                        <span>${analysis.overallStatus.message}</span>
                    </div>
                </div>
                
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-medium text-gray-800 mb-2">Primary Issue</h3>
                    <p class="text-sm text-gray-600">${analysis.primaryIssue || 'No major issues detected'}</p>
                </div>
            </div>
            
            <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 class="font-medium text-gray-800 mb-2">Technical Details</h3>
                <pre class="code-block p-3 rounded text-xs overflow-x-auto">${JSON.stringify(this.results, null, 2)}</pre>
            </div>
        `;
        
        container.innerHTML = html;
    }

    getOverallStatus() {
        const { connectivity, websocket } = this.results;
        
        if (!connectivity.reachable) {
            return {
                class: 'status-error',
                icon: '❌',
                message: 'Endpoint not reachable'
            };
        }
        
        if (!websocket.supported) {
            return {
                class: 'status-warning',
                icon: '⚠️',
                message: 'HTTP accessible, WebSocket not supported'
            };
        }
        
        return {
            class: 'status-success',
            icon: '✅',
            message: 'Endpoint accessible with WebSocket support'
        };
    }

    checkCorsIssues() {
        // CORS issues are common with webhook endpoints
        return this.results.connectivity.status === 'Unknown (CORS)';
    }

    checkNetworkIssues() {
        return !this.results.connectivity.reachable;
    }

    checkConfigurationIssues() {
        const { methods } = this.results;
        return !methods.POST?.supported && !methods.GET?.supported;
    }

    generateRecommendations() {
        const container = document.getElementById('recommendations');
        const recommendations = [];
        
        // Check connectivity issues
        if (!this.results.connectivity.reachable) {
            recommendations.push({
                type: 'error',
                title: 'Connectivity Issue',
                message: 'The webhook endpoint is not reachable. Check if the n8n instance is running and the URL is correct.',
                actions: [
                    'Verify the n8n instance is running',
                    'Check the webhook URL for typos',
                    'Ensure firewall allows outbound connections',
                    'Test the URL directly in a browser'
                ]
            });
        }
        
        // Check WebSocket support
        if (!this.results.websocket.supported) {
            recommendations.push({
                type: 'warning',
                title: 'WebSocket Not Supported',
                message: 'The endpoint doesn\'t support WebSocket connections. Consider using HTTP polling or Server-Sent Events for real-time functionality.',
                actions: [
                    'Use HTTP POST requests to send messages',
                    'Implement polling to check for new messages',
                    'Consider using Server-Sent Events if supported',
                    'Configure n8n to support WebSocket connections'
                ]
            });
        }
        
        // Check HTTP methods
        const supportedMethods = Object.entries(this.results.methods || {})
            .filter(([_, result]) => result.supported)
            .map(([method, _]) => method);
            
        if (supportedMethods.length > 0) {
            recommendations.push({
                type: 'success',
                title: 'HTTP Methods Available',
                message: `The following HTTP methods are supported: ${supportedMethods.join(', ')}`,
                actions: [
                    `Use ${supportedMethods.includes('POST') ? 'POST' : supportedMethods[0]} method for sending messages`,
                    'Include proper Content-Type headers',
                    'Structure your message payload as JSON'
                ]
            });
        }
        
        // CORS recommendations
        if (this.checkCorsIssues()) {
            recommendations.push({
                type: 'info',
                title: 'CORS Configuration',
                message: 'CORS headers may be blocking requests. This is common with webhook endpoints.',
                actions: [
                    'Configure n8n to allow CORS from your domain',
                    'Add proper Access-Control-Allow-Origin headers',
                    'Consider using a proxy server to bypass CORS',
                    'Test from the same domain as the n8n instance'
                ]
            });
        }
        
        // Default recommendation if everything looks good
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                title: 'Configuration Looks Good',
                message: 'The webhook endpoint appears to be properly configured.',
                actions: [
                    'Test sending actual messages',
                    'Monitor for any rate limiting',
                    'Implement proper error handling',
                    'Add message queuing for reliability'
                ]
            });
        }
        
        let html = '';
        recommendations.forEach(rec => {
            const iconMap = {
                error: '🚨',
                warning: '⚠️',
                info: 'ℹ️',
                success: '✅'
            };
            
            html += `
                <div class="p-4 border-l-4 border-${rec.type === 'error' ? 'red' : rec.type === 'warning' ? 'yellow' : rec.type === 'info' ? 'blue' : 'green'}-500 bg-${rec.type === 'error' ? 'red' : rec.type === 'warning' ? 'yellow' : rec.type === 'info' ? 'blue' : 'green'}-50 rounded-r-lg">
                    <div class="flex items-start space-x-3">
                        <span class="text-2xl">${iconMap[rec.type]}</span>
                        <div class="flex-1">
                            <h3 class="font-medium text-gray-800">${rec.title}</h3>
                            <p class="text-sm text-gray-600 mt-1">${rec.message}</p>
                            <ul class="mt-2 text-sm text-gray-600 space-y-1">
                                ${rec.actions.map(action => `<li class="flex items-start space-x-2"><span>•</span><span>${action}</span></li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    setupManualTesting() {
        const testButton = document.getElementById('manualTest');
        const messageInput = document.getElementById('testMessage');
        const methodSelect = document.getElementById('testMethod');
        const resultsContainer = document.getElementById('manualTestResults');
        const outputElement = document.getElementById('manualTestOutput');
        
        testButton.addEventListener('click', async () => {
            const message = messageInput.value.trim();
            const method = methodSelect.value;
            
            if (!message) {
                alert('Please enter a test message');
                return;
            }
            
            testButton.disabled = true;
            testButton.textContent = 'Testing...';
            resultsContainer.classList.remove('hidden');
            
            try {
                let body = undefined;
                let headers = {
                    'Content-Type': 'application/json'
                };
                
                if (method !== 'GET') {
                    try {
                        JSON.parse(message); // Validate JSON
                        body = message;
                    } catch (e) {
                        body = JSON.stringify({ message: message });
                    }
                }
                
                const response = await fetch(this.webhookUrl, {
                    method: method,
                    headers: headers,
                    body: body
                });
                
                const responseText = await response.text();
                
                const result = {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: responseText,
                    timestamp: new Date().toISOString()
                };
                
                outputElement.textContent = JSON.stringify(result, null, 2);
                
            } catch (error) {
                const result = {
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                
                outputElement.textContent = JSON.stringify(result, null, 2);
            }
            
            testButton.disabled = false;
            testButton.textContent = 'Send Test Message';
        });
    }
}

// Initialize diagnostics when page loads
document.addEventListener('DOMContentLoaded', () => {
    new WebhookDiagnostics();
});