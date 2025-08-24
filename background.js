/* global chrome */
const DEFAULT_SETTINGS = {
    provider: 'datamuse',
    datamuseUrl: 'https://api.datamuse.com/words',
    maxResults: 10
};
// Ensure settings exist
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
        chrome.storage.sync.set(Object.assign({}, DEFAULT_SETTINGS, stored));
    });

    // Create context menu item
    chrome.contextMenus.create({
        id: 'quick-thesaurus-lookup',
        title: 'Find synonyms for "%s"',
        contexts: ['selection']
    });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'quick-thesaurus-lookup' && info.selectionText) {
        chrome.tabs.sendMessage(tab.id, {
            type: 'QT_LOOKUP_FROM_CONTEXT',
            text: info.selectionText
        });
    }
});
// Fetch synonyms in the background to avoid CORS pitfalls in some sites
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.type === 'QT_FETCH_SYNONYMS') {
            const word = (message.word || '').trim();
            if (!word) return sendResponse({ ok: false, error: 'Empty word' });
            const settings = await new Promise((resolve) => {
                chrome.storage.sync.get(DEFAULT_SETTINGS, resolve);
            });
            try {
                if (settings.provider === 'datamuse') {
                    const url = new URL(settings.datamuseUrl);
                    url.searchParams.set('rel_syn', word);
                    url.searchParams.set('max', String(settings.maxResults || 10));
                    const res = await fetch(url.toString());
                    if (!res.ok) throw new Error('Network error');
                    const data = await res.json();
                    const synonyms = (data || []).map(x => x.word).filter(Boolean);
                    return sendResponse({ ok: true, synonyms });
                }
                return sendResponse({ ok: false, error: 'Unknown provider' });
            } catch (err) {
                return sendResponse({ ok: false, error: err.message || String(err) });
            }
        }
    })();
    // Keep the message channel open for async sendResponse
    return true;
});