#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/options.cfg"

VERSION=""
VERSIONS=()
SOURCE=""
BOOK=""
YES_TO_ALL=false

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        CUSTOM_VERSIONS=$(grep -i "^custom_versions" "$CONFIG_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d ' ')
        if [[ -n "$CUSTOM_VERSIONS" ]]; then
            echo "$CUSTOM_VERSIONS"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

load_custom_versions() {
    local in_custom_section=false
    local versions=()
    local current_lang=""
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo ""
        return
    fi
    
    while IFS= read -r line; do
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        if [[ "$line" == "[custom_versions]" ]]; then
            in_custom_section=true
            continue
        elif [[ "$line" == "["*"]" ]]; then
            if [[ "$in_custom_section" == true ]]; then
                current_lang=$(echo "$line" | sed 's/^\[//;s/\]$//')
            fi
            continue
        fi
        
        if [[ "$in_custom_section" == true ]] && [[ -n "$line" ]]; then
            # Format: version, source, "Full Name"
            local version=$(echo "$line" | cut -d',' -f1 | tr -d ' ')
            local source=$(echo "$line" | cut -d',' -f2 | tr -d ' ')
            local comment=$(echo "$line" | cut -d',' -f3- | sed 's/^[[:space:]]*//;s/^"//;s/"$//')
            if [[ -n "$version" && -n "$source" ]]; then
                local full_comment="$current_lang - $comment"
                versions+=("$version:$source:$full_comment")
            fi
        fi
    done < "$CONFIG_FILE"
    
    if [[ ${#versions[@]} -gt 0 ]]; then
        printf '%s\n' "${versions[@]}"
    else
        echo ""
    fi
}

update_versions_json() {
    local version_code="$1"
    local full_info="$2"
    
    if [[ -z "$version_code" || -z "$full_info" ]]; then
        return
    fi
    
    local language="${full_info%% - *}"
    local name="${full_info#* - }"
    
    local versions_json="$SCRIPT_DIR/../public/txt_bibles/versions.json"
    
    if [[ ! -f "$versions_json" ]]; then
        echo '{}' > "$versions_json"
    fi
    
    if grep -q "\"$version_code\"" "$versions_json" 2>/dev/null; then
        return
    fi
    
    local temp_file=$(mktemp)
    
    if grep -q "\"$language\"" "$versions_json" 2>/dev/null; then
        python3 -c "
import json
with open('$versions_json', 'r') as f:
    data = json.load(f)
if '$language' not in data.get('languages', {}):
    data.setdefault('languages', {})['$language'] = {}
data['languages']['$language']['$version_code'] = '$name'
with open('$temp_file', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
" 2>/dev/null
    else
        python3 -c "
import json
with open('$versions_json', 'r') as f:
    data = json.load(f)
data.setdefault('languages', {})['$language'] = {'$version_code': '$name'}
with open('$temp_file', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
" 2>/dev/null
    fi
    
    if [[ -f "$temp_file" ]]; then
        mv "$temp_file" "$versions_json"
    fi
}

get_config_value() {
    local key="$1"
    local default="$2"
    if [[ -f "$CONFIG_FILE" ]]; then
        local value=$(grep -i "^${key}=" "$CONFIG_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d ' ')
        if [[ -n "$value" ]]; then
            echo "$value"
            return
        fi
    fi
    echo "$default"
}

show_help() {
    echo "Bible Downloader - Command Line Interface"
    echo ""
    echo "Usage: ./launch.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -1, --site-versions      Download custom versions (from options.cfg)"
    echo "  -y, --yes                Skip confirmation prompts"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./launch.sh --site-versions                # Download custom versions"
    echo "  ./launch.sh --site-versions -y              # Download without prompt"
    echo ""
    echo "Config file: $CONFIG_FILE"
}

print_header() {
    echo ""
    echo "=============================================================="
    echo "  📖 BIBLE DOWNLOADER to JSON & TXT"
    echo "=============================================================="
    echo ""
}

print_menu() {
    echo "  Downloading CUSTOM VERSIONS from options.cfg..."
}

run_action() {
    case $1 in
        blueletter)
            cd "$SCRIPT_DIR/app_files"
            if [[ ${#VERSIONS[@]} -gt 0 ]]; then
                echo "  ► Downloading from BlueLetterBible: ${VERSIONS[*]}${BOOK:+ (book: $BOOK)}"
                for ver in "${VERSIONS[@]}"; do
                    echo "  ▸ Pulling $ver..."
                    ARGS="-v $ver"
                    [[ -n "$BOOK" ]] && ARGS="$ARGS -b $BOOK"
                    python3 bible_blueletter_downloader.py $ARGS 2>/dev/null || echo "    ⚠ $ver not available"
                done
            else
                echo "  ► Running BlueLetterBible pull (interactive)..."
                python3 bible_blueletter_downloader.py
            fi
            ;;
        biblegateway)
            cd "$SCRIPT_DIR/app_files"
            if [[ ${#VERSIONS[@]} -gt 0 ]]; then
                echo "  ► Downloading from BibleGateway: ${VERSIONS[*]}${BOOK:+ (book: $BOOK)}"
                for ver in "${VERSIONS[@]}"; do
                    echo "  ▸ Pulling $ver..."
                    ARGS="$ver"
                    [[ -n "$BOOK" ]] && ARGS="$ARGS --book $BOOK"
                    python3 bible_gateway_downloader.py $ARGS 2>/dev/null || echo "    ⚠ $ver not available"
                done
            else
                echo "  ► Running BibleGateway pull (interactive)..."
                python3 bible_gateway_downloader.py
            fi
            ;;
        site-versions)
            echo "  ► DOWNLOADING https://bible.armorofgod.life Bible versions to TXT..."
            echo ""
            
            mapfile -t MY_VERSIONS < <(load_custom_versions)
            
            if [[ ${#MY_VERSIONS[@]} -eq 0 ]] || [[ -z "${MY_VERSIONS[0]}" ]]; then
                echo "  No versions configured in options.cfg"
                return
            fi
            
            # Initialize all versions as selected (1 = selected)
            declare -A selected
            for version in "${MY_VERSIONS[@]}"; do
                selected["$version"]=1
            done
            
            # Interactive selection loop
            while true; do
                echo "  Select versions to download (dl_bible-bl-bg/options.cfg):"
                echo "  ───────────────────────────────────────────────"
                local idx=1
                for version in "${MY_VERSIONS[@]}"; do
                    trans="${version%%:*}"
                    rest="${version#*:}"
                    source="${rest%%:*}"
                    full_info="${rest#*:}"
                    
                    if [[ "$full_info" == "$source" ]]; then
                        full_info=""
                    fi
                    
                    local marker="[ ]"
                    if [[ "${selected[$version]}" -eq 1 ]]; then
                        marker="[✓]"
                    fi
                    
                    if [[ -n "$full_info" ]]; then
                        printf "    %2d %s %-8s (%s) [from %s]\n" "$idx" "$marker" "$trans" "$full_info" "$source"
                    else
                        printf "    %2d %s %-8s [from %s]\n" "$idx" "$marker" "$trans" "$source"
                    fi
                    ((idx++))
                done
                echo ""
                echo "    a - All/None"
                echo "    c - Continue to download"
                echo "    q - Cancel"
                echo ""
                
                read -p "  Choice [c]: " choice
                choice=$(echo "$choice" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
                
                if [[ "$choice" == "q" || "$choice" == "quit" ]]; then
                    echo "  Cancelled."
                    return
                elif [[ "$choice" == "c" || "$choice" == "" ]]; then
                    break
                elif [[ "$choice" == "a" || "$choice" == "all" ]]; then
                    # Toggle all
                    local all_selected=1
                    for version in "${MY_VERSIONS[@]}"; do
                        if [[ "${selected[$version]}" -eq 0 ]]; then
                            all_selected=0
                            break
                        fi
                    done
                    for version in "${MY_VERSIONS[@]}"; do
                        if [[ "$all_selected" -eq 1 ]]; then
                            selected["$version"]=0
                        else
                            selected["$version"]=1
                        fi
                    done
                elif [[ "$choice" =~ ^[0-9]+$ ]]; then
                    if [[ "$choice" -ge 1 && "$choice" -le ${#MY_VERSIONS[@]} ]]; then
                        local i=1
                        for version in "${MY_VERSIONS[@]}"; do
                            if [[ "$i" -eq "$choice" ]]; then
                                if [[ "${selected[$version]}" -eq 1 ]]; then
                                    selected["$version"]=0
                                else
                                    selected["$version"]=1
                                fi
                                break
                            fi
                            ((i++))
                        done
                    fi
                fi
                echo ""
            done
            
            # Build final list of selected versions
            local FINAL_VERSIONS=()
            for version in "${MY_VERSIONS[@]}"; do
                if [[ "${selected[$version]}" -eq 1 ]]; then
                    FINAL_VERSIONS+=("$version")
                fi
            done
            
            if [[ ${#FINAL_VERSIONS[@]} -eq 0 ]]; then
                echo "  No versions selected."
                return
            fi
            
            echo ""
            echo "  Downloading ${#FINAL_VERSIONS[@]} versions..."
            
            for version in "${FINAL_VERSIONS[@]}"; do
                trans="${version%%:*}"
                rest="${version#*:}"
                source="${rest%%:*}"
                full_info="${rest#*:}"
                
                if [[ "$full_info" == "$source" ]]; then
                    full_info=""
                fi
                
                echo "  ▸ Pulling $trans from $source..."
                
                case $source in
                    "blueletterbible")
                        cd "$SCRIPT_DIR/app_files"
                        python3 bible_blueletter_downloader.py -v "$trans" 2>/dev/null || echo "    ⚠ $trans not available in BlueLetterBible"
                        ;;
                    "biblegateway")
                        cd "$SCRIPT_DIR/app_files"
                        python3 bible_gateway_downloader.py "$trans" 2>/dev/null || echo "    ⚠ $trans not available in BibleGateway"
                        ;;
                esac
                
                if [[ -n "$full_info" ]]; then
                    update_versions_json "$trans" "$full_info"
                fi
            done
            
            echo ""
            echo "  ► Converting to TXT format..."
            cd "$SCRIPT_DIR/app_files"
            python3 convert_bibles_json_to_txt.py
            
            echo ""
            echo "  ✓ Done! Output in bible_downloads/txt_bibles/"
            ;;
        convert)
            echo "  ► Converting JSON Bibles to TXT format..."
            cd "$SCRIPT_DIR/app_files"
            python3 convert_bibles_json_to_txt.py
            echo ""
            echo "  ✓ Done! Output in bible_downloads/txt_bibles/"
            ;;
    esac
}

ACTION=""

if [[ $# -eq 0 ]]; then
    while true; do
        print_header
        print_menu
        read -p "  Enter your choice [1-6]: " choice
        echo ""
        
        case $choice in
            1) run_action "site-versions" ;;
            2) show_help; echo "" ;;
            3) echo "  Exiting."; exit 0 ;;
            *) echo "  ✕ Invalid option: $choice"; echo "" ;;
        esac
    done
else
    while [[ $# -gt 0 ]]; do
        case $1 in
            -1|--site-versions)
                ACTION="site-versions"
                shift
                ;;
            -y|--yes)
                YES_TO_ALL=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    if [[ -n "$ACTION" ]]; then
        run_action "$ACTION"
    fi
fi

