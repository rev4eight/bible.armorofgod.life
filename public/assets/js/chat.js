import { chatState, el, getOllamaUrl, getCloudflareUrl, getCloudAPIKey } from './state-ui-utils.js';
import { fmt, scroll, scrollToMessage, scrollToAIResponse } from './state-ui-utils.js';

export function addMessage(text, type, avatar) {
    const div = document.createElement('div');
    div.className = `message ${type}-message`;
    if (type === 'user') {
        div.innerHTML = `<div class="message-content"><p>${fmt(text)}</p></div>`;
    } else {
        div.innerHTML = `<div class="message-content"><div class="message-avatar">${avatar}</div><p>${fmt(text)}</p></div>`;
    }
    el.messages.appendChild(div);
    if (type === 'user') {
        scrollToMessage(div);
    } else if (type === 'ai') {
        scrollToAIResponse(div);
    }
    saveChatHistory();
}

export function saveChatHistory() {
    const msgs = [];
    document.querySelectorAll('.message').forEach(m => {
        if (!m.classList.contains('typing-indicator')) {
            msgs.push({ type: m.classList.contains('user-message') ? 'user' : 'ai', text: m.querySelector('p')?.textContent || '' });
        }
    });
    const toSave = msgs.slice(-10);
    localStorage.setItem('chatHistory', JSON.stringify(toSave));
    console.log('saveChatHistory: saved', toSave.length, 'messages');
    console.log('saveChatHistory: content:', JSON.stringify(toSave));
}

export function loadChatHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        // Only clear and load if there's saved history
        if (saved.length > 0) {
            el.messages.innerHTML = '';
            saved.forEach(m => addMessage(m.text, m.type, m.type === 'user' ? '👤' : '🤖'));
        }
        // If no history, keep the default welcome message
    } catch (e) {
        console.error('Error loading chat history:', e);
    }
}

export function showTyping() {
    const div = document.createElement('div');
    div.id = 'typingIndicator';
    div.className = 'typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    el.messages.appendChild(div);
}

export function removeTyping() { 
    document.getElementById('typingIndicator')?.remove(); 
}

export function updateSendButton() {
    if (chatState.isProcessing) {
        el.sendBtn.innerHTML = '■';
        el.sendBtn.classList.add('processing');
        el.input.disabled = true;
        el.input.placeholder = 'AI is thinking...';
    } else {
        el.sendBtn.innerHTML = '➤';
        el.sendBtn.classList.remove('processing');
        el.input.disabled = false;
        el.input.placeholder = 'Ask about this chapter...';
    }
}

export function showChat() {
    chatState.isChatOpen = true;
    localStorage.setItem('chatOpen', 'true');
    
    // Clear any previous inline width from resize
    el.panel.style.width = '';
    el.panel.style.minWidth = '';
    el.panel.style.maxWidth = '';
    
    el.panel.classList.add('open');
    document.body.classList.add('chat-open');
    
    const toggleAI = document.getElementById('toggleAI');
    if (toggleAI) {
        toggleAI.classList.add('ai-active');
    }
    
    // Remove split button border when AI is active
    const splitBtn = document.getElementById('splitView');
    if (splitBtn) {
        splitBtn.classList.remove('split-active');
    }
    
    // Load saved width if exists
    const savedWidth = localStorage.getItem('aiPanelWidth');
    if (savedWidth) {
        el.panel.style.width = savedWidth;
        el.panel.style.minWidth = savedWidth;
    }
    
    // Set chatbox to be 22px wider than left menu edge
    const root = document.documentElement;
    root.style.setProperty('--chatbox-extra-width', '22px');
}

export function hideChat() {
    chatState.isChatOpen = false;
    localStorage.setItem('chatOpen', 'false');
    
    el.panel.classList.remove('open');
    el.panel.classList.remove('mobile-full-width');
    document.body.classList.remove('chat-open');
    
    // Clear all inline styles from resize
    el.panel.style.width = '';
    el.panel.style.minWidth = '';
    el.panel.style.maxWidth = '';
    el.panel.style.flex = '';
    el.panel.style.flexBasis = '';
    el.panel.style.flexShrink = '';
    
    // Clear saved width from localStorage
    localStorage.removeItem('aiPanelWidth');
    
    // Force browser to recalculate layout
    void el.panel.offsetWidth;
    
    // Reset chatbox CSS variable
    const root = document.documentElement;
    root.style.setProperty('--chatbox-extra-width', '0px');
    
    const toggleAI = document.getElementById('toggleAI');
    if (toggleAI) {
        toggleAI.classList.remove('ai-active');
    }
    
    // Restore split button border if split view is still active
    const splitBtn = document.getElementById('splitView');
    if (splitBtn && chatState.isSplitView) {
        splitBtn.classList.add('split-active');
    }
}

export function toggleChat() {
    if (el.panel.classList.contains('open')) {
        hideChat();
    } else {
        // If split view is open, close it first
        if (typeof chatState !== 'undefined' && chatState.isSplitView) {
            import('./splitView.js').then(({ closeSplitView }) => closeSplitView());
        }
        // Check if we're in mobile view and sidebar is visible
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('mobile-visible')) {
                // Hide sidebar and make chatbox full width
                sidebar.classList.remove('mobile-visible');
                el.panel.classList.add('mobile-full-width');
                localStorage.setItem('menuHidden', 'true');
            }
        }
        showChat();
    }
}



export function clearChat() {
    el.messages.innerHTML = `<div class="message ai-message"><div class="message-content"><div class="message-avatar">🤖</div><p>Select a chapter and ask about the text.</p></div></div>`;
    localStorage.removeItem('chatHistory');
}

export function toggleSettings() {
    el.settingsPanel.classList.toggle('open');
    if (el.settingsPanel.classList.contains('open')) {
        el.cloudUrl.dispatchEvent(new Event('input', { bubbles: true }));
        el.aiPassword.dispatchEvent(new Event('input', { bubbles: true }));
        el.ollamaUrl.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

export function saveSettings() {
    const settings = {
        cloudUrl: el.cloudUrl.value,
        temperature: el.temperature.value,
        topP: el.topP.value,
        topK: el.topK.value,
        maxTokens: el.maxTokens.value,
        customPrompt: el.customPrompt.value,
        ollamaUrl: el.ollamaUrl.value,
        aiPassword: el.aiPassword.value
    };
    localStorage.setItem('aiSettings', JSON.stringify(settings));
    
    localStorage.setItem('bibleVersion', el.bibleVersion.value);
}

export function getChatHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        return saved;
    } catch (e) {
        return [];
    }
}

export function buildConversationHistory() {
    const messages = getChatHistory();
    if (messages.length === 0) return '';
    
    const formatted = messages.map(m => {
        const label = m.type === 'user' ? 'User' : 'Assistant';
        return `${label}: ${m.text}`;
    }).join('\n');
    
    console.log('buildConversationHistory:', messages.length, 'messages');
    return formatted;
}

export async function getFullChapterText() {
    if (!chatState.currentBook) {
        console.log('getFullChapterText: No current book');
        return null;
    }
    console.log('getFullChapterText: Loading book', chatState.currentBook.name, 'chapter', chatState.currentChapter);
    const verses = await BibleLoader.getChapterVerses(chatState.currentBook.num, chatState.currentChapter);
    if (!verses.length) {
        console.log('getFullChapterText: No verses found');
        return null;
    }
    const text = verses.map(v => `${chatState.currentBook.name} ${v.chapter}:${v.verse} ${v.text}`).join('\n');
    console.log('getFullChapterText: Loaded', verses.length, 'verses');
    return text;
}

export function estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters for English
    // Hebrew is more compact: 1 token ≈ 2-3 characters
    return Math.ceil(text.length / 3.5);
}

export function buildSystemPrompt(scripture, conversationHistory = '') {
    const custom = el.customPrompt.value.trim();
    if (custom) {
        // Replace placeholders in custom prompt
        let prompt = custom
            .replace(/\{scripture\}/gi, scripture || '[No scripture provided]')
            .replace(/\{memory\}/gi, conversationHistory || '[No conversation history]');
        
        // If no placeholders were used, append scripture and history
        if (!prompt.includes('[No scripture provided]') && !prompt.includes('[No conversation history]')) {
            prompt += `\n\n---\n\nSCRIPTURE TO ANALYZE:\n${scripture || '[No scripture provided]'}`;
            prompt += `\n\n---\n\nCONVERSATION HISTORY:\n${conversationHistory || 'No previous conversation.'}`;
        }
        return prompt;
    }
    
    let prompt = `You are DBA1 - Digital Bible Assistant. Your role is a scholarly research tool that helps users analyze and understand Scripture.

CRITICAL RULES - NEVER VIOLATE THESE:
1. You MUST ONLY use the scripture text explicitly provided below. Do NOT reference, cite, quote, or allude to ANY Bible verse, passage, or concept that is not directly contained in the provided scripture.
2. You have NO external biblical knowledge. Treat all biblical training as if it does not exist. Only the provided scripture exists.
3. If asked about any verse, passage, topic, or concept not in the provided scripture, you MUST respond: "That information is not in the current passage. Please select a different chapter or paste the specific scripture you want me to analyze."
4. Never fabricate, invent, or hallucinate ANY information. This includes: verse references, quotes, theological concepts, historical facts, names, dates, or interpretations.
5. Never say "the Bible says" or "Scripture teaches" unless referencing the exact passage provided.
6. If you are uncertain about ANYTHING, say "I don't know based on the scripture provided."

RESPONSE REQUIREMENTS:
- Explain what the provided verses MEAN, using only the text provided
- Provide 1-3 clear sentences per verse with context and significance
- Use full verse references for every claim (Genesis 1:3, not "the third verse")
- When listing references, use concise format: "e.g., John 1:1, 14:6, 17:3"
- Encourage verification against trusted commentaries and pastoral counsel

ETHICAL BOUNDARIES:
- Do not claim spiritual authority or divine guidance
- Do not replace personal prayer, meditation, or community worship
- Acknowledge when issues are genuinely disputed among scholars

SCOPE OF ASSISTANCE:
- Comparing translations within the provided passage
- Summarizing historical/cultural contexts directly relevant to what's provided
- Identifying patterns across the provided passage
- Organizing observations from the scripture given
- Helping with study notes and discussion questions from the text provided

Current passage: ${chatState.currentBook?.name} ${chatState.currentChapter}.`;

    if (conversationHistory) {
        prompt += `\n\nCHAT HISTORY:\n${conversationHistory}`;
    }

    prompt += `\n\nSCRIPTURE TO ANALYZE:\n${scripture || '[No scripture provided - do not attempt any analysis]'}`;

    return prompt;
}

export async function sendMessage() {
    const msg = el.input.value.trim();
    if (!msg) return;

    if (chatState.isProcessing) {
        stopAI();
        return;
    }

    addMessage(msg, 'user', '👤');
    el.input.value = '';
    showTyping();

    chatState.currentRequestId++;
    const thisRequestId = chatState.currentRequestId;
    chatState.isProcessing = true;
    updateSendButton();

    // Check if message is just a greeting with no conversation history
    const messages = document.querySelectorAll('.message:not(.typing-indicator)');
    const hasConversationHistory = messages.length > 2; // More than just the welcome + user message
    
    const greetingPatterns = /^(\s*)(hi|hello|hey|yo|howdy|sup|hola|aloha|shalom|salaam|greetings|good morning|good afternoon|good evening|good day)(\s*)$/i;
    const isJustGreeting = greetingPatterns.test(msg) && msg.length < 20;
    
    // Only respond with help message if it's a pure greeting with no history
    if (isJustGreeting && !hasConversationHistory) {
        removeTyping();
        addMessage("Hello! I'm here to help you study the Bible. Ask me to explain verses, provide context, or discuss themes in the current chapter.", 'ai', '🤖');
        chatState.isProcessing = false;
        updateSendButton();
        return;
    }

    // Create abort controller for this request
    chatState.abortController = new AbortController();

    try {
        if (chatState.aiProvider === 'cloud') {
            await sendToCloud(msg, thisRequestId);
        } else {
            await sendToOllama(msg, thisRequestId);
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log('Request was aborted');
        removeTyping();
        addMessage('Response stopped.', 'ai', '🤖');
        } else {
            console.error(e);
            removeTyping();
            addMessage(`Error: ${e.message}`, 'ai', '🤖');
        }
    }

    chatState.isProcessing = false;
    chatState.abortController = null;
    updateSendButton();
}

export function stopAI() {
    if (chatState.abortController) {
        chatState.abortController.abort();
        console.log('AI request aborted via AbortController');
    }
    
    // For Ollama, also call the cancel endpoint to immediately stop generation
    if (chatState.aiProvider !== 'cloud') {
        const ollamaUrl = getOllamaUrl();
        fetch(`${ollamaUrl}/api/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).catch(e => console.log('Ollama cancel request failed:', e));
    }
}

export async function sendToCloud(userMessage, requestId) {
    // Check if AI panel is open
    if (!chatState.isChatOpen) {
        throw new Error('Please open the AI chat panel first.');
    }
    
    const scripture = await getFullChapterText();
    const conversationHistory = buildConversationHistory();
    const cloudUrl = getCloudflareUrl();
    
    // Get API key - will only prompt if panel is open
    const apiKey = getCloudAPIKey();
    if (!apiKey) {
        throw new Error('Cloudflare API key required. Please enter your key in the AI settings.');
    }
    
    const headers = { 
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
    };

    const systemPrompt = buildSystemPrompt(scripture, conversationHistory);
    const userPrompt = userMessage;

    // Calculate tokens to reserve space for response
    const systemTokens = estimateTokens(systemPrompt);
    const userTokens = estimateTokens(userPrompt);
    const historyTokens = estimateTokens(conversationHistory);
    const scriptureTokens = estimateTokens(scripture || '');
    
    // Estimate total input tokens
    const totalInputTokens = systemTokens + userTokens + historyTokens + scriptureTokens;
    
    // Llama 3.1 70B context window is ~128K tokens, but Cloudflare limits responses
    // Reserve ~4000 tokens for response to ensure completeness
    const maxResponseTokens = 4000;
    const maxTokens = Math.min(8000, totalInputTokens + maxResponseTokens);
    
    console.log('sendToCloud: input tokens ≈', totalInputTokens, 'maxTokens:', maxTokens);

    const response = await fetch(`${cloudUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: chatState.selectedModel,
            system: systemPrompt,
            prompt: userPrompt,
            stream: false,
            options: {
                temperature: parseFloat(el.temperature.value) || 0.2,
                top_p: parseFloat(el.topP.value) || 0.9,
                top_k: parseInt(el.topK.value) || 40,
                num_predict: maxTokens
            }
        }),
        signal: chatState.abortController?.signal
    });

    // Check if request was aborted
    if (chatState.abortController?.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Cloud Error Response:', errorText);
        if (response.status === 401) {
            el.aiProviderToggle.classList.remove('cloud-active');
            el.aiProviderToggle.classList.add('cloud-error');
            el.aiProviderToggle.title = 'Auth failed. Check Settings password.';
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const answer = data.response || data.choices?.[0]?.message?.content || 'No response from Cloud AI.';
    removeTyping();
    addMessage(answer, 'ai', '🤖');
}

async function sendToOllama(userMessage, requestId) {
    const scripture = await getFullChapterText();
    console.log('sendToOllama: scripture is', scripture ? 'defined' : 'NULL');
    
    const conversationHistory = buildConversationHistory();
    const ollamaUrl = getOllamaUrl();
    
    const systemPrompt = buildSystemPrompt(scripture, conversationHistory);
    console.log('sendToOllama: systemPrompt length:', systemPrompt.length);
    
    const userPrompt = userMessage;

    // Calculate tokens to reserve space for response
    const systemTokens = estimateTokens(systemPrompt);
    const userTokens = estimateTokens(userPrompt);
    const historyTokens = estimateTokens(conversationHistory);
    const scriptureTokens = estimateTokens(scripture || '');
    
    const totalInputTokens = systemTokens + userTokens + historyTokens + scriptureTokens;
    const maxResponseTokens = 4000;
    const maxTokens = Math.min(8000, totalInputTokens + maxResponseTokens);
    
    console.log('sendToOllama: input tokens ≈', totalInputTokens, 'maxTokens:', maxTokens);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: chatState.selectedModel,
            system: systemPrompt,
            prompt: userPrompt,
            stream: false,
            options: {
                temperature: parseFloat(el.temperature.value) || 0.2,
                top_p: parseFloat(el.topP.value) || 0.9,
                top_k: parseInt(el.topK.value) || 40,
                num_predict: maxTokens
            }
        }),
        signal: chatState.abortController?.signal
    });

    // Check if request was aborted
    if (chatState.abortController?.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const answer = data.response || 'No response from Ollama.';
    removeTyping();
    addMessage(answer, 'ai', '🤖');
}