class ChatApp {
  constructor() {
    this.webhookUrl =
      'https://n8n-lab.web-magic.space/webhook/2ab88b52-1566-44cc-98cb-d76917bdf022/chat';
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
    const stored = localStorage.getItem('userId');
    if (stored) {
      return stored;
    }
    const id = 'user_' + Math.random().toString(36).substr(2, 9);
    try {
      localStorage.setItem('userId', id);
    } catch (_) {
      // ignore storage errors
    }
    return id;
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
      if (!this.isConnecting) {
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
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.updateConnectionStatus('connecting', 'Connecting...');

    fetch(this.webhookUrl, { method: 'GET' })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        this.updateConnectionStatus('connected', 'Connected');
      })
      .catch((err) => {
        console.error('Connection error:', err);
        this.updateConnectionStatus('disconnected', 'Connection Error');
      })
      .finally(() => {
        this.isConnecting = false;
      });
  }


  async sendMessage() {
    const message = this.messageInput.value.trim();

    if (!message) {
      return;
    }

    if (message.length > 500) {
      this.showStatusModal(
        '<div class="text-red-500 mb-4">⚠️</div><p class="text-gray-700">Message too long. Please keep it under 500 characters.</p>'
      );
      return;
    }

    const messageData = {
      type: 'message',
      text: message,
      userId: this.userId,
      timestamp: new Date().toISOString()
    };

    // Add to UI immediately
    this.addMessage(messageData, true);
    this.saveMessageToHistory(messageData);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      let replyText = await response.text();
      try {
        const json = JSON.parse(replyText);
        if (json.message) {
          replyText = json.message;
        } else if (json.output) {
          replyText = json.output;
        } else {
          replyText = JSON.stringify(json);
        }
      } catch (_) {
        // plain text response
      }

      if (replyText) {
        const reply = {
          type: 'message',
          text: replyText,
          userId: 'server',
          timestamp: new Date().toISOString()
        };
        this.addMessage(reply, false);
        this.saveMessageToHistory(reply);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showStatusModal(
        '<div class="text-red-500 mb-4">❌</div><p class="text-gray-700">Failed to send message. Please try again.</p>'
      );
    }

    this.messageInput.value = '';
    this.updateCharacterCount();
  }

  sendSystemMessage(data) {
    fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch((error) => {
      console.error('Failed to send system message:', error);
    });
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
    if (window.marked && window.DOMPurify) {
      const html = marked.parse(messageData.text || '');
      textDiv.innerHTML = DOMPurify.sanitize(html);
    } else {
      textDiv.textContent = messageData.text;
    }
    
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
    // Nothing to clean up for HTTP webhook
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