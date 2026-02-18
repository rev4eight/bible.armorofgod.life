// Dynamic version dropdown population based on versions.json

async function populateVersionDropdown() {
    const versionSelect = document.getElementById('bibleVersion');
    if (!versionSelect) return;

    try {
        // Get available versions from versions.json
        const { versions, languageGroups, languageOrder, languageNames: langNames } = await getAvailableVersions();

        // Clear existing options except keep the current selection
        const currentValue = versionSelect.value;
        versionSelect.innerHTML = '';

        // Add Original Languages section at the top
        const originalOptgroup = document.createElement('optgroup');
        const origLangNames = langNames ? ` (${langNames['Hebrew'] || 'Hebrew'} / ${langNames['Greek'] || 'Greek'})` : '';
        originalOptgroup.label = 'Original Languages' + origLangNames;

        // WLC/UBS5 (Hebrew/Greek)
        if (versions.some(v => v.id === 'wlc' || v.id === 'na28-ubs5')) {
            const wlcOption = document.createElement('option');
            wlcOption.value = 'original';
            wlcOption.textContent = 'WLC/UBS5 - Hebrew / Greek';
            wlcOption.dataset.shortcode = 'WLC/UBS5';
            wlcOption.dataset.originalText = 'WLC/UBS5 - Hebrew / Greek';
            originalOptgroup.appendChild(wlcOption);
        }

        versionSelect.appendChild(originalOptgroup);

        // Add language groups in the order they appear in versions.json
        const finalLanguageOrder = languageOrder.filter(lang => languageGroups[lang]);

        finalLanguageOrder.forEach(language => {
            const optgroup = document.createElement('optgroup');
            const nativeName = langNames && langNames[language] ? langNames[language] : null;
            optgroup.label = nativeName && nativeName !== language ? `${language} (${nativeName})` : language;

            // Sort versions within each language
            languageGroups[language].sort((a, b) => a.name.localeCompare(b.name));

            languageGroups[language].forEach(version => {
                const option = document.createElement('option');
                option.value = version.id;
                option.textContent = version.name;
                const shortcode = version.name.split(' - ')[0];
                option.dataset.shortcode = shortcode;
                optgroup.appendChild(option);
            });

            versionSelect.appendChild(optgroup);
        });

        // Restore previous selection if it still exists
        if (currentValue && Array.from(versionSelect.options).some(opt => opt.value === currentValue)) {
            versionSelect.value = currentValue;
        } else {
            // Default to ESV if available, otherwise first option
            const esvOption = Array.from(versionSelect.options).find(opt => opt.value === 'esv');
            if (esvOption) {
                versionSelect.value = 'esv';
            } else if (versionSelect.options.length > 0) {
                versionSelect.value = versionSelect.options[0].value;
            }
        }

        // Update display to show shortcodes
        updateVersionDropdownDisplay(versionSelect);

        // Setup focus/blur events to show full names when open
        versionSelect.addEventListener('focus', () => {
            showFullVersionNames(versionSelect);
        });
        versionSelect.addEventListener('mousedown', () => {
            showFullVersionNames(versionSelect);
        });
        versionSelect.addEventListener('blur', () => {
            updateVersionDropdownDisplay(versionSelect);
        });
        versionSelect.addEventListener('change', () => {
            setTimeout(() => updateVersionDropdownDisplay(versionSelect), 0);
        });

    } catch (error) {
        console.error('Failed to populate version dropdown:', error);
        // Fallback - try to load from versions.json
        await loadFromVersionsJson();
    }
}

async function loadFromVersionsJson() {
    const versionSelect = document.getElementById('bibleVersion');
    if (!versionSelect) return;

    try {
        const response = await fetch('txt_bibles/versions.json');
        if (!response.ok) throw new Error('Failed to load versions.json');
        const data = await response.json();
        
        versionSelect.innerHTML = '';
        
        // Add Original Languages section
        const originalOptgroup = document.createElement('optgroup');
        const origLangNames = langNames ? ` (${langNames['Hebrew'] || 'Hebrew'} / ${langNames['Greek'] || 'Greek'})` : '';
        originalOptgroup.label = 'Original Languages' + origLangNames;
        originalOptgroup.innerHTML = '<option value="original" data-shortcode="WLC/UBS5" data-original-text="WLC/UBS5 - Hebrew / Greek">WLC/UBS5 - Hebrew / Greek</option>';
        versionSelect.appendChild(originalOptgroup);

        // Add languages from JSON
        const langNames = data.languageNames || {};
        for (const [language, versions] of Object.entries(data.languages)) {
            const optgroup = document.createElement('optgroup');
            const nativeName = langNames[language];
            optgroup.label = nativeName && nativeName !== language ? `${language} (${nativeName})` : language;
            
            for (const [id, name] of Object.entries(versions)) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                const shortcode = name.split(' - ')[0];
                option.dataset.shortcode = shortcode;
                optgroup.appendChild(option);
            }
            
            versionSelect.appendChild(optgroup);
        }

        updateVersionDropdownDisplay(versionSelect);
    } catch (error) {
        console.error('Failed to load from versions.json:', error);
        populateFallbackOptions();
    }
}

function showFullVersionNames(select) {
    Array.from(select.options).forEach(option => {
        // Show full name (WLC/UBS5) when dropdown is opened
        if (option.dataset.originalText) {
            // Check if there's a data attribute for the full name, otherwise use originalText
            const fullName = option.dataset.fullName || option.dataset.originalText;
            option.textContent = fullName;
        }
    });
}

function updateVersionDropdownDisplay(select) {
    Array.from(select.options).forEach(option => {
        // Store original text if not already stored
        if (!option.dataset.originalText) {
            option.dataset.originalText = option.textContent;
        }
        // Show shortcode (from data-shortcode attribute or extracted from original text)
        const shortcode = option.dataset.shortcode || option.dataset.originalText.split(' - ')[0];
        option.textContent = shortcode;
    });
}

async function getAvailableVersions() {
    try {
        const response = await fetch('txt_bibles/versions.json');
        if (!response.ok) throw new Error('Failed to load versions.json');
        const data = await response.json();
        
        const versions = [];
        const languageGroups = {};
        
        for (const [language, langVersions] of Object.entries(data.languages)) {
            languageGroups[language] = [];
            for (const [id, name] of Object.entries(langVersions)) {
                const version = {
                    id: id,
                    language: language,
                    name: name
                };
                versions.push(version);
                languageGroups[language].push(version);
            }
        }
        
        return { versions, languageGroups, languageOrder: Object.keys(data.languages), languageNames: data.languageNames || {} };
    } catch (error) {
        console.error('Failed to get available versions:', error);
        return { versions: [], languageGroups: {}, languageOrder: [] };
    }
}

function populateFallbackOptions() {
    const versionSelect = document.getElementById('bibleVersion');
    if (!versionSelect) return;

    // Fallback - try to load from versions.json first
    loadFromVersionsJson().catch(() => {
        // If that fails, show empty
        versionSelect.innerHTML = '<option value="">No versions found</option>';
    });
}

// Make function available globally for debugging
window.populateVersionDropdown = populateVersionDropdown;

export { populateVersionDropdown };
