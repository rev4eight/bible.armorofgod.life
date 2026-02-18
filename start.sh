#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting OFFLINE HOLY BIBLE from https://bible.armorofgod.life ..."

echo "Starting CORS proxy for Ollama on port 11436..."
node proxy.js > /dev/null 2>&1 &
PROXY_PID=$!

sleep 1

echo "Starting web server on port 8001..."
cd public
python3 -m http.server 8001 > /dev/null 2>&1 &
WEB_PID=$!

cleanup() {
    kill $PROXY_PID $WEB_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

cd "$SCRIPT_DIR"

echo ""
echo "[+] Running!"
echo "   - Bible web app: http://localhost:8001"
echo "   - Ollama Proxy: http://localhost:11436"

# Show current versions
echo ""
echo "Current versions installed:"
for lang_dir in public/txt_bibles/*/; do
    if [ -d "$lang_dir" ]; then
        lang_name=$(basename "$lang_dir")
        versions=$(ls -d "$lang_dir"*/ 2>/dev/null | xargs -n1 basename | tr '\n' ',' | sed 's/,$//')
        echo "  - $lang_name: $versions"
    fi
done

# Load version descriptions from options.cfg
load_version_descs() {
    local config_file="dl_bible-bl-bg/options.cfg"
    declare -gA version_descs
    
    if [[ -f "$config_file" ]]; then
        local in_custom_section=false
        local current_lang=""
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
                if [[ -n "$version" && -n "$comment" ]]; then
                    version_descs["$version"]="${version^^} - $comment"
                fi
            fi
        done < "$config_file"
    fi
}

load_version_descs

# Language names with native script
declare -gA language_names_native
language_names_native["english"]="English"
language_names_native["hebrew"]="עברית"
language_names_native["greek"]="Ελληνικά"
language_names_native["spanish"]="Español"
language_names_native["french"]="Français"
language_names_native["japanese"]="日本語"
language_names_native["chinese"]="中文"
language_names_native["arabic"]="العربية"
language_names_native["korean"]="한국어"
language_names_native["russian"]="Русский"
language_names_native["filipino"]="Tagalog"
language_names_native["hindi"]="हिन्दी"
language_names_native["ukrainian"]="Українська"

VERSIONS_FILE="public/txt_bibles/versions.json"
if [ -f "$VERSIONS_FILE" ]; then
    
    get_expected() {
        case "$1" in 
            english) echo 66;;
            hebrew) echo 39;;
            greek) echo 27;;
            arabic) echo 66;;
            spanish) echo 66;;
            french) echo 66;;
            chinese) echo 66;;
            japanese) echo 66;;
            korean) echo 66;;
            russian) echo 66;;
            filipino) echo 66;;
            hindi) echo 66;;
            ukrainian) echo 66;;
            *) echo 0;;
        esac
    }
    
    # Remove deleted versions and languages
    for lang in $(jq -r '.languages | keys[]' "$VERSIONS_FILE"); do
        dir=$(echo "$lang" | tr '[:upper:]' '[:lower:]' | sed 's/ ע.*//' | sed 's/ ε.*//')
        if [ -d "public/txt_bibles/$dir" ]; then
            for v in $(jq -r ".languages[\"$lang\"] | keys[]" "$VERSIONS_FILE"); do
                if [ ! -d "public/txt_bibles/$dir/$v" ]; then
                    jq --arg l "$lang" --arg v "$v" 'del(.languages[$l][$v])' "$VERSIONS_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSIONS_FILE"
                    echo "[-] Removed $lang:$v"
                fi
            done
            # Remove language if empty
            if [ -z "$(jq -r ".languages[\"$lang\"] | keys[]" "$VERSIONS_FILE")" ]; then
                jq --arg l "$lang" 'del(.languages[$l])' "$VERSIONS_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSIONS_FILE"
                echo "[-] Removed language: $lang"
            fi
        else
            # Language directory doesn't exist, remove entire language
            jq --arg l "$lang" 'del(.languages[$l])' "$VERSIONS_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSIONS_FILE"
            echo "[-] Removed language: $lang (directory not found)"
        fi
    done
    
    # Add/update versions from directories
    for lang_dir in public/txt_bibles/*/; do
        [ -d "$lang_dir" ] || continue
        lang=$(basename "$lang_dir")
        lang_cap=$(echo "$lang" | sed 's/^./\U&/')
        
        for ver_dir in "$lang_dir"*/; do
            [ -d "$ver_dir" ] || continue
            ver=$(basename "$ver_dir")
            count=$(ls "$ver_dir"*.txt 2>/dev/null | wc -l)
            expected=$(get_expected "$lang")
            
            desc="${version_descs[$ver]:-$(echo "$ver" | tr '[:lower:]' '[:upper:]')}"
            if [ "$expected" -gt 0 ] && [ "$count" -lt "$expected" ]; then
                desc="$desc [$count/$expected]"
            fi
            
            jq --arg l "$lang_cap" --arg v "$ver" --arg d "$desc" '.languages[$l][$v] = $d' "$VERSIONS_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSIONS_FILE"
        done
    done
    
    # Update languageNames for all languages present
    for lang in $(jq -r '.languages | keys[]' "$VERSIONS_FILE"); do
        lang_key=$(echo "$lang" | tr '[:upper:]' '[:lower:]' | sed 's/ ע.*//' | sed 's/ ε.*//' | sed 's/ א.*//')
        native_name="${language_names_native[$lang_key]:-$lang}"
        jq --arg l "$lang" --arg n "$native_name" '.languageNames[$l] = $n' "$VERSIONS_FILE" > tmp.$$.json && mv tmp.$$.json "$VERSIONS_FILE"
    done
fi

echo ""
if ! [ -t 0 ]; then
    echo "Download additional Bibles now? (skipped - not interactive)"
else
    read -p "Download additional Bibles now? [Y/n]: " -r
    if [[ "$REPLY" =~ ^[Yy]$ || -z "$REPLY" ]]; then
        if [ -f "./dl_bible-bl-bg/launch.sh" ]; then
            bash ./dl_bible-bl-bg/launch.sh -1
        fi
        
        # Only prompt restart if user chose to download
        if [ -t 0 ]; then
            read -p "Restart server to load new versions? [Y/n]: " -r
            if [[ "$REPLY" =~ ^[Yy]$ || -z "$REPLY" ]]; then
                exec "$0"
            fi
        fi
    fi
fi

echo ""
echo "Press Ctrl+C to stop all servers"

# Stay running - sleep in foreground so Ctrl+C works
sleep 365d & wait
