/* global chrome */
async function fetchSynonyms(word) {
    const settings = await new Promise((resolve) => chrome.storage.sync.get(null,
        resolve));
    const url = new URL(settings.datamuseUrl || 'https://api.datamuse.com/words');
    url.searchParams.set('rel_syn', word);
    url.searchParams.set('max', String(settings.maxResults || 10));
    const res = await fetch(url.toString());
    const data = await res.json();
    return (data || []).map(x => x.word);
}
document.getElementById('go').addEventListener('click', async () => {
    const input = document.getElementById('word');
    const word = (input.value || '').trim();
    const results = document.getElementById('results');
    results.textContent = 'Loading…';
    try {
        const syns = await fetchSynonyms(word);
        console.log("syns", syns, syns.map(s => `<span class="chip">${s}</
span>`).join(''));

        results.innerHTML = syns.map(s => `<span class="chip">${s}</
span>`).join('');
    } catch (e) {
        results.textContent = 'Error fetching synonyms';
    }
});