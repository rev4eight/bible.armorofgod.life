import { getBrightness } from './state-ui-utils.js';

let isHighlighting = false;
let currentContextMenu = null;
let currentHighlight = null;
let contextMenuTimeout = null;

export function highlightSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) return;
    
    console.log('Highlighting text:', selectedText);
    
    let element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer;
    
    const verseContainer = element.closest('.verse');
    if (!verseContainer) return;
    
    // Constrain selection to the verse container only
    const verseRange = document.createRange();
    verseRange.selectNodeContents(verseContainer);
    
    // Check if selection is actually within this verse
    const selectionStart = range.startContainer;
    const selectionEnd = range.endContainer;
    
    if (!verseContainer.contains(selectionStart) || !verseContainer.contains(selectionEnd)) {
        console.log('Selection spans beyond verse, ignoring');
        selection.removeAllRanges();
        return;
    }
    
    // Only use the original range, don't extend to full verse
    try {
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'highlight';
        highlightSpan.title = 'Right-click for options';
        highlightSpan.dataset.isSelectionHighlight = 'true';
        
        range.surroundContents(highlightSpan);
        
        highlightSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            removeHighlight(highlightSpan);
        });
        
        selection.removeAllRanges();
        
    } catch (e) {
        console.error('Could not highlight selection:', e);
    }
}

export function removeHighlight(highlightElement) {
    const parent = highlightElement.parentNode;
    
    const fragment = document.createDocumentFragment();
    
    while (highlightElement.firstChild) {
        fragment.appendChild(highlightElement.firstChild);
    }
    
    parent.replaceChild(fragment, highlightElement);
    
    parent.normalize();
}

export function showContextMenu(x, y, targetElement) {
    hideContextMenu();
    
    currentHighlight = targetElement;
    
    const isHighlightedText = targetElement.classList.contains('highlight');
    const isSingleClickHighlight = isHighlightedText && 
        targetElement.title === 'Right-click for options' &&
        (!targetElement.dataset.isSelectionHighlight || targetElement.dataset.createdTime);
    
    let menuHTML = `
        <div class="context-menu-item" data-action="copy">
            <span class="context-menu-icon">📋</span>
            <span>COPY</span>
        </div>
        <!--
        <div class="context-menu-item" data-action="play">
            <span class="context-menu-icon">▶️</span>
            <span>PLAY</span>
        </div>
        -->
    `;
    
    if (isHighlightedText) {
        let colorMenuItem = '';
        if (!isSingleClickHighlight) {
            colorMenuItem = `
                <div class="context-menu-item" data-action="change-color">
                    <span class="context-menu-icon">🎨</span>
                    <span>CHANGE COLOR</span>
                </div>
            `;
        }
        
        menuHTML = `
            <div class="context-menu-item" data-action="copy">
                <span class="context-menu-icon">📋</span>
                <span>COPY</span>
            </div>
            ${colorMenuItem}
            <!--
            <div class="context-menu-item" data-action="play">
                <span class="context-menu-icon">▶️</span>
                <span>PLAY</span>
            </div>
            -->
        `;
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = menuHTML;
    
    document.body.appendChild(menu);
    currentContextMenu = menu;
    
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = x;
    let top = y;
    
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height - 10;
    }
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.display = 'block';
    
    menu.addEventListener('click', handleContextMenuClick);
    
    contextMenuTimeout = setTimeout(() => {
        hideContextMenu();
    }, 10000);
}

export function showColorSubMenu(changeColorMenuItem) {
    const contextMenu = changeColorMenuItem.closest('.context-menu');
    const existingColorItems = contextMenu.querySelectorAll('.color-submenu-item');
    
    if (existingColorItems.length > 0) {
        return;
    }
    
    const colors = [
        { name: 'Red', value: '#FF0000' },
        { name: 'Green', value: '#00FF00' },
        { name: 'Yellow', value: '#FFFF00' },
        { name: 'Blue', value: '#0000FF' },
        { name: 'Cyan', value: '#00FFFF' },
        { name: 'Magenta', value: '#FF00FF' },
        { name: 'White', value: '#FFFFFF' },
        { name: 'Orange', value: '#FFA500' },
        { name: 'Gray', value: '#808080' },
        { name: 'Black', value: '#000000' }
    ];
    
    const colorItems = colors.map(color => `
        <div class="context-menu-item color-submenu-item" data-color="${color.value}" style="
            display: flex;
            align-items: center;
            padding-left: 36px;
        ">
            <span class="color-swatch" style="
                width: 16px;
                height: 16px;
                border-radius: 2px;
                margin-right: 10px;
                border: 1px solid ${color.value === '#FFFFFF' ? '#ccc' : 'transparent'};
                background-color: ${color.value};
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                display: inline-block;
            "></span>
            <span>${color.name}</span>
        </div>
    `).join('');
    
    changeColorMenuItem.insertAdjacentHTML('afterend', colorItems);
    
    const colorMenuItems = contextMenu.querySelectorAll('.color-submenu-item');
    colorMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const newColor = item.dataset.color;
            
            if (currentHighlight) {
                if (!currentHighlight.dataset.originalColor) {
                    currentHighlight.dataset.originalColor = window.getComputedStyle(currentHighlight).color;
                }
                
                currentHighlight.style.backgroundColor = newColor;
                
                const brightness = getBrightness(newColor);
                if (brightness > 128) {
                    currentHighlight.style.color = 'black';
                } else {
                    currentHighlight.style.color = 'white';
                }
                
                const verseRefs = currentHighlight.querySelectorAll('.verse-ref');
                verseRefs.forEach(ref => {
                    ref.style.color = currentHighlight.dataset.originalColor;
                });
            }
            
            hideContextMenu();
        });
    });
}

export function hideContextMenu() {
    if (contextMenuTimeout) {
        clearTimeout(contextMenuTimeout);
        contextMenuTimeout = null;
    }
    if (currentContextMenu) {
        currentContextMenu.remove();
        currentContextMenu = null;
        currentHighlight = null;
    }
}

function showCopySuccess(targetElement) {
    const menuItem = targetElement.closest('.context-menu-item');
    if (menuItem) {
        // Store original content
        const originalHTML = menuItem.innerHTML;
        const originalBg = menuItem.style.backgroundColor;
        const originalColor = menuItem.style.color;
        
        // Update to show success
        menuItem.innerHTML = `
            <span class="context-menu-icon">✓</span>
            <span>COPIED</span>
        `;
        menuItem.style.backgroundColor = '#4CAF50';
        menuItem.style.color = 'white';
        
        // Restore after a short delay
        setTimeout(() => {
            if (menuItem && menuItem.parentNode) {
                menuItem.innerHTML = originalHTML;
                menuItem.style.backgroundColor = originalBg;
                menuItem.style.color = originalColor;
            } else {
                // If menu is gone, just hide it
                hideContextMenu();
            }
        }, 1000);
    }
}

function handleContextMenuClick(e) {
    e.stopPropagation();
    
    const action = e.target.closest('.context-menu-item')?.dataset.action;
    if (!action) return;
    
    switch (action) {
        case 'copy':
            console.log('Copy action triggered, currentHighlight:', currentHighlight);
            
            // Find the correct highlight element
            let highlightElement = null;
            if (currentHighlight) {
                if (currentHighlight.classList.contains('highlight')) {
                    highlightElement = currentHighlight;
                } else {
                    highlightElement = currentHighlight.closest('.highlight');
                }
            }
            
            console.log('Found highlight element:', highlightElement);
            
            if (highlightElement && highlightElement.classList.contains('highlight')) {
                // Get clean text content
                let textToCopy = '';
                
                // Method 1: Try to get text directly from highlight
                textToCopy = highlightElement.textContent.trim();
                
                // Method 2: If that doesn't work well, try cloning and cleaning
                if (!textToCopy || textToCopy.length === 0) {
                    const clonedElement = highlightElement.cloneNode(true);
                    // Remove any verse reference spans from the clone
                    const verseRefs = clonedElement.querySelectorAll('.verse-ref');
                    verseRefs.forEach(ref => ref.remove());
                    textToCopy = clonedElement.textContent.trim();
                }
                
                console.log('Copying highlighted text:', textToCopy);
                
                if (textToCopy) {
                    console.log('Attempting to copy:', textToCopy);
                    
                    // Use a more robust copy method
                    try {
                        // Fallback for browsers that don't support clipboard API
                        if (!navigator.clipboard) {
                            const textArea = document.createElement('textarea');
                            textArea.value = textToCopy;
                            textArea.style.position = 'fixed';
                            textArea.style.left = '-999999px';
                            textArea.style.top = '-999999px';
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            showCopySuccess(e.target);
                        } else {
                            navigator.clipboard.writeText(textToCopy).then(() => {
                                console.log('Copy successful');
                                showCopySuccess(e.target);
                            }).catch(err => {
                                console.error('Clipboard API failed, trying fallback:', err);
                                // Fallback method
                                const textArea = document.createElement('textarea');
                                textArea.value = textToCopy;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                textArea.style.top = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                showCopySuccess(e.target);
                            });
                        }
                    } catch (err) {
                        console.error('Failed to copy text:', err);
                        hideContextMenu();
                    }
                } else {
                    console.log('No text to copy');
                    hideContextMenu();
                }
            } else {
                // Fallback: copy the entire verse if no highlight found
                if (currentHighlight) {
                    const verseRef = currentHighlight.querySelector('.verse-ref');
                    const verseText = currentHighlight.querySelector('.verse-text');
                    const refText = verseRef ? verseRef.textContent.trim() : '';
                    const textContent = verseText ? verseText.textContent.trim() : '';
                    const fallbackText = `${refText} ${textContent}`.trim();
                    
                    console.log('Copying fallback text:', fallbackText);
                    
                    if (fallbackText) {
                        try {
                            if (!navigator.clipboard) {
                                const textArea = document.createElement('textarea');
                                textArea.value = fallbackText;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                textArea.style.top = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                showCopySuccess(e.target);
                            } else {
                                navigator.clipboard.writeText(fallbackText).then(() => {
                                    console.log('Fallback copy successful');
                                    showCopySuccess(e.target);
                                }).catch(err => {
                                    console.error('Fallback copy failed:', err);
                                    hideContextMenu();
                                });
                            }
                        } catch (err) {
                            console.error('Failed to copy fallback text:', err);
                            hideContextMenu();
                        }
                    } else {
                        console.log('No fallback text to copy');
                        hideContextMenu();
                    }
                } else {
                    console.log('No currentHighlight and no fallback available');
                    hideContextMenu();
                }
            }
            break;
        case 'change-color':
            console.log('Change color clicked, currentHighlight:', currentHighlight);
            if (currentHighlight && currentHighlight.classList.contains('highlight')) {
                console.log('Showing color picker for highlight');
                showColorSubMenu(e.target.closest('.context-menu-item'));
            } else {
                console.log('No valid highlight found for color picker');
            }
            break;
        case 'play':
            console.log('PLAY functionality not yet implemented');
            if (currentHighlight) {
                const verseRef = currentHighlight.querySelector('.verse-ref');
                const verseText = currentHighlight.querySelector('.verse-text');
                const refText = verseRef ? verseRef.textContent : '';
                const textContent = verseText ? verseText.textContent : '';
                console.log('Would play full verse:', `${refText} ${textContent}`);
            }
            hideContextMenu();
            break;
        default:
            hideContextMenu();
            break;
    }
}

export function setupHighlighting() {
    // Check if on actual mobile device (has touch capability), not just mobile viewport
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Mobile: Setup long-press context menu for verses (no highlighting)
    if (isMobile) {
        let longPressTimer = null;
        let longPressTarget = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let isTouchMoving = false;
        let hasSelection = false;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                isTouchMoving = false;
                hasSelection = false;
                
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                const verseContainer = element?.closest('.verse');
                
                if (verseContainer) {
                    longPressTarget = verseContainer;
                    
                    longPressTimer = setTimeout(() => {
                        // Only show menu if:
                        // 1. Touch hasn't moved significantly
                        // 2. There's NO system selection (user is NOT highlighting)
                        // 3. Timer still exists (wasn't cancelled)
                        const selection = window.getSelection();
                        const selectedText = selection?.toString().trim();
                        
                        if (longPressTimer && !isTouchMoving && longPressTarget && (!selectedText || selectedText.length === 0)) {
                            console.log('Mobile long-press: showing context menu');
                            currentHighlight = longPressTarget;
                            showContextMenu(touch.clientX, touch.clientY, longPressTarget);
                        }
                        longPressTimer = null;
                        longPressTarget = null;
                    }, 500); // 500ms long press
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - touchStartX);
                const deltaY = Math.abs(touch.clientY - touchStartY);
                
                // Mark as moving if finger moves more than 5px
                if (deltaX > 5 || deltaY > 5) {
                    isTouchMoving = true;
                }
                
                // Cancel long-press immediately if finger moves
                if (longPressTimer && (deltaX > 5 || deltaY > 5)) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                    longPressTarget = null;
                }
                
                // Clear any existing selection when moving (user is highlighting)
                const selection = window.getSelection();
                if (selection && selection.toString().trim().length > 0) {
                    hasSelection = true;
                    selection.removeAllRanges();
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                longPressTarget = null;
            }
            isTouchMoving = false;
        }, { passive: true });
        
        // Prevent context menu on verses - but allow if there's active selection (menu was already triggered)
        document.addEventListener('contextmenu', (e) => {
            const verseContainer = e.target.closest('.verse');
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();
            
            // Only prevent context menu if no selection and no existing menu
            if (verseContainer && !selectedText && !currentContextMenu) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Close menu on tap elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                hideContextMenu();
            }
        });
        
        // Close menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideContextMenu();
            }
        });
        
        console.log('Mobile context menu setup complete');
        return;
    }
    
    // Desktop: Full highlighting setup
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    document.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging && (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5)) {
            return;
        }
    });

    document.addEventListener('mouseup', (e) => {
        // Skip single-word highlighting on right-click (only left click for highlighting)
        if (e.button === 2) return;
        
        setTimeout(() => {
            isDragging = false;
        }, 10);
        
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText) {
            // Check if selection is within any verses container (main or split panels)
            const versesContainers = document.querySelectorAll('.verses-container');
            let isWithinVerses = false;
            
            for (let container of versesContainers) {
                if (selection.rangeCount > 0 && container.contains(selection.getRangeAt(0).commonAncestorContainer)) {
                    isWithinVerses = true;
                    break;
                }
            }
            
            if (isWithinVerses) {
                setTimeout(() => {
                    if (selectedText) {
                        highlightSelection();
                    }
                }, 10);
            }
        } else {
            const clickTarget = e.target;
            
            const verseText = clickTarget.closest('.verse-text');
            const isVerseRef = clickTarget.closest('.verse-ref');
            const isAlreadyHighlighted = clickTarget.closest('.highlight');
            const hasTextContent = clickTarget.textContent && clickTarget.textContent.trim().length > 0;
            
            if (verseText && !isVerseRef && !isAlreadyHighlighted && hasTextContent) {
                let targetToHighlight = clickTarget;
                
                if (clickTarget.nodeType === Node.TEXT_NODE) {
                    const range = document.createRange();
                    range.selectNodeContents(clickTarget);
                    
                    const highlightSpan = document.createElement('span');
                    highlightSpan.className = 'highlight';
                    highlightSpan.title = 'Right-click for options';
                    
                    range.surroundContents(highlightSpan);
                    
                    highlightSpan.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeHighlight(highlightSpan);
                    });
                    
                    targetToHighlight = highlightSpan;
                } else {
                    const textNode = targetToHighlight.firstChild;
                    
                    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                        const text = textNode.textContent;
                        
                        const tempRange = document.createRange();
                        tempRange.selectNode(textNode);
                        const rect = tempRange.getBoundingClientRect();
                        
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        
                        let caretPosition = 0;
                        if (document.caretPositionFromPoint) {
                            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                            if (pos && pos.offsetNode === textNode) {
                                caretPosition = pos.offset;
                            }
                        } else if (document.caretRangeFromPoint) {
                            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                            if (range && range.startContainer === textNode) {
                                caretPosition = range.startOffset;
                            }
                        } else {
                            caretPosition = Math.floor((clickX / rect.width) * text.length);
                        }
                        
                        let wordStart = caretPosition;
                        let wordEnd = caretPosition;
                        
                        while (wordStart > 0 && text[wordStart - 1] !== ' ' && text[wordStart - 1] !== '\n') {
                            wordStart--;
                        }
                        
                        while (wordEnd < text.length && text[wordEnd] !== ' ' && text[wordEnd] !== '\n') {
                            wordEnd++;
                        }
                        
                        if (wordStart < wordEnd && text.substring(wordStart, wordEnd).trim()) {
                            const range = document.createRange();
                            range.setStart(textNode, wordStart);
                            range.setEnd(textNode, wordEnd);
                            
                            const highlightSpan = document.createElement('span');
                            highlightSpan.className = 'highlight';
                            highlightSpan.title = 'Right-click for options';
                            highlightSpan.dataset.createdTime = Date.now().toString();
                            
                            range.surroundContents(highlightSpan);
                            
                            highlightSpan.addEventListener('click', (e) => {
                                e.stopPropagation();
                                removeHighlight(highlightSpan);
                            });
                            
                            targetToHighlight = highlightSpan;
                        }
                    }
                }
            }
        }
    });

    document.addEventListener('contextmenu', (e) => {
        const highlightTarget = e.target.closest('.highlight');
        const verseContainer = e.target.closest('.verse');
        
        if (highlightTarget || verseContainer) {
            e.preventDefault();
            const targetElement = highlightTarget || verseContainer;
            
            if (highlightTarget) {
                currentHighlight = highlightTarget;
            } else if (verseContainer) {
                currentHighlight = verseContainer;
            }
            
            showContextMenu(e.clientX, e.clientY, targetElement);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            hideContextMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.verse-text') && !e.target.classList.contains('highlight')) {
            window.getSelection().removeAllRanges();
        }
        
        if (!e.target.closest('.highlight') && !e.target.closest('.verse-ref') && !e.target.closest('.context-menu')) {
            const allHighlights = document.querySelectorAll('.highlight');
            allHighlights.forEach(highlight => {
                if (!highlight.dataset.isSelectionHighlight) {
                    const createdTime = parseInt(highlight.dataset.createdTime || '0');
                    const now = Date.now();
                    if (now - createdTime > 200) {
                        removeHighlight(highlight);
                    }
                }
            });
        }
    });
}

export function reinitializeHighlighting() {
    // Since highlighting uses document-level event listeners with closest() methods,
    // it should automatically work with new content. This function is for
    // any additional setup needed for dynamic content.
    console.log('Reinitializing highlighting for dynamic content');
}
