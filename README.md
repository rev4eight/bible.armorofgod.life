# bible.armorofgod.life - On or Offline Bible Study App with AI Cloud Worker & Local Ollama (DBA1)

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-yellow" alt="JavaScript">
  <img src="https://img.shields.io/badge/HTML5-E34F26" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6" alt="CSS3">
  <img src="https://img.shields.io/badge/Node.js-339933?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-3.x-blue?logo=python" alt="Python">
</p>

An offline-capable, multi-language Bible study application with AI-powered scripture analysis, split-view translation comparison, and a built-in Bible downloader. No build tools, no frameworks -- just open and study.

**Live site:** [bible.armorofgod.life](https://bible.armorofgod.life)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Bible Versions](#bible-versions)
- [Downloading New Bibles](#downloading-new-bibles)
- [AI Integration](#ai-integration)
- [How to Use](#how-to-use)
- [Development](#development)

---

## Quick Start

### Requirements

- **Node.js** (for CORS proxy)
- **Python 3** (for web server and Bible downloaders)
- **Ollama** (optional, for local AI -- see [AI Integration](#ai-integration))

### Start the Application

```bash
./start.sh
```

This single command:
1. Starts the CORS proxy for Ollama on port **11436**
2. Starts the web server on port **8001**
3. Auto-syncs `versions.json` with installed Bible versions on disk
4. Shows installed versions and their completeness
5. Optionally prompts to download additional Bible versions

Then open: **http://localhost:8001**

### Manual Start

```bash
# Terminal 1: CORS proxy
node proxy.js

# Terminal 2: Web server
cd public && python3 -m http.server 8001
```

---

## Features

### Bible Reading
- **66 Books** -- Complete Old and New Testament navigation
- **Multi-Language** -- English, Hebrew, Greek, Spanish, French, Japanese, Chinese, Arabic, Korean, Russian, Filipino, Hindi, Ukrainian, and more
- **Original Languages** -- Read the Hebrew Bible (WLC) and Greek New Testament (NA28-UBS5) in their original scripts with RTL support
- **Reading Progress** -- Automatically saves your last book, chapter, and version

### Split View
- Compare two translations side-by-side
- Each panel has its own version selector
- Navigation stays synchronized across both panels
- Resizable panels with drag handle

### AI Assistant (DBA1)
- **Two AI providers** -- Local (Ollama) or Cloud (Cloudflare Workers AI)
- **Scripture-grounded** -- AI is instructed to only analyze the currently loaded chapter text; it will not hallucinate or cite external verses
- **Configurable** -- Temperature, Top P, Top K, max tokens, and custom system prompts
- **Conversation history** -- Maintains context across questions within a session
- **Model selection** -- Choose from any models available on your Ollama instance or cloud endpoint

### Interface
- **Dark / Light theme** with persistent preference
- **Verse highlighting** -- Click to highlight words, drag to highlight selections, right-click for copy and color options
- **PWA support** -- Installable as a standalone app on mobile and desktop
- **Responsive** -- Works on desktop, tablet, and mobile with touch-optimized interactions
- **Resizable panels** -- Sidebar and AI chat panel widths are draggable and saved

### Bible Downloader
- Built-in downloader fetches Bibles from **BibleGateway** and **BlueLetterBible**
- Interactive version selector with checkbox UI
- Configurable via `dl_bible-bl-bg/options.cfg`
- Auto-converts downloaded JSON to the plain-text format used by the app
- `versions.json` is automatically updated on startup

---

## Project Structure

```
├── start.sh                         # Master startup script
├── proxy.js                         # Node.js CORS proxy (port 11436 → Ollama 11434)
├── README.md
│
├── public/                          # Web application root (served on port 8001)
│   ├── index.html                   # SPA entry point with inline PWA manifest
│   ├── assets/
│   │   ├── css/
│   │   │   ├── styles.css           # Core layout and component styles
│   │   │   ├── light-theme.css      # Light theme colors
│   │   │   └── dark-theme.css       # Dark theme colors
│   │   ├── js/
│   │   │   ├── app.js               # App init, event wiring, AI provider toggle
│   │   │   ├── bibleLoader.js       # Bible file loading, parsing, caching
│   │   │   ├── navigation.js        # Book/chapter navigation, verse rendering
│   │   │   ├── chat.js              # AI chat: Ollama + Cloud, system prompt
│   │   │   ├── models.js            # AI model fetching and selection
│   │   │   ├── state-ui-utils.js    # Global state, DOM refs, theme, resize
│   │   │   ├── versionDropdown.js   # Dynamic version dropdown from versions.json
│   │   │   ├── splitView.js         # Side-by-side translation comparison
│   │   │   └── highlighting.js      # Verse highlighting and context menu
│   │   └── img/
│   │       └── favicon.png
│   └── txt_bibles/                  # Bible text data
│       ├── versions.json            # Registry of installed versions (auto-synced)
│       ├── english/ylt/             # 66 books - Young's Literal Translation
│       ├── hebrew/
│       │   ├── wlc/                 # 39 OT books - Westminster Leningrad Codex
│       │   └── wlc_book-names.txt   # Hebrew book name mappings
│       └── greek/na28-ubs5/         # 27 NT books - Greek New Testament
│
└── dl_bible-bl-bg/                  # Bible downloader subsystem
    ├── launch.sh                    # Interactive download CLI
    ├── options.cfg                  # Download config: versions, sources, settings
    └── app_files/
        ├── bible_gateway_downloader.py      # BibleGateway scraper
        ├── bible_blueletter_downloader.py   # BlueLetterBible scraper
        ├── convert_bibles_json_to_txt.py    # JSON → TXT converter
        ├── version_languages.py             # Version-to-language mapping (100+ versions)
        └── biblegateway-versions-available.txt  # Reference list of BG versions
```

---

## How It Works

### Data Flow

```
User selects Book → Chapter
         │
         ▼
navigation.loadChapter()
         │
         ▼
bibleLoader.loadBook(bookNum)
         │
         ├──► Cache hit → return cached data
         │
         └──► Fetch:  txt_bibles/{language}/{version}/{num}-{book}-{version}.txt
                  │
                  ▼
             Parse text (one verse per line: "BookName Ch:Vs Text")
                  │
                  ▼
             Cache + render verses in UI
```

### Bible Text File Format

Each book is a single `.txt` file with one verse per line:

```
Genesis 1:1 In the beginning God created the heavens and the earth.
Genesis 1:2 And the earth was without form and void...
```

With optional section titles in parentheses:

```
Genesis 1:1 (The Beginning) In the beginning God created the heavens and the earth.
```

Files are named: `{book-number}-{book-name}-{version}.txt`
Examples: `01-genesis-ylt.txt`, `40-matthew-na28-ubs5.txt`

### Startup Sync

When `start.sh` runs, it:
1. Scans all `public/txt_bibles/{language}/{version}/` directories
2. Removes entries from `versions.json` for deleted versions
3. Adds new entries for versions found on disk
4. Marks versions as `[INCOMPLETE]` if they have fewer books than expected
5. Updates native language names (Hebrew → עברית, Greek → Ελληνικά, etc.)

---

## Bible Versions

### Included

| Language | Version | Books | Description |
|----------|---------|-------|-------------|
| English | YLT | 66 | Young's Literal Translation |
| Hebrew | WLC | 39 | Westminster Leningrad Codex (Old Testament) |
| Greek | NA28-UBS5 | 27 | Nestle-Aland / UBS Greek New Testament |

The **Original Languages** option (WLC/UBS5) in the version dropdown automatically uses Hebrew for OT books (1-39) and Greek for NT books (40-66).

### Adding Versions Manually

1. Create folder: `public/txt_bibles/{language}/{version}/`
2. Add text files: `{NN}-{book-name}-{version}.txt`
3. Restart the app -- `start.sh` auto-detects and registers new versions

---

## Downloading New Bibles

### Using the Built-in Downloader

The app includes a downloader that scrapes from BibleGateway and BlueLetterBible.

**Interactive download on startup:**
```bash
./start.sh
# When prompted "Download additional Bibles now?" → press Y
# Select versions from the checklist → press C to download
```

**Direct download:**
```bash
cd dl_bible-bl-bg
./launch.sh --site-versions
```

### Configuring Versions

Edit `dl_bible-bl-bg/options.cfg` to add or remove versions:

```ini
[custom_versions]

[English]
csb, biblegateway, Christian Standard Bible
esv, biblegateway, English Standard Version
niv, biblegateway, New International Version

[Spanish]
lbla, biblegateway, La Biblia de Las Américas

[French]
ls, blueletterbible, Louis Segond

[Korean]
kor, blueletterbible, Korean Version
```

Format: `version_code, source, Full Name`

Sources: `biblegateway` or `blueletterbible`

### Download Settings

Also in `options.cfg`:

```ini
[DEFAULT]
auto_convert_to_txt=true    # Auto-convert JSON downloads to TXT
request_delay=2             # Seconds between HTTP requests
max_retries=3               # Retry failed downloads
output_dir="../../public/"  # Where to save Bible files
```

---

## AI Integration

### Option 1: Local AI with Ollama (Recommended)

Ollama runs AI models locally on your machine for private, offline Bible study.

**Install Ollama:**

| Platform | Command |
|----------|---------|
| macOS | `brew install ollama` |
| Linux | `curl -fsSL https://ollama.com/install.sh \| sh` |
| Windows | [Download installer](https://ollama.com/download/windows) |

**Pull a model:**
```bash
ollama pull llama3.2:3b    # Recommended (4GB, 8GB+ RAM)
ollama pull llama3.2:1b    # Lightweight (2GB, minimal RAM)
ollama pull llama3.1:8b    # More capable (5GB, 16GB+ RAM)
```

**Start Ollama:**
```bash
ollama serve               # Runs on localhost:11434
```

The app's CORS proxy (`proxy.js`) automatically forwards requests from the browser to Ollama.

**Configure in the app:**
1. Click 🤖 to open the AI panel
2. Click ⚙️ for settings
3. Enter Ollama URL (default: `http://localhost:11434`)
4. Select a model from the dropdown

### Option 2: Cloud AI

1. Click ⚙️ in the AI panel
2. Enter your API URL and API password
3. Click the cloud icon (☁️) to switch to cloud mode
4. The app validates credentials before connecting

Default cloud endpoint: `https://ai-web-dba1.armorofgod.life`

### AI Behavior

The AI assistant (DBA1) is configured with strict scholarly guardrails:
- **Only analyzes the currently loaded chapter** -- will not cite external verses
- **Never hallucinates** -- responds "I don't know" when uncertain
- **Full verse references** for every claim
- **Custom prompts** -- override the default system prompt in settings

---

## How to Use

### Navigation
- **Open book menu** -- Click 📖 in the header (mobile: tap chapter title)
- **Select a book** -- Click to expand, then click a chapter number
- **Prev/Next** -- Arrow buttons in header and bottom nav
- **HOLY BIBLE title** -- Click to collapse menu and scroll to top

### Version Switching
- Click the version dropdown in the header
- Versions are grouped by language with native script names
- The dropdown shows shortcodes when closed, full names when open

### Split View
1. Click ➕ in the sidebar to open split view
2. Each panel gets its own version dropdown
3. Click ➖ or ✕ to close

### Highlighting
- **Desktop:** Click a word to highlight it, drag to highlight a selection
- **Desktop:** Right-click highlighted text for copy/color options
- **Mobile:** Long-press a verse for the context menu
- Click a highlighted word again to remove the highlight

### Theme
- Click ☀️/🌙 in the sidebar to toggle dark/light mode

---

## Development

### Architecture Notes

- **No build step** -- Pure ES6 modules loaded natively by the browser
- **No npm dependencies** for the frontend -- zero `node_modules`
- **State management** -- Single `chatState` object in `state-ui-utils.js`
- **localStorage** -- Persists theme, last position, AI settings, chat history, panel widths, split panel versions
- **Cache** -- `BibleLoader` caches parsed book data in memory, clears on version change

### Running Locally

```bash
./start.sh
```

### Key Files to Edit

| What | Where |
|------|-------|
| Add UI elements | `public/index.html` |
| Change styles | `public/assets/css/styles.css` |
| App initialization | `public/assets/js/app.js` |
| Bible loading logic | `public/assets/js/bibleLoader.js` |
| AI chat behavior | `public/assets/js/chat.js` |
| Add a new language mapping | `public/assets/js/bibleLoader.js` (language directory lookup) |
| Configure downloadable versions | `dl_bible-bl-bg/options.cfg` |

---

<p align="center">
  <strong>Happy Bible Studying!</strong><br>
  May this tool help you grow in understanding of Scripture.
</p>
