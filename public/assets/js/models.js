import { chatState, el, getOllamaUrl, getCloudflareUrl, getCloudAPIKey, availableModels, setAvailableModels } from './state-ui-utils.js';

export async function validateCloudCredentials(apiKey) {
    const cloudUrl = getCloudflareUrl();
    try {
        const response = await fetch(`${cloudUrl}/api/tags`, {
            headers: { 'X-API-Key': apiKey }
        });
        if (response.status === 401) {
            return { valid: false, error: 'auth' };
        }
        if (!response.ok) {
            return { valid: false, error: 'server' };
        }
        return { valid: true };
    } catch (e) {
        console.error('Cloud credentials validation failed:', e);
        return { valid: false, error: 'connection' };
    }
}

export async function fetchModels() {
    try {
        el.modelSelect.innerHTML = '<option value="">Loading...</option>';
        el.modelRefresh.textContent = '⏳';
        
        if (chatState.aiProvider === 'cloud') {
            await fetchCloudModels();
        } else {
            await fetchOllamaModels();
        }
    } catch (e) {
        console.error('Failed to fetch models:', e);
        const cloudUrlIcon = document.getElementById('cloudUrlValid');
        const passwordIcon = document.getElementById('aiPasswordValid');
        if (chatState.aiProvider === 'cloud' && (!cloudUrlIcon?.classList.contains('valid') || !passwordIcon?.classList.contains('valid'))) {
            el.modelSelect.innerHTML = '<option value="">No models found</option>';
        } else if (chatState.aiProvider === 'cloud') {
            el.modelSelect.innerHTML = '<option value="llama3.2-3b">llama3.2-3b</option>';
            chatState.selectedModel = 'llama3.2-3b';
        } else {
            el.modelSelect.innerHTML = '<option value="llama3.2">llama3.2</option>';
            chatState.selectedModel = 'llama3.2';
        }
    } finally {
        el.modelRefresh.textContent = '↻';
    }
}

async function fetchCloudModels() {
    try {
        if (!chatState.isChatOpen) {
            console.log('AI panel not open, showing cloud default');
            el.modelSelect.innerHTML = '<option value="llama3.2-3b">llama3.2-3b</option>';
            chatState.selectedModel = 'llama3.2-3b';
            return;
        }
        
        const cloudUrl = getCloudflareUrl();
        const apiKey = getCloudAPIKey();
        if (!apiKey) {
            console.log('No Cloudflare API key available');
            el.modelSelect.innerHTML = '<option value="">Enter API key in settings</option>';
            return;
        }
        
        const headers = { 'X-API-Key': apiKey };
        console.log('Fetching cloud models from:', `${cloudUrl}/api/tags`);
        const response = await fetch(`${cloudUrl}/api/tags`, { headers });
        console.log('Cloud models response status:', response.status);
        if (response.status === 401) {
            el.aiProviderToggle.classList.remove('cloud-active');
            el.aiProviderToggle.classList.add('cloud-error');
            el.aiProviderToggle.title = 'Auth failed. Check Settings password.';
            el.modelSelect.innerHTML = '<option value="">Invalid password - check settings</option>';
            return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('Cloud models data:', data);
        const models = data.models || [];
        setAvailableModels(models.map(m => ({ name: m.name, description: m.description })));
        populateModelSelect();
        if (models.length === 0) {
            console.log('No models returned from cloud, using default');
            el.modelSelect.innerHTML = '<option value="llama3.2-3b">llama3.2-3b</option>';
            chatState.selectedModel = 'llama3.2-3b';
        }
    } catch (e) {
        console.error('Failed to fetch Cloud models:', e);
        const cloudUrlIcon = document.getElementById('cloudUrlValid');
        const passwordIcon = document.getElementById('aiPasswordValid');
        if (!cloudUrlIcon?.classList.contains('valid') || !passwordIcon?.classList.contains('valid')) {
            el.modelSelect.innerHTML = '<option value="">No models found</option>';
        } else {
            el.modelSelect.innerHTML = '<option value="llama3.2-3b">llama3.2-3b</option>';
            chatState.selectedModel = 'llama3.2-3b';
        }
    }
}

async function fetchOllamaModels() {
    try {
        const ollamaUrl = getOllamaUrl();
        console.log('Fetching Ollama models from:', `${ollamaUrl}/api/tags`);
        const response = await fetch(`${ollamaUrl}/api/tags`);
        console.log('Ollama response status:', response.status);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('Ollama models data:', data);
        const models = data.models || [];
        setAvailableModels(models);
        populateModelSelect();
        if (models.length === 0) {
            console.log('No models returned from Ollama, using defaults');
            setAvailableModels([{ name: 'llama3.2:latest' }, { name: 'llama3.2' }]);
            populateModelSelect();
        }
    } catch (e) {
        console.error('Failed to fetch Ollama models:', e);
        el.modelSelect.innerHTML = '<option value="">No models found</option>';
        chatState.selectedModel = 'llama3.2';
    }
}

export function populateModelSelect() {
    el.modelSelect.innerHTML = '';
    
    // Show all models (no filtering)
    let modelsToShow = availableModels;
    
    if (modelsToShow.length === 0) {
        el.modelSelect.innerHTML = '<option value="llama3.2-3b">llama3.2-3b</option>';
        return;
    }
    
    modelsToShow.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name.length > 40 ? model.name.substring(0, 37) + '...' : model.name;
        if (option.value === 'llama3.2-3b') option.selected = true;
        el.modelSelect.appendChild(option);
    });
    
    el.modelSelect.addEventListener('change', e => {
        chatState.selectedModel = e.target.value;
        localStorage.setItem('selectedModel', chatState.selectedModel);
        console.log('Model changed to:', chatState.selectedModel);
    });
    
    const saved = localStorage.getItem('selectedModel');
    if (saved) {
        const found = [...el.modelSelect.options].find(o => o.value === saved);
        if (found) { 
            el.modelSelect.value = saved; 
            chatState.selectedModel = saved; 
            console.log('Restored saved model:', saved);
        }
    }
}
