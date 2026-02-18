#!/usr/bin/env python3
"""
Bible Gateway Downloader
Downloads all verses from all chapters from all books for each Bible version from BibleGateway
"""

import requests
import json
import os
import sys
import time
import re
import configparser
from bs4 import BeautifulSoup
from urllib.parse import quote
from pathlib import Path

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

base_dir = Path(__file__).parent.parent
sys.path.insert(0, str(base_dir))
from version_languages import get_language_for_version

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

# Bible books with their chapter counts
BIBLE_BOOKS = {
    # Old Testament
    "genesis": 50, "exodus": 40, "leviticus": 27, "numbers": 36, "deuteronomy": 34,
    "joshua": 24, "judges": 21, "ruth": 4, "1-samuel": 31, "2-samuel": 24,
    "1-kings": 22, "2-kings": 19, "1-chronicles": 29, "2-chronicles": 36,
    "ezra": 10, "nehemiah": 13, "esther": 10, "job": 42, "psalms": 150,
    "proverbs": 31, "ecclesiastes": 12, "song-of-solomon": 8, "isaiah": 66,
    "jeremiah": 52, "lamentations": 5, "ezekiel": 48, "daniel": 12,
    "hosea": 14, "joel": 3, "amos": 9, "obadiah": 1, "jonah": 4,
    "micah": 7, "nahum": 3, "habakkuk": 3, "zephaniah": 3, "haggai": 2,
    "zechariah": 14, "malachi": 4,
    # New Testament
    "matthew": 28, "mark": 16, "luke": 24, "john": 21, "acts": 28,
    "romans": 16, "1-corinthians": 16, "2-corinthians": 13, "galatians": 6,
    "ephesians": 6, "philippians": 4, "colossians": 4, "1-thessalonians": 5,
    "2-thessalonians": 3, "1-timothy": 6, "2-timothy": 4, "titus": 3,
    "philemon": 1, "hebrews": 13, "james": 5, "1-peter": 5, "2-peter": 3,
    "1-john": 5, "2-john": 1, "3-john": 1, "jude": 1, "revelation": 22
}

class BibleGatewayDownloader:
    def __init__(self, versions_file="biblegateway-versions-available.txt", output_dir=None):
        self.versions_file = versions_file
        if output_dir is None:
            self.output_dir = str(resolve_output_dir('json_bibles'))
        else:
            self.output_dir = str(Path(output_dir) if os.path.isabs(output_dir) else Path.cwd() / output_dir / 'json_bibles')
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': USER_AGENT
        })
        
    def load_versions(self):
        """Load Bible versions from the versions file"""
        versions = []
        try:
            with open(self.versions_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        # Handle both formats:
                        # "ADB1905 https://..." or just "ADB1905"
                        parts = line.split()
                        if parts:
                            version_code = parts[0]
                            if version_code:
                                versions.append(version_code.lower())
        except FileNotFoundError:
            print(f"Error: {self.versions_file} not found")
            return []
        
        return versions
    
    def construct_url(self, book, chapter, version):
        """Construct BibleGateway URL for specific book, chapter, and version"""
        # Format book name for URL (replace hyphens with spaces, then URL encode)
        book_formatted = book.replace('-', ' ')
        url = f"https://www.biblegateway.com/passage/?search={quote(book_formatted)}+{chapter}&version={version.upper()}"
        return url
    
    def get_chapter_verses(self, book, chapter, version, max_retries=5):
        """Download verses for a specific chapter from BibleGateway"""
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # Construct the URL correctly - use spaces, not plus signs
                book_formatted = book.replace('-', ' ').title()  # "1-samuel" -> "1 Samuel"
                url = f"https://www.biblegateway.com/passage/?search={quote(book_formatted)}+{chapter}&version={version.upper()}"
                
                if retry_count == 0:
                    print(f"Downloading: {book.title()} {chapter}:{version.upper()}")
                else:
                    print(f"Retry {retry_count} for: {book.title()} {chapter}:{version.upper()}")
                
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Use the improved parsing method
                verses = self._parse_verses_new_method(soup, book, chapter, version)
                
                if verses:
                    print(f"✓ Successfully downloaded {book.title()} {chapter}:{version.upper()} ({len(verses)} verses)")
                    return verses
                else:
                    print(f"✗ No verses found for {book.title()} {chapter}:{version.upper()}")

            except requests.RequestException as e:
                print(f"Error downloading {book.title()} {chapter}:{version.upper()} - {e}")
            except Exception as e:
                print(f"Error parsing {book.title()} {chapter}:{version.upper()} - {e}")

            # If we get here, the download failed - retry after delay
            retry_count += 1
            if retry_count < max_retries:
                print(f"Waiting 3 seconds before retry...")
                time.sleep(3)
        
        print(f"✗ FAILED: Could not download {book.title()} {chapter}:{version.upper()} after {retry_count} attempts")
        return []

    def detect_version_books(self, version):
        """Detect whether a version has OT, NT, or both by testing Genesis and Matthew"""
        print(f"  Detecting available books for {version.upper()}...")
        
        has_genesis = bool(self.get_chapter_verses("genesis", 1, version, max_retries=2))
        
        has_matthew = bool(self.get_chapter_verses("matthew", 1, version, max_retries=2))
        
        if has_genesis and has_matthew:
            print(f"  -> Detected: Full Bible (66 books)")
            return 'all'
        elif has_genesis and not has_matthew:
            print(f"  -> Detected: Old Testament only (39 books)")
            return 'ot'
        elif has_matthew and not has_genesis:
            print(f"  -> Detected: New Testament only (27 books)")
            return 'nt'
        else:
            print(f"  -> Warning: Could not detect any books, defaulting to full Bible")
            return 'all'
    
    def get_starting_book(self, book_type):
        """Get the starting book based on book type"""
        if book_type == 'nt':
            return 'matthew'
        return 'genesis'
    
    def _parse_verses_new_method(self, soup, book, chapter, version):
        """Improved parsing method that targets specific passage content area"""
        verses = []
        
        try:
            # Target the main passage content area specifically
            passage_content = soup.select_one('.passage-content .text-html')
            if not passage_content:
                # Fallback to any passage content
                passage_content = soup.select_one('.passage-content')
            if not passage_content:
                # Last resort - look for version-specific content
                passage_content = soup.select_one(f'.version-{version.upper()}')
            
            if not passage_content:
                print("No passage content found")
                return []
            
            # First, collect any section headings that appear before verse 1
            section_headings = []
            headings = passage_content.find_all('h3')
            for heading in headings:
                heading_text = heading.get_text().strip()
                if heading_text and heading_text not in section_headings:
                    section_headings.append(heading_text)
            
                        # Find all verse spans within passage content
            # Verse spans have pattern: class="text Gen-1-1" and id="en-ESV-1"
            verse_spans = passage_content.find_all('span', class_=lambda c: c and 'text' in c)

            # Extract section headings from h3 tags and map them to verse numbers
            heading_map = {}  # verse_number -> heading_text
            h3_headings = passage_content.find_all('h3')
            for h3 in h3_headings:
                heading_span = h3.find('span', class_=lambda c: c and 'text' in c)
                if heading_span:
                    heading_text = heading_span.get_text().strip()
                    heading_class = heading_span.get('class', [])
                    
                    # Extract verse number from heading class like "Gen-2-4"
                    verse_number = None
                    for cls in heading_class:
                        if '-' in cls and cls != 'text':
                            parts = cls.split('-')
                            if len(parts) >= 3:
                                try:
                                    verse_number = int(parts[-1])
                                    break
                                except (ValueError, AttributeError):
                                    continue
                    
                    if verse_number:
                        heading_map[verse_number] = heading_text

            # Group spans by verse number to handle poetry books where content is split
            verse_groups = {}

            for verse_span in verse_spans:
                # Extract verse number from class attribute
                class_attr = verse_span.get('class', [])
                verse_class = None
                for cls in class_attr:
                    if '-' in cls and cls != 'text':
                        verse_class = cls
                        break

                if not verse_class:
                    continue

                # Extract verse number from class like "Job-29-2"
                parts = verse_class.split('-')
                if len(parts) >= 3:
                    try:
                        verse_number = int(parts[-1])
                    except (ValueError, AttributeError):
                        continue
                else:
                    continue

                # Extract text from this span
                span_copy = verse_span.__copy__()

                # Remove chapter number (only appears on first verse)
                chapter_num_span = span_copy.find('span', class_='chapternum')
                if chapter_num_span:
                    chapter_num_span.decompose()

                # Remove cross references and footnotes
                cross_refs = span_copy.find_all('sup', class_='crossreference')
                for ref in cross_refs:
                    ref.decompose()
                footnotes = span_copy.find_all('sup', class_='footnote')
                for fn in footnotes:
                    fn.decompose()

                # Remove verse number if present
                versenum_span = span_copy.find('sup', class_='versenum')
                if versenum_span:
                    versenum_span.decompose()

                clean_text = span_copy.get_text().strip()

                # Remove heading text from verse content if this verse has a heading
                if verse_number in heading_map:
                    heading_text = heading_map[verse_number]
                    if heading_text in clean_text:
                        clean_text = clean_text.replace(heading_text, "").strip()
                        # Remove extra space if heading was at beginning
                        if clean_text.startswith('  '):
                            clean_text = clean_text[2:].strip()

                # Clean up extra whitespace
                clean_text = re.sub(r'\s+', ' ', clean_text).strip()

                if clean_text:
                    # Group text by verse number
                    if verse_number not in verse_groups:
                        verse_groups[verse_number] = []
                    verse_groups[verse_number].append(clean_text)

            # Combine grouped text for each verse
            for verse_number, text_parts in sorted(verse_groups.items()):
                # Combine all parts for this verse with proper spacing
                combined_text = ' '.join(text_parts)

                # Add heading to this verse if one exists for it
                if verse_number in heading_map:
                    combined_text = f"({heading_map[verse_number]}) {combined_text}"

                # Validation: check if this looks like a real verse
                if (self._is_valid_verse(verse_number, combined_text, book)):
                    verses.append({
                        "verse": verse_number,
                        "text": combined_text
                    })
            
            # Sort verses by number and remove duplicates
            unique_verses = {}
            for verse in verses:
                verse_num = verse["verse"]
                if verse_num not in unique_verses or len(verse["text"]) > len(unique_verses[verse_num]["text"]):
                    unique_verses[verse_num] = verse
            
            verses = [unique_verses[key] for key in sorted(unique_verses.keys())]
            
            if not verses:
                print("No valid verses found after filtering")
                return []
            
            return verses
            
        except Exception as e:
            print(f"Error in parsing: {e}")
            return []

    def _is_valid_verse(self, verse_number, verse_text, book):
        """Validate if extracted content is likely a real Bible verse"""
        # Basic validation only - verse number and reasonable text length
        if verse_number < 1 or verse_number > 200:  # Most chapters don't exceed 200 verses
            return False
        
        # Minimal text length validation - just ensure it's not empty or obviously invalid
        if len(verse_text) < 1 or len(verse_text) > 5000:
            return False
        
        # No content filtering - accept any verse text as valid
        return True

    def _parse_verses_from_soup(self, soup, book, chapter, version):
        """Parse verses directly from soup using span.text structure"""
        verses = []
        
        # Find all verse spans with pattern like "text Gen-1-1" or "text Exod-1-1" etc
        verse_spans = soup.find_all('span', class_=lambda c: c and 'text' in c)
        
        for verse_span in verse_spans:
            class_attr = verse_span.get('class', [])
            verse_class = None
            for cls in class_attr:
                if 'text' in cls and '-' in cls:
                    verse_class = cls
                    break
            
            if verse_class:
                # Extract verse number from class like "text Gen-1-1"
                parts = verse_class.split('-')
                if len(parts) >= 3:
                    try:
                        verse_number = int(parts[-1])
                        
                        # Extract verse text
                        # Remove chapter number span
                        chapter_num_span = verse_span.find('span', class_='chapternum')
                        if chapter_num_span:
                            chapter_num_span.decompose()
                        
                        # Get the remaining text
                        verse_text = verse_span.get_text().strip()
                        
                        # Clean up cross references and footnotes
                        # Remove cross reference content
                        cross_refs = verse_span.find_all('sup', class_='crossreference')
                        for ref in cross_refs:
                            ref.decompose()
                        
                        # Clean up extra whitespace
                        verse_text = re.sub(r'\s+', ' ', verse_text).strip()
                        
                        if verse_text and verse_number > 0:  # Valid verse
                            verses.append({
                                "verse": verse_number,
                                "text": verse_text
                            })
                    except (ValueError, IndexError):
                        continue
        
        # Remove duplicates and sort verses by number
        unique_verses = {}
        for verse in verses:
            verse_num = verse["verse"]
            if verse_num not in unique_verses or len(verse["text"]) > len(unique_verses[verse_num]["text"]):
                unique_verses[verse_num] = verse
        
        verses = [unique_verses[key] for key in sorted(unique_verses.keys())]
        return verses

    def _parse_verses_method1(self, passage_div, book, chapter, version):
        """Deprecated - use _parse_verses_new_method instead"""
        print("Warning: Using deprecated parsing method 1")
        return []
    
    def _parse_verses_method2(self, soup, book, chapter, version):
        """Deprecated - use _parse_verses_new_method instead"""
        print("Warning: Using deprecated parsing method 2")
        return []
    
    def _parse_verses_method3(self, soup, book, chapter, version):
        """Deprecated - use _parse_verses_new_method instead"""
        print("Warning: Using deprecated parsing method 3")
        return []
    
    def create_chapter_json(self, book, chapter, version, verses):
        """Create JSON structure for a chapter"""
        return {
            "book": book,
            "chapter": chapter,
            "translation": version.lower(),
            "verses": verses
        }
    
    def save_chapter(self, book, chapter, version, verses):
        """Save chapter data to JSON file"""
        lang = get_language_for_version(version)
        version_dir = os.path.join(self.output_dir, lang, version.lower())
        book_dir = os.path.join(version_dir, f"{version.lower()}_{self.get_book_number(book):02d}-{book}")
        
        os.makedirs(book_dir, exist_ok=True)
        
        # Create filename
        filename = f"{version.lower()}_{self.get_book_number(book):02d}-{book}_chapter-{chapter:02d}.json"
        filepath = os.path.join(book_dir, filename)
        
        # Create JSON data
        chapter_data = self.create_chapter_json(book, chapter, version, verses)
        
        # Save to file
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(chapter_data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving {filepath}: {e}")
            return False
    
    def get_book_number(self, book):
        """Get the canonical book number for ordering"""
        book_order = list(BIBLE_BOOKS.keys())
        try:
            return book_order.index(book) + 1
        except ValueError:
            return 999
    
    def download_version(self, version):
        """Download all books and chapters for a specific version"""
        print(f"\n=== Downloading version: {version.upper()} ===")
        
        book_type = self.detect_version_books(version)
        starting_book = self.get_starting_book(book_type)
        
        books_order = list(BIBLE_BOOKS.keys())
        try:
            start_idx = books_order.index(starting_book)
            books_to_download = books_order[start_idx:]
        except ValueError:
            books_to_download = books_order
        
        success_count = 0
        total_count = 0
        
        for book in books_to_download:
            chapter_count = BIBLE_BOOKS[book]
            print(f"\nDownloading {book} ({chapter_count} chapters)...")
            
            for chapter in range(1, chapter_count + 1):
                total_count += 1
                
                # Download verses with 5 retries (handled in get_chapter_verses)
                verses = self.get_chapter_verses(book, chapter, version)
                
                if verses:
                    # Successfully downloaded verses, now try to save
                    save_success = False
                    save_retry_count = 0
                    
                    # Retry saving if it fails
                    while not save_success and save_retry_count < 10:
                        if self.save_chapter(book, chapter, version, verses):
                            success_count += 1
                            save_success = True
                            print(f"✓ Completed {book} {chapter}:{version} ({len(verses)} verses)")
                            break
                        else:
                            save_retry_count += 1
                            print(f"Failed to save {book} {chapter}:{version}, retrying in 5 seconds... (attempt {save_retry_count}/10)")
                            time.sleep(5)
                    
                    if not save_success:
                        # Failed to save after retries, skip to next book
                        print(f"Critical: Failed to save {book} {chapter}:{version} after multiple save attempts, skipping to next book...")
                        break
                else:
                    # Failed to download after 5 retries, skip to next book
                    print(f"Failed to download {book} {chapter}:{version} after 5 attempts, skipping to next book...")
                    break
                
                # Rate limiting - be respectful to BibleGateway after successful completion
                time.sleep(1)
            
            # Convert book to TXT after all chapters are downloaded
            print(f"  Converting {book} to TXT...")
            if AUTO_CONVERT_TO_TXT:
                self.convert_book_to_txt(book, version)
        
        print(f"\nVersion {version.upper()} complete: {success_count}/{total_count} chapters downloaded")
        return success_count, total_count
    
    def download_book(self, version, book):
        """Download a specific book for a version"""
        print(f"\n=== Downloading {book} from {version.upper()} ===")
        
        if book not in BIBLE_BOOKS:
            print(f"Error: Unknown book '{book}'")
            return 0, 0
        
        chapter_count = BIBLE_BOOKS[book]
        success_count = 0
        total_count = 0
        
        print(f"\nDownloading {book} ({chapter_count} chapters)...")
        
        for chapter in range(1, chapter_count + 1):
            total_count += 1
            verses = self.get_chapter_verses(book, chapter, version)
            
            if verses:
                save_success = False
                save_retry_count = 0
                
                while not save_success and save_retry_count < 10:
                    if self.save_chapter(book, chapter, version, verses):
                        success_count += 1
                        save_success = True
                        print(f"✓ Completed {book} {chapter}:{version} ({len(verses)} verses)")
                        break
                    else:
                        save_retry_count += 1
                        print(f"Failed to save {book} {chapter}:{version}, retrying in 5 seconds... (attempt {save_retry_count}/10)")
                        time.sleep(5)
                
                if not save_success:
                    print(f"Critical: Failed to save {book} {chapter}:{version} after multiple save attempts, skipping...")
            else:
                print(f"Failed to download {book} {chapter}:{version} after 5 retries, skipping...")
            
            time.sleep(1)
        
        if AUTO_CONVERT_TO_TXT:
            print(f"  Converting {book} to TXT...")
            self.convert_book_to_txt(book, version)
        
        print(f"\nBook {book} complete: {success_count}/{total_count} chapters downloaded")
        return success_count, total_count
    
    def convert_book_to_txt(self, book, version):
        """Convert a book's JSON files to a single TXT file"""
        book_num = self.get_book_number(book)
        lang = get_language_for_version(version)
        book_dir = os.path.join(self.output_dir, lang, version.lower(), f"{version.lower()}_{book_num:02d}-{book}")
        
        if not os.path.exists(book_dir):
            return
        
        chapter_files = sorted([f for f in os.listdir(book_dir) if f.endswith('.json')])
        if not chapter_files:
            return
        
        lang = get_language_for_version(version)
        txt_bibles_dir = resolve_output_dir('txt_bibles') / lang / version.lower()
        txt_bibles_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = txt_bibles_dir / f"{book_num:02d}-{book}-{version.lower()}.txt"
        
        all_lines = []
        for chapter_file in chapter_files:
            chapter_path = os.path.join(book_dir, chapter_file)
            with open(chapter_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            chapter = data['chapter']
            book_display = BOOK_NAME_MAP.get(book, book.title())
            
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
    
    def download_all(self):
        """Download all versions"""
        versions = self.load_versions()
        
        if not versions:
            print("No versions found to download")
            return
        
        print(f"Found {len(versions)} versions to download")
        
        total_success = 0
        total_chapters = 0
        
        for i, version in enumerate(versions, 1):
            print(f"\n{'='*60}")
            print(f"Version {i}/{len(versions)}: {version.upper()}")
            print(f"{'='*60}")
            
            success, total = self.download_version(version)
            total_success += success
            total_chapters += total
            
            # Longer break between versions
            time.sleep(3)
        
        print(f"\n{'='*60}")
        print(f"DOWNLOAD COMPLETE")
        print(f"Total chapters downloaded: {total_success}/{total_chapters}")
        print(f"Success rate: {(total_success/total_chapters*100):.1f}%")
        print(f"{'='*60}")

def display_menu():
    """Display interactive menu"""
    print("\n" + "=" * 60)
    print("📖 BIBLE GATEWAY DOWNLOADER - INTERACTIVE MODE")
    print("=" * 60)
    print("Please select an option:")
    print("1) Download all translations of entire Bible")
    print("2) Download all books from specific translation")
    print("3) Download all books from multiple selected translations")
    print("4) Download specific book from specific translation")
    print("5) List available translations")
    print("6) List available books")
    print("7) Return to Main Menu")
    print("8) Exit")

def list_available_versions():
    """List all available Bible versions"""
    downloader = BibleGatewayDownloader()
    versions = downloader.load_versions()
    
    print(f"\n📚 Available Translations ({len(versions)} total):")
    print("-" * 40)
    for i, version in enumerate(versions, 1):
        print(f"{i:3d}. {version.upper()}")
    print()

def select_multiple_versions():
    """Let user select multiple translations by number or shortcode"""
    downloader = BibleGatewayDownloader()
    versions = downloader.load_versions()
    
    if not versions:
        print("❌ No versions found in versions file!")
        return []
    
    print(f"\n📚 Available Translations:")
    print("-" * 30)
    for i, version in enumerate(versions, 1):
        print(f"{i:2d}. {version.upper()}")
    
    print("\nEnter version numbers separated by commas (e.g., 1,3,5)")
    print("Or shortcodes separated by commas (e.g., niv,esv,kjv)")
    print("Or type 'all' to select all versions")
    
    while True:
        choice = input(f"\nSelect translations: ").strip()
        if choice.lower() in ['q', 'quit', 'exit']:
            return []
        
        if choice.lower() == 'all':
            print(f"✅ Selected all {len(versions)} translations")
            return versions
        
        parts = [x.strip().lower() for x in choice.split(',')]
        selected_versions = []
        invalid = []
        
        for part in parts:
            if part in versions:
                selected_versions.append(part)
            else:
                try:
                    idx = int(part) - 1
                    if 0 <= idx < len(versions):
                        selected_versions.append(versions[idx])
                    else:
                        invalid.append(part)
                except ValueError:
                    invalid.append(part)
        
        if invalid:
            print(f"❌ Invalid: {', '.join(invalid)}. Please enter valid numbers or shortcodes.")
        elif selected_versions:
            unique_versions = list(dict.fromkeys(selected_versions))
            print(f"✅ Selected: {', '.join([v.upper() for v in unique_versions])}")
            return unique_versions
        else:
            print("❌ Please enter valid numbers or shortcodes separated by commas")

def download_multiple_selected_versions():
    """Download all books from multiple specifically selected translations"""
    versions = select_multiple_versions()
    if not versions:
        return
    
    downloader = BibleGatewayDownloader()
    
    print(f"\n🚀 Starting download for {len(versions)} selected translations...")
    print("-" * 50)
    
    total_success = 0
    total_chapters = 0
    
    for i, version in enumerate(versions, 1):
        print(f"\n{'='*40}")
        print(f"Version {i}/{len(versions)}: {version.upper()}")
        print(f"{'='*40}")
        
        success, total = downloader.download_version(version)
        total_success += success
        total_chapters += total
    
    print(f"\n🎯 Multiple versions download complete!")
    print(f"Total chapters downloaded: {total_success}/{total_chapters}")
    print(f"Success rate: {(total_success/total_chapters*100):.1f}%")

def list_available_books():
    """List all available Bible books with chapter counts"""
    print(f"\n📖 Available Bible Books ({len(BIBLE_BOOKS)} total):")
    print("-" * 60)
    for i, (book, chapters) in enumerate(BIBLE_BOOKS.items(), 1):
        print(f"{i:2d}. {book.title():<15} ({chapters} chapters)")
    print()

def select_version():
    """Let user select a translation by number or shortcode"""
    downloader = BibleGatewayDownloader()
    versions = downloader.load_versions()
    
    if not versions:
        print("❌ No versions found in versions file!")
        return None
    
    print(f"\n📚 Available Translations:")
    print("-" * 30)
    for i, version in enumerate(versions, 1):
        print(f"{i:2d}. {version.upper()}")
    
    while True:
        choice = input(f"\nSelect translation (1-{len(versions)} or shortcode like NIV, ESV): ").strip()
        if choice.lower() in ['q', 'quit', 'exit']:
            return None
        
        choice_lower = choice.lower()
        
        if choice_lower in versions:
            print(f"✅ Selected: {choice.upper()}")
            return choice_lower
        
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(versions):
                selected = versions[idx]
                print(f"✅ Selected: {selected.upper()}")
                return selected
            else:
                print(f"❌ Please enter a number between 1 and {len(versions)} or a valid shortcode")
        except ValueError:
            print("❌ Please enter a valid number or shortcode")

def select_book():
    """Let user select a Bible book"""
    books_list = list(BIBLE_BOOKS.keys())
    
    print(f"\n📖 Available Books:")
    print("-" * 40)
    for i, book in enumerate(books_list, 1):
        print(f"{i:2d}. {book.title()}")
    
    while True:
        try:
            choice = input(f"\nSelect book (1-{len(books_list)}): ").strip()
            if choice.lower() in ['q', 'quit', 'exit']:
                return None
            
            idx = int(choice) - 1
            if 0 <= idx < len(books_list):
                selected = books_list[idx]
                print(f"✅ Selected: {selected.title()}")
                return selected
            else:
                print(f"❌ Please enter a number between 1 and {len(books_list)}")
        except ValueError:
            print("❌ Please enter a valid number")

def download_specific_translation():
    """Download all books from a specific translation"""
    version = select_version()
    if version:
        downloader = BibleGatewayDownloader()
        print(f"\n🚀 Starting download for {version.upper()}...")
        success, total = downloader.download_version(version)
        print(f"\n✅ Download complete: {success}/{total} chapters downloaded")

def download_specific_book():
    """Download specific book from specific translation"""
    print("📖 Select translation:")
    version = select_version()
    if not version:
        return
    
    print("📚 Select book:")
    book = select_book()
    if not book:
        return
    
    downloader = BibleGatewayDownloader()
    chapter_count = BIBLE_BOOKS[book]
    
    print(f"\n🚀 Downloading {book.title()} ({chapter_count} chapters) from {version.upper()}...")
    print("-" * 50)
    
    success_count = 0
    for chapter in range(1, chapter_count + 1):
        verses = downloader.get_chapter_verses(book, chapter, version)
        if verses:
            if downloader.save_chapter(book, chapter, version, verses):
                success_count += 1
                print(f"✅ {book.title()} {chapter}:{version} ({len(verses)} verses)")
            else:
                print(f"❌ Failed to save {book.title()} {chapter}:{version}")
        else:
            print(f"❌ No verses found for {book.title()} {chapter}:{version}")
    
    print(f"\n🎯 Download complete: {success_count}/{chapter_count} chapters downloaded")



def test_main():
    """Test parsing functionality without interactive menu"""
    downloader = BibleGatewayDownloader()
    
    print("🧪 Testing BibleGateway downloader...")
    print("Testing Genesis 1:ESV")
    
    # Test single chapter
    verses = downloader.get_chapter_verses('genesis', 1, 'ESV')
    
    if verses:
        print(f"✅ Success! Found {len(verses)} verses:")
        for verse in verses[:5]:  # Show first 5 verses
            print(f"  Verse {verse['verse']}: {verse['text'][:100]}...")
    else:
        print("❌ No verses found!")
    
    # Test saving
    if verses:
        if downloader.save_chapter('genesis', 1, 'ESV', verses):
            print("✅ Successfully saved test chapter")

def main():
    """Main entry point with interactive menu"""
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description='Download Bible from Bible Gateway')
    parser.add_argument('version', nargs='?', help='Bible version code (e.g., kjv, esv, niv)')
    parser.add_argument('--book', '-b', help='Specific book to download (e.g., genesis or 1)')
    args = parser.parse_args()
    
    if args.version:
        downloader = BibleGatewayDownloader()
        
        book = args.book
        if book:
            try:
                book_num = int(book)
                book = list(BIBLE_BOOKS.keys())[book_num - 1]
            except (ValueError, IndexError):
                pass
            
            if book not in BIBLE_BOOKS:
                print(f"Error: Unknown book '{args.book}'")
                return
            
            print(f"\n🚀 Downloading {args.version} - {book}...")
            success, total = downloader.download_book(args.version, book)
        else:
            print(f"\n🚀 Downloading {args.version}...")
            success, total = downloader.download_version(args.version)
        
        print(f"\n✅ Download complete: {success}/{total} chapters downloaded")
        return
    
    # Check if test mode requested
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        test_main()
        return
    
    while True:
        try:
            display_menu()
            choice = input("\nEnter your choice (1-8): ").strip()
            
            if choice == '1':
                downloader = BibleGatewayDownloader()
                print("\n🚀 Downloading all translations of entire Bible...")
                downloader.download_all()
                
            elif choice == '2':
                download_specific_translation()
                
            elif choice == '3':
                download_multiple_selected_versions()
                
            elif choice == '4':
                download_specific_book()
                
            elif choice == '5':
                list_available_versions()
                
            elif choice == '6':
                list_available_books()
            
            elif choice == '7':
                print("\n↩️  Returning to main menu...")
                break
            
            elif choice == '8':
                print("\n👋 Goodbye!")
                import sys
                sys.exit(10)
                
            else:
                print("❌ Please enter a number between 1 and 8")
                
        except KeyboardInterrupt:
            print("\n\n⚠️  Download interrupted by user")
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
