#!/usr/bin/env python3
"""
Convert JSON Bible files to text format matching the ESV .txt file format.

Expected input structure:
  json_bibles/{language}/{translation}/esv_{book_number}-{book_name}/esv_{book_number}-{book_name}_chapter-{chapter_number}.json

Expected output structure:
  bibles/{language}/{translation}/{book_number:02d}-{book_name}-{translation}.txt

Output format per line:
  NNNNN| BookName Chapter:Verse Text
"""

import os
import json
import re
import sys
import configparser
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

def get_config_value(key, default):
    try:
        return config.get('DEFAULT', key, fallback=default)
    except:
        return default

script_dir = Path(__file__).parent.parent
sys.path.insert(0, str(script_dir))
try:
    from version_languages import get_language_for_version
    HAS_VERSION_LANGUAGES = True
except ImportError:
    HAS_VERSION_LANGUAGES = False

AUTO_CONVERT_TO_TXT = os.environ.get('AUTO_CONVERT_TO_TXT', get_config_value('auto_convert_to_txt', 'true')).lower() == 'true'
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', get_config_value('output_dir', 'bible_downloads')).strip('"').strip("'")

def resolve_output_dir(output_subpath=''):
    """Resolve output directory - absolute paths used as-is, relative paths resolved from cwd."""
    if os.path.isabs(OUTPUT_DIR):
        base = Path(OUTPUT_DIR)
    else:
        base = Path.cwd() / OUTPUT_DIR
    if output_subpath:
        return base / output_subpath
    return base

LANGUAGES = ['arabic', 'bulgarian', 'chinese', 'croatian', 'czech', 'danish', 'dutch', 'english', 'finnish', 'french', 'german', 'greek', 'hebrew', 'hindi', 'hungarian', 'indonesian', 'italian', 'japanese', 'korean', 'latin', 'norwegian', 'polish', 'portuguese', 'romanian', 'russian', 'serbian', 'spanish', 'swedish', 'filipino', 'tamil', 'telugu', 'thai', 'turkish', 'ukrainian', 'vietnamese']

def get_language_for_translation(translation):
    """Get language for a translation, trying version_languages first, then falling back to defaults"""
    if HAS_VERSION_LANGUAGES:
        try:
            lang = get_language_for_version(translation)
            if lang in LANGUAGES:
                return lang
        except Exception:
            pass
    
    fallback_map = {
        'bbe': 'english', 'kjv': 'english', 'nkjv': 'english', 'nlt': 'english', 'niv': 'english',
        'esv': 'english', 'csb': 'english', 'nasb95': 'english', 'nasb20': 'english', 'nasb': 'english',
        'lsb': 'english', 'amp': 'english', 'net': 'english', 'rsv': 'english', 'asv': 'english',
        'ylt': 'english', 'dby': 'english', 'web': 'english', 'hnv': 'english',
        'vul': 'latin', 'wlc': 'hebrew', 'lxx': 'greek', 'mgnt': 'greek', 'na28': 'greek', 'tr': 'greek',
        'svd': 'arabic', 'nav': 'arabic', 'bes': 'english', 'rst': 'russian', 'se': 'swedish',
        'cht': 'chinese', 'em': 'german', 'kor': 'korean', 'ls': 'french', 'lut': 'german',
        'rvr09': 'spanish', 'rvr60': 'spanish', 'ukr': 'ukrainian', 'fsv': 'filipino',
        'abtag1978': 'filipino', 'abtag2001': 'filipino', 'adb1905': 'filipino', 'snd': 'filipino',
    }
    return fallback_map.get(translation.lower(), 'english')

BOOK_NAME_MAP = {
    'genesis': 'Genesis',
    'exodus': 'Exodus',
    'leviticus': 'Leviticus',
    'numbers': 'Numbers',
    'deuteronomy': 'Deuteronomy',
    'joshua': 'Joshua',
    'judges': 'Judges',
    'ruth': 'Ruth',
    '1-samuel': '1 Samuel',
    '2-samuel': '2 Samuel',
    '1-kings': '1 Kings',
    '2-kings': '2 Kings',
    '1-chronicles': '1 Chronicles',
    '2-chronicles': '2 Chronicles',
    'ezra': 'Ezra',
    'nehemiah': 'Nehemiah',
    'esther': 'Esther',
    'job': 'Job',
    'psalms': 'Psalms',
    'proverbs': 'Proverbs',
    'ecclesiastes': 'Ecclesiastes',
    'song-of-solomon': 'Song of Solomon',
    'isaiah': 'Isaiah',
    'jeremiah': 'Jeremiah',
    'lamentations': 'Lamentations',
    'ezekiel': 'Ezekiel',
    'daniel': 'Daniel',
    'hosea': 'Hosea',
    'joel': 'Joel',
    'amos': 'Amos',
    'obadiah': 'Obadiah',
    'jonah': 'Jonah',
    'micah': 'Micah',
    'nahum': 'Nahum',
    'habakkuk': 'Habakkuk',
    'zephaniah': 'Zephaniah',
    'haggai': 'Haggai',
    'zechariah': 'Zechariah',
    'malachi': 'Malachi',
    'matthew': 'Matthew',
    'mark': 'Mark',
    'luke': 'Luke',
    'john': 'John',
    'acts': 'Acts',
    'romans': 'Romans',
    '1-corinthians': '1 Corinthians',
    '2-corinthians': '2 Corinthians',
    'galatians': 'Galatians',
    'ephesians': 'Ephesians',
    'philippians': 'Philippians',
    'colossians': 'Colossians',
    '1-thessalonians': '1 Thessalonians',
    '2-thessalonians': '2 Thessalonians',
    '1-timothy': '1 Timothy',
    '2-timothy': '2 Timothy',
    'titus': 'Titus',
    'philemon': 'Philemon',
    'hebrews': 'Hebrews',
    'james': 'James',
    '1-peter': '1 Peter',
    '2-peter': '2 Peter',
    '1-john': '1 John',
    '2-john': '2 John',
    '3-john': '3 John',
    'jude': 'Jude',
    'revelation': 'Revelation'
}

OT_BOOKS = set(range(1, 40))
NT_BOOKS = set(range(40, 67))

def get_book_type(book_nums):
    """Determine if a translation has all 66 books, only OT (39), or only NT (27)"""
    has_ot = bool(book_nums & OT_BOOKS)
    has_nt = bool(book_nums & NT_BOOKS)
    
    if has_ot and has_nt:
        return 'all'  # 66 books
    elif has_ot and not has_nt:
        return 'ot'  # 39 books
    elif has_nt and not has_ot:
        return 'nt'  # 27 books
    else:
        return 'unknown'

def get_starting_book(book_type):
    """Get the starting book number based on book type"""
    if book_type == 'all':
        return 1   # genesis
    elif book_type == 'ot':
        return 1  # genesis
    elif book_type == 'nt':
        return 40  # matthew
    return 1

def get_ending_book(book_type):
    """Get the ending book number based on book type"""
    if book_type == 'all':
        return 66  # revelation
    elif book_type == 'ot':
        return 39  # malachi
    elif book_type == 'nt':
        return 66  # revelation
    return 66

def extract_book_info(dir_name):
    """Extract book number and name from directory name like 'esv_01-genesis'"""
    parts = dir_name.split('_')
    if len(parts) >= 2:
        book_num = parts[1].split('-')[0]
        book_name = '-'.join(parts[1].split('-')[1:])
        return int(book_num), book_name
    return None, None

def extract_book_info_from_filename(filename):
    """Extract book number and name from flat filename like '40-matthew-na28-ubs5.json' or '40_matthew.json'"""
    base = filename.replace('.json', '')
    
    if '-' in base:
        parts = base.split('-')
        if len(parts) >= 3:
            try:
                book_num = int(parts[0])
                translation = parts[-1]
                book_key = '-'.join(parts[1:-1])
                return book_num, book_key
            except ValueError:
                pass
    elif '_' in base:
        parts = base.split('_')
        if len(parts) >= 2:
            try:
                book_num = int(parts[0])
                book_key = '_'.join(parts[1:])
                return book_num, book_key
            except ValueError:
                pass
    
    return None, None

BOOK_ABBREV_MAP = {
    'genesis': ['Gen'],
    'exodus': ['Ex', 'Exo'],
    'leviticus': ['Lev'],
    'numbers': ['Num'],
    'deuteronomy': ['Deu', 'Deut'],
    'joshua': ['Jos'],
    'judges': ['Jdg', 'Jue'],
    'ruth': ['Rth', 'Rut'],
    '1-samuel': ['1Sa', 'Sa', 'Sam'],
    '2-samuel': ['2Sa', 'Sa', 'Sam'],
    '1-kings': ['Ki', 'Rey'],
    '2-kings': ['2Ki', 'Ki', 'Rey'],
    '1-chronicles': ['1Ch', 'Ch'],
    '2-chronicles': ['2Ch', 'Ch'],
    'ezra': ['Esd', 'Ezr'],
    'nehemiah': ['Neh'],
    'esther': ['Est'],
    'job': ['Job'],
    'psalms': ['Psa', 'Sal'],
    'proverbs': ['Pro', 'Prov'],
    'ecclesiastes': ['Ecc', 'Ecl'],
    'song-of-solomon': ['Sng', 'Cant'],
    'isaiah': ['Isa'],
    'jeremiah': ['Jer'],
    'lamentations': ['Lam'],
    'ezekiel': ['Eze', 'Ezeq'],
    'daniel': ['Dan'],
    'hosea': ['Hos', 'Os'],
    'joel': ['Joe', 'Joel'],
    'amos': ['Amo'],
    'obadiah': ['Abd', 'Oba'],
    'jonah': ['Jon'],
    'micah': ['Mic', 'Miq'],
    'nahum': ['Nah'],
    'habakkuk': ['Hab'],
    'zephaniah': ['Sof', 'Zep'],
    'haggai': ['Hag'],
    'zechariah': ['Zac', 'Zec'],
    'malachi': ['Mal'],
    'matthew': ['Mat'],
    'mark': ['Mar'],
    'luke': ['Luc', 'Luk'],
    'john': ['Jhn', 'Juan'],
    'acts': ['Act', 'Hech'],
    'romans': ['Rom'],
    '1-corinthians': ['1Co', 'Co', 'Cor'],
    '2-corinthians': ['2Co', 'Co', 'Cor'],
    'galatians': ['Gal'],
    'ephesians': ['Ef', 'Eph'],
    'philippians': ['Fil', 'Phl'],
    'colossians': ['Col'],
    '1-thessalonians': ['1Th', 'Th', 'Tes'],
    '2-thessalonians': ['2Th', 'Th', 'Tes'],
    '1-timothy': ['1Ti', 'Ti', 'Tim'],
    '2-timothy': ['2Ti', 'Ti', 'Tim'],
    'titus': ['Tit', 'Tito'],
    'philemon': ['Filem', 'Phm'],
    'hebrews': ['Heb'],
    'james': ['Jas', 'Sant'],
    '1-peter': ['Pe', 'Ped'],
    '2-peter': ['Pe', 'Ped'],
    '1-john': ['1Jo', 'Jo', 'Jn'],
    '2-john': ['2Jo', 'Jo', 'Jn'],
    '3-john': ['3Jo', 'Jo', 'Jn'],
    'jude': ['Jde'],
    'revelation': ['Apoc', 'Rev'],
}

def clean_verse_text(text):
    """Clean verse text by removing duplicate headings and footnote markers"""
    cleaned = text

    # Pattern 1: Remove footnote markers like (A)(B)(C) that appear inside parentheses headings
    # Match patterns like: (Heading Text(A)(B)(C))
    import re
    cleaned = re.sub(r'\(([^)]*\([A-Z][^)]*\))+\)', lambda m: clean_parenthetical_heading(m.group()), cleaned)

    # Pattern 2: Remove duplicate heading text that appears after closing parenthesis
    # Match: (Heading) Heading Duplicate Text...
    # This captures the heading in parentheses and the repeated text after
    cleaned = re.sub(
        r'\(([^)]+)\)\s*\1\s+',
        lambda m: f'({clean_parenthetical_heading(m.group(1))}) ',
        cleaned
    )

    return cleaned


def clean_parenthetical_heading(heading):
    """Clean a parenthetical heading by removing footnote markers like (A)(B)(C)"""
    import re
    # Remove footnote markers like (A), (B), (C), etc. that are NOT the main content
    # These are single uppercase letters or short sequences inside parentheses
    cleaned = re.sub(r'\([A-Z](?:\([^)]*\))*\)(?:\([A-Z](?:\([^)]*\))*\))*', '', heading)
    # Clean up any remaining extra parentheses with just single letters
    cleaned = re.sub(r'\([A-Z]\)\s*', '', cleaned)
    return cleaned.strip()


def process_opengnt_file(data, chapter_file):
    """Process OpenGNT format JSON file (single file per book with all chapters)"""
    book_number = data.get('book_number')
    book_name = data.get('book_name', '')
    book_key = book_name.lower().replace(' ', '-')
    
    VERSE_NUMBER_MAP = {
        'matthew': 'Matthew', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
        'acts': 'Acts', 'romans': 'Romans', '1-corinthians': '1 Corinthians',
        '2-corinthians': '2 Corinthians', 'galatians': 'Galatians', 'ephesians': 'Ephesians',
        'philippians': 'Philippians', 'colossians': 'Colossians', '1-thessalonians': '1 Thessalonians',
        '2-thessalonians': '2 Thessalonians', '1-timothy': '1 Timothy', '2-timothy': '2 Timothy',
        'titus': 'Titus', 'philemon': 'Philemon', 'hebrews': 'Hebrews', 'james': 'James',
        '1-peter': '1 Peter', '2-peter': '2 Peter', '1-john': '1 John', '2-john': '2 John',
        '3-john': '3 John', 'jude': 'Jude', 'revelation': 'Revelation'
    }
    
    lines = []
    chapters = data.get('chapters', {})
    
    for chapter_num in sorted(chapters.keys(), key=int):
        chapter_data = chapters[chapter_num]
        verses = chapter_data.get('verses', {})
        
        for verse_num in sorted(verses.keys(), key=int):
            verse_text = verses[verse_num]
            if isinstance(verse_text, dict):
                verse_text = verse_text.get('text', '')
            
            verse_text = clean_verse_text(verse_text)
            if not verse_text:
                continue
            
            full_book_name = VERSE_NUMBER_MAP.get(book_key, book_name)
            verse_line = f"{book_number:05d}| {full_book_name} {chapter_num}:{verse_num} {verse_text}"
            lines.append(verse_line)
    
    return lines


def process_chapter_file(chapter_file):
    """Process a single chapter JSON file and return list of formatted lines"""
    with open(chapter_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    lines = []
    
    if 'chapters' in data:
        return process_opengnt_file(data, chapter_file)
    
    chapter = data['chapter']
    book_name = BOOK_NAME_MAP.get(data['book'], data['book'].title())
    book_first = book_name.split()[0] if book_name else ""
    book_abbrev = book_first[:3]
    
    text_abbrevs = BOOK_ABBREV_MAP.get(data['book'], [book_abbrev])
    
    for verse_data in data['verses']:
        verse = verse_data['verse']
        text = clean_verse_text(verse_data['text'])
        
        # Build patterns for all possible abbreviations
        all_patterns = []
        for abbrev in text_abbrevs:
            all_patterns.append(f"{abbrev} {chapter}:")
        
        alt_abbrev_patterns = [
            f"Ch {chapter}:",
            f"Chr {chapter}:",
            f"Co {chapter}:",
        ]
        
        matched = False
        for pattern in all_patterns + alt_abbrev_patterns:
            if text.startswith(pattern):
                match_text = text[len(pattern):].lstrip()
                space_pos = match_text.find(' ')
                if space_pos > 0:
                    verse_in_text = match_text[:space_pos]
                    remainder = match_text[space_pos+1:].lstrip()
                    if remainder.startswith('- '):
                        remainder = remainder[2:].lstrip()
                    lines.append(f"{book_name} {chapter}:{verse_in_text} {remainder}")
                else:
                    lines.append(f"{book_name} {chapter}:{verse} {text}")
                matched = True
                break
        
        if not matched:
            lines.append(f"{book_name} {chapter}:{verse} {text}")
    
    return lines

def detect_books(json_path):
    """Detect which books exist in a translation and return metadata"""
    book_nums = set()
    
    book_dirs = [d for d in os.listdir(json_path) if os.path.isdir(os.path.join(json_path, d))]
    json_files = [f for f in os.listdir(json_path) if f.endswith('.json') and os.path.isfile(os.path.join(json_path, f))]
    
    if book_dirs:
        for book_dir in book_dirs:
            book_num, _ = extract_book_info(book_dir)
            if book_num:
                book_nums.add(book_num)
    elif json_files:
        for json_file in json_files:
            book_num, _ = extract_book_info_from_filename(json_file)
            if book_num:
                book_nums.add(book_num)
    
    book_type = get_book_type(book_nums)
    starting_book = get_starting_book(book_type)
    ending_book = get_ending_book(book_type)
    
    return {
        'book_type': book_type,
        'books': sorted(book_nums),
        'total_books': len(book_nums),
        'starting_book': starting_book,
        'ending_book': ending_book
    }

def convert_translation(language, translation, json_base, bible_base):
    """Convert all books for a specific language and translation"""
    json_path = os.path.join(json_base, language, translation)
    bible_path = os.path.join(bible_base, language, translation)
    
    if not os.path.exists(json_path):
        print(f"  Skipping {language}/{translation} - not found")
        return
    
    os.makedirs(bible_path, exist_ok=True)
    
    metadata = detect_books(json_path)
    book_type = metadata['book_type']
    starting_book = metadata['starting_book']
    
    print(f"  Detected {metadata['total_books']} books ({book_type}) - starting from book {starting_book}")
    
    book_dirs = sorted([d for d in os.listdir(json_path) if os.path.isdir(os.path.join(json_path, d))])
    json_files = sorted([f for f in os.listdir(json_path) if f.endswith('.json') and os.path.isfile(os.path.join(json_path, f))])
    
    if book_dirs:
        for book_dir in book_dirs:
            book_num, book_key = extract_book_info(book_dir)
            if book_num is None:
                print(f"  Skipping invalid directory: {book_dir}")
                continue
            
            if book_num < starting_book:
                continue
            
            chapter_files = sorted([
                f for f in os.listdir(os.path.join(json_path, book_dir))
                if f.endswith('.json')
            ])
            
            output_filename = f"{book_num:02d}-{book_key}-{translation}.txt"
            output_file = os.path.join(bible_path, output_filename)
            
            all_lines = []
            for chapter_file in chapter_files:
                chapter_path = os.path.join(json_path, book_dir, chapter_file)
                lines = process_chapter_file(chapter_path)
                all_lines.extend(lines)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(all_lines) + '\n')
            
            print(f"  Created {output_filename} ({len(all_lines)} verses)")
    
    elif json_files:
        books_processed = {}
        for json_file in json_files:
            book_num, book_key = extract_book_info_from_filename(json_file)
            if book_num is None:
                print(f"  Skipping invalid file: {json_file}")
                continue
            
            if book_num < starting_book:
                continue
            
            if book_num not in books_processed:
                books_processed[book_num] = {'book_key': book_key, 'lines': []}
            
            chapter_path = os.path.join(json_path, json_file)
            lines = process_chapter_file(chapter_path)
            books_processed[book_num]['lines'].extend(lines)
        
        for book_num in sorted(books_processed.keys()):
            book_key = books_processed[book_num]['book_key']
            all_lines = books_processed[book_num]['lines']
            
            output_filename = f"{book_num:02d}-{book_key}-{translation}.txt"
            output_file = os.path.join(bible_path, output_filename)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(all_lines) + '\n')
            
            print(f"  Created {output_filename} ({len(all_lines)} verses)")

def main():
    json_base = resolve_output_dir('json_bibles')
    bible_base = resolve_output_dir('txt_bibles')
    
    print("Converting JSON Bibles to text format...")
    
    for language in LANGUAGES:
        lang_path = os.path.join(json_base, language)
        if not os.path.exists(lang_path):
            continue
        
        translations = [d for d in os.listdir(lang_path) if os.path.isdir(os.path.join(lang_path, d))]
        
        for translation in sorted(translations):
            print(f"Processing {language}/{translation}...")
            convert_translation(language, translation, json_base, bible_base)
    
    print("\nConversion complete!")

if __name__ == '__main__':
    main()
