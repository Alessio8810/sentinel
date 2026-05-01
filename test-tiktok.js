require('dotenv').config();
const axios = require('axios');

const username = process.argv[2] || 'tiktok';
console.log(`Test tikwm.com API per @${username}...`);

// tikwm.com è un'API proxy TikTok gratuita usata da molti bot
axios.get(`https://www.tikwm.com/api/user/posts`, {
    params: { unique_id: username, count: 5, cursor: 0 },
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tikwm.com/' },
    timeout: 15000,
})
    .then(({ data }) => {
        console.log('Status API:', data?.code, data?.msg);
        const videos = data?.data?.videos;
        if (videos?.length) {
            const v = videos[0];
            console.log('✅ Ultimo video:');
            console.log('  ID:', v.video_id);
            console.log('  Desc:', v.title?.slice(0, 80));
            console.log('  URL:', `https://www.tiktok.com/@${username}/video/${v.video_id}`);
            console.log('  Cover:', v.cover ? 'presente' : 'assente');
            console.log('  Like:', v.digg_count);
            console.log('  Views:', v.play_count);
        } else {
            console.log('Risposta completa:', JSON.stringify(data).slice(0, 500));
        }
    })
    .catch(e => console.log('ERRORE:', e.response?.status, e.message));


const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.tiktok.com/',
};

// Inserisci qui il tuo username TikTok (senza @)
const username = process.argv[2] || 'tiktok';

console.log(`Test scraping TikTok per @${username}...`);

axios.get(`https://www.tiktok.com/@${username}`, { headers: BROWSER_HEADERS, timeout: 15000 })
    .then(({ data: html, status }) => {
        console.log('HTTP Status:', status);

        const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
        if (!match) {
            console.log('❌ JSON __UNIVERSAL_DATA_FOR_REHYDRATION__ non trovato nella pagina');
            // Cerca altri script JSON
            const scripts = html.match(/<script[^>]*type="application\/json"[^>]*>/g);
            console.log('Script JSON trovati:', scripts?.length || 0);
            return;
        }

        console.log('✅ JSON trovato, parsing...');
        const json = JSON.parse(match[1]);
        const defaultScope = json?.__DEFAULT_SCOPE__;
        if (!defaultScope) {
            console.log('❌ __DEFAULT_SCOPE__ non trovato');
            console.log('Chiavi root:', Object.keys(json).join(', '));
            return;
        }

        const keys = Object.keys(defaultScope);
        console.log('Chiavi in __DEFAULT_SCOPE__:', keys.join(', '));

        // Estrai secUid da webapp.app-context o dalla pagina HTML grezza
        let secUid = defaultScope?.['webapp.user-detail']?.userInfo?.user?.secUid;
        if (!secUid) {
            const secUidMatch = html.match(/"secUid"\s*:\s*"([^"]+)"/);
            secUid = secUidMatch?.[1];
        }
        if (!secUid) {
            // Cerca in app-context
            const appCtx = defaultScope?.['webapp.app-context'];
            console.log('app-context:', JSON.stringify(appCtx).slice(0, 300));
        }

        console.log('secUid trovato:', secUid ? secUid.slice(0, 30) + '...' : 'NO');

        if (secUid) {
            // Chiama API video diretta
            const apiUrl = `https://www.tiktok.com/api/post/item_list/?aid=1988&count=5&secUid=${encodeURIComponent(secUid)}&cursor=0&app_language=en&device_platform=web_pc`;
            console.log('\nChiamo API video...');
            return axios.get(apiUrl, { headers: { ...BROWSER_HEADERS, 'Referer': `https://www.tiktok.com/@${username}` }, timeout: 15000 })
                .then(({ data }) => {
                    const items = data?.itemList;
                    if (items?.length) {
                        console.log('✅ Video trovati via API:', items.length);
                        const v = items[0];
                        console.log('  ID:', v.id);
                        console.log('  Desc:', v.desc?.slice(0, 80));
                    } else {
                        console.log('API risposta:', JSON.stringify(data).slice(0, 300));
                    }
                });
        }
    })
    .catch(e => {
        console.log('❌ ERRORE HTTP:', e.response?.status || 'nessun response', e.message);
        if (e.response?.status === 403) console.log('TikTok blocca la richiesta (403 Forbidden)');
        if (e.response?.status === 404) console.log('Profilo non trovato (404)');
    });
