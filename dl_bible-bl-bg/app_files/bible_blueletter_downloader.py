#!/usr/bin/env python3
import requests
import json
import os
import sys
import argparse
import re
import time
import configparser
from pathlib import Path
from bs4 import BeautifulSoup

def load_config():
    config = configparser.ConfigParser()
    base_dir = Path(__file__).parent.parent
    config_file = base_dir / 'options.cfg'
    if config_file.exists():
        try:
            config.read(str(config_file))
        except configparser.ParsingError:
            pass
    return config

config = load_config()

def get_config_value(section, key, default):
    try:
        return config.get(section, key) if config.has_section(section) else config.get('DEFAULT', key, fallback=default)
    except:
        return default

sys.path.insert(0, str(Path(__file__).parent.parent))
from version_languages import get_language_for_version

AUTO_CONVERT_TO_TXT = os.environ.get('AUTO_CONVERT_TO_TXT', get_config_value('DEFAULT', 'auto_convert_to_txt', 'true')).lower() == 'true'
REQUEST_DELAY = int(os.environ.get('REQUEST_DELAY', get_config_value('DEFAULT', 'request_delay', '2')))
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', get_config_value('DEFAULT', 'max_retries', '3')))
USER_AGENT = os.environ.get('USER_AGENT', get_config_value('DEFAULT', 'user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'))
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', get_config_value('DEFAULT', 'output_dir', 'bible_downloads')).strip('"').strip("'")

def resolve_output_dir(output_subpath=''):
    """Resolve output directory - absolute paths used as-is, relative paths resolved from cwd."""
    if os.path.isabs(OUTPUT_DIR):
        base = Path(OUTPUT_DIR)
    else:
        base = Path.cwd() / OUTPUT_DIR
    if output_subpath:
        return base / output_subpath
    return base

# Bible books with their chapter counts
BIBLE_BOOKS = {
    'genesis': 50,
    'exodus': 40,
    'leviticus': 27,
    'numbers': 36,
    'deuteronomy': 34,
    'joshua': 24,
    'judges': 21,
    'ruth': 4,
    '1-samuel': 31,
    '2-samuel': 24,
    '1-kings': 22,
    '2-kings': 25,
    '1-chronicles': 29,
    '2-chronicles': 36,
    'ezra': 10,
    'nehemiah': 13,
    'esther': 10,
    'job': 42,
    'psalms': 150,
    'proverbs': 31,
    'ecclesiastes': 12,
    'song-of-solomon': 8,
    'isaiah': 66,
    'jeremiah': 52,
    'lamentations': 5,
    'ezekiel': 48,
    'daniel': 12,
    'hosea': 14,
    'joel': 3,
    'amos': 9,
    'obadiah': 1,
    'jonah': 4,
    'micah': 7,
    'nahum': 3,
    'habakkuk': 3,
    'zephaniah': 3,
    'haggai': 2,
    'zechariah': 14,
    'malachi': 4,
    'matthew': 28,
    'mark': 16,
    'luke': 24,
    'john': 21,
    'acts': 28,
    'romans': 16,
    '1-corinthians': 16,
    '2-corinthians': 13,
    'galatians': 6,
    'ephesians': 6,
    'philippians': 4,
    'colossians': 4,
    '1-thessalonians': 5,
    '2-thessalonians': 3,
    '1-timothy': 6,
    '2-timothy': 4,
    'titus': 3,
    'philemon': 1,
    'hebrews': 13,
    'james': 5,
    '1-peter': 5,
    '2-peter': 3,
    '1-john': 5,
    '2-john': 1,
    '3-john': 1,
    'jude': 1,
    'revelation': 22
}

TRANSLATIONS = [
    'kjv', 'nkjv', 'nlt', 'niv', 'esv', 'csb', 'nasb95', 'nasb20', 
    'lsb', 'amp', 'net', 'rsv', 'asv', 'ylt', 'dby', 'web', 'hnv', 'vul', 
    'nav', 'wlc', 'lxx', 'mgnt', 'tr', 'svd', 'bes', 'rvr09', 'rvr60', 
    'bbe', 'cht', 'em', 'kor', 'ls', 'lut', 'rst', 'se'
]

# Base URLs for different translation providers
BLUELETTER_BIBLE_BASE = 'https://www.blueletterbible.org/'

def is_blueletter_bible_translation(translation):
    """Check if translation uses Blue Letter Bible"""
    blueletter_translations = {
        'kjv', 'nkjv', 'nlt', 'niv', 'esv', 'csb', 'nasb95', 'nasb20',
        'lsb', 'amp', 'net', 'rsv', 'asv', 'ylt', 'dby', 'web', 'hnv', 'vul',
        'nav', 'wlc', 'lxx', 'mgnt', 'tr', 'svd', 'bes', 'rvr09', 'rvr60',
        'bbe', 'cht', 'em', 'kor', 'ls', 'lut', 'rst', 'se'
    }
    return translation in blueletter_translations

def is_old_testament_book(book_name):
    """Check if a book is from the Old Testament"""
    old_testament_books = [
        'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy',
        'joshua', 'judges', 'ruth', '1-samuel', '2-samuel',
        '1-kings', '2-kings', '1-chronicles', '2-chronicles',
        'ezra', 'nehemiah', 'esther', 'job', 'psalms',
        'proverbs', 'ecclesiastes', 'song-of-solomon', 'isaiah',
        'jeremiah', 'lamentations', 'ezekiel', 'daniel',
        'hosea', 'joel', 'amos', 'obadiah', 'jonah',
        'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai',
        'zechariah', 'malachi'
    ]
    return book_name in old_testament_books

BOOK_NAME_MAP = {
    'genesis': 'Genesis', 'exodus': 'Exodus', 'leviticus': 'Leviticus', 'numbers': 'Numbers',
    'deuteronomy': 'Deuteronomy', 'joshua': 'Joshua', 'judges': 'Judges', 'ruth': 'Ruth',
    '1-samuel': '1 Samuel', '2-samuel': '2 Samuel', '1-kings': '1 Kings', '2-kings': '2 Kings',
    '1-chronicles': '1 Chronicles', '2-chronicles': '2 Chronicles', 'ezra': 'Ezra', 'nehemiah': 'Nehemiah',
    'esther': 'Esther', 'job': 'Job', 'psalms': 'Psalms', 'proverbs': 'Proverbs',
    'ecclesiastes': 'Ecclesiastes', 'song-of-solomon': 'Song of Solomon', 'isaiah': 'Isaiah',
    'jeremiah': 'Jeremiah', 'lamentations': 'Lamentations', 'ezekiel': 'Ezekiel', 'daniel': 'Daniel',
    'hosea': 'Hosea', 'joel': 'Joel', 'amos': 'Amos', 'obadiah': 'Obadiah', 'jonah': 'Jonah',
    'micah': 'Micah', 'nahum': 'Nahum', 'habakkuk': 'Habakkuk', 'zephaniah': 'Zephaniah',
    'haggai': 'Haggai', 'zechariah': 'Zechariah', 'malachi': 'Malachi', 'matthew': 'Matthew',
    'mark': 'Mark', 'luke': 'Luke', 'john': 'John', 'acts': 'Acts', 'romans': 'Romans',
    '1-corinthians': '1 Corinthians', '2-corinthians': '2 Corinthians', 'galatians': 'Galatians',
    'ephesians': 'Ephesians', 'philippians': 'Philippians', 'colossians': 'Colossians',
    '1-thessalonians': '1 Thessalonians', '2-thessalonians': '2 Thessalonians', '1-timothy': '1 Timothy',
    '2-timothy': '2 Timothy', 'titus': 'Titus', 'philemon': 'Philemon', 'hebrews': 'Hebrews',
    'james': 'James', '1-peter': '1 Peter', '2-peter': '2 Peter', '1-john': '1 John',
    '2-john': '2 John', '3-john': '3 John', 'jude': 'Jude', 'revelation': 'Revelation'
}

TRANSLATION_LANG_MAP = {
    'bbe': 'english', 'kjv': 'english', 'nkjv': 'english', 'nlt': 'english', 'niv': 'english',
    'esv': 'english', 'csb': 'english', 'nasb95': 'english', 'nasb20': 'english', 'lsb': 'english',
    'amp': 'english', 'net': 'english', 'rsv': 'english', 'asv': 'english', 'ylt': 'english',
    'dby': 'english', 'web': 'english', 'hnv': 'english', 'vul': 'latin', 'nav': 'arabic',
    'wlc': 'hebrew', 'lxx': 'greek', 'mgnt': 'greek', 'tr': 'greek', 'svd': 'arabic',
    'bes': 'english', 'rvr09': 'spanish', 'rvr60': 'spanish', 'cht': 'chinese', 'em': 'german',
    'kor': 'korean', 'ls': 'french', 'lut': 'german', 'rst': 'russian', 'se': 'swedish',
}

def convert_book_to_txt(book_dir, translation, book_name, book_num):
    """Convert a book's JSON files to a single TXT file"""
    book_dir = Path(book_dir)
    if not AUTO_CONVERT_TO_TXT:
        return
    
    chapter_files = sorted([f for f in os.listdir(book_dir) if f.endswith('.json')])
    if not chapter_files:
        return
    
    lang = get_language_for_version(translation)
    txt_bibles_dir = resolve_output_dir('txt_bibles') / lang / translation
    txt_bibles_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = txt_bibles_dir / f"{book_num:02d}-{book_name}-{translation}.txt"
    
    all_lines = []
    for chapter_file in chapter_files:
        chapter_path = book_dir / chapter_file
        with open(chapter_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        chapter = data['chapter']
        book_display = BOOK_NAME_MAP.get(book_name, book_name.title())
        
        for verse_data in data['verses']:
            verse = verse_data['verse']
            text = clean_verse_text(verse_data['text'])
            all_lines.append(f"{book_display} {chapter}:{verse} {text}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_lines) + '\n')
    
    print(f"    -> Created TXT: {output_file.name}")

def clean_verse_text(text):
    """Remove Strong's numbers and special markers from verse text"""
    import re
    text = re.sub(r'[\s\u00A0\u2000-\u200F]+H\d+\b', '', text)
    text = re.sub(r'[\s\u00A0\u2000-\u200F]+G\d+\b', '', text)
    text = re.sub(r'\s*➔\s*', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_blueletter_bible_abbrev(book_name, translation):
    """Convert internal book name to Blue Letter Bible abbreviation"""
    # Most Blue Letter Bible translations use similar abbreviations
    abbrev_map = {
        # Old Testament
        'genesis': 'gen', 'exodus': 'exo', 'leviticus': 'lev', 'numbers': 'num', 'deuteronomy': 'deu',
        'joshua': 'jos', 'judges': 'jdg', 'ruth': 'rut', '1-samuel': '1sa', '2-samuel': '2sa',
        '1-kings': '1ki', '2-kings': '2ki', '1-chronicles': '1ch', '2-chronicles': '2ch',
        'ezra': 'ezr', 'nehemiah': 'neh', 'esther': 'est', 'job': 'job', 'psalms': 'psa',
        'proverbs': 'pro', 'ecclesiastes': 'ecc', 'song-of-solomon': 'sng', 'isaiah': 'isa', 'jeremiah': 'jer',
        'lamentations': 'lam', 'ezekiel': 'eze', 'daniel': 'dan', 'hosea': 'hos', 'joel': 'joe', 'amos': 'amo',
        'obadiah': 'oba', 'jonah': 'jon', 'micah': 'mic', 'nahum': 'nah', 'habakkuk': 'hab',
        'zephaniah': 'zep', 'haggai': 'hag', 'zechariah': 'zec', 'malachi': 'mal',
        # New Testament
        'matthew': 'mat', 'mark': 'mar', 'luke': 'luk', 'john': 'jhn', 'acts': 'act',
        'romans': 'rom', '1-corinthians': '1co', '2-corinthians': '2co', 'galatians': 'gal',
        'ephesians': 'eph', 'philippians': 'phi', 'colossians': 'col', '1-thessalonians': '1th',
        '2-thessalonians': '2th', '1-timothy': '1ti', '2-timothy': '2ti', 'titus': 'tit',
        'philemon': 'phm', 'hebrews': 'heb', 'james': 'jas', '1-peter': '1pe', '2-peter': '2pe',
        '1-john': '1jo', '2-john': '2jo', '3-john': '3jo', 'jude': 'jud', 'revelation': 'rev'
    }
    return abbrev_map.get(book_name, book_name)

def get_blueletter_bible_verses(book, chapter, translation):
    """Get verses from Blue Letter Bible for any translation with retry logic"""
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(max_retries):
        verses = []
        book_abbrev = get_blueletter_bible_abbrev(book, translation)
        url = f"{BLUELETTER_BIBLE_BASE}{translation}/{book_abbrev}/{chapter}/1/"
        
        headers = {
            'User-Agent': USER_AGENT
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            # Parse HTML 
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find unique verse divs with data-bible-id
            verse_containers = []
            verse_divs = soup.find_all('div', attrs={'data-bible-id': True})
            verse_containers.extend(verse_divs)
            
            # If no data-bible-id divs, try alternative approach
            if not verse_containers:
                verse_links = soup.find_all('a', href=re.compile(rf'/{translation}/{book_abbrev}/{chapter}/\d+/'))
                seen_verse_nums = set()
                
                for link in verse_links:
                    verse_match = re.search(rf'/{translation}/{book_abbrev}/{chapter}/(\d+)', link.get('href', ''))
                    if verse_match:
                        verse_num_in_link = int(verse_match.group(1))
                        if verse_num_in_link not in seen_verse_nums:
                            seen_verse_nums.add(verse_num_in_link)
                            parent = link.find_parent(['div', 'p', 'span'])
                            if parent:
                                verse_containers.append(parent)
            
            # Sort verse containers by their verse number
            def sort_key(container):
                verse_id = container.get('data-bible-id', '')
                if verse_id:
                    match = re.search(r'(\d+)$', verse_id)
                    if match:
                        return int(match.group(1))
                return 0
            
            verse_containers.sort(key=sort_key)
            
            verse_num = 1
            
            for container in verse_containers:
                # Use simple sequential verse numbering instead of complex data-bible-id
                # This ensures verses are numbered 1, 2, 3, etc. regardless of the data-bible-id
                
                # Extract text content
                verse_text = container.get_text(separator=' ', strip=True)
                
                # If container doesn't have meaningful text, try parent
                if len(verse_text) < 10:
                    parent = container.find_parent(['div', 'p', 'span'])
                    if parent:
                        verse_text = parent.get_text(separator=' ', strip=True)
                
                # Clean up verse references and extra whitespace
                text_content = re.sub(r'^[A-Za-z]+\s+\d+:\d+\s*[-—]\s*', '', verse_text)
                text_content = re.sub(r'^\d+\.?\s*', '', text_content)
                text_content = re.sub(r'\s+\[fn\]\s+', ' ', text_content)
                # Fix broken LORD formatting
                text_content = re.sub(r'\bL\s+ORD\b', 'LORD', text_content)
                text_content = re.sub(r'\s+', ' ', text_content).strip()
                text_content = text_content.strip()
                
                if text_content and len(text_content) > 1:
                    verses.append({
                        'verse': verse_num,
                        'text': text_content
                    })
                    verse_num += 1
                    
            print(f"Extracted {len(verses)} {translation.upper()} verses for {book} {chapter}")
            
            # Success! Return the verses
            time.sleep(1)  # Rate limiting for BLB
            return verses
                
        except Exception as e:
            print(f"Error fetching {translation.upper()} chapter {book} {chapter} (attempt {attempt + 1}/{max_retries}): {e}")
            
            if attempt < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Double the delay for next retry (5, 10, 20 seconds)
            else:
                print(f"Failed to fetch {translation.upper()} chapter {book} {chapter} after {max_retries} attempts")
                print(f"Moving to next chapter...")
                time.sleep(1)  # Rate limiting even for failures
                return []  # Return empty list to continue with next chapter

def resolve_translation(input_val):
    """Resolve version input (number or shortcode) to shortcode"""
    input_val = input_val.strip().lower()
    if input_val in TRANSLATIONS:
        return input_val
    try:
        idx = int(input_val) - 1
        if 0 <= idx < len(TRANSLATIONS):
            return TRANSLATIONS[idx]
    except ValueError:
        pass
    return None

def resolve_translations_list(input_str):
    """Resolve comma-separated version inputs (numbers or shortcodes) to shortcode list"""
    parts = [p.strip().lower() for p in input_str.split(',')]
    result = []
    for part in parts:
        resolved = resolve_translation(part)
        if resolved:
            result.append(resolved)
    return result

def interactive_prompt():
    """Interactive menu for user selection"""
    print("\n" + "="*60)
    print("📖 BLUELETTERBIBLE DOWNLOADER - INTERACTIVE MODE")
    print("="*60)
    
    while True:
        print("\nPlease select an option:")
        print("1) Download all translations of entire Bible")
        print("2) Download all books from specific translation")
        print("3) Download all books from multiple selected translations")
        print("4) Download specific book from specific translation")
        print("5) List available translations")
        print("6) List available books")
        print("7) Return to Main Menu")
        print("8) Exit")
        
        choice = input("\nEnter your choice (1-8): ").strip()
        
        if choice == '1':
            print("\n⚠️  This will download all translations (35 total) of the entire Bible - this may take many hours!")
            confirm = input("Are you absolutely sure you want to continue? (y/N): ").strip().lower()
            if confirm in ['y', 'yes']:
                return TRANSLATIONS, list(BIBLE_BOOKS.keys()), None
            else:
                continue
                
        elif choice == '2':
            print("\nAvailable translations:")
            for i, version in enumerate(TRANSLATIONS, 1):
                print(f"{i:2d}. {version.upper()}")
            translation = input("\nEnter translation code or number (e.g., KJV, NIV, or 4): ").strip().lower()
            translation = resolve_translation(translation)
            if translation:
                print(f"\n⚠️  This will download all books from {translation.upper()} - this may take a while!")
                confirm = input("Are you sure you want to continue? (y/N): ").strip().lower()
                if confirm in ['y', 'yes']:
                    return [translation], list(BIBLE_BOOKS.keys()), None
                else:
                    continue
            else:
                print(f"❌ Translation '{translation}' not found. Please try again.")
        
        elif choice == '3':
            print("\nAvailable translations:")
            for i, version in enumerate(TRANSLATIONS, 1):
                print(f"{i:2d}. {version.upper()}")
            
            translations_input = input("\nEnter translation codes or numbers separated by comma (e.g., kjv,niv,esv or 1,4,5): ").strip()
            valid_translations = resolve_translations_list(translations_input)
            
            if not valid_translations:
                print(f"❌ No valid translations entered. Please try again.")
                continue
            
            print(f"\n⚠️  This will download all books from {len(valid_translations)} translations: {', '.join([t.upper() for t in valid_translations])}")
            confirm = input("Are you sure you want to continue? (y/N): ").strip().lower()
            if confirm in ['y', 'yes']:
                return valid_translations, list(BIBLE_BOOKS.keys()), None
            else:
                continue
        
        elif choice == '4':
            print("\nAvailable translations:")
            for i, version in enumerate(TRANSLATIONS, 1):
                print(f"{i:2d}. {version.upper()}")
            
            translation = input("\nEnter translation code or number (e.g., KJV, NIV, or 4): ").strip().lower()
            translation = resolve_translation(translation)
            if not translation:
                print(f"❌ Translation not found. Please try again.")
                continue
                
            print(f"\nAvailable books:")
            for i, (book, chapters) in enumerate(BIBLE_BOOKS.items(), 1):
                print(f"{i:2d}. {book.title()} ({chapters} chapters)")
            
            book_input = input("\nEnter book name: ").strip().lower()
            if book_input in BIBLE_BOOKS:
                chapter_input = input(f"Enter chapter number (1-{BIBLE_BOOKS[book_input]}) or press Enter for all: ").strip()
                chapter = int(chapter_input) if chapter_input.isdigit() else None
                return [translation], [book_input], chapter
            else:
                print(f"❌ Book '{book_input}' not found. Please try again.")
        
        elif choice == '5':
            print(f"\n📚 Available translations ({len(TRANSLATIONS)}):")
            for i, version in enumerate(TRANSLATIONS, 1):
                print(f"{i:2d}. {version.upper()}")
        
        elif choice == '6':
            print(f"\n📚 Available books ({len(BIBLE_BOOKS)}):")
            for i, (book, chapters) in enumerate(BIBLE_BOOKS.items(), 1):
                print(f"{i:2d}. {book.title()} ({chapters} chapters)")
        
        elif choice == '7':
            return None, None, 'return'
        
        elif choice == '8':
            print("\n👋 Goodbye!")
            sys.exit(10)

def create_bible_structure(target_versions=None, target_books=None, target_chapter=None):
    """Create a Bible directory structure with filters"""
    base_dir = resolve_output_dir('json_bibles')
    
    # Set defaults if None
    if target_versions is None:
        target_versions = TRANSLATIONS
    if target_books is None:
        target_books = list(BIBLE_BOOKS.keys())
    
    # Create ordered list of books with their numbers
    book_order = list(BIBLE_BOOKS.keys())
    
    for translation in target_versions:
        # Skip translation if not in target versions
        if translation not in target_versions:
            continue
        
        lang = get_language_for_version(translation)
        translation_dir = base_dir / lang / translation
        translation_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {translation_dir}")
        
        for book_index, book_name in enumerate(book_order, 1):
            # Skip book if not in target books
            if target_books and book_name not in target_books:
                continue
            
            # For WLC, only process Old Testament books
            if translation == 'wlc' and not is_old_testament_book(book_name):
                print(f"Skipping WLC for New Testament book: {book_name}")
                continue
            
            # For MGNT, only process New Testament books
            if translation == 'mgnt' and is_old_testament_book(book_name):
                print(f"Skipping MGNT for Old Testament book: {book_name}")
                continue
            
            # Format: bible/wlc/wlc_01-genesis/
            book_number = f"{book_index:02d}"
            book_dir = translation_dir / f"{translation}_{book_number}-{book_name}"
            book_dir.mkdir(exist_ok=True)
            
            print(f"Processing {translation.upper()} - {book_name.title()}...")
            
            chapter_count = BIBLE_BOOKS[book_name]
            
            # Determine chapter range
            start_chapter = target_chapter if target_chapter else 1
            end_chapter = target_chapter if target_chapter else chapter_count
            
            for chapter in range(start_chapter, end_chapter + 1):
                # Format: wlc_01-genesis_chapter-01.json
                chapter_file = book_dir / f"{translation}_{book_number}-{book_name}_chapter-{chapter:02d}.json"
                
                # Skip if already exists
                if chapter_file.exists():
                    print(f"  Skipping {book_name} chapter {chapter} (already exists)")
                    continue
                
                # Get all verses in this chapter
                verses = get_blueletter_bible_verses(book_name, chapter, translation)
                
                if verses:
                    chapter_data = {
                        'book': book_name,
                        'chapter': chapter,
                        'translation': translation,
                        'verses': verses
                    }
                    
                    with open(chapter_file, 'w', encoding='utf-8') as f:
                        json.dump(chapter_data, f, indent=2, ensure_ascii=False)
                    
                    print(f"  Created {book_name} chapter {chapter} with {len(verses)} verses")
                else:
                    print(f"  Failed to fetch {book_name} chapter {chapter}")
                
                # Rate limiting to avoid overwhelming the API
                if translation == 'wlc':
                    time.sleep(2)  # Longer delay for BLB
                else:
                    time.sleep(1)
            
            # Convert book to TXT after all chapters are downloaded
            print(f"  Converting {book_name} to TXT...")
            convert_book_to_txt(book_dir, translation, book_name, int(book_number))

def create_summary_file():
    """Create a summary file with statistics"""
    base_dir = Path('bible')
    summary = {
        'translations': TRANSLATIONS,
        'books': len(BIBLE_BOOKS),
        'total_chapters': sum(BIBLE_BOOKS.values()),
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    
    summary_file = base_dir / 'summary.json'
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
        json.dump(summary, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Download Bible from Blue Letter Bible')
    parser.add_argument('--version', '-v', help='Specific version to download (default: all)')
    parser.add_argument('--book', '-b', help='Specific book to download (default: all)')
    parser.add_argument('--chapter', '-c', type=int, help='Specific chapter to download (default: all)')
    parser.add_argument('--list-versions', '-l', action='store_true', help='List available versions')
    parser.add_argument('--list-books', action='store_true', help='List available books')
    
    args = parser.parse_args()
    
    # Handle list commands
    if args.list_versions:
        print("Available versions:")
        for version in sorted(TRANSLATIONS):
            print(f"  {version}")
        return
    
    if args.list_books:
        print("Available books:")
        for book in sorted(BIBLE_BOOKS.keys()):
            print(f"  {book}")
        return
    
    # Handle list commands
    if len(sys.argv) > 1:
        # Use command line mode
        parser = argparse.ArgumentParser(description='Download Bible from Blue Letter Bible')
        parser.add_argument('--version', '-v', help='Specific version to download (default: all)')
        parser.add_argument('--book', '-b', help='Specific book to download (default: all)')
        parser.add_argument('--chapter', '-c', type=int, help='Specific chapter to download (default: all)')
        parser.add_argument('--list-versions', '-l', action='store_true', help='List available versions')
        parser.add_argument('--list-books', action='store_true', help='List available books')
        
        args = parser.parse_args()
        
        # Handle list commands
        if args.list_versions:
            print("Available versions:")
            for version in sorted(TRANSLATIONS):
                print(f"  {version}")
            return
        
        if args.list_books:
            print("Available books:")
            for book in sorted(BIBLE_BOOKS.keys()):
                print(f"  {book}")
            return
        
        # Determine what to download from command line args
        target_versions = [args.version] if args.version else TRANSLATIONS
        target_books = [args.book] if args.book else list(BIBLE_BOOKS.keys())
        target_chapter = args.chapter
    else:
        # Use interactive mode
        result = interactive_prompt()
        if result is None or (isinstance(result, tuple) and len(result) == 3 and result[2] == 'return'):
            print("\n↩️  Returning to main menu...")
            return
        target_versions, target_books, target_chapter = result

    if target_versions is None:
        return

    print(f"📥 Downloading: {len(target_versions)} version(s), {len(target_books)} book(s)")
    if target_chapter:
        print(f"   Chapter: {target_chapter}")
    print()
    
    # Create the directory structure and download content
    create_bible_structure(target_versions, target_books, target_chapter)
    
    # Create summary file
    create_summary_file()
    
    print("\n✅ Bible download completed!")

if __name__ == "__main__":
    main()