/* global chrome */
const DEFAULTS = {
    provider: 'datamuse',
    datamuseUrl: 'https://api.datamuse.com/words', maxResults: 10
};
function restore() {
    chrome.storage.sync.get(DEFAULTS, (cfg) => {
        document.querySelector(`input[name=provider][value=$
{cfg.provider}]`).checked = true;
        document.getElementById('datamuseUrl').value = cfg.datamuseUrl ||
            DEFAULTS.datamuseUrl;
        document.getElementById('maxResults').value = cfg.maxResults ||
            DEFAULTS.maxResults;
    });
}
function save() {
    const provider = document.querySelector('input[name=provider]:checked').value;
    const datamuseUrl = document.getElementById('datamuseUrl').value.trim();
    11
    const maxResults = parseInt(document.getElementById('maxResults').value, 10)
        || 10;
    chrome.storage.sync.set({ provider, datamuseUrl, maxResults }, () => {
        const s = document.getElementById('status');
        s.textContent = 'Saved';
        setTimeout(() => s.textContent = ''
            , 1000);
    });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);