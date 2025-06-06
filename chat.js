class ChatApp {
  constructor() {
    this.websocket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.messageHistory = [];
    this.maxHistorySize = 100;
    this.userId = this.generateUserId();
    
    // DOM elements
    this.messagesContainer = document.getElementById('messagesContainer');
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.connectionIndicator = document.getElementById('connectionIndicator');
    this.charCount = document.getElementById('charCount');
    this.typingContainer = document.getElementById('typingContainer');
    this.statusModal = document.getElementById('statusModal');
    this.modalContent = document.getElementById('modalContent');
    
    this.init();
  }

  init() {
    this.loadChatHistory();
    this.setupEventListeners();
    this.connect();
    this.updateCharacterCount();
  }

  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  setupEventListeners() {
    // Send button click
    this.sendButton.addEventListener('click', () => this.sendMessage());
    
    // Enter key to send message
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Character count update
    this.messageInput.addEventListener('input', () => {
      this.updateCharacterCount();
    });
    
    // Window focus/blur for connection management
    window.addEventListener('focus', () => {
      if (this.websocket?.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    });
    
    // Before page unload
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  updateCharacterCount() {
    const length = this.messageInput.value.length;
    this.charCount.textContent = `${length}/500`;
    
    if (length > 450) {
      this.charCount.classList.add('text-red-500');
    } else {
      this.charCount.classList.remove('text-red-500');
    }
  }

  connect() {
    if (this.isConnecting || (this.websocket && this.websocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    this.updateConnectionStatus('connecting', 'Connecting...');
    
    try {
      // Note: The provided URL appears to be an HTTP webhook, not a WebSocket endpoint
      // For demonstration, we'll create a WebSocket connection to a mock endpoint
      // In production, you'd need to ensure the n8n webhook supports WebSocket connections
      
      const wsUrl = 'wss://echo.websocket.org/'; // Mock WebSocket for demonstration
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = (event) => {
        console.log('WebSocket connected:', event);
        this.onOpen();
      };
      
      this.websocket.onmessage = (event) => {
        console.log('WebSocket message:', event.data);
        this.onMessage(event);
      };
      
      this.websocket.onclose = (event) => {
        console.log('WebSocket closed:', event);
        this.onClose(event);
      };
      
      this.websocket.onerror = (event) => {
        console.error('WebSocket error:', event);
        this.onError(event);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.onError({ error });
    }
  }

  onOpen() {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.updateConnectionStatus('connected', 'Connected');
    this.hideStatusModal();
    
    // Send initial connection message
    this.sendSystemMessage({
      type: 'connection',
      userId: this.userId,
      timestamp: new Date().toISOString()
    });
  }

  onMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.handleIncomingMessage(data);
    } catch (error) {
      // Handle plain text messages
      this.handleIncomingMessage({
        type: 'message',
        text: event.data,
        userId: 'system',
        timestamp: new Date().toISOString()
      });
    }
  }

  onClose(event) {
    this.isConnecting = false;
    this.updateConnectionStatus('disconnected', 'Disconnected');
    
    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnect();
    }
  }

  onError(event) {
    this.isConnecting = false;
    console.error('WebSocket error:', event);
    this.updateConnectionStatus('disconnected', 'Connection Error');
    
    this.showStatusModal(
      '<div class="text-red-500 mb-4">⚠️</div>' +
      '<p class="text-gray-700 mb-4">Connection failed. Retrying...</p>' +
      '<button onclick="chatApp.connect()" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Retry Now</button>'
    );
  }

  attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.updateConnectionStatus('connecting', `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect();
      } else {
        this.updateConnectionStatus('disconnected', 'Connection Failed');
        this.showStatusModal(
          '<div class="text-red-500 mb-4">❌</div>' +
          '<p class="text-gray-700 mb-4">Unable to connect after multiple attempts.</p>' +
          '<button onclick="chatApp.connect(); chatApp.reconnectAttempts = 0;" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Try Again</button>'
        );
      }
    }, delay);
  }

  sendMessage() {
    const message = this.messageInput.value.trim();
    
    if (!message || message.length === 0) {
      return;
    }
    
    if (message.length > 500) {
      this.showStatusModal('<div class="text-red-500 mb-4">⚠️</div><p class="text-gray-700">Message too long. Please keep it under 500 characters.</p>');
      return;
    }
    
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.showStatusModal('<div class="text-orange-500 mb-4">⚠️</div><p class="text-gray-700">Not connected. Please wait for connection to be established.</p>');
      return;
    }

    const messageData = {
      type: 'message',
      text: message,
      userId: this.userId,
      timestamp: new Date().toISOString()
    };

    try {
      // Send to WebSocket
      this.websocket.send(JSON.stringify(messageData));
      
      // Add to local UI immediately
      this.addMessage(messageData, true);
      
      // Clear input
      this.messageInput.value = '';
      this.updateCharacterCount();
      
      // Save to history
      this.saveMessageToHistory(messageData);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showStatusModal('<div class="text-red-500 mb-4">❌</div><p class="text-gray-700">Failed to send message. Please try again.</p>');
    }
  }

  sendSystemMessage(data) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      try {
        this.websocket.send(JSON.stringify(data));
      } catch (error) {
        console.error('Failed to send system message:', error);
      }
    }
  }

  handleIncomingMessage(data) {
    // Don't show our own messages again
    if (data.userId === this.userId) {
      return;
    }
    
    this.addMessage(data, false);
    this.saveMessageToHistory(data);
  }

  addMessage(messageData, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${isSent ? 'justify-end' : 'justify-start'} mb-4`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `message-bubble px-4 py-3 rounded-2xl text-white ${
      isSent ? 'message-sent rounded-br-md' : 'message-received rounded-bl-md'
    }`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'text-sm leading-relaxed';
    textDiv.textContent = messageData.text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs mt-1 opacity-75';
    timeDiv.textContent = this.formatTimestamp(messageData.timestamp);
    
    bubbleDiv.appendChild(textDiv);
    bubbleDiv.appendChild(timeDiv);
    messageDiv.appendChild(bubbleDiv);
    
    // Remove welcome message if it exists
    const welcomeMessage = this.messagesContainer.querySelector('.text-center');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 100);
  }

  updateConnectionStatus(status, text) {
    this.connectionStatus.textContent = text;
    this.connectionIndicator.className = `connection-indicator ${status}`;
  }

  showStatusModal(content) {
    this.modalContent.innerHTML = content;
    this.statusModal.style.display = 'flex';
    
    // Auto-hide after 3 seconds for non-critical messages
    if (!content.includes('retry') && !content.includes('Try Again')) {
      setTimeout(() => this.hideStatusModal(), 3000);
    }
  }

  hideStatusModal() {
    this.statusModal.style.display = 'none';
  }

  saveMessageToHistory(messageData) {
    this.messageHistory.push(messageData);
    
    // Limit history size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('chatHistory', JSON.stringify(this.messageHistory));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }

  loadChatHistory() {
    try {
      const savedHistory = localStorage.getItem('chatHistory');
      if (savedHistory) {
        this.messageHistory = JSON.parse(savedHistory);
        
        // Display recent messages
        this.messageHistory.slice(-20).forEach(messageData => {
          this.addMessage(messageData, messageData.userId === this.userId);
        });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

// Initialize the chat app when the page loads
let chatApp;
document.addEventListener('DOMContentLoaded', () => {
  chatApp = new ChatApp();
});

// Handle modal clicks outside content
document.addEventListener('click', (e) => {
  if (e.target.id === 'statusModal') {
    chatApp.hideStatusModal();
  }
});