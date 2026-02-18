import { chatState, el, fmt } from './state-ui-utils.js';

export let hebrewBookNames = {};

export async function loadHebrewBookNames() {
    if (Object.keys(hebrewBookNames).length > 0) return hebrewBookNames;

    try {
        const response = await fetch('txt_bibles/hebrew/wlc_book-names.txt');
        if (!response.ok) return hebrewBookNames;

        const text = await response.text();
        const lines = text.split('\n');

        lines.forEach(line => {
            if (!line.trim()) return;
            // Format: "09 1 Samuel שמואל א" or "22 Song of Solomon שיר השירים"
            // Split by first space, then use Hebrew character detection
            const firstSpace = line.indexOf(' ');
            if (firstSpace === -1) return;
            
            const numStr = line.substring(0, firstSpace).trim();
            const rest = line.substring(firstSpace + 1).trim();
            
            const num = parseInt(numStr, 10);
            if (isNaN(num)) return;
            
            // Find where Hebrew starts (Hebrew Unicode range: \u0590-\u05FF)
            const hebrewMatch = rest.match(/[\u0590-\u05FF]/);
            if (hebrewMatch) {
                const hebrewIndex = rest.indexOf(hebrewMatch[0]);
                const englishName = rest.substring(0, hebrewIndex).trim();
                const hebrewName = rest.substring(hebrewIndex).trim();
                
                if (englishName && hebrewName) {
                    hebrewBookNames[num] = { english: englishName, hebrew: hebrewName };
                    console.log(`Loaded Hebrew name for book ${num} (${englishName}): ${hebrewName}`);
                }
            }
        });
    } catch (error) {
        console.error('Failed to load Hebrew book names:', error);
    }

    console.log(`Total Hebrew book names loaded: ${Object.keys(hebrewBookNames).length}`);
    return hebrewBookNames;
}

export function collapseAllAndScrollTop() {
    document.querySelectorAll('.book-item').forEach(item => {
        item.classList.remove('expanded');
    });
    document.querySelectorAll('.chapter-list').forEach(list => {
        list.classList.remove('expanded');
    });
    el.bookList.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function loadBookList() {
    el.bookList.innerHTML = '';
    for (const book of BibleLoader.books) {
        const bookItem = document.createElement('div');
        bookItem.className = 'book-item';
        bookItem.setAttribute('data-book-num', book.num);
        bookItem.innerHTML = `<span>${book.name}</span><span class="expand-icon">▶</span>`;
        
        const chapterList = document.createElement('div');
        chapterList.className = 'chapter-list';
        chapterList.id = `chapters-${book.num}`;
        
        bookItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isExpanded = bookItem.classList.contains('expanded');
            document.querySelectorAll('.book-item').forEach(item => {
                item.classList.remove('expanded');
            });
            document.querySelectorAll('.chapter-list').forEach(list => {
                list.classList.remove('expanded');
            });
            if (!isExpanded) {
                requestAnimationFrame(async () => {
                    await new Promise(r => setTimeout(r, 150));
                    bookItem.classList.add('expanded');
                    const myChapterList = document.querySelector(`#chapters-${book.num}`);
                    if (myChapterList) {
                        myChapterList.classList.add('expanded');
                        await loadChapterList(book, myChapterList);
                        bookItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
        });
        
        el.bookList.appendChild(bookItem);
        el.bookList.appendChild(chapterList);
    }
}

export async function loadChapterList(book, chapterListEl) {
    const bookData = await BibleLoader.loadBook(book.num);
    if (!bookData || !bookData.chapters) {
        chapterListEl.innerHTML = '<div class="chapter-item">No chapters</div>';
        return;
    }
    const chapterCount = Object.keys(bookData.chapters).length;
    chapterListEl.innerHTML = '';
    for (let i = 1; i <= chapterCount; i++) {
        const chapterItem = document.createElement('div');
        chapterItem.className = 'chapter-item';
        chapterItem.textContent = `${i}`;
        chapterItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            console.log(`Chapter ${i} clicked for book ${book.name}, split view: ${chatState.isSplitView}`);
            await loadChapter(i, book.name);
            document.querySelectorAll('.chapter-item').forEach(c => c.classList.remove('active'));
            chapterItem.classList.add('active');

            // Auto-close menu on mobile after chapter selection
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar && sidebar.classList.contains('mobile-visible')) {
                    sidebar.classList.remove('mobile-visible');
                    localStorage.setItem('menuHidden', 'true');
                }
            }
        });
        chapterListEl.appendChild(chapterItem);
    }
}

export async function loadChapter(chapter, bookName) {
    const book = BibleLoader.getBookByName(bookName);
    if (!book) return;
    chatState.currentBook = book;
    chatState.currentChapter = chapter;
    const displayName = book.name === 'Psalms' ? 'Psalm' : book.name;

    // Check if using WLC version for Old Testament
    const isWLC = window.BibleLoader.currentVersion === 'wlc';
    const isOriginal = window.BibleLoader.currentVersion === 'original';
    const useHebrewNames = (isWLC || isOriginal) && book.num <= 39;
    console.log('LOADCHAPTER: isWLC:', isWLC, ', isOriginal:', isOriginal, ', useHebrewNames:', useHebrewNames, ', book.num:', book.num, ', currentVersion:', window.BibleLoader.currentVersion);

    let hebrewBookName = '';
    if (useHebrewNames) {
        await loadHebrewBookNames();
        const bookData = hebrewBookNames[book.num];
        console.log(`LOADCHAPTER: Book ${book.num} (${book.name}), hebrewBookNames entry:`, bookData);
        if (bookData && bookData.hebrew) {
            hebrewBookName = bookData.hebrew;
            console.log(`LOADCHAPTER: Using Hebrew name for book ${book.num}: ${hebrewBookName}`);
        } else {
            console.log(`LOADCHAPTER: No Hebrew name found for book ${book.num}`);
        }
    }

    const titleDisplayName = useHebrewNames && hebrewBookName ? hebrewBookName : displayName;
    console.log('LOADCHAPTER: titleDisplayName:', titleDisplayName);

    // Update title while preserving the menu toggle icon
    const menuToggle = el.title.querySelector('#chapterMenuToggle');
    if (menuToggle) {
        // Preserve the icon span, just update the text node
        el.title.innerHTML = '';
        el.title.appendChild(menuToggle);
        el.title.appendChild(document.createTextNode(`${titleDisplayName} ${chapter}`));
    } else {
        el.title.textContent = `${titleDisplayName} ${chapter}`;
    }
    console.log('LOADCHAPTER: Title set to:', el.title.textContent);
    const verses = await BibleLoader.getChapterVerses(book.num, chapter);

    // Only render verses if NOT in split mode (split mode has its own rendering)
    if (!chatState.isSplitView) {
        await renderVerses(verses, displayName, hebrewBookName);
    }
    localStorage.setItem('lastBookNum', book.num);
    localStorage.setItem('lastChapter', chapter);
    highlightChapterInMenu(book, chapter);

    document.querySelectorAll('.book-item').forEach(b => b.classList.remove('current-book'));
    const currentBookItem = document.querySelector(`.book-item[data-book-num="${book.num}"]`);
    if (currentBookItem) {
        currentBookItem.classList.add('current-book');
    }

    // Scroll verses container to top
    const versesContainer = document.querySelector('.verses-container');
    if (versesContainer) {
        versesContainer.scrollTo({ top: 0, behavior: 'auto' });
    }

    // If in split view mode, update both panel states and titles
    if (chatState.isSplitView && chatState.splitPanelStates.length > 0) {
        console.log(`In split view, updating both panels to ${book.name} ${chapter}`);
        
        // CRITICAL: Get and lock left panel version before ANY updates
        const panel0State = chatState.splitPanelStates.find(s => s.id === 'panel-0');
        const lockedLeftVersion = panel0State ? panel0State.version : null;
        console.log(`LOCKED left panel version: ${lockedLeftVersion}`);
        
        // IMMEDIATELY force all UI elements to left panel version
        if (lockedLeftVersion) {
            window.BibleLoader.setVersion(lockedLeftVersion);
            if (window.el && window.el.bibleVersion) {
                window.el.bibleVersion.value = lockedLeftVersion;
            }
            const leftPanelSelect = document.querySelector('#panel-0 .bible-version-select, .content-panel:first-child .bible-version-select');
            if (leftPanelSelect) {
                leftPanelSelect.value = lockedLeftVersion;
            }
            console.log(`IMMEDIATE LOCK: Forced all UI to left panel version ${lockedLeftVersion}`);
        }
        
        console.log(`Panel states before update:`, chatState.splitPanelStates.map(s => ({id: s.id, book: s.book?.name, chapter: s.chapter, version: s.version})));
        
        // Update both panel states BEFORE rendering
        chatState.splitPanelStates.forEach((panelState) => {
            console.log(`Panel ${panelState.id} before update: book=${panelState.book?.name}, chapter=${panelState.chapter}, version=${panelState.version}`);
            panelState.book = book;
            panelState.chapter = chapter;
            console.log(`Panel ${panelState.id} after update: book=${panelState.book?.name}, chapter=${panelState.chapter}, version=${panelState.version}`);
        });
        
        import('./splitView.js').then(({ updatePanelContent }) => {
            console.log('Updating panels with locked left version');
            
            // RE-LOCK: Ensure left panel version is still correct
            if (panel0State && lockedLeftVersion) {
                panel0State.version = lockedLeftVersion;
                const leftPanelSelect = document.querySelector('#panel-0 .bible-version-select, .content-panel:first-child .bible-version-select');
                if (leftPanelSelect) {
                    leftPanelSelect.value = lockedLeftVersion;
                    console.log(`RE-LOCKED left panel dropdown to ${lockedLeftVersion}`);
                }
            }
            
            // DEBUG: Check right panel state before update
            const panel1State = chatState.splitPanelStates.find(s => s.id === 'panel-1');
            console.log('RIGHT PANEL DEBUG - Before update:', panel1State);
            
            console.log('MENU: Updating both panels immediately on chapter selection...');
            
            // Update BOTH panels immediately and synchronously
            updatePanelContent('panel-0');
            updatePanelContent('panel-1');
            
            // Force immediate visual refresh for both panels
            setTimeout(() => {
                const panel0Container = document.querySelector('.content-panel.split:first-child .verses-container');
                const panel1Container = document.querySelector('.content-panel.split:last-child .verses-container');
                if (panel0Container) {
                    panel0Container.style.display = 'none';
                    panel0Container.offsetHeight; // Force reflow
                    panel0Container.style.display = '';
                }
                if (panel1Container) {
                    panel1Container.style.display = 'none';
                    panel1Container.offsetHeight; // Force reflow
                    panel1Container.style.display = '';
                }
                console.log('Forced visual refresh for both panels after chapter selection');
            }, 50);
            
            // DEBUG: Final check
            console.log('RIGHT PANEL DEBUG - After panel updates:', panel1State);
            
            // Immediately restore global version to left panel version
            if (lockedLeftVersion) {
                window.BibleLoader.setVersion(lockedLeftVersion);
            }
            
            // CRITICAL: Ensure all UI elements remain locked to left panel version
            if (window.el && window.el.bibleVersion) {
                window.el.bibleVersion.value = lockedLeftVersion;
            }
            const leftPanelSelect = document.querySelector('#panel-0 .bible-version-select, .content-panel:first-child .bible-version-select');
            if (leftPanelSelect) {
                leftPanelSelect.value = lockedLeftVersion;
            }
            console.log(`MENU: Updated both panels and locked UI to left panel version ${lockedLeftVersion}`);
        }).catch(err => {
            console.error('Failed to import updatePanelContent:', err);
        });
    }
    // Removed else block that was resetting title to English - title already set correctly above
}

function highlightChapterInMenu(book, chapter) {
    console.log(`highlightChapterInMenu called for book ${book.name}, chapter ${chapter}`);
    const chapterList = document.querySelector(`#chapters-${book.num}`);
    if (chapterList) {
        document.querySelectorAll('.chapter-item').forEach(c => c.classList.remove('active'));
        const chapterItems = chapterList.querySelectorAll('.chapter-item');
        console.log(`Found ${chapterItems.length} chapter items, trying to highlight chapter ${chapter} (index ${chapter - 1})`);
        if (chapterItems[chapter - 1]) {
            chapterItems[chapter - 1].classList.add('active');
            console.log(`Successfully highlighted chapter ${chapter} for book ${book.name}`);
        } else {
            console.log(`Failed to find chapter item for index ${chapter - 1}`);
        }
    }
}

export async function renderVerses(verses, displayName, hebrewBookName = '') {
    if (!verses.length) {
        el.verses.innerHTML = '<p class="verse">No verses found.</p>';
        return;
    }

    let html = '';

    // Check if using WLC version for Old Testament
    const isWLC = window.BibleLoader.currentVersion === 'wlc';
    const isOriginal = window.BibleLoader.currentVersion === 'original';
    const useHebrewNames = (isWLC || isOriginal) && chatState.currentBook && chatState.currentBook.num <= 39;

    // Use passed hebrewBookName or load it if not provided
    let finalHebrewBookName = hebrewBookName;
    if (useHebrewNames && !finalHebrewBookName) {
        await loadHebrewBookNames();
        const bookData = hebrewBookNames[chatState.currentBook?.num];
        if (bookData) {
            finalHebrewBookName = bookData.hebrew;
        }
    }

    verses.forEach(v => {
        if (v.title) {
            const cleanTitle = v.title.replace(/\s*\([A-C]\)\s*/g, '').trim();
            html += `<h3 class="verse-title">${cleanTitle}</h3>`;
        }
        const verseClass = getVerseClass();
        const refBookName = useHebrewNames && finalHebrewBookName ? finalHebrewBookName : displayName;
        const cleanText = v.text.replace(/\s*\([A-C]\)\s*/g, '').trim();
        html += `<div class="verse ${verseClass}" data-book="${displayName}" data-chapter="${v.chapter}" data-verse="${v.verse}"><span class="verse-ref">${refBookName} ${v.chapter}:${v.verse}</span><span class="verse-text">${cleanText}</span></div>`;
    });

    el.verses.innerHTML = html;
}

function getVerseClass() {
    const version = window.BibleLoader.currentVersion;
    if (version === 'original') {
        // For WLC/NA28, we need to check the current book to determine if it's Hebrew or Greek
        if (chatState.currentBook && chatState.currentBook.num <= 39) {
            return 'hebrew'; // Old Testament books use Hebrew (WLC)
        } else {
            return 'greek'; // New Testament books use Greek (NA28)
        }
    } else if (version === 'wlc') {
        return 'hebrew';
} else if (version === 'na28' || version === 'na28-ubs5') {
            return 'greek';
    }
    return ''; // Default for all other translations
}

export async function navigate(dir) {
    if (!chatState.currentBook) return;
    const bookData = await BibleLoader.loadBook(chatState.currentBook.num);
    const max = bookData?.chapters ? Object.keys(bookData.chapters).length : 1;
    const nextChapter = chatState.currentChapter + dir;

    if (nextChapter < 1) {
        if (chatState.currentBook.num > 1) {
            const prevBookNum = chatState.currentBook.num - 1;
            const prevBookData = await BibleLoader.loadBook(prevBookNum);
            const prevMax = prevBookData?.chapters ? Object.keys(prevBookData.chapters).length : 1;
            const prevBook = BibleLoader.books.find(b => b.num === prevBookNum);
            await loadChapter(prevMax, prevBook.name);
            updateMenuForBook(prevBook);
        }
    } else if (nextChapter > max) {
        if (chatState.currentBook.num < BibleLoader.books.length) {
            const nextBookNum = chatState.currentBook.num + 1;
            const nextBook = BibleLoader.books.find(b => b.num === nextBookNum);
            await loadChapter(1, nextBook.name);
            updateMenuForBook(nextBook);
        }
    } else {
        await loadChapter(nextChapter, chatState.currentBook.name);
    }

    // Scroll verses container to top
    const versesContainer = document.querySelector('.verses-container');
    if (versesContainer) {
        versesContainer.scrollTo({ top: 0, behavior: 'auto' });
    }

    // Remove any stuck hover/active states on buttons after navigation
    clearButtonActiveStates();
}

export function clearButtonActiveStates() {
    const prevBtn = document.getElementById('prevChapter');
    const nextBtn = document.getElementById('nextChapter');
    const bottomPrevBtn = document.getElementById('bottomPrevChapter');
    const bottomNextBtn = document.getElementById('bottomNextChapter');
    
    [prevBtn, nextBtn, bottomPrevBtn, bottomNextBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('touch-active');
            btn.blur();
        }
    });
}

export function updateMenuForBook(book) {
    const bookItem = document.querySelectorAll('.book-item')[book.num - 1];
    const isAlreadyExpanded = bookItem && bookItem.classList.contains('expanded');
    
    // Only collapse other books if this book isn't already expanded
    if (!isAlreadyExpanded) {
        document.querySelectorAll('.book-item').forEach(item => {
            item.classList.remove('expanded');
        });
        document.querySelectorAll('.chapter-list').forEach(list => {
            list.classList.remove('expanded');
        });
    }
    
    requestAnimationFrame(async () => {
        await new Promise(r => setTimeout(r, 150));
        if (bookItem) {
            // Only expand if it wasn't already expanded
            if (!isAlreadyExpanded) {
                bookItem.classList.add('expanded');
                const myChapterList = document.querySelector(`#chapters-${book.num}`);
                if (myChapterList) {
                    myChapterList.classList.add('expanded');
                    await loadChapterList(book, myChapterList);
                }
            }
            
            // Always update highlighting and scroll to view
            const chapterToHighlight = chatState.isSplitView && chatState.splitPanelStates.length > 0 
                ? chatState.splitPanelStates.find(state => state.id === 'panel-0')?.chapter 
                : chatState.currentChapter;
            
            highlightChapterInMenu(book, chapterToHighlight);
            bookItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

export async function expandToSavedBook(book) {
    const bookItem = document.querySelectorAll('.book-item')[book.num - 1];
    if (bookItem) {
        bookItem.classList.add('expanded');
        const chapterList = document.querySelector(`#chapters-${book.num}`);
        if (chapterList) {
            chapterList.classList.add('expanded');
            await loadChapterList(book, chapterList);
            const chapterItem = chapterList.querySelectorAll('.chapter-item')[chatState.currentChapter - 1];
            if (chapterItem) chapterItem.classList.add('active');
        }
    }
}

export function highlightSavedChapter(book, chapter) {
    const chapterList = document.querySelector(`#chapters-${book.num}`);
    if (chapterList) {
        loadChapterList(book, chapterList).then(() => {
            const chapterItems = chapterList.querySelectorAll('.chapter-item');
            if (chapterItems[chapter - 1]) {
                chapterItems[chapter - 1].classList.add('active');
            }
        });
    }
}