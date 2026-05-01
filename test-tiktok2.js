const { GetUserPosts, StalkUser } = require('@tobyg74/tiktok-api-dl');

const username = process.argv[2] || 'tiktok';

async function test() {
    console.log(`Test GetUserPosts per @${username}...\n`);

    try {
        const result = await GetUserPosts(username, { count: 3 });
        console.log('Status:', result?.status);
        if (result?.status === 'success') {
            const videos = result.result;
            console.log('Video trovati:', videos?.length);
            if (videos?.length) {
                const v = videos[0];
                console.log('\nUltimo video:');
                console.log('  Keys:', Object.keys(v).join(', '));
                console.log('  ID:', v.id || v.aweme_id);
                console.log('  Desc:', (v.desc || v.description || '').slice(0, 80));
                console.log('  Cover:', v.cover ? 'presente' : 'assente');
                console.log('  Like:', v.diggCount || v.stats?.diggCount);
                console.log('  Views:', v.playCount || v.stats?.playCount);
            }
        } else {
            console.log('Risposta completa:', JSON.stringify(result).slice(0, 800));
        }
    } catch (e) {
        console.log('Errore GetUserPosts:', e.message);
    }
}

test();
