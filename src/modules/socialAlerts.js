const cron = require('node-cron');
const axios = require('axios');
const Parser = require('rss-parser');
const { EmbedBuilder } = require('discord.js');
const Guild = require('../database/models/Guild');
const logger = require('../utils/logger');

const rssParser = new Parser({ timeout: 10000 });

// ── BROWSER HEADLESS (TikTok anti-bot bypass) ─────────────────────────────────

async function launchBrowser() {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--single-process',
        ],
    };
    // Su Railway/Linux usa Chromium di sistema per evitare download 300MB
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    return puppeteer.launch(launchOptions);
}

// ── TWITCH ────────────────────────────────────────────────────────────────────
let _twitchToken = null;
let _twitchTokenExpiry = 0;

async function getTwitchToken() {
    if (_twitchToken && Date.now() < _twitchTokenExpiry) return _twitchToken;
    const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials',
        },
    });
    _twitchToken = res.data.access_token;
    _twitchTokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
    return _twitchToken;
}

async function checkTwitch(client) {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return;
    const guilds = await Guild.findAll();
    let token;
    try { token = await getTwitchToken(); } catch (e) {
        logger.warn('Twitch token error: ' + e.message);
        return;
    }

    for (const guildRecord of guilds) {
        const alerts = guildRecord.twitchAlerts;
        if (!alerts?.channelId || !alerts.streamers?.length) continue;

        const channel = await client.channels.fetch(alerts.channelId).catch(() => null);
        if (!channel) continue;

        let dirty = false;
        for (let i = 0; i < alerts.streamers.length; i++) {
            const streamer = alerts.streamers[i];
            try {
                const { data } = await axios.get('https://api.twitch.tv/helix/streams', {
                    params: { user_login: streamer.name },
                    headers: {
                        'Client-ID': process.env.TWITCH_CLIENT_ID,
                        Authorization: `Bearer ${token}`,
                    },
                });
                const stream = data.data[0];
                const isLive = !!stream;

                if (isLive && !streamer.lastLive) {
                    const thumb = stream.thumbnail_url
                        ?.replace('{width}', '400')
                        .replace('{height}', '225');
                    const embed = new EmbedBuilder()
                        .setColor(0x9146ff)
                        .setTitle(`🔴 ${streamer.name} è in live su Twitch!`)
                        .setDescription(`**${stream.title}**`)
                        .addFields(
                            { name: '🎮 Gioco', value: stream.game_name || 'N/D', inline: true },
                            { name: '👥 Spettatori', value: stream.viewer_count.toLocaleString('it'), inline: true },
                        )
                        .setURL(`https://twitch.tv/${streamer.name}`)
                        .setImage(thumb || null)
                        .setTimestamp();
                    await channel.send({ content: `📡 **${streamer.name}** ha iniziato una live!`, embeds: [embed] });
                    alerts.streamers[i].lastLive = true;
                    dirty = true;
                } else if (!isLive && streamer.lastLive) {
                    alerts.streamers[i].lastLive = false;
                    dirty = true;
                }
            } catch (e) {
                logger.warn(`Twitch check error (${streamer.name}): ${e.message}`);
            }
        }

        if (dirty) {
            guildRecord.twitchAlerts = alerts;
            guildRecord.changed('twitchAlerts', true);
            await guildRecord.save();
        }
    }
}

// ── TIKTOK ────────────────────────────────────────────────────────────────────

let _tiktokRunning = false;

// Istanze pubbliche RSSHub — nessuna configurazione richiesta agli utenti
const RSSHUB_INSTANCES = [
    'https://rsshub.app',
    'https://rsshub.rssforever.com',
    'https://hub.slarky.com',
];

// Strategia 1: RSS via RSSHub — zero configurazione, funziona per tutti
async function getLatestTikTokVideoViaRSS(username) {
    for (const instance of RSSHUB_INSTANCES) {
        try {
            const url = `${instance}/tiktok/user/@${username}`;
            const feed = await rssParser.parseURL(url);
            if (!feed.items?.length) continue;

            const item = feed.items[0];
            // Estrai l'ID video dall'URL
            const videoId = (item.link || item.guid || '').match(/\/video\/(\d+)/)?.[1]
                         || item.guid || item.link;

            if (!videoId) continue;

            // Cerca thumbnail nel content HTML
            let cover = null;
            const content = item['content:encoded'] || item.content || '';
            const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
            if (imgMatch) cover = imgMatch[1];

            logger.info(`TikTok RSS [${instance}]: trovato video ${videoId} per @${username}`);
            return {
                id: videoId,
                desc: item.title || item.contentSnippet || '',
                cover,
                author: feed.title?.replace(/^TikTok[· ·]+/i, '') || username,
                avatar: null,
                likes: 0,
                views: 0,
                url: item.link,
            };
        } catch (e) {
            logger.warn(`TikTok RSS: ${instance} fallito per @${username}: ${e.message}`);
        }
    }
    return null;
}

// Strategia 2: Puppeteer (fallback) — usa cookie globali bot o quelli del guild
// guildSession = { sessionid, ttwid } — opzionale, per server che vogliono più affidabilità
async function getLatestTikTokVideoPuppeteer(username, guildSession = {}) {
    logger.info(`TikTok puppeteer: avvio browser per @${username}...`);
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        // Cookie: priorità guild-specific → fallback globali .env
        const sessionid = guildSession.sessionid || process.env.TIKTOK_SESSIONID;
        const ttwid = guildSession.ttwid || process.env.TIKTOK_TTWID;
        const cookies = [];
        if (sessionid) cookies.push({ name: 'sessionid', value: sessionid, domain: '.tiktok.com', path: '/' });
        if (ttwid) cookies.push({ name: 'ttwid', value: ttwid, domain: '.tiktok.com', path: '/' });
        if (cookies.length) await page.setCookie(...cookies);

        let videoList = null;
        page.on('response', async (response) => {
            if (videoList) return;
            const url = response.url();
            if (!url.includes('/api/post/item_list')) return;
            try {
                const json = await response.json();
                if (json?.itemList?.length) videoList = json.itemList;
            } catch { }
        });

        await page.goto(`https://www.tiktok.com/@${username}`, {
            waitUntil: 'networkidle0',
            timeout: 45000,
        }).catch(() => { });

        await new Promise(r => setTimeout(r, 5000));

        if (!videoList?.length) {
            logger.warn(`TikTok puppeteer: nessun video trovato per @${username}`);
            return null;
        }

        const pageData = await page.evaluate(() => {
            try {
                const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (!el) return null;
                const scope = JSON.parse(el.textContent)?.__DEFAULT_SCOPE__;
                const user = scope?.['webapp.user-detail']?.userInfo?.user;
                return user ? { secUid: user.secUid, nickname: user.nickname, avatar: user.avatarMedium } : null;
            } catch { return null; }
        });

        const v = videoList[0];
        return {
            id: v.id,
            desc: v.desc || '',
            cover: v.video?.cover || v.video?.originCover || null,
            author: pageData?.nickname || v.author?.nickname || username,
            avatar: pageData?.avatar || v.author?.avatarMedium || null,
            likes: v.stats?.diggCount || 0,
            views: v.stats?.playCount || 0,
            secUid: pageData?.secUid || null,
        };
    } finally {
        await browser.close().catch(() => { });
    }
}

// Entry point: prova RSS → fallback puppeteer
async function getLatestTikTokVideo(username, guildSession = {}) {
    // Se il guild ha cookie propri, vai direttamente a puppeteer (più affidabile con auth)
    const hasGuildCookies = guildSession.sessionid || guildSession.ttwid;
    if (!hasGuildCookies) {
        const rssResult = await getLatestTikTokVideoViaRSS(username);
        if (rssResult) return rssResult;
        logger.info(`TikTok: RSS fallito per @${username}, provo puppeteer fallback...`);
    }
    return getLatestTikTokVideoPuppeteer(username, guildSession);
}

async function checkTikTok(client) {
    if (_tiktokRunning) return; // evita check sovrapposti
    _tiktokRunning = true;
    try {
        const guilds = await Guild.findAll();

        for (const guildRecord of guilds) {
            const alerts = guildRecord.tiktokAlerts;
            if (!alerts?.channelId || !alerts.users?.length) continue;

            const channel = await client.channels.fetch(alerts.channelId).catch(() => null);
            if (!channel) {
                logger.warn(`TikTok: canale ${alerts.channelId} non trovato per guild ${guildRecord.guildId}`);
                continue;
            }

            const guildSession = guildRecord.tiktokSession || {};

            let dirty = false;
            for (let i = 0; i < alerts.users.length; i++) {
                const user = alerts.users[i];
                try {
                    const video = await getLatestTikTokVideo(user.name, guildSession);
                    if (!video) continue;

                    if (video.secUid && !user.secUid) {
                        alerts.users[i].secUid = video.secUid;
                        dirty = true;
                    }

                    if (video.id === user.lastPostId) continue;

                    const videoUrl = video.url || `https://www.tiktok.com/@${user.name}/video/${video.id}`;

                    const isValidUrl = (u) => { try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:'; } catch { return false; } };
                    const safeAvatar = video.avatar && isValidUrl(video.avatar) ? video.avatar : undefined;
                    const safeCover = video.cover && isValidUrl(video.cover) ? video.cover : null;
                    const safeDesc = (video.desc || '').slice(0, 4096);

                    const embed = new EmbedBuilder()
                        .setColor(0x010101)
                        .setAuthor({ name: (video.author || user.name).slice(0, 256), iconURL: safeAvatar })
                        .setTitle(`🎵 Nuovo video TikTok da @${user.name}`.slice(0, 256))
                        .setURL(videoUrl)
                        .setTimestamp();
                    if (safeDesc) embed.setDescription(safeDesc);
                    if (safeCover) embed.setImage(safeCover);
                    if (video.likes || video.views) {
                        embed.addFields(
                            { name: '❤️ Like', value: video.likes.toLocaleString('it'), inline: true },
                            { name: '▶️ Visualizzazioni', value: video.views.toLocaleString('it'), inline: true },
                        );
                    }

                    await channel.send({ content: `📲 **@${user.name}** ha pubblicato un nuovo video su TikTok!`, embeds: [embed] });
                    logger.info(`TikTok: notifica inviata per @${user.name} (video ${video.id})`);

                    alerts.users[i].lastPostId = video.id;
                    alerts.users[i].lastPost = {
                        id: video.id,
                        desc: video.desc || '',
                        cover: safeCover,
                        url: videoUrl,
                        likes: video.likes,
                        views: video.views,
                        timestamp: new Date().toISOString(),
                    };
                    dirty = true;
                } catch (e) {
                    const detail = e.errors ? JSON.stringify(e.errors) : e.stack || e.message;
                    logger.warn(`TikTok check error (@${user.name}): ${e.message} — ${detail}`);
                }
            }

            if (dirty) {
                guildRecord.tiktokAlerts = alerts;
                guildRecord.changed('tiktokAlerts', true);
                await guildRecord.save();
            }
        }
    } finally {
        _tiktokRunning = false;
    }
}

// ── RSS (Instagram) ───────────────────────────────────────────────────────────
function buildRssUrl(username) {
    return `https://rsshub.app/instagram/user/${username}`;
}

async function checkInstagram(client) {
    const guilds = await Guild.findAll();

    for (const guildRecord of guilds) {
        const alerts = guildRecord.instagramAlerts;
        if (!alerts?.channelId || !alerts.users?.length) continue;

        const channel = await client.channels.fetch(alerts.channelId).catch(() => null);
        if (!channel) continue;

        let dirty = false;
        for (let i = 0; i < alerts.users.length; i++) {
            const user = alerts.users[i];
            try {
                const feed = await rssParser.parseURL(buildRssUrl(user.name));
                const latest = feed.items[0];
                if (!latest) continue;

                const postId = latest.guid || latest.link;
                if (postId === user.lastPostId) continue;

                alerts.users[i].lastPostId = postId;
                dirty = true;

                const embed = new EmbedBuilder()
                    .setColor(0xe1306c)
                    .setTitle(`📸 Nuovo post Instagram da @${user.name}`)
                    .setDescription(latest.contentSnippet || latest.title || '')
                    .setURL(latest.link)
                    .setTimestamp(latest.pubDate ? new Date(latest.pubDate) : undefined);
                if (latest.enclosure?.url) embed.setImage(latest.enclosure.url);

                await channel.send({ content: `📲 **@${user.name}** ha pubblicato un nuovo post su Instagram!`, embeds: [embed] });
            } catch (e) {
                logger.warn(`Instagram check error (@${user.name}): ${e.message}`);
            }
        }

        if (dirty) {
            guildRecord.instagramAlerts = alerts;
            guildRecord.changed('instagramAlerts', true);
            await guildRecord.save();
        }
    }
}

// ── AVVIO ─────────────────────────────────────────────────────────────────────
function startSocialAlerts(client) {
    // Twitch ogni 2 minuti
    cron.schedule('*/2 * * * *', () => checkTwitch(client).catch(() => { }));
    // TikTok ogni 30 secondi (6-field cron con secondi)
    cron.schedule('*/30 * * * * *', () => checkTikTok(client).catch(() => { }));
    // Instagram ogni 20 minuti (RSS)
    cron.schedule('*/20 * * * *', () => checkInstagram(client).catch(() => { }));

    logger.info('✅ Social Alerts avviato (Twitch ogni 2m · TikTok ogni 30s · Instagram ogni 20m)');
}

module.exports = { startSocialAlerts };
