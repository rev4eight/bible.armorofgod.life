import { chatState, el, isDarkTheme, setDarkTheme, getCurrentAIUrl, getCloudAPIKey, toggleTheme, toggleMenu, setupResize, updateBookFontSize, setupMobileKeyboardHandling } from './state-ui-utils.js';
import { addMessage, loadChatHistory, sendMessage, toggleChat, hideChat, clearChat, toggleSettings, saveSettings, stopAI } from './chat.js';
import { fetchModels, populateModelSelect, validateCloudCredentials } from './models.js';
import { createSplitView, closeSplitView } from './splitView.js';
import { populateVersionDropdown } from './versionDropdown.js';
import { loadBookList, loadChapter, navigate, collapseAllAndScrollTop, expandToSavedBook, highlightSavedChapter } from './navigation.js';
import { setupHighlighting } from './highlighting.js';

function setupEvents() {
    el.sendBtn.addEventListener('click', () => {
        if (chatState.isProcessing) {
            stopAI();
        } else {
            sendMessage();
        }
    });
    el.input.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    el.input.addEventListener('click', () => { el.input.focus(); setTimeout(() => el.input.focus(), 50); });

    el.clearBtn.addEventListener('click', clearChat);
    el.closeBtn.addEventListener('click', () => { hideChat(); });
    el.prevBtn.addEventListener('click', function() {
        this.classList.add('touch-active');
        setTimeout(() => {
            this.classList.remove('touch-active');
            this.blur();
            // Force reset on mobile - disable transitions temporarily
            this.style.transition = 'none';
            this.style.display = 'none';
            this.offsetHeight;
            this.style.display = '';
            // Re-enable transitions after repaint
            requestAnimationFrame(() => {
                this.style.transition = '';
            });
        }, 500);
        navigate(-1);
    });
    
    el.nextBtn.addEventListener('click', function() {
        this.classList.add('touch-active');
        setTimeout(() => {
            this.classList.remove('touch-active');
            this.blur();
            // Force reset on mobile - disable transitions temporarily
            this.style.transition = 'none';
            this.style.display = 'none';
            this.offsetHeight;
            this.style.display = '';
            // Re-enable transitions after repaint
            requestAnimationFrame(() => {
                this.style.transition = '';
            });
        }, 500);
        navigate(1);
    });
    
    // Bottom navigation buttons - use different handlers for split vs single panel mode
    const bottomPrevBtn = document.getElementById('bottomPrevChapter');
    const bottomNextBtn = document.getElementById('bottomNextChapter');
    
    if (bottomPrevBtn) {
        bottomPrevBtn.addEventListener('click', function() {
            this.classList.add('touch-active');
            setTimeout(() => {
                this.classList.remove('touch-active');
                this.blur();
                // Force reset on mobile - disable transitions temporarily
                this.style.transition = 'none';
                this.style.display = 'none';
                this.offsetHeight;
                this.style.display = '';
                // Re-enable transitions after repaint
                requestAnimationFrame(() => {
                    this.style.transition = '';
                });
            }, 500);
            if (chatState.isSplitView) {
                import('./splitView.js').then(({ navigateBothPanels }) => {
                    navigateBothPanels(-1);
                });
            } else {
                navigate(-1);
            }
        });
    }
    
    if (bottomNextBtn) {
        bottomNextBtn.addEventListener('click', function() {
            this.classList.add('touch-active');
            setTimeout(() => {
                this.classList.remove('touch-active');
                this.blur();
                // Force reset on mobile - disable transitions temporarily
                this.style.transition = 'none';
                this.style.display = 'none';
                this.offsetHeight;
                this.style.display = '';
                // Re-enable transitions after repaint
                requestAnimationFrame(() => {
                    this.style.transition = '';
                });
            }, 500);
            if (chatState.isSplitView) {
                import('./splitView.js').then(({ navigateBothPanels }) => {
                    navigateBothPanels(1);
                });
            } else {
                navigate(1);
            }
        });
    }
    el.modelRefresh.addEventListener('click', () => fetchModels());
    el.splitBtn.addEventListener('click', toggleSplitView);

    async function toggleAIProvider() {
        if (chatState.aiProvider === 'local') {
            const apiKey = getCloudAPIKey(true);
            if (!apiKey) {
                el.aiProviderToggle.classList.add('cloud-error');
                el.aiProviderToggle.title = 'No password. Enter in Settings.';
                return;
            }
            const result = await validateCloudCredentials(apiKey);
            if (!result.valid) {
                el.aiProviderToggle.classList.add('cloud-error');
                if (result.error === 'connection') {
                    el.aiProviderToggle.title = 'Connection failed. Check API URL.';
                } else if (result.error === 'server') {
                    el.aiProviderToggle.title = 'Server error. Try again.';
                } else {
                    el.aiProviderToggle.title = 'Auth failed. Check Settings password.';
                }
                return;
            }
            chatState.aiProvider = 'cloud';
            el.aiProviderToggle.classList.add('cloud-active');
            el.aiProviderToggle.classList.remove('cloud-error');
            el.aiProviderToggle.title = 'Auth successful. Connected to Cloud AI.';
            el.aiProviderToggle.textContent = '☁️';
            localStorage.setItem('aiProvider', chatState.aiProvider);
            fetchModels();
        } else {
            chatState.aiProvider = 'local';
            el.aiProviderToggle.classList.remove('cloud-active');
            el.aiProviderToggle.classList.remove('cloud-error');
            el.aiProviderToggle.title = 'Toggle AI Provider';
            el.aiProviderToggle.textContent = '☁️';
            localStorage.setItem('aiProvider', 'local');
            fetchModels();
            return;
        }
    }

    el.aiProviderToggle.addEventListener('click', toggleAIProvider);

    async function toggleSplitView() {
    const splitBtn = document.getElementById('splitView');
    if (chatState.isSplitView) {
        // Close split view
        closeSplitView();
        localStorage.setItem('splitViewOpen', 'false');
        splitBtn.textContent = '➕';
        splitBtn.title = 'Create Parallel View';
        splitBtn.classList.remove('split-active');
    } else {
        // If AI chat is open, close it first
        if (chatState.isChatOpen) {
            const { hideChat } = await import('./chat.js');
            hideChat();
        }
        // Open split view
        await createSplitView();
        localStorage.setItem('splitViewOpen', 'true');
        splitBtn.textContent = '➖';
        splitBtn.title = 'Close Parallel View';
        splitBtn.classList.add('split-active');
    }
}
    el.bibleVersion.addEventListener('change', (e) => {
        // In split view, only update panel-0 version and content
        if (chatState.isSplitView) {
            const panel0State = chatState.splitPanelStates.find(state => state.id === 'panel-0');
            if (panel0State) {
                panel0State.version = e.target.value;
                import('./splitView.js').then(({ updatePanelContent }) => {
                    updatePanelContent('panel-0');
                });
            }
        } else {
            // Single panel mode - update global version
            BibleLoader.setVersion(e.target.value);
            if (chatState.currentBook) {
                loadChapter(chatState.currentChapter, chatState.currentBook.name);
            }
        }
    });
    el.bibleHeader.addEventListener('click', function() {
        // Mobile only: if menu is open and at top, close it
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('mobile-visible')) {
                const bookList = el.bookList;
                if (bookList) {
                    // Debug logging
                    console.log('=== HOLY BIBLE Click Debug ===');
                    console.log('scrollTop:', bookList.scrollTop);
                    console.log('scrollHeight:', bookList.scrollHeight);
                    console.log('clientHeight:', bookList.clientHeight);
                    
                    // Check if at top - multiple conditions for reliability
                    const isAtTop = bookList.scrollTop <= 0 || 
                                    (bookList.scrollTop <= 10 && bookList.scrollHeight <= bookList.clientHeight + 10);
                    
                    console.log('isAtTop:', isAtTop);
                    
                    if (isAtTop) {
                        // Close menu immediately
                        sidebar.classList.remove('mobile-visible');
                        localStorage.setItem('menuHidden', true);
                        console.log('Menu closed!');
                        return;
                    } else {
                        console.log('Not at top, collapsing...');
                        // Not at top - do normal behavior (collapse)
                        collapseAllAndScrollTop();
                        return;
                    }
                }
            }
        }
        // Desktop or menu closed - just collapse (normal behavior)
        collapseAllAndScrollTop();
    });
    el.toggleAI.addEventListener('click', toggleChat);
    el.toggleTheme.addEventListener('click', toggleTheme);
    el.title.addEventListener('click', function() {
        // Mobile only: if menu is open and at top, close it
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('mobile-visible')) {
                const bookList = el.bookList;
                if (bookList) {
                    // Debug logging
                    console.log('=== Title Click Debug ===');
                    console.log('scrollTop:', bookList.scrollTop);
                    console.log('scrollHeight:', bookList.scrollHeight);
                    console.log('clientHeight:', bookList.clientHeight);
                    console.log('offsetHeight:', bookList.offsetHeight);
                    console.log('scrollTop === 0:', bookList.scrollTop === 0);
                    
                    // Check if at top - multiple conditions for reliability
                    const isAtTop = bookList.scrollTop <= 0 || 
                                    (bookList.scrollTop <= 10 && bookList.scrollHeight <= bookList.clientHeight + 10);
                    
                    console.log('isAtTop:', isAtTop);
                    
                    if (isAtTop) {
                        // Close menu immediately
                        sidebar.classList.remove('mobile-visible');
                        localStorage.setItem('menuHidden', true);
                        console.log('Menu closed!');
                        return;
                    } else {
                        console.log('Not at top, collapsing and scrolling...');
                        // Not at top - do normal behavior (collapse and scroll)
                        collapseAllAndScrollTop();
                        return;
                    }
                }
            }
        }
        toggleMenu();
    });
    
    // Menu toggle icon click handler
    const menuToggleIcon = document.getElementById('chapterMenuToggle');
    if (menuToggleIcon) {
        menuToggleIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent title click from also firing
            toggleMenu();
        });
    }
    
    el.settingsBtn.addEventListener('click', toggleSettings);
    


    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const chapterTitle = el.title;
        const menuToggle = el.chapterMenuToggle;
        if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-visible') && 
            !sidebar.contains(e.target) && e.target !== chapterTitle && e.target !== menuToggle) {
            sidebar.classList.remove('mobile-visible');
            localStorage.setItem('menuHidden', true);
        }
    });

    [el.cloudUrl, el.temperature, el.topP, el.topK, el.maxTokens, el.customPrompt, el.ollamaUrl, el.aiPassword].forEach(input => {
        input.addEventListener('input', saveSettings);
    });
    
    // Validate URL and Password on input with debounce
    let urlValidationTimeout;
    let passwordValidationTimeout;
    
    function normalizeUrl(url) {
        let normalized = url.trim();
        if (!normalized) return '';
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        // Add https:// if no protocol specified
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        return normalized;
    }
    
    function updateCloudBorder() {
        const urlIcon = document.getElementById('cloudUrlValid');
        const passwordIcon = document.getElementById('aiPasswordValid');
        const urlValid = urlIcon?.classList.contains('valid');
        const passwordValid = passwordIcon?.classList.contains('valid');
        const urlInvalid = urlIcon?.classList.contains('invalid');
        const passwordInvalid = passwordIcon?.classList.contains('invalid');
        
        if (chatState.aiProvider === 'cloud') {
            if (urlInvalid || passwordInvalid) {
                el.aiProviderToggle.classList.add('cloud-error');
                el.aiProviderToggle.classList.remove('cloud-active');
            } else {
                el.aiProviderToggle.classList.add('cloud-active');
                el.aiProviderToggle.classList.remove('cloud-error');
                if (urlValid && passwordValid) {
                    fetchModels();
                }
            }
        } else {
            el.aiProviderToggle.classList.remove('cloud-active', 'cloud-error');
        }
    }
    
    el.cloudUrl.addEventListener('input', () => {
        clearTimeout(urlValidationTimeout);
        urlValidationTimeout = setTimeout(async () => {
            const urlIcon = document.getElementById('cloudUrlValid');
            const url = el.cloudUrl.value.trim();
            
            if (!url) {
                urlIcon.classList.remove('show', 'valid', 'invalid');
                updateCloudBorder();
                return;
            }
            
            const normalizedUrl = normalizeUrl(url);
            
            // Test if URL is reachable (just a basic fetch test)
            try {
                const response = await fetch(`${normalizedUrl}/api/tags`, { 
                    method: 'HEAD',
                    mode: 'no-cors'
                });
                // With no-cors, we get an opaque response if it works
                urlIcon.textContent = '✓';
                urlIcon.classList.add('show', 'valid');
                urlIcon.classList.remove('invalid');
            } catch (e) {
                urlIcon.textContent = '✗';
                urlIcon.classList.add('show', 'invalid');
                urlIcon.classList.remove('valid');
            }
            updateCloudBorder();
        }, 500);
    });
    
    el.aiPassword.addEventListener('input', () => {
        clearTimeout(passwordValidationTimeout);
        passwordValidationTimeout = setTimeout(async () => {
            const passwordIcon = document.getElementById('aiPasswordValid');
            const password = el.aiPassword.value;
            const url = el.cloudUrl.value.trim() || 'https://ai-web-dba1.armorofgod.life';
            
            if (!password) {
                passwordIcon.classList.remove('show', 'valid', 'invalid');
                updateCloudBorder();
                return;
            }
            
            const normalizedUrl = normalizeUrl(url);
            
            // Test if password works with current URL
            try {
                const response = await fetch(`${normalizedUrl}/api/tags`, {
                    headers: { 'X-API-Key': password }
                });
                if (response.status === 401) {
                    passwordIcon.textContent = '✗';
                    passwordIcon.classList.add('show', 'invalid');
                    passwordIcon.classList.remove('valid');
                } else if (response.ok) {
                    passwordIcon.textContent = '✓';
                    passwordIcon.classList.add('show', 'valid');
                    passwordIcon.classList.remove('invalid');
                } else {
                    passwordIcon.classList.remove('show', 'valid', 'invalid');
                }
            } catch (e) {
                passwordIcon.classList.remove('show', 'valid', 'invalid');
            }
            updateCloudBorder();
        }, 500);
    });
    
    el.aiPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            toggleAIProvider();
        }
    });
    
    // Validate Ollama URL on input
    let ollamaValidationTimeout;
    el.ollamaUrl.addEventListener('input', () => {
        clearTimeout(ollamaValidationTimeout);
        ollamaValidationTimeout = setTimeout(async () => {
            const urlIcon = document.getElementById('ollamaUrlValid');
            let url = el.ollamaUrl.value.trim();
            
            if (!url) {
                urlIcon.classList.remove('show', 'valid', 'invalid');
                return;
            }
            
            // Normalize URL similar to cloud URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'http://' + url;
            }
            url = url.replace(/\/$/, '');
            
            // Test if Ollama is reachable
            try {
                const response = await fetch(`${url}/api/tags`, { 
                    method: 'GET',
                    mode: 'cors'
                });
                if (response.ok) {
                    urlIcon.textContent = '✓';
                    urlIcon.classList.add('show', 'valid');
                    urlIcon.classList.remove('invalid');
                    fetchModels();
                } else {
                    urlIcon.textContent = '✗';
                    urlIcon.classList.add('show', 'invalid');
                    urlIcon.classList.remove('valid');
                    const cloudUrlIcon = document.getElementById('cloudUrlValid');
                    const passwordIcon = document.getElementById('aiPasswordValid');
                    if (chatState.aiProvider === 'cloud' && cloudUrlIcon?.classList.contains('valid') && passwordIcon?.classList.contains('valid')) {
                        fetchModels();
                    } else {
                        el.modelSelect.innerHTML = '<option value="">No models found</option>';
                    }
                }
            } catch (e) {
                urlIcon.textContent = '✗';
                urlIcon.classList.add('show', 'invalid');
                urlIcon.classList.remove('valid');
                const cloudUrlIcon = document.getElementById('cloudUrlValid');
                const passwordIcon = document.getElementById('aiPasswordValid');
                if (chatState.aiProvider === 'cloud' && cloudUrlIcon?.classList.contains('valid') && passwordIcon?.classList.contains('valid')) {
                    fetchModels();
                } else {
                    el.modelSelect.innerHTML = '<option value="">No models found</option>';
                }
            }
        }, 500);
    });
    
    el.bibleVersion.addEventListener('change', saveSettings);
}

async function initializeApp() {
    const savedTheme = localStorage.getItem('darkTheme');
    const savedAIProvider = localStorage.getItem('aiProvider');
    
    if (savedAIProvider === 'cloud') {
        const apiKey = getCloudAPIKey();
        if (apiKey) {
            const result = await validateCloudCredentials(apiKey);
            if (result.valid) {
                chatState.aiProvider = 'cloud';
                el.aiProviderToggle.classList.add('cloud-active');
                el.aiProviderToggle.title = 'Auth successful. Connected to Cloud AI.';
            } else {
                chatState.aiProvider = 'local';
                el.aiProviderToggle.classList.add('cloud-error');
                if (result.error === 'connection') {
                    el.aiProviderToggle.title = 'Connection failed. Check API URL.';
                } else if (result.error === 'server') {
                    el.aiProviderToggle.title = 'Server error. Try again.';
                } else {
                    el.aiProviderToggle.title = 'Auth failed. Check Settings password.';
                }
                localStorage.setItem('aiProvider', 'local');
            }
        } else {
            chatState.aiProvider = 'local';
            el.aiProviderToggle.classList.remove('cloud-active');
        }
    } else {
        chatState.aiProvider = 'local';
        el.aiProviderToggle.classList.remove('cloud-active');
    }
    
    const lightTheme = document.getElementById('lightTheme');
    const darkTheme = document.getElementById('darkTheme');
    
    if (savedTheme === 'true') {
        setDarkTheme(true);
        lightTheme.disabled = true;
        darkTheme.disabled = false;
        el.toggleTheme.textContent = '🌙';
    } else {
        setDarkTheme(false);
        lightTheme.disabled = false;
        darkTheme.disabled = true;
        el.toggleTheme.textContent = '☀️';
    }

    const menuHidden = localStorage.getItem('menuHidden');
    const isMobile = window.innerWidth <= 768;
    if (menuHidden === 'false' && isMobile) {
        document.querySelector('.sidebar').classList.add('mobile-visible');
    }

    const savedSettings = JSON.parse(localStorage.getItem('aiSettings') || '{}');
    el.temperature.value = savedSettings.temperature || 0.2;
    el.topP.value = savedSettings.topP || 0.9;
    el.topK.value = savedSettings.topK || 40;
    el.maxTokens.value = savedSettings.maxTokens || 1000;
    el.customPrompt.value = savedSettings.customPrompt || '';
    el.ollamaUrl.value = savedSettings.ollamaUrl || '';
    el.aiPassword.value = savedSettings.aiPassword || '';
    el.cloudUrl.value = savedSettings.cloudUrl || '';

    const savedVersion = localStorage.getItem('bibleVersion');
    // Set version AFTER dropdown is populated to ensure saved value is restored correctly
    await populateVersionDropdown();

    if (savedVersion && Array.from(el.bibleVersion.options).some(opt => opt.value === savedVersion)) {
        el.bibleVersion.value = savedVersion;
        BibleLoader.setVersion(savedVersion);
    } else {
        el.bibleVersion.value = 'esv';
        BibleLoader.setVersion('esv');
    }

    loadChatHistory();
    
    // Restore chat panel state if it was open before refresh
    const chatOpen = localStorage.getItem('chatOpen');
    if (chatOpen === 'true') {
        const { showChat } = await import('./chat.js');
        showChat();
    }
    
    setupEvents();
    setupResize();
    setupMobileKeyboardHandling();
    setupHighlighting();
    
    // Settings help button click handler
    const settingsHelpBtn = document.getElementById('settingsHelpBtn');
    const settingsHelpMenu = document.getElementById('settingsHelpMenu');
    if (settingsHelpBtn && settingsHelpMenu) {
        settingsHelpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsHelpMenu.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            settingsHelpMenu.classList.remove('show');
        });
        settingsHelpMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    await populateVersionDropdown();
    await loadBookList();
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const savedSidebarWidth = localStorage.getItem('sidebarWidth');
        if (savedSidebarWidth) {
            const width = parseInt(savedSidebarWidth);
            if (width >= 160 && width <= 380) {
                sidebar.style.width = `${width}px`;
                updateBookFontSize(width);
            } else {
                updateBookFontSize(sidebar.offsetWidth);
            }
        } else {
            updateBookFontSize(sidebar.offsetWidth);
        }
    }
    
    const savedBook = localStorage.getItem('lastBookNum');
    const savedChapter = localStorage.getItem('lastChapter');
    
    if (savedBook && savedChapter) {
        const bookNum = parseInt(savedBook);
        const chapter = parseInt(savedChapter);
        const book = BibleLoader.books.find(b => b.num === bookNum);
        console.log('INIT: savedBook:', savedBook, ', savedChapter:', savedChapter);
        console.log('INIT: currentVersion before loadChapter:', window.BibleLoader.currentVersion);
        if (book) {
            await loadChapter(chapter, book.name);
            highlightSavedChapter(book, chapter);
        } else {
            await loadChapter(1, 'Genesis');
        }
    } else {
        await loadChapter(1, 'Genesis');
    }

    // Restore split view if it was open
    const splitViewOpen = localStorage.getItem('splitViewOpen');
    if (splitViewOpen === 'true') {
        const splitBtn = document.getElementById('splitView');
        await createSplitView();
        splitBtn.textContent = '➖';
        splitBtn.title = 'Close Parallel View';
    }
    
    // Validate saved inputs on load
    setTimeout(async () => {
        // Validate Cloud URL
        const savedCloudUrl = savedSettings.cloudUrl?.trim();
        if (savedCloudUrl) {
            const urlIcon = document.getElementById('cloudUrlValid');
            const normalized = normalizeUrl(savedCloudUrl);
            try {
                await fetch(`${normalized}/api/tags`, { method: 'HEAD', mode: 'no-cors' });
                urlIcon.textContent = '✓';
                urlIcon.classList.add('show', 'valid');
            } catch (e) {
                urlIcon.textContent = '✗';
                urlIcon.classList.add('show', 'invalid');
            }
        }
        
        // Validate Cloud Password
        const savedPassword = savedSettings.aiPassword;
        if (savedPassword) {
            const passwordIcon = document.getElementById('aiPasswordValid');
            const url = savedCloudUrl?.trim() || 'https://ai-web-dba1.armorofgod.life';
            const normalized = normalizeUrl(url);
            try {
                const response = await fetch(`${normalized}/api/tags`, { headers: { 'X-API-Key': savedPassword } });
                if (response.status === 401) {
                    passwordIcon.textContent = '✗';
                    passwordIcon.classList.add('show', 'invalid');
                } else if (response.ok) {
                    passwordIcon.textContent = '✓';
                    passwordIcon.classList.add('show', 'valid');
                }
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Validate Ollama URL
        const savedOllamaUrl = savedSettings.ollamaUrl?.trim();
        if (savedOllamaUrl) {
            const ollamaIcon = document.getElementById('ollamaUrlValid');
            let ollamaUrl = savedOllamaUrl;
            if (!ollamaUrl.startsWith('http://') && !ollamaUrl.startsWith('https://')) {
                ollamaUrl = 'http://' + ollamaUrl;
            }
            ollamaUrl = ollamaUrl.replace(/\/$/, '');
            try {
                const response = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', mode: 'cors' });
                if (response.ok) {
                    ollamaIcon.textContent = '✓';
                    ollamaIcon.classList.add('show', 'valid');
                } else {
                    ollamaIcon.textContent = '✗';
                    ollamaIcon.classList.add('show', 'invalid');
                }
            } catch (e) {
                ollamaIcon.textContent = '✗';
                ollamaIcon.classList.add('show', 'invalid');
            }
        }
    }, 100);

    await fetchModels();
}

// Global function to update split panels when book is selected from menu
let updatePanelContentFunction = null;

// Pre-load the updatePanelContent function
import('./splitView.js').then(({ updatePanelContent }) => {
    updatePanelContentFunction = updatePanelContent;
    console.log('updatePanelContent function pre-loaded');
}).catch(err => {
    console.error('Failed to pre-load updatePanelContent:', err);
});

window.updateSplitPanelsFromBookSelection = function(panelId) {
    console.log(`updateSplitPanelsFromBookSelection called for ${panelId}, isSplitView: ${chatState.isSplitView}`);
    if (!chatState.isSplitView) {
        console.log('Not in split view, skipping panel update');
        return;
    }
    
    console.log(`Current split panel states:`, chatState.splitPanelStates);
    
    const panelState = chatState.splitPanelStates.find(state => state.id === panelId);
    if (!panelState || !panelState.book) {
        console.log(`No panel state or book found for ${panelId}`);
        return;
    }
    
    console.log(`Updating panel ${panelId} to ${panelState.book.name} ${panelState.chapter}`);
    
    // Update only the specific panel that was triggered
    if (updatePanelContentFunction) {
        console.log(`Using pre-loaded updatePanelContent for ${panelId}`);
        updatePanelContentFunction(panelId);
    } else {
        console.log(`Function not pre-loaded, importing for ${panelId}`);
        import('./splitView.js').then(({ updatePanelContent }) => {
            updatePanelContentFunction = updatePanelContent;
            updatePanelContent(panelId);
        }).catch(err => {
            console.error('Failed to import updatePanelContent:', err);
        });
    }
};

document.addEventListener('DOMContentLoaded', initializeApp);