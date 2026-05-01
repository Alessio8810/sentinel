require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const { connectDB, sequelize } = require('../src/database/connection');
const path = require('path');
const Guild = require('../src/database/models/Guild');
const User = require('../src/database/models/User');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const https = require('https');
const axios = require('axios');

const app = express();

// ─── PASSPORT ───
passport.use(new Strategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ['identify', 'guilds', 'guilds.members.read'],
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─── MIDDLEWARE ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── AUTH ───
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);
app.get('/auth/logout', (req, res) => { req.logout(() => res.redirect('/')); });

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/discord');
}

// ─── ROUTES ───
app.get('/', (req, res) => res.render('index', { user: req.user || null, clientId: process.env.CLIENT_ID }));

// Recupera le guild del bot (cached per 60s)
let botGuildIds = new Set();
let botGuildsCachedAt = 0;
async function getBotGuildIds() {
  if (Date.now() - botGuildsCachedAt < 60000 && botGuildIds.size > 0) return botGuildIds;
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    const data = await rest.get(Routes.userGuilds());
    botGuildIds = new Set(data.map(g => g.id));
    botGuildsCachedAt = Date.now();
  } catch (e) { console.error('Errore fetch guild bot:', e.message); }
  return botGuildIds;
}

app.get('/dashboard', ensureAuth, async (req, res) => {
  const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x20)) === BigInt(0x20));
  const ids = await getBotGuildIds();
  const guilds = adminGuilds.filter(g => ids.has(g.id));
  res.render('dashboard', { user: req.user, guilds });
});

app.get('/dashboard/:guildId', ensureAuth, async (req, res) => {
  try {
    const guild = req.user.guilds.find(g => g.id === req.params.guildId);
    if (!guild) return res.status(403).send('Accesso negato.');

    let [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });

    // Fetch canali e ruoli tramite bot token
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    let channels = [], roles = [];
    try {
      const [ch, ro] = await Promise.all([
        rest.get(Routes.guildChannels(req.params.guildId)),
        rest.get(Routes.guildRoles(req.params.guildId)),
      ]);
      channels = ch;
      roles = ro;
    } catch (e) { console.error('Fetch canali/ruoli errore:', e.message); }

    res.render('guild', { user: req.user, guild, config, channels, roles });
  } catch (e) {
    console.error('GET /dashboard/:guildId errore:', e.message);
    res.status(500).send('Errore interno del server.');
  }
});

app.post('/dashboard/:guildId/save', ensureAuth, async (req, res) => {
  try {
    const guild = req.user.guilds.find(g => g.id === req.params.guildId);
    if (!guild) return res.status(403).json({ error: 'Accesso negato.' });

    const { section, data } = req.body;
    let [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });

    const scalarAllowed = [
      'prefix',
      'welcomeChannel', 'welcomeMessage', 'welcomeEnabled',
      'levelsEnabled', 'levelUpChannel', 'levelUpMessage',
      'modLogChannel',
      'musicChannel', 'djRole',
      'ticketsEnabled', 'ticketCategory', 'ticketLogChannel',
    ];
    for (const key of scalarAllowed) {
      if (data[key] !== undefined) config[key] = data[key];
    }

    if (data.automod && typeof data.automod === 'object') {
      config.automod = { ...(config.automod || {}), ...data.automod };
      config.changed('automod', true);
    }

    await config.save();
    res.json({ success: true });
  } catch (e) {
    console.error('POST /save errore:', e.message);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

// ─── PERSONALIZZAZIONE BOT ───
app.post('/dashboard/:guildId/personalize', ensureAuth, async (req, res) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (!guild) return res.status(403).json({ error: 'Accesso negato.' });

  const { nick, avatarUrl, activityType, activityText } = req.body;
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  const results = [];

  // Cambia nickname del bot nel server
  try {
    await rest.patch(Routes.guildMember(req.params.guildId, '@me'), {
      body: { nick: nick || null },
    });
    results.push('Nickname aggiornato');
  } catch (e) {
    return res.json({ success: false, error: `Nickname: ${e.message}` });
  }

  // Cambia avatar globale (se URL fornito)
  if (avatarUrl && avatarUrl.startsWith('http')) {
    try {
      const imageData = await new Promise((resolve, reject) => {
        https.get(avatarUrl, (resp) => {
          const chunks = [];
          resp.on('data', c => chunks.push(c));
          resp.on('end', () => resolve(Buffer.concat(chunks)));
          resp.on('error', reject);
        }).on('error', reject);
      });
      const mimeType = avatarUrl.includes('.png') ? 'image/png' : 'image/jpeg';
      const base64 = `data:${mimeType};base64,${imageData.toString('base64')}`;
      await rest.patch(Routes.user(), { body: { avatar: base64 } });
      results.push('Avatar aggiornato');
    } catch (e) {
      results.push(`Avatar: ${e.message}`);
    }
  }

  // Attività bot (richiede accesso al client Discord — salvato su DB)
  if (activityText) {
    try {
      const [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });
      config.botName = activityText;
      await config.save();
      results.push('Attività salvata (applicata al prossimo avvio)');
    } catch { }
  }

  res.json({ success: true, message: results.join(' · ') });
});

// ─── TIKTOK PROFILE FETCH ───
async function fetchTikTokProfile(username) {
  const cookie = [
    process.env.TIKTOK_SESSIONID ? `sessionid=${process.env.TIKTOK_SESSIONID}` : '',
    process.env.TIKTOK_TTWID ? `ttwid=${process.env.TIKTOK_TTWID}` : '',
  ].filter(Boolean).join('; ');

  const url = `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(username)}&aid=1988&app_language=en`;
  const resp = await axios.get(url, {
    headers: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': `https://www.tiktok.com/@${username}`,
    },
    timeout: 10000,
  });
  const user = resp.data?.userInfo?.user;
  if (!user || !user.uniqueId) return null;
  return {
    username: user.uniqueId,
    nickname: user.nickname || user.uniqueId,
    avatar: user.avatarMedium || user.avatarThumb || '',
    followers: resp.data?.userInfo?.stats?.followerCount ?? 0,
    bio: user.signature || '',
    secUid: user.secUid || null,
  };
}

// ─── TIKTOK SEARCH API ───
app.get('/api/:guildId/tiktok/search', ensureAuth, async (req, res) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (!guild) return res.status(403).json({ error: 'Accesso negato.' });

  const username = (req.query.username || '').replace('@', '').trim();
  if (!username) return res.status(400).json({ error: 'Username richiesto.' });

  try {
    const profile = await fetchTikTokProfile(username);
    if (!profile) return res.status(404).json({ error: 'Utente non trovato.' });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: 'Profilo non recuperabile.' });
  }
});

// ─── TIKTOK SUBSCRIBE ───
app.post('/api/:guildId/tiktok/subscribe', ensureAuth, async (req, res) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (!guild) return res.status(403).json({ error: 'Accesso negato.' });

  const username = (req.body.username || '').replace('@', '').trim();
  if (!username) return res.status(400).json({ error: 'Username richiesto.' });

  try {
    const [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });
    const alerts = config.tiktokAlerts || { channelId: null, users: [] };
    if (!alerts.users.find(u => u.name === username)) {
      // Risolvi secUid subito così il polling è immediato
      let secUid = null;
      try { secUid = (await fetchTikTokProfile(username))?.secUid || null; } catch { }
      alerts.users.push({ name: username, lastPostId: null, secUid });
      config.tiktokAlerts = alerts;
      config.changed('tiktokAlerts', true);
      await config.save();
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

// ─── TIKTOK UNSUBSCRIBE ───
app.delete('/api/:guildId/tiktok/subscribe', ensureAuth, async (req, res) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (!guild) return res.status(403).json({ error: 'Accesso negato.' });

  const username = (req.body.username || '').replace('@', '').trim();
  if (!username) return res.status(400).json({ error: 'Username richiesto.' });

  try {
    const [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });
    const alerts = config.tiktokAlerts || { channelId: null, users: [] };
    alerts.users = alerts.users.filter(u => u.name !== username);
    config.tiktokAlerts = alerts;
    config.changed('tiktokAlerts', true);
    await config.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

// ─── SALVA CANALE SOCIAL ALERTS ───
app.post('/dashboard/:guildId/save-social', ensureAuth, async (req, res) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (!guild) return res.status(403).json({ error: 'Accesso negato.' });

  const { platform, channelId } = req.body;
  const allowedPlatforms = ['twitchAlerts', 'tiktokAlerts', 'instagramAlerts'];
  const fieldMap = { twitch: 'twitchAlerts', tiktok: 'tiktokAlerts', instagram: 'instagramAlerts' };
  const field = fieldMap[platform];
  if (!field) return res.status(400).json({ error: 'Piattaforma non valida.' });

  try {
    const [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });
    const current = config[field] || { channelId: null, streamers: [], users: [] };
    current.channelId = channelId || null;
    config[field] = current;
    config.changed(field, true);
    await config.save();
    res.json({ success: true });
  } catch (e) {
    console.error('POST /save-social errore:', e.message);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

// ─── TIKTOK POSTS SUMMARY ───
app.get('/api/:guildId/tiktok/posts', ensureAuth, async (req, res) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (!guild) return res.status(403).json({ error: 'Accesso negato.' });
  try {
    const [config] = await Guild.findOrCreate({ where: { guildId: req.params.guildId } });
    const users = (config.tiktokAlerts?.users || []).map(u => ({
      name: u.name,
      lastPostId: u.lastPostId || null,
      lastPost: u.lastPost || null,
    }));
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

// ─── API per stats ───
app.get('/api/:guildId/leaderboard', ensureAuth, async (req, res) => {
  try {
    const users = await User.findAll({ where: { guildId: req.params.guildId }, order: [['totalXp', 'DESC']], limit: 50 });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Errore interno.' });
  }
});

// ─── GLOBAL ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('Express error handler:', err.message);
  res.status(500).send('Errore interno del server.');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

connectDB().then(() => {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`✅ Dashboard in ascolto su http://localhost:${process.env.PORT || 3000}`);
  });
});
