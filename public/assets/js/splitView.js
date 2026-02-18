import { chatState, el } from './state-ui-utils.js';
import { renderVerses, navigate, updateMenuForBook, highlightSavedChapter, loadHebrewBookNames, clearButtonActiveStates } from './navigation.js';
import { reinitializeHighlighting } from './highlighting.js';

// Expose navigatePanel globally for bottom navigation
window.navigateToPanel = navigatePanel;

let panelIdCounter = 0;

export async function createSplitView() {
    if (chatState.isSplitView) return;
    
    // Sidebar width is no longer modified when split view opens
    // const sidebar = document.querySelector('.sidebar');
    // if (sidebar) {
    //     sidebar.style.width = '185px';
    //     localStorage.setItem('sidebarWidth', '185');
    //     // Update font size for smaller sidebar
    //     const root = document.documentElement;
    //     root.style.setProperty('--book-font-size', '1.0rem');
    //     root.style.setProperty('--current-sidebar-width', '185px');
    // }
    
    const mainContent = document.querySelector('.main-content');
    const chapterHeader = mainContent.querySelector('.chapter-header');
    const versesContainer = mainContent.querySelector('.verses-container');
    const bottomNav = mainContent.querySelector('.bottom-nav');
    
    if (!chapterHeader || !versesContainer) {
        console.error('Required elements not found for split view');
        return;
    }
    
    // Update state BEFORE creating duplicate panel (needed for getVerseClassForPanel)
    chatState.isSplitView = true;
    
    // Update split view button to show "-"
    const splitBtn = document.getElementById('splitView');
    if (splitBtn) {
        splitBtn.textContent = '➖';
        splitBtn.title = 'Close Parallel View';
    }
    localStorage.setItem('splitViewOpen', 'true');
    
    const savedPanel1Version = localStorage.getItem('splitPanel1Version') || 'original';
    chatState.splitPanelStates = [
        {
            id: 'panel-0',
            book: chatState.currentBook,
            chapter: chatState.currentChapter,
            version: el.bibleVersion.value
        },
        {
            id: 'panel-1',
            book: chatState.currentBook,
            chapter: chatState.currentChapter,
            version: savedPanel1Version
        }
    ];
    
    // Create a duplicate panel first while we still have access to original header
    const duplicatePanel = await createDuplicatePanel();
    if (!duplicatePanel) {
        console.error('Failed to create duplicate panel');
        return;
    }
    
    // Remove prev/next buttons from original chapter header
    const prevBtn = chapterHeader.querySelector('#prevChapter');
    const nextBtn = chapterHeader.querySelector('#nextChapter');
    if (prevBtn) prevBtn.remove();
    if (nextBtn) nextBtn.remove();
    
    // Wrap the existing content in a content panel
    const currentPanel = document.createElement('div');
    currentPanel.className = 'content-panel split';
    
    // Move existing content into panel
    currentPanel.appendChild(chapterHeader);
    currentPanel.appendChild(versesContainer);

    // Update original panel title to use Hebrew names if WLC/Old Testament
    const originalTitleElement = currentPanel.querySelector('#chapterTitle, .chapter-title');
    if (originalTitleElement) {
        const isWLC = window.BibleLoader.currentVersion === 'wlc';
        const isOriginal = window.BibleLoader.currentVersion === 'original';
        const useHebrewNames = (isWLC || isOriginal) && chatState.currentBook && chatState.currentBook.num <= 39;

        // Keep title in English, only update verse references
    }

    // Re-render original panel verses with Hebrew refs if WLC/Old Testament
    const originalVersesContainer = currentPanel.querySelector('.verses-container');
    console.log('SPLIT MODE: originalVersesContainer found:', !!originalVersesContainer);
    console.log('SPLIT MODE: currentBook:', chatState.currentBook);
    console.log('SPLIT MODE: currentVersion:', window.BibleLoader.currentVersion);

    // Keep left panel in English (don't update refs)

    // Keep bottom navigation outside of panels - it will span across both panels
    
    // Create a split container
    const splitContainer = document.createElement('div');
    splitContainer.className = 'split-container';
    
    // Add panels to the split container
    splitContainer.appendChild(currentPanel);
    splitContainer.appendChild(duplicatePanel);
    
    // Set initial explicit widths - only for desktop (mobile uses CSS flex)
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        currentPanel.style.width = '50%';
        duplicatePanel.style.width = '50%';
    }
    
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'split-resize-handle';
    splitContainer.appendChild(resizeHandle);
    
    // Add the split container to the main content
    mainContent.appendChild(splitContainer);
    
    // Setup resize functionality
    setupSplitResize(splitContainer, resizeHandle, isMobile);
    
    // Setup events for the existing panel
    setupPanelEvents(currentPanel, 'panel-0');
    
    // Ensure highlighting works properly in split view
    reinitializeHighlighting();
    
    // Update UI
    updateSplitPanelUI();
    
    // Setup unified bottom navigation for split view
    setupUnifiedBottomNavigation();
}

async function createDuplicatePanel() {
    const duplicatePanel = document.createElement('div');
    duplicatePanel.className = 'content-panel split';

    // Create a clone of current chapter header
    const originalHeader = document.querySelector('.chapter-header');
    if (!originalHeader) {
        console.error('Original chapter header not found');
        return null;
    }
    const headerClone = originalHeader.cloneNode(true);

    // Remove theme toggle, AI buttons, and prev/next buttons from duplicate panel
    const themeToggle = headerClone.querySelector('#toggleTheme');
    const aiToggle = headerClone.querySelector('#toggleAI');
    const prevBtn = headerClone.querySelector('#prevChapter');
    const nextBtn = headerClone.querySelector('#nextChapter');
    if (themeToggle) themeToggle.remove();
    if (aiToggle) aiToggle.remove();
    if (prevBtn) prevBtn.remove();
    if (nextBtn) nextBtn.remove();
    
    // Fix duplicate version select ID for second panel
    const versionSelectClone = headerClone.querySelector('#bibleVersion');
    if (versionSelectClone) {
        versionSelectClone.id = 'bibleVersion-panel-1';
    }
    
    // Add close button to chapter-nav in the duplicate panel (right of version dropdown)
    const chapterNavClone = headerClone.querySelector('.chapter-nav');
    if (chapterNavClone) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'split-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.title = 'Close split view';
        chapterNavClone.appendChild(closeBtn);
    }
    
    // Create verses container
    const versesContainer = document.createElement('div');
    versesContainer.className = 'verses-container';
    
    // Assemble panel - no bottom navigation for individual panels
    duplicatePanel.innerHTML = '';
    duplicatePanel.appendChild(headerClone);
    duplicatePanel.appendChild(versesContainer);
    
    // Set initial content for duplicate panel
    const titleElement = headerClone.querySelector('#chapterTitle, .chapter-title');
    console.log(`createDuplicatePanel: titleElement found:`, !!titleElement, titleElement ? `id=${titleElement.id}, text=${titleElement.textContent}` : 'not found');
    
    const versionSelect = headerClone.querySelector('.bible-version-select');

    // Get saved version
    const panel1Version = localStorage.getItem('splitPanel1Version') || 'original';
    console.log(`createDuplicatePanel: panel1Version=${panel1Version}, currentBook=${chatState.currentBook?.name}, currentChapter=${chatState.currentChapter}`);

    // Check if using WLC version for Old Testament (only for WLC/original, not NIV, ESV, etc.)
    const useHebrewNames = (panel1Version === 'wlc' || panel1Version === 'original') && chatState.currentBook && chatState.currentBook.num <= 39;
    console.log(`createDuplicatePanel: useHebrewNames=${useHebrewNames}, bookNum=${chatState.currentBook?.num}`);

    // CRITICAL: Set version to panel1Version BEFORE loading book
    console.log(`createDuplicatePanel: Setting version to ${panel1Version} before loading book`);
    window.BibleLoader.setVersion(panel1Version);

    // Get Hebrew book name from wlc_book-names.txt
    let hebrewBookName = null;
    if (useHebrewNames) {
        const hebrewNames = await loadHebrewBookNames();
        const bookData = hebrewNames[chatState.currentBook.num];
        if (bookData) {
            hebrewBookName = bookData.hebrew;
        }
    }

    const titleDisplayName = hebrewBookName || chatState.currentBook.name;

    if (titleElement) {
        titleElement.textContent = `${titleDisplayName} ${chatState.currentChapter}`;
        // Always set unique ID for second panel title
        titleElement.id = 'chapterTitle-panel-1';
        console.log(`createDuplicatePanel: AFTER setting title - text=${titleElement.textContent}, id=${titleElement.id}`);
    } else {
        console.error(`createDuplicatePanel: titleElement NOT FOUND!`);
    }
    if (versionSelect) {
        // Use saved version or default to 'original'
        const savedPanel1Version = localStorage.getItem('splitPanel1Version') || 'original';
        versionSelect.value = savedPanel1Version;

        // Setup focus/blur events to show full names when open
        versionSelect.addEventListener('focus', () => {
            Array.from(versionSelect.options).forEach(option => {
                if (option.dataset.originalText) {
                    option.textContent = option.dataset.originalText;
                }
            });
        });
        versionSelect.addEventListener('mousedown', () => {
            Array.from(versionSelect.options).forEach(option => {
                if (option.dataset.originalText) {
                    option.textContent = option.dataset.originalText;
                }
            });
        });
        versionSelect.addEventListener('blur', () => {
            Array.from(versionSelect.options).forEach(option => {
                if (!option.dataset.originalText) {
                    option.dataset.originalText = option.textContent;
                }
                const shortcode = option.dataset.shortcode || option.dataset.originalText.split(' - ')[0];
                option.textContent = shortcode;
            });
        });
        versionSelect.addEventListener('change', () => {
            setTimeout(() => {
                Array.from(versionSelect.options).forEach(option => {
                    if (!option.dataset.originalText) {
                        option.dataset.originalText = option.textContent;
                    }
                    const shortcode = option.dataset.shortcode || option.dataset.originalText.split(' - ')[0];
                    option.textContent = shortcode;
                });
            }, 0);
        });
    }
    
    // Load verses for duplicate panel
    window.BibleLoader.setVersion(panel1Version);
    const verses = await window.BibleLoader.getChapterVerses(chatState.currentBook.num, chatState.currentChapter);
    await renderVersesInPanel(verses, chatState.currentBook.name, versesContainer, 'panel-1');

    // Setup events for this panel
    setupPanelEvents(duplicatePanel, 'panel-1');

    return duplicatePanel;
}

async function renderVersesInPanel(verses, displayName, container, panelId) {
    if (!verses.length) {
        container.innerHTML = '<p class="verse">No verses found.</p>';
        return;
    }

    // Get version directly from localStorage or panelState
    const panelState = chatState.splitPanelStates.find(state => state.id === panelId);
    const savedVersion = localStorage.getItem('splitPanel1Version') || (panelState?.version || '');
    const isWLC = savedVersion === 'wlc';
    const isOriginal = savedVersion === 'original';
    const useHebrewNames = (isWLC || isOriginal) && chatState.currentBook && chatState.currentBook.num <= 39;

    // Get Hebrew book name from wlc_book-names.txt
    let hebrewBookName = null;
    if (useHebrewNames && chatState.currentBook) {
        const hebrewNames = await loadHebrewBookNames();
        const bookData = hebrewNames[chatState.currentBook.num];
        if (bookData) {
            hebrewBookName = bookData.hebrew;
        }
    }

    let html = '';
    verses.forEach(v => {
        if (v.title) {
            const cleanTitle = v.title.replace(/\s*\([A-C]\)\s*/g, '').trim();
            html += `<h3 class="verse-title">${cleanTitle}</h3>`;
        }
        const verseClass = getVerseClassForPanel(panelId);
        const refBookName = hebrewBookName || displayName;
        const cleanText = v.text.replace(/\s*\([A-C]\)\s*/g, '').trim();
        html += `<div class="verse ${verseClass}" data-book="${refBookName}" data-chapter="${v.chapter}" data-verse="${v.verse}"><span class="verse-ref">${refBookName} ${v.chapter}:${v.verse}</span><span class="verse-text">${cleanText}</span></div>`;
    });

    container.innerHTML = html;
}

function getVerseClassForPanel(panelId) {
    const panelState = chatState.splitPanelStates.find(state => state.id === panelId);
    // Use saved version from localStorage for panel-1
    const savedVersion = panelId === 'panel-1' ? (localStorage.getItem('splitPanel1Version') || panelState?.version || '') : panelState?.version;
    if (!savedVersion) return '';

    if (savedVersion === 'original') {
        // For WLC/NA28, we need to check the current book to determine if it's Hebrew or Greek
        if (panelState?.book && panelState.book.num <= 39) {
            return 'hebrew'; // Old Testament books use Hebrew (WLC)
        } else {
            return 'greek'; // New Testament books use Greek (NA28)
        }
    } else if (savedVersion === 'wlc') {
        return 'hebrew';
    } else if (savedVersion === 'na28' || savedVersion === 'na28-ubs5') {
        return 'greek';
    }
    return ''; // Default for all other translations
}

function setupPanelEvents(panel, panelId) {
    const closeBtn = panel.querySelector('.close-panel');
    const splitCloseBtn = panel.querySelector('.split-close-btn');
    const prevBtn = panel.querySelector('#prevChapter');
    const nextBtn = panel.querySelector('#nextChapter');
    const versionSelect = panel.querySelector('#bibleVersion, #bibleVersion-panel-1');
    const splitBtn = panel.querySelector('#splitView');
    
    console.log(`Setting up events for panel ${panelId}`, { closeBtn, splitCloseBtn, prevBtn, nextBtn, versionSelect, splitBtn });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log(`Close button clicked for panel ${panelId}`);
            closePanel(panelId);
        });
    }
    
    if (splitCloseBtn) {
        splitCloseBtn.addEventListener('click', () => {
            console.log(`Split close button clicked`);
            closeSplitView();
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            console.log(`Prev button clicked for panel ${panelId}`);
            navigatePanel(panelId, -1);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            console.log(`Next button clicked for panel ${panelId}`);
            navigatePanel(panelId, 1);
        });
    }
    
    if (versionSelect) {
        versionSelect.addEventListener('change', (e) => {
            console.log(`Version changed for panel ${panelId} to ${e.target.value}`);
            changePanelVersion(panelId, e.target.value);
        });
    }
    
    if (splitBtn) {
        splitBtn.addEventListener('click', createSplitView);
    }
    
    // No panel-specific bottom navigation setup - using unified navigation
}

async function navigatePanel(panelId, direction) {
    console.log(`navigatePanel called: panelId=${panelId}, direction=${direction}`);
    const panelState = chatState.splitPanelStates.find(state => state.id === panelId);
    if (!panelState || !panelState.book) {
        console.log('No panel state or book found');
        return;
    }
    console.log(`Current state: chapter=${panelState.chapter}, book=${panelState.book.name}`);
    
    window.BibleLoader.setVersion(panelState.version);
    const bookData = await window.BibleLoader.loadBook(panelState.book.num);
    const max = bookData?.chapters ? Object.keys(bookData.chapters).length : 1;
    let nextChapter = panelState.chapter + direction;
    let newBook = panelState.book;
    let newChapter = panelState.chapter;
    
    if (nextChapter < 1) {
        if (panelState.book.num > 1) {
            const prevBookNum = panelState.book.num - 1;
            const prevBookData = window.BibleLoader.books.find(b => b.num === prevBookNum);
            if (prevBookData) {
                const prevData = await window.BibleLoader.loadBook(prevBookNum);
                const prevMax = prevData?.chapters ? Object.keys(prevData.chapters).length : 1;
                newBook = prevBookData;
                newChapter = prevMax;
            }
        }
    } else if (nextChapter > max) {
        if (panelState.book.num < window.BibleLoader.books.length) {
            const nextBookNum = panelState.book.num + 1;
            const nextBook = window.BibleLoader.books.find(b => b.num === nextBookNum);
            if (nextBook) {
                newBook = nextBook;
                newChapter = 1;
            }
        }
    } else {
        newChapter = nextChapter;
    }
    
    // Update BOTH panels to stay synchronized while preserving versions
    const panel0Version = chatState.splitPanelStates.find(s => s.id === 'panel-0')?.version;
    const panel1Version = chatState.splitPanelStates.find(s => s.id === 'panel-1')?.version;
    
    chatState.splitPanelStates.forEach(state => {
        state.book = newBook;
        state.chapter = newChapter;
    });
    
    // Restore versions for both panels
    const panel0State = chatState.splitPanelStates.find(s => s.id === 'panel-0');
    const panel1State = chatState.splitPanelStates.find(s => s.id === 'panel-1');
    if (panel0State && panel0Version) panel0State.version = panel0Version;
    if (panel1State && panel1Version) panel1State.version = panel1Version;
    
    // Update both panels IMMEDIATELY and synchronously, setting version before each
    console.log(`PREV/NEXT: Updating both panels immediately to ${newBook.name} ${newChapter}`);
    
    // Update left panel with left panel's version
    window.BibleLoader.setVersion(panel0Version);
    updatePanelContent('panel-0');
    
    // Update right panel with right panel's version
    window.BibleLoader.setVersion(panel1Version);
    updatePanelContent('panel-1');
    updatePanelContent('panel-1');
    
    // Restore global version to left panel version for UI consistency
    window.BibleLoader.setVersion(panel0Version);
    
    // CRITICAL: Ensure all UI elements remain locked to left panel version
    if (window.el && window.el.bibleVersion) {
        window.el.bibleVersion.value = panel0Version;
    }
    const leftPanelSelect = document.querySelector('#panel-0 .bible-version-select, .content-panel:first-child .bible-version-select');
    if (leftPanelSelect) {
        leftPanelSelect.value = panel0Version;
    }
    console.log(`PREV/NEXT: Updated both panels and locked UI to left panel version ${panel0Version}`);
    
    // Update chapter grid and main state if this was triggered from panel-0
    if (panelId === 'panel-0') {
        updateMenuForBook(newBook);
        highlightSavedChapter(newBook, newChapter);
        
        // Update main app state to match
        chatState.currentBook = newBook;
        chatState.currentChapter = newChapter;
        el.title.textContent = `${newBook.name} ${newChapter}`;
    }
}

function changePanelVersion(panelId, version) {
    console.log(`changePanelVersion called for ${panelId} to version ${version}`);
    const panelState = chatState.splitPanelStates.find(state => state.id === panelId);
    if (panelState) {
        console.log(`Found panel state for ${panelId}, current version: ${panelState.version}, changing to: ${version}`);

        // CRITICAL: Store current left panel version before any changes
        const panel0State = chatState.splitPanelStates.find(s => s.id === 'panel-0');
        const leftPanelVersion = panel0State ? panel0State.version : null;

        panelState.version = version;
        console.log(`Updated panel state version to ${version}, calling updatePanelContent`);

        // Save panel-1 version to localStorage
        if (panelId === 'panel-1') {
            localStorage.setItem('splitPanel1Version', version);
        }

        // For right panel: NEVER let it affect global BibleLoader version
        if (panelId === 'panel-1') {
            // Temporarily store right panel content, update without affecting global state
            const currentGlobalVersion = window.BibleLoader.currentVersion;
            updatePanelContent(panelId);
            // Immediately restore global version to left panel version
            if (leftPanelVersion) {
                window.BibleLoader.setVersion(leftPanelVersion);
                console.log(`RESTORED: Global BibleLoader back to left panel version: ${leftPanelVersion}`);
            }
        } else {
            // For left panel: update normally
            updatePanelContent(panelId);
        }

        // CRITICAL SAFEGUARD: Always ensure menu dropdown stays with left panel version
        if (window.el && window.el.bibleVersion && leftPanelVersion) {
            window.el.bibleVersion.value = leftPanelVersion;
            console.log(`SAFEGUARD: Menu dropdown forced to left panel version: ${leftPanelVersion}`);
        }
    } else {
        console.log(`No panel state found for ${panelId}`);
    }
}

async function updatePanelContent(panelId) {
    console.log(`updatePanelContent called for ${panelId}`);
    const panelState = chatState.splitPanelStates.find(state => state.id === panelId);
    if (!panelState || !panelState.book) {
        console.log(`No panel state or book found for ${panelId}`);
        return;
    }

    console.log(`Panel state for ${panelId}: ${panelState.book.name} ${panelState.chapter}, version: ${panelState.version}`);

    let panel;

    // Try to find panel by index first (more reliable)
    const panels = document.querySelectorAll('.content-panel.split');
    console.log(`Found ${panels.length} panels with class .content-panel.split`);
    const panelIndex = panelId === 'panel-0' ? 0 : 1;
    panel = panels[panelIndex];
    console.log(`Panel ${panelId} found by index ${panelIndex}:`, panel);

    // Also try ID as fallback
    if (!panel) {
        panel = document.getElementById(panelId);
        console.log(`Panel ${panelId} found by ID fallback:`, panel);
    }

    if (!panel) {
        console.log(`Panel element not found for ${panelId}`);
        return;
    }

    // EXTRA DEBUG: For right panel, show more details
    if (panelId === 'panel-1') {
        console.log('RIGHT PANEL DEBUG - Found panel element:', panel);
        console.log('RIGHT PANEL DEBUG - Panel innerHTML length:', panel.innerHTML.length);
        console.log('RIGHT PANEL DEBUG - Panel classes:', panel.className);
    }

    console.log(`Panel state for ${panelId}: ${panelState.book.name} ${panelState.chapter}, version: ${panelState.version}`);

    // Try multiple selectors to find the title element
    let titleElement = panel.querySelector('#chapterTitle-panel-1');
    if (!titleElement) {
        titleElement = panel.querySelector('#chapterTitle');
    }
    if (!titleElement) {
        titleElement = panel.querySelector('.chapter-title');
    }
    if (!titleElement) {
        // Try finding h1 in chapter-header
        const chapterHeader = panel.querySelector('.chapter-header');
        if (chapterHeader) {
            titleElement = chapterHeader.querySelector('h1');
        }
    }
    
    // Ensure right panel has correct ID
    if (panelId === 'panel-1' && titleElement && titleElement.id !== 'chapterTitle-panel-1') {
        titleElement.id = 'chapterTitle-panel-1';
        console.log(`updatePanelContent: Fixed title ID to chapterTitle-panel-1`);
    }

    console.log(`Panel ${panelId} title element found:`, !!titleElement, titleElement ? `id=${titleElement.id}, text=${titleElement.textContent}` : 'not found');

    const versesContainer = panel.querySelector('.verses-container');
    const versionSelect = panel.querySelector('.bible-version-select');

    // Check if using WLC version for Old Testament
    const isWLC = panelState.version === 'wlc';
    const isOriginal = panelState.version === 'original';
    const useHebrewNames = (isWLC || isOriginal) && panelState.book.num <= 39;

    // Get Hebrew book name from wlc_book-names.txt
    let hebrewBookName = null;
    if (useHebrewNames) {
        const hebrewNames = await loadHebrewBookNames();
        console.log(`Panel ${panelId}: Loaded hebrewNames, keys:`, Object.keys(hebrewNames));
        const bookData = hebrewNames[panelState.book.num];
        console.log(`Panel ${panelId}: Looking up book ${panelState.book.num} (${panelState.book.name}), result:`, bookData);
        if (bookData) {
            hebrewBookName = bookData.hebrew;
            console.log(`Panel ${panelId}: Found Hebrew name: ${hebrewBookName}`);
        }
    }

    const titleDisplayName = hebrewBookName || panelState.book.name;

    console.log(`Panel ${panelId} title update: version=${panelState.version}, isWLC=${isWLC}, useHebrewNames=${useHebrewNames}, bookNum=${panelState.book.num}, hebrewBookName=${hebrewBookName}, displayName=${titleDisplayName}`);
    console.log(`Panel ${panelId} actual title element text BEFORE update:`, titleElement ? titleElement.textContent : 'not found');

    if (titleElement) {
        const oldText = titleElement.textContent;
        titleElement.textContent = `${titleDisplayName} ${panelState.chapter}`;
        console.log(`Updated title for panel ${panelId}: "${oldText}" -> "${titleElement.textContent}"`);
    }
    if (versionSelect) {
        console.log(`Setting version for panel ${panelId}: current select value = ${versionSelect.value}, setting to = ${panelState.version}`);
        versionSelect.value = panelState.version;
        console.log(`Version select for panel ${panelId} now set to: ${versionSelect.value}`);

        // SAFEGUARD: If this is the right panel, ensure global menu dropdown is not affected
        if (panelId === 'panel-1' && window.el && window.el.bibleVersion) {
            const panel0State = chatState.splitPanelStates.find(s => s.id === 'panel-0');
            if (panel0State) {
                console.log(`SAFEGUARD: Restoring menu dropdown to left panel version: ${panel0State.version}`);
                window.el.bibleVersion.value = panel0State.version;
            }
        }
    }

    console.log(`Loading verses for panel ${panelId}: ${panelState.book.name} ${panelState.chapter} (${panelState.version})`);

    // Set the correct version for this panel
    const panelVersion = panelState.version;
    console.log(`Setting BibleLoader version to ${panelVersion} for panel ${panelId}`);

    // For left panel, always force its version and update menu dropdown
    if (panelId === 'panel-0') {
        // DOUBLE-CHECK: Ensure we're using the correct left panel version
        const panel0State = chatState.splitPanelStates.find(s => s.id === 'panel-0');
        const correctVersion = panel0State ? panel0State.version : panelVersion;
        
        console.log(`LEFT PANEL: Forcing version ${correctVersion} (was ${window.BibleLoader.currentVersion})`);
        window.BibleLoader.setVersion(correctVersion);
        
        // Update global menu version dropdown to match left panel
        if (window.el && window.el.bibleVersion) {
            window.el.bibleVersion.value = correctVersion;
            console.log(`LEFT PANEL: Set menu dropdown to ${correctVersion}`);
        }
    } else {
        // For right panel, set its version but NEVER affect the menu dropdown
        window.BibleLoader.setVersion(panelVersion);
    }
    
    // Load verses for this panel
    const verses = await window.BibleLoader.getChapterVerses(panelState.book.num, panelState.chapter);
    console.log(`Got ${verses.length} verses for panel ${panelId} using version ${window.BibleLoader.currentVersion}`);
    console.log(`Verses container found: ${!!versesContainer}, container ID: ${versesContainer.id}`);
    await renderVersesInPanel(verses, panelState.book.name, versesContainer, panelId);
    console.log(`After renderVersesInPanel, container innerHTML length: ${versesContainer.innerHTML.length}`);

    // Force visual refresh by triggering a reflow
    versesContainer.style.display = 'none';
    versesContainer.offsetHeight; // Force reflow
    versesContainer.style.display = '';

    console.log(`Forced visual refresh for panel ${panelId}`);
}

function closePanel(panelId) {
    if (!chatState.isSplitView) return;
    
    // Prevent closing the original panel (panel-0)
    if (panelId === 'panel-0') {
        console.log('Cannot close original panel');
        return;
    }
    
    const mainContent = document.querySelector('.main-content');
    const splitContainer = mainContent.querySelector('.split-container');
    
    if (!splitContainer) return;
    
    const panels = splitContainer.querySelectorAll('.content-panel');
    const panelIndex = panelId === 'panel-0' ? 0 : 1;
    const panelToKeep = panels[1 - panelIndex];
    
    // Remove the close button from the panel we're keeping
    const closeBtn = panelToKeep.querySelector('.close-panel');
    if (closeBtn) {
        panelToKeep.removeChild(closeBtn);
    }
    
    // Move the remaining panel content back to main content
    const chapterHeader = panelToKeep.querySelector('.chapter-header');
    const versesContainer = panelToKeep.querySelector('.verses-container');
    
    // Restore prev/next buttons to the chapter header
    const chapterNav = chapterHeader.querySelector('.chapter-nav');
    if (chapterNav) {
        // Check if prev/next buttons already exist
        const existingPrevBtn = chapterNav.querySelector('#prevChapter');
        const existingNextBtn = chapterNav.querySelector('#nextChapter');
        
        if (!existingPrevBtn) {
            const prevBtn = document.createElement('button');
            prevBtn.id = 'prevChapter';
            prevBtn.textContent = '◀ Prev';
            chapterNav.appendChild(prevBtn);
        }
        
        if (!existingNextBtn) {
            const nextBtn = document.createElement('button');
            nextBtn.id = 'nextChapter';
            nextBtn.textContent = 'Next ▶';
            chapterNav.appendChild(nextBtn);
        }
    }
    
    // Remove the split container
    mainContent.removeChild(splitContainer);
    
    // Add the elements back to main content
    mainContent.appendChild(chapterHeader);
    mainContent.appendChild(versesContainer);
    
    // Ensure bottom navigation is properly positioned at the bottom
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        // Remove any existing bottom nav to avoid duplicates
        const existingBottomNav = mainContent.querySelector('.bottom-nav');
        if (existingBottomNav) {
            existingBottomNav.remove();
        }
        // Add bottom nav at the end to ensure it's at the bottom
        mainContent.appendChild(bottomNav);
    }
    
    // Update event listeners for the bottom navigation in single panel mode
    const bottomPrevBtn = document.getElementById('bottomPrevChapter');
    const bottomNextBtn = document.getElementById('bottomNextChapter');
    
    if (bottomPrevBtn) {
        // Clone to remove existing listeners
        const newPrevBtn = bottomPrevBtn.cloneNode(true);
        bottomPrevBtn.parentNode.replaceChild(newPrevBtn, bottomPrevBtn);
        newPrevBtn.addEventListener('click', () => navigate(-1));
    }
    
    if (bottomNextBtn) {
        // Clone to remove existing listeners
        const newNextBtn = bottomNextBtn.cloneNode(true);
        bottomNextBtn.parentNode.replaceChild(newNextBtn, bottomNextBtn);
        newNextBtn.addEventListener('click', () => navigate(1));
    }
    
    // Setup event listeners for the restored prev/next buttons in chapter header
    const restoredPrevBtn = document.getElementById('prevChapter');
    const restoredNextBtn = document.getElementById('nextChapter');
    
    if (restoredPrevBtn) {
        restoredPrevBtn.addEventListener('click', () => navigate(-1));
    }
    
    if (restoredNextBtn) {
        restoredNextBtn.addEventListener('click', () => navigate(1));
    }
    
// Sidebar width is no longer modified when split view closes
    // const sidebar = document.querySelector('.sidebar');
    // if (sidebar) {
    //     sidebar.style.width = '160px';
    //     localStorage.setItem('sidebarWidth', '160');
    //     // Update font size for smaller sidebar
    //     const root = document.documentElement;
    //     root.style.setProperty('--book-font-size', '1.0rem');
    //     root.style.setProperty('--current-sidebar-width', '160px');
    // }

    // Update state
    const panelState = panelIndex === 0 ? chatState.splitPanelStates[1] : chatState.splitPanelStates[0];
    chatState.isSplitView = false;
    chatState.splitPanelStates = [];
    
    // Update split view button to show "+"
    const splitBtn = document.getElementById('splitView');
    if (splitBtn) {
        splitBtn.textContent = '➕';
        splitBtn.title = 'Create Parallel View';
    }
    localStorage.setItem('splitViewOpen', 'false');
    
    // Sync main app state with the remaining panel
    if (panelState && panelState.book) {
        chatState.currentBook = panelState.book;
        chatState.currentChapter = panelState.chapter;
        el.bibleVersion.value = panelState.version;
        window.BibleLoader.setVersion(panelState.version);
        el.title.textContent = `${panelState.book.name} ${panelState.chapter}`;
        window.BibleLoader.getChapterVerses(panelState.book.num, panelState.chapter).then(verses => {
            renderVerses(verses, panelState.book.name);
        });
    }
}

function updateSplitPanelUI() {
    // Update the main panel elements to reflect panel 0 state
    const panel0State = chatState.splitPanelStates[0];
    if (panel0State) {
        chatState.currentBook = panel0State.book;
        chatState.currentChapter = panel0State.chapter;
        el.bibleVersion.value = panel0State.version;
    }
}

function setupSplitResize(splitContainer, resizeHandle, isMobile) {
    let isResizing = false;
    let startX = 0;
    let containerRect = null;
    
    // Function to get available width for split container
    const getAvailableWidth = () => {
        const mainContent = document.querySelector('.main-content');
        const mainContentRect = mainContent ? mainContent.getBoundingClientRect() : { width: window.innerWidth };
        const aiPanel = document.querySelector('.chatbox-panel');
        const aiPanelWidth = (aiPanel && aiPanel.classList.contains('open')) ? aiPanel.offsetWidth : 0;
        return mainContentRect.width - aiPanelWidth; // Subtract only AI panel, sidebar is already separate
    };
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        containerRect = splitContainer.getBoundingClientRect();
        splitContainer.classList.add('resizing');
        e.preventDefault();
        e.stopPropagation();
        console.log('Started resizing', { startX, availableWidth: getAvailableWidth() });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || !containerRect) return;
        
        // Calculate position relative to container
        const relativeX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;
        const availableWidth = getAvailableWidth();
        
        // Calculate new left panel width based on available space
        const newLeftWidth = Math.max(350, Math.min(relativeX, availableWidth - 350));
        const leftPercentage = (newLeftWidth / availableWidth) * 100;
        
        console.log(`Resizing: relativeX=${relativeX}, availableWidth=${availableWidth}, newLeftWidth=${newLeftWidth}, leftPercentage=${leftPercentage.toFixed(1)}%`);
        
        const panels = splitContainer.querySelectorAll('.content-panel');
        if (panels.length >= 2) {
            panels[0].style.width = `${leftPercentage}%`;
            panels[1].style.width = `${100 - leftPercentage}%`;
        }
        
        // Position handle slightly offset from the divider line (left panel right edge)
        requestAnimationFrame(() => {
            const leftPanelRightEdge = panels[0].offsetWidth;
            resizeHandle.style.left = `${leftPanelRightEdge + 4}px`;
        });
    });
    
    document.addEventListener('mouseup', (e) => {
        if (isResizing) {
            isResizing = false;
            splitContainer.classList.remove('resizing');
            containerRect = null;
            
            // Save the split ratio to localStorage
            const panels = splitContainer.querySelectorAll('.content-panel');
            if (panels.length >= 2) {
                const leftWidth = panels[0].style.width;
                localStorage.setItem('splitRatio', leftWidth);
            }
        }
    });
    
    // Also handle mouse leave document in case mouse is released outside window
    document.addEventListener('mouseleave', (e) => {
        if (isResizing) {
            isResizing = false;
            splitContainer.classList.remove('resizing');
            containerRect = null;
        }
    });
    
    // Update handle position when panels change size (debounced)
    const updateHandlePosition = () => {
        if (!isResizing && splitContainer && splitContainer.parentNode) {
            const panels = splitContainer.querySelectorAll('.content-panel');
            if (panels.length >= 2) {
                const leftPanelRightEdge = panels[0].offsetWidth;
                resizeHandle.style.left = `${leftPanelRightEdge + 4}px`; // Offset from edge
            }
        }
    };
    
    // Handle window resize and AI panel toggle
    const resizeObserver = new ResizeObserver(() => {
        setTimeout(updateHandlePosition, 50);
    });
    
    // Observe multiple elements for size changes
    if (splitContainer) {
        resizeObserver.observe(splitContainer);
        // Also observe main content to catch AI panel changes
        const mainContent = splitContainer.parentNode;
        if (mainContent) {
            resizeObserver.observe(mainContent);
        }
        // Observe sidebar to catch sidebar changes
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            resizeObserver.observe(sidebar);
        }
        // Observe AI panel to catch toggle changes
        const aiPanel = document.querySelector('.chatbox-panel');
        if (aiPanel) {
            resizeObserver.observe(aiPanel);
        }
    }
    
    // Fallback for browsers that don't support ResizeObserver
    window.addEventListener('resize', () => {
        setTimeout(updateHandlePosition, 100);
    });
    
    // Restore saved split ratio if exists (desktop only)
    const savedRatio = localStorage.getItem('splitRatio');
    if (savedRatio && !isMobile) {
        const panels = splitContainer.querySelectorAll('.content-panel');
        if (panels.length >= 2) {
            panels[0].style.width = savedRatio;
            const leftPercentage = parseFloat(savedRatio);
            panels[1].style.width = `${100 - leftPercentage}%`;
            
            // Update handle position after a short delay to ensure layout is complete
            setTimeout(() => {
                updateHandlePosition();
            }, 50);
        }
    }
    
    // Initial handle position
    setTimeout(updateHandlePosition, 100);
    
    // Clean up observer when split view is closed
    const cleanupResizeObserver = () => {
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
    };
    
    // Export cleanup function for use in closePanel
    window.splitViewCleanup = cleanupResizeObserver;
}



function setupUnifiedBottomNavigation() {
    const bottomPrevBtn = document.getElementById('bottomPrevChapter');
    const bottomNextBtn = document.getElementById('bottomNextChapter');
    
    if (bottomPrevBtn) {
        // Clone to remove existing listeners
        const newPrevBtn = bottomPrevBtn.cloneNode(true);
        bottomPrevBtn.parentNode.replaceChild(newPrevBtn, bottomPrevBtn);
        newPrevBtn.addEventListener('click', () => {
            console.log('Unified bottom prev button clicked - navigating both panels');
            navigateBothPanels(-1);
        });
    }
    
    if (bottomNextBtn) {
        // Clone to remove existing listeners
        const newNextBtn = bottomNextBtn.cloneNode(true);
        bottomNextBtn.parentNode.replaceChild(newNextBtn, bottomNextBtn);
        newNextBtn.addEventListener('click', () => {
            console.log('Unified bottom next button clicked - navigating both panels');
            navigateBothPanels(1);
        });
    }
}

async function navigateBothPanels(direction) {
    if (!chatState.isSplitView) return;
    
    // Use the existing navigatePanel function but call it for panel-0 only
    // and it will handle synchronizing both panels
    await navigatePanel('panel-0', direction);
    
    // Clear any stuck button active states
    clearButtonActiveStates();
}

export function closeSplitView() {
    if (!chatState.isSplitView) return;
    
    // Update split view button to show "+" before closing
    const splitBtn = document.getElementById('splitView');
    if (splitBtn) {
        splitBtn.textContent = '➕';
        splitBtn.title = 'Create Parallel View';
    }
    
    closePanel('panel-1');
}

export { updatePanelContent };