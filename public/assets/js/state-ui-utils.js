// ============================================
// STATE - Global state and configuration
// ============================================

export const chatState = {
    currentBook: null,
    currentChapter: 1,
    isChatOpen: false,
    isRecording: false,
    selectedModel: 'llama3.2',
    isProcessing: false,
    currentRequestId: 0,
    isSplitView: false,
    splitPanelStates: [],
    aiProvider: 'local',
    abortController: null
};

export let isDarkTheme = false;
export let availableModels = [];

export const DEFAULT_OLLAMA_URL = 'http://localhost:11436';

export const OLLAMA_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:11436'
  : `${window.location.protocol}//${window.location.host}`;

export const CLOUDFLARE_URL = 'https://ai-web-dba1.armorofgod.life';

export function getOllamaUrl() {
    try {
        const savedSettings = JSON.parse(localStorage.getItem('aiSettings') || '{}');
        const customUrl = savedSettings.ollamaUrl;
        if (customUrl && customUrl.trim() !== '') {
            let url = customUrl.trim();
            // Remove trailing slash
            url = url.replace(/\/$/, '');
            // Add http:// if no protocol specified (Ollama typically needs this)
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'http://' + url;
            }
            console.log('Using custom Ollama URL:', url);
            return url;
        }
    } catch (e) {
        console.warn('Error reading ollamaUrl from settings:', e);
    }
    console.log('Using default Ollama URL:', OLLAMA_URL);
    return OLLAMA_URL;
}

export function getCloudflareUrl() {
    const customUrl = el.cloudUrl?.value?.trim();
    if (customUrl) {
        let url = customUrl;
        // Remove trailing slash if present
        url = url.replace(/\/$/, '');
        // Add https:// if no protocol specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    }
    return CLOUDFLARE_URL;
}

export function getCurrentAIUrl() {
    return chatState.aiProvider === 'cloud' ? CLOUDFLARE_URL : getOllamaUrl();
}

export const el = {
    panel: document.getElementById('chatboxPanel'),
    messages: document.getElementById('chatboxMessages'),
    input: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendMessage'),

    clearBtn: document.getElementById('clearChat'),
    closeBtn: document.getElementById('closeChatbox'),
    verses: document.getElementById('versesContainer'),
    title: document.getElementById('chapterTitle'),
    chapterMenuToggle: document.getElementById('chapterMenuToggle'),
    prevBtn: document.getElementById('prevChapter'),
    nextBtn: document.getElementById('nextChapter'),
    bookList: document.getElementById('bookList'),
    modelSelect: document.getElementById('modelSelect'),
    modelRefresh: document.getElementById('modelRefresh'),
    bibleVersion: document.getElementById('bibleVersion'),
    bibleHeader: document.getElementById('bibleHeader'),
    toggleAI: document.getElementById('toggleAI'),
    toggleTheme: document.getElementById('toggleTheme'),
    toggleMenu: document.getElementById('toggleMenu'),
    settingsBtn: document.getElementById('settingsBtn'),
    aiProviderToggle: document.getElementById('aiProviderToggle'),
    settingsPanel: document.getElementById('chatboxSettings'),
    cloudUrl: document.getElementById('cloudUrl'),
    temperature: document.getElementById('temperature'),
    topP: document.getElementById('topP'),
    topK: document.getElementById('topK'),
    maxTokens: document.getElementById('maxTokens'),
    customPrompt: document.getElementById('customPrompt'),
    ollamaUrl: document.getElementById('ollamaUrl'),
    aiPassword: document.getElementById('aiPassword'),
    splitBtn: document.getElementById('splitView')
};

export function setDarkTheme(value) {
    isDarkTheme = value;
}

export function setAvailableModels(models) {
    availableModels = models;
}

export function getCloudAPIKey(forcePrompt = false) {
    // First check settings for password
    const savedSettings = localStorage.getItem('aiSettings');
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            if (parsed.aiPassword) {
                return parsed.aiPassword;
            }
        } catch (e) {
            console.warn('Error reading aiPassword from settings:', e);
        }
    }
    
    // No password in settings
    if (forcePrompt) {
        return null;
    }
    
    // Message sending - only prompt if no stored key
    const apiKey = localStorage.getItem('cloudAPIKey');
    if (!apiKey) {
        return null;
    }
    return apiKey;
}

// ============================================
// UI - Theme, menu, and resize functions
// ============================================

export function toggleTheme() {
    setDarkTheme(!isDarkTheme);
    
    const lightTheme = document.getElementById('lightTheme');
    const darkTheme = document.getElementById('darkTheme');
    
    if (isDarkTheme) {
        lightTheme.disabled = true;
        darkTheme.disabled = false;
        el.toggleTheme.textContent = '🌙';
    } else {
        lightTheme.disabled = false;
        darkTheme.disabled = true;
        el.toggleTheme.textContent = '☀️';
    }
    
    localStorage.setItem('darkTheme', isDarkTheme);
}

export function toggleMenu() {
    if (window.innerWidth > 768) return;
    const sidebar = document.querySelector('.sidebar');
    const isNowVisible = !sidebar.classList.contains('mobile-visible');
    
    sidebar.classList.toggle('mobile-visible');
    localStorage.setItem('menuHidden', !isNowVisible);
    
    // If sidebar is now visible and AI chatbox is open, remove full-width class
    if (isNowVisible) {
        const chatboxPanel = document.querySelector('.chatbox-panel');
        if (chatboxPanel && chatboxPanel.classList.contains('open')) {
            chatboxPanel.classList.remove('mobile-full-width');
        }
    }
}

export function setupResize() {
    let isResizing = false;
    let panel = null;
    let startX = 0;
    let startWidth = 0;
    
    document.addEventListener('mousedown', e => {
        if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
            const handle = e.target.classList.contains('resize-handle') ? e.target : e.target.closest('.resize-handle');
            const panelElement = handle.parentElement;
            if (panelElement && panelElement.classList.contains('chatbox-panel')) {
                isResizing = true;
                panel = panelElement;
                startX = e.clientX;
                startWidth = panel.offsetWidth;
                panel.classList.add('resizing');
                handle.classList.add('active-resize');
                document.body.classList.add('resizing');
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });
    
    document.addEventListener('mousemove', e => {
        if (!isResizing || !panel) return;
        e.preventDefault();
        
        const diff = startX - e.clientX;
        let newWidth = startWidth + diff;
        
        // Fixed limits: min 350px, max leaves 350px for main content
        const sidebar = document.querySelector('.sidebar');
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
        const viewportWidth = window.innerWidth;
        const minWidth = 350;
        const maxWidth = viewportWidth - sidebarWidth - 350;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            panel.style.width = `${newWidth}px`;
            panel.style.minWidth = `${newWidth}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing && panel) {
            panel.classList.remove('resizing');
            document.querySelectorAll('.active-resize').forEach(handle => {
                handle.classList.remove('active-resize');
            });
            document.body.classList.remove('resizing');
            
            localStorage.setItem('aiPanelWidth', panel.style.width);
            
            isResizing = false;
            panel = null;
        }
    });
    
    document.addEventListener('mouseleave', () => {
        if (isResizing && panel) {
            panel.classList.remove('resizing');
            document.querySelectorAll('.active-resize').forEach(handle => {
                handle.classList.remove('active-resize');
            });
            document.body.classList.remove('resizing');
            
            localStorage.setItem('aiPanelWidth', panel.style.width);
            
            isResizing = false;
            panel = null;
        }
    });
    
    const savedWidth = localStorage.getItem('aiPanelWidth');
    if (savedWidth) {
        const chatPanel = document.getElementById('chatboxPanel');
        if (chatPanel && chatPanel.classList.contains('open')) {
            chatPanel.style.width = savedWidth;
            chatPanel.style.minWidth = savedWidth;
        }
    }
}

export function updateBookFontSize(sidebarWidth) {
    const root = document.documentElement;
    let fontSize;
    
    if (sidebarWidth >= 250) {
        fontSize = '26px';
    } else if (sidebarWidth >= 220) {
        fontSize = '22px';
    } else if (sidebarWidth >= 200) {
        fontSize = '20px';
    } else {
        fontSize = '1.2rem';
    }
    
    root.style.setProperty('--book-font-size', fontSize);
    root.style.setProperty('--current-sidebar-width', `${sidebarWidth}px`);
}

// ============================================
// UTILS - Formatting and helper functions
// ============================================

export function fmt(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\.([A-Z])/g, '.<br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$1')
        .replace(/\n/g, '<br>');
}

export function scroll(messagesContainer) {
    requestAnimationFrame(() => {
        messagesContainer.scrollTop = 0;
    });
}

export function scrollToMessage(messageElement) {
    requestAnimationFrame(() => {
        setTimeout(() => {
            el.messages.scrollTop = messageElement.offsetTop;
        }, 50);
    });
}

export function scrollToAIResponse(aiMessageElement) {
    requestAnimationFrame(() => {
        setTimeout(() => {
            const containerRect = el.messages.getBoundingClientRect();
            const elementRect = aiMessageElement.getBoundingClientRect();
            el.messages.scrollTop = el.messages.scrollTop + (elementRect.top - containerRect.top) - 77;
        }, 50);
    });
}

export function getBrightness(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return (r * 299 + g * 587 + b * 114) / 1000;
}

// Mobile keyboard handling - ensure chat input floats above keyboard
export function setupMobileKeyboardHandling() {
    const chatInput = document.getElementById('chatInput');
    const chatInputArea = document.querySelector('.chatbox-input-area');
    const chatPanel = document.querySelector('.chatbox-panel');
    
    if (!chatInput || !chatInputArea) return;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    // iOS Safari - uses visual viewport
    if (window.visualViewport) {
        const originalHeight = window.visualViewport.height;
        
        window.visualViewport.addEventListener('resize', () => {
            const currentHeight = window.visualViewport.height;
            const diff = originalHeight - currentHeight;
            
            if (diff > 50) {
                // Keyboard is open - attach input ABOVE keyboard with 10px offset
                chatInputArea.style.position = 'fixed';
                chatInputArea.style.bottom = `${diff + 10}px`;
                chatInputArea.style.left = '0';
                chatInputArea.style.right = '0';
                chatInputArea.style.width = '100%';
                chatInputArea.style.boxSizing = 'border-box';
            } else {
                // Keyboard is closed - attach to bottom of viewport
                chatInputArea.style.position = 'fixed';
                chatInputArea.style.bottom = '0';
                chatInputArea.style.left = '0';
                chatInputArea.style.right = '0';
                chatInputArea.style.width = '100%';
                chatInputArea.style.boxSizing = 'border-box';
            }
        });
    }
    
    // Android fallback using window innerHeight
    window.addEventListener('resize', () => {
        if (!window.visualViewport) {
            const screenHeight = window.screen.height;
            const windowHeight = window.innerHeight;
            const diff = screenHeight - windowHeight;
            
            if (diff > 100) {
                chatInputArea.style.position = 'fixed';
                chatInputArea.style.bottom = `${diff + 10}px`;
                chatInputArea.style.left = '0';
                chatInputArea.style.right = '0';
                chatInputArea.style.width = '100%';
                chatInputArea.style.boxSizing = 'border-box';
            } else {
                chatInputArea.style.position = 'fixed';
                chatInputArea.style.bottom = '0';
                chatInputArea.style.left = '0';
                chatInputArea.style.right = '0';
                chatInputArea.style.width = '100%';
                chatInputArea.style.boxSizing = 'border-box';
            }
        }
    });
}
