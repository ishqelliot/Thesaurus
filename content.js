/* global chrome */
(function () {
    let panelRoot = null; // Shadow root host
    let panelEl = null; // Panel container inside shadow
    let currentWord = '';
    let hideTimer = null;
    // Create shadow DOM panel once
    function ensurePanel() {
        if (panelRoot) return;
        const host = document.createElement('div');
        host.setAttribute('id', 'qt-shadow-host');
        host.style.position = 'fixed';
        host.style.zIndex = 2147483647;
        host.style.top = '0';
        host.style.left = '0';
        host.style.pointerEvents = 'none'; // panel captures events internally only
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent =
            `
.qt-panel {
pointer-events: auto;
font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji;
position: absolute;
background: white;
border: 1px solid rgba(0,0,0,0.1);
box-shadow: 0 8px 30px rgba(0,0,0,0.12);
border-radius: 12px;
padding: 10px 12px;
max-width: 320px;
}
.qt-header { font-size: 12px; opacity: 0.7; margin-bottom: 6px; }
.qt-word { font-weight: 600; }
.qt-list { display: flex; flex-wrap: wrap; gap: 6px; }
.qt-chip {
font-size: 13px;
padding: 4px 8px;
border-radius: 9999px;
border: 1px solid rgba(0,0,0,0.12);
cursor: pointer;
user-select: none;
}
.qt-chip:hover { box-shadow: 0 0 0 2px rgba(0,0,0,0.06) inset; }
.qt-row { display: flex; gap: 8px; align-items: center; justify-content:
space-between; }
.qt-actions { display: flex; gap: 6px; }
.qt-btn { font-size: 12px; padding: 4px 8px; border-radius: 6px; border:
1px solid rgba(0,0,0,0.12); background: #f8f8f8; cursor: pointer; }
.qt-muted { font-size: 12px; opacity: 0.7; }
.qt-close { cursor: pointer; border: none; background: transparent; font-
size: 16px; line-height: 1; padding: 0 4px; }
`;
        panelEl = document.createElement('div');
        panelEl.className = 'qt-panel';
        panelEl.style.display = 'none';
        shadow.appendChild(style);
        shadow.appendChild(panelEl);
        document.documentElement.appendChild(host);
        panelRoot = host;
        // Dismiss when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (!shadow.contains(e.target)) hidePanel();
        }, true);
    }
    function setPanelPosition(rect) {
        ensurePanel();
        const x = Math.min(rect.left + rect.width / 2, window.innerWidth - 20);
        const y = Math.max(rect.top - 8, 10);
        panelEl.style.left =
            `${Math.max(10, x - 160)}px`;
        panelEl.style.top =
            `${y + window.scrollY}px`;
    }
    function showLoading(word) {
        ensurePanel();
        panelEl.innerHTML =
            `
<div class="qt-row">
<div class="qt-header">Synonyms for <span class="qt-word">${escapeHtml(word)}</span></div>
<button class="qt-close" aria-label="Close">×</button>
</div>
<div class="qt-muted">Loading…</div>
`;
        panelEl.style.display = 'block';
        panelEl.querySelector('.qt-close').addEventListener('click', hidePanel);
    }
    function renderSynonyms(word, synonyms) {
        ensurePanel();
        const list = synonyms.map(s => `
            <span class="qt-chip" data-syn="${escapeHtml(s)}">${escapeHtml(s)}</span>`).join('');
        panelEl.innerHTML =
            `
<div class="qt-row">
<div class="qt-header">Synonyms for <span class="qt-word">${escapeHtml(word)}</span></div>
<button class="qt-close" aria-label="Close">×</button>
</div>
${synonyms.length ? `<div class="qt-list">${list}</div>` : `<div
class="qt-muted">No synonyms found.</div>`}
<div class="qt-row" style="margin-top:8px;">
<div class="qt-muted">Tip: click a word to copy</div>
<div class="qt-actions">
<button class="qt-btn" id="qt-copy">Copy word</button>
</div>
</div>
`;
        panelEl.style.display = 'block';
        panelEl.querySelector('.qt-close').addEventListener('click', hidePanel);
        panelEl.querySelectorAll('.qt-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const s = chip.getAttribute('data-syn');
                copyToClipboard(s);
                chip.textContent = s + ' ✓';
                setTimeout(() => { chip.textContent = s; }, 600);
            });
        });
        panelEl.querySelector('#qt-copy')?.addEventListener('click', () =>
            copyToClipboard(word));
        resetAutoHide();
    }
    function hidePanel() {
        // if (panelEl) panelEl.style.display = 'none';
        // currentWord = '';
        clearTimeout(hideTimer);
    }
    function resetAutoHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hidePanel, 6000);
    }
    function getSelectedWord(text) {
        const raw = (text || '').trim();
        if (!raw) return '';
        // Use the last token if a phrase is selected
        const token = raw.split(/\s+/).pop();
        // Only consider alphabetic words
        const clean = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g,
            '');
        return clean;
    }
    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m =>
        ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', '\'': '&#039;'
        }[m]));
    }
    async function lookupAtSelection(forceWord) {
        const sel = window.getSelection();
        const txt = forceWord || (sel ? sel.toString() : '');
        const word = getSelectedWord(txt);
        if (!word || word.length > 40) return;
        // Compute position from range
        let rect = { left: 20, top: 20, width: 0, height: 0 };
        try {
            if (sel && sel.rangeCount) {
                rect = sel.getRangeAt(0).getBoundingClientRect();
            }
        } catch (_) { }
        setPanelPosition(rect);
        showLoading(word);
        currentWord = word;
        chrome.runtime.sendMessage({ type: 'QT_FETCH_SYNONYMS', word }, (res) => {
            if (!res || !res.ok) {
                panelEl.innerHTML = `<div class="qt-muted">Error: ${escapeHtml(res?.error || 'Unknown')}</div>`;
                panelEl.style.display = 'block';
                return;
            }
            // Only show if user hasn’t selected a different word in the meantime
            if (currentWord === word) {
                renderSynonyms(word, res.synonyms || []);
            }
        });
    }

    function copyToClipboard(text) {
        try {
            navigator.clipboard.writeText(text);
        } catch (_) {
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            document.execCommand('copy');
            ta.remove();
        }
    }
    // Listen for selection events: mouseup and keyup (for keyboard selection)
    let selectTimer = null;
    function onSelectionChange() {
        clearTimeout(selectTimer);
        selectTimer = setTimeout(() => {
            const sel = window.getSelection();
            const text = sel ? sel.toString() : '';
            if (text && text.trim().length) {
                lookupAtSelection();
            } else {
                hidePanel();
            }
        }, 120);
    }
    document.addEventListener('mouseup', onSelectionChange);
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            onSelectionChange();
        }
    });
    // Receive context‑menu initiated lookups
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'QT_LOOKUP_FROM_CONTEXT' && msg.text) {
            lookupAtSelection(msg.text);
        }
    });
})();