// Bible Data Loader
const BibleLoader = {
    currentVersion: 'esv',
    books: [
        { num: 1, name: 'Genesis', abbrev: 'Gen' },
        { num: 2, name: 'Exodus', abbrev: 'Exod' },
        { num: 3, name: 'Leviticus', abbrev: 'Lev' },
        { num: 4, name: 'Numbers', abbrev: 'Num' },
        { num: 5, name: 'Deuteronomy', abbrev: 'Deut' },
        { num: 6, name: 'Joshua', abbrev: 'Josh' },
        { num: 7, name: 'Judges', abbrev: 'Judg' },
        { num: 8, name: 'Ruth', abbrev: 'Ruth' },
        { num: 9, name: '1 Samuel', abbrev: '1Sam' },
        { num: 10, name: '2 Samuel', abbrev: '2Sam' },
        { num: 11, name: '1 Kings', abbrev: '1Kgs' },
        { num: 12, name: '2 Kings', abbrev: '2Kgs' },
        { num: 13, name: '1 Chronicles', abbrev: '1Chr' },
        { num: 14, name: '2 Chronicles', abbrev: '2Chr' },
        { num: 15, name: 'Ezra', abbrev: 'Ezra' },
        { num: 16, name: 'Nehemiah', abbrev: 'Neh' },
        { num: 17, name: 'Esther', abbrev: 'Esth' },
        { num: 18, name: 'Job', abbrev: 'Job' },
        { num: 19, name: 'Psalms', abbrev: 'Ps' },
        { num: 20, name: 'Proverbs', abbrev: 'Prov' },
        { num: 21, name: 'Ecclesiastes', abbrev: 'Eccl' },
        { num: 22, name: 'Song of Solomon', abbrev: 'Song' },
        { num: 23, name: 'Isaiah', abbrev: 'Isa' },
        { num: 24, name: 'Jeremiah', abbrev: 'Jer' },
        { num: 25, name: 'Lamentations', abbrev: 'Lam' },
        { num: 26, name: 'Ezekiel', abbrev: 'Ezek' },
        { num: 27, name: 'Daniel', abbrev: 'Dan' },
        { num: 28, name: 'Hosea', abbrev: 'Hos' },
        { num: 29, name: 'Joel', abbrev: 'Joel' },
        { num: 30, name: 'Amos', abbrev: 'Amos' },
        { num: 31, name: 'Obadiah', abbrev: 'Obad' },
        { num: 32, name: 'Jonah', abbrev: 'Jonah' },
        { num: 33, name: 'Micah', abbrev: 'Mic' },
        { num: 34, name: 'Nahum', abbrev: 'Nah' },
        { num: 35, name: 'Habakkuk', abbrev: 'Hab' },
        { num: 36, name: 'Zephaniah', abbrev: 'Zeph' },
        { num: 37, name: 'Haggai', abbrev: 'Hag' },
        { num: 38, name: 'Zechariah', abbrev: 'Zech' },
        { num: 39, name: 'Malachi', abbrev: 'Mal' },
        { num: 40, name: 'Matthew', abbrev: 'Matt' },
        { num: 41, name: 'Mark', abbrev: 'Mark' },
        { num: 42, name: 'Luke', abbrev: 'Luke' },
        { num: 43, name: 'John', abbrev: 'John' },
        { num: 44, name: 'Acts', abbrev: 'Acts' },
        { num: 45, name: 'Romans', abbrev: 'Rom' },
        { num: 46, name: '1 Corinthians', abbrev: '1Cor' },
        { num: 47, name: '2 Corinthians', abbrev: '2Cor' },
        { num: 48, name: 'Galatians', abbrev: 'Gal' },
        { num: 49, name: 'Ephesians', abbrev: 'Eph' },
        { num: 50, name: 'Philippians', abbrev: 'Phil' },
        { num: 51, name: 'Colossians', abbrev: 'Col' },
        { num: 52, name: '1 Thessalonians', abbrev: '1Thess' },
        { num: 53, name: '2 Thessalonians', abbrev: '2Thess' },
        { num: 54, name: '1 Timothy', abbrev: '1Tim' },
        { num: 55, name: '2 Timothy', abbrev: '2Tim' },
        { num: 56, name: 'Titus', abbrev: 'Titus' },
        { num: 57, name: 'Philemon', abbrev: 'Phlm' },
        { num: 58, name: 'Hebrews', abbrev: 'Heb' },
        { num: 59, name: 'James', abbrev: 'Jas' },
        { num: 60, name: '1 Peter', abbrev: '1Pet' },
        { num: 61, name: '2 Peter', abbrev: '2Pet' },
        { num: 62, name: '1 John', abbrev: '1John' },
        { num: 63, name: '2 John', abbrev: '2John' },
        { num: 64, name: '3 John', abbrev: '3John' },
        { num: 65, name: 'Jude', abbrev: 'Jude' },
        { num: 66, name: 'Revelation', abbrev: 'Rev' }
    ],

    cache: new Map(),

    setVersion(version) {
        if (this.currentVersion !== version) {
            this.currentVersion = version;
            this.cache.clear(); // Clear cache when version changes
            console.log(`Bible version changed to: ${version}`);
        }
    },

getBookFileName(bookNum) {
        let name = this.books[bookNum - 1].name.toLowerCase().replace(/ /g, '-');
        let version = this.currentVersion;
        
        // For original languages, use WLC for OT (books 1-39) and NA28/UBS5 for NT (books 40+)
        if (version === 'original') {
            version = bookNum <= 39 ? 'wlc' : 'na28-ubs5';
        }
        
        return `${version}_${String(bookNum).padStart(2, '0')}-${name}`;
    },

    async loadBook(bookNum) {
        const cacheKey = `book-${bookNum}-${this.currentVersion}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const version = this.currentVersion === 'original' ? (bookNum <= 39 ? 'wlc' : 'na28-ubs5') : this.currentVersion;
            
            // Determine the language directory
            let languageDir = 'english';
            if (version === 'wlc' || version === 'hhh') {
                languageDir = 'hebrew';
            } else if (version === 'na28' || version === 'na28-ubs5') {
                languageDir = 'greek';
            } else if (['csb', 'esv', 'kjv', 'nasb', 'net', 'niv', 'nlt', 'rsv', 'web', 'ylt'].includes(version)) {
                languageDir = 'english';
            } else if (['em', 'lbla', 'rvr1995', 'se'].includes(version)) {
                languageDir = 'spanish';
            } else if (['ls'].includes(version)) {
                languageDir = 'french';
            } else if (['lut'].includes(version)) {
                languageDir = 'german';
            } else if (['cht'].includes(version)) {
                languageDir = 'chinese';
            } else if (['nav', 'svd'].includes(version)) {
                languageDir = 'arabic';
            } else if (['kor'].includes(version)) {
                languageDir = 'korean';
            } else if (['rst'].includes(version)) {
                languageDir = 'russian';
            } else if (['vul'].includes(version)) {
                languageDir = 'latin';
            } else if (['abtag2001', 'apsd-ceb', 'ceb'].includes(version)) {
                languageDir = 'filipino';
            } else if (['erv-hi', 'shb'].includes(version)) {
                languageDir = 'hindi';
            } else if (['jlb'].includes(version)) {
                languageDir = 'japanese';
            } else if (['ukr'].includes(version)) {
                languageDir = 'ukrainian';
            }
            
            // Get book name from the books array
            const bookName = this.books[bookNum - 1].name;
            const bookNameLower = bookName.toLowerCase().replace(/ /g, '-');
            
            // For Hebrew WLC, use Hebrew book names (for 'wlc' or 'original' versions in Old Testament)
            if ((version === 'wlc' || version === 'original') && bookNum <= 39) {
                const textFilePath = `txt_bibles/hebrew/wlc/${String(bookNum).padStart(2, '0')}-${bookNameLower}-wlc.txt`;
                console.log(`Loading Hebrew WLC: ${textFilePath}`);
                
                const response = await fetch(textFilePath);
                if (response.ok) {
                    const text = await response.text();
                    const bookData = this.parseBookText(text, bookNum, bookName);
                    bookData.isHebrew = true; // Mark as Hebrew for right-to-left display
                    console.log(`Loaded Hebrew WLC book ${bookNum} (${bookName}):`, Object.keys(bookData.chapters).length, 'chapters, hebrewBookName:', bookData.hebrewBookName);
                    this.cache.set(cacheKey, bookData);
                    return bookData;
                } else {
                    console.log(`Hebrew WLC file not found: ${textFilePath}, falling back to regular WLC`);
                }
                // Fall back to regular WLC if Hebrew version doesn't exist
            }
            
            // Special handling for HHH - only has New Testament (books 40-66)
            if (version === 'hhh' && bookNum < 40) {
                console.error(`HHH version only has New Testament books (40-66), requested book ${bookNum}`);
                return {
                    name: `${bookName} (Not Available in HHH)`,
                    chapters: {
                        1: [{
                            chapter: 1,
                            verse: 1,
                            text: "HHH (Hebrew Holy Bible) only contains New Testament books. Please select a New Testament book (Matthew-Revelation).",
                            title: "HHH Version Notice"
                        }]
                    }
                };
            }
            
            // Build the text file path
            const textFilePath = `txt_bibles/${languageDir}/${version}/${String(bookNum).padStart(2, '0')}-${bookNameLower}-${version}.txt`;
            
            // Fetch the entire book as a text file
            const response = await fetch(textFilePath);
            if (!response.ok) {
                throw new Error(`Failed to load book file: ${textFilePath}`);
            }
            
            const text = await response.text();
            
            // Parse the text file
            const bookData = this.parseBookText(text, bookNum, bookName);
            
            console.log(`Loaded ${version} book ${bookNum} (${bookName}):`, Object.keys(bookData.chapters).length, 'chapters');
            this.cache.set(cacheKey, bookData);
            return bookData;
            
        } catch (error) {
            console.error(`Error loading book ${bookNum}:`, error);
            return null;
        }
    },

    parseBookText(text, bookNum, bookName) {
        const chapters = {};
        const lines = text.trim().split('\n');
        
        let currentChapter = 0;
        
        // For Hebrew, extract the book name from the first line
        let hebrewBookName = null;
        if (lines[0]) {
            // Match any text at the start before chapter:verse (supports Hebrew, English, and numbered books like "1 Peter")
            const match = lines[0].match(/^(.+?)\s+\d+:\d+/);
            if (match && match[1]) {
                hebrewBookName = match[1].trim();
                console.log(`parseBookText: Extracted book name from first line: "${hebrewBookName}"`);
            } else {
                console.log(`parseBookText: Could not extract book name from first line: "${lines[0].substring(0, 50)}..."`);
            }
        }
        
        lines.forEach(line => {
            // Parse format: בראשית 1:1 Text or Genesis 1:1 (Title) Text or 1 Peter 1:1 (Title) Text
            // Match any text before chapter:verse (including numbers at start), then capture optional (title) and text
            // Handle titles that may contain (A)(B)(C) markers inside parentheses
            const match = line.match(/^(.+?)\s+(\d+):(\d+)\s*(?:\(([^)]*(?:\([^)]*\)[^)]*)*)\))?\s*(.+)$/);
            if (match) {
                const chapter = parseInt(match[2]);
                const verse = parseInt(match[3]);
                const rawTitle = match[4] || null;
                const title = rawTitle ? rawTitle.replace(/\s*\([A-C]\)\s*/g, '').trim() : null;
                const verseText = match[5].trim();
                
                if (chapter !== currentChapter) {
                    currentChapter = chapter;
                    chapters[chapter] = [];
                }
                
                chapters[chapter].push({
                    chapter: chapter,
                    verse: verse,
                    title: title,
                    text: verseText,
                    bookName: hebrewBookName // Store Hebrew book name for rendering
                });
            }
        });
        
        return { name: bookName, chapters, hebrewBookName };
    },

    parseBook(text, bookNum) {
        // This method is no longer used with JSON format
        // Keeping for backward compatibility
        const lines = text.trim().split('\n');
        const bookName = this.books[bookNum - 1].name;
        const chapters = {};

        lines.forEach(line => {
            const parsed = this.parseVerse(line, bookName);
            if (parsed) {
                if (!chapters[parsed.chapter]) {
                    chapters[parsed.chapter] = [];
                }
                chapters[parsed.chapter].push(parsed);
            }
        });

        return { name: bookName, chapters };
    },

    isValidSectionTitle(title) {
        if (!title || typeof title !== 'string') return false;

        if (/^[a-z]/.test(title)) return false;

        if (/[.!?;]$/.test(title)) return false;

        const titleLength = title.length;
        if (titleLength < 4 || titleLength > 60) return false;

        const proseStarters = ['now ', 'then ', 'for ', 'but ', 'if ', 'when ', 'because ', 'although ', 'though ', 'yet ', 'since ', 'after ', 'before ', 'until ', 'while '];
        const lowerTitle = title.toLowerCase();
        if (proseStarters.some(starter => lowerTitle.startsWith(starter))) return false;

        if (/\b(fathered|bore|son of|daughter of|was the father of)/i.test(title)) return false;

        if (/^"(for|that|which|who|whom)/i.test(title)) return false;
        if (/^(for|that|which|who|whom) [^A-Z]/.test(title)) return false;

        if (/\b(cf\.|see|compare|参见|見|arabic|hebrew|greek|syriac|latin)/i.test(title)) return false;

        if (/\([^)]*["'"'"'][^)]*\)/.test(title)) return false;

        return true;
    },

    extractTitleFromText(text) {
        const regex = /^\(([^)]+)\)\s*(.+)$/;
        const match = text.match(regex);
        if (match) {
            const title = match[1];
            const cleanText = match[2];
            if (title && title.toLowerCase() !== 'about' && this.isValidSectionTitle(title)) {
                return { title, text: cleanText };
            }
        }
        return { title: null, text };
    },

    parseVerse(line) {
        // This method is no longer used with JSON format
        // Keeping for backward compatibility
        const regex = /^(.+?)\s+(\d+):(\d+)\s*(?:\(([^)]+)\))?\s*(.+)$/i;
        const match = line.match(regex);
        if (match) {
            let title = match[4] || null;
            // Skip (About) placeholders
            if (title && title.toLowerCase() === 'about') {
                title = null;
            }
            return {
                chapter: parseInt(match[2]),
                verse: parseInt(match[3]),
                title: title, // Show titles for future toggle implementation
                text: match[5].trim()
            };
        }
        return null;
    },

    getBookByName(bookName) {
        const book = this.books.find(b =>
            b.name.toLowerCase() === bookName.toLowerCase() ||
            b.abbrev.toLowerCase() === bookName.toLowerCase()
        );
        if (!book) {
            console.warn(`Book not found: "${bookName}"`);
        }
        return book;
    },

    async getChapterVerses(bookNum, chapter) {
        const bookData = await this.loadBook(bookNum);
        if (!bookData || !bookData.chapters[chapter]) {
            return [];
        }
        return bookData.chapters[chapter];
    },

    getChapterText(bookNum, chapter) {
        return this.chapterCache && this.chapterCache.bookNum === bookNum && this.chapterCache.chapter === chapter
            ? this.chapterCache.text
            : null;
    }
};

window.BibleLoader = BibleLoader;
