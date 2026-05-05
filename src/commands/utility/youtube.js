const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const Parser = require('rss-parser');
const Guild = require('../../database/models/Guild');

const rssParser = new Parser({ timeout: 10000 });

// ── Risoluzione canale YouTube → { channelId, name } ─────────────────────────
// Supporta: ID diretto (UC...), URL /channel/UC..., URL /@handle, handle @nome
async function risolviCanaleYoutube(input) {
    input = input.trim();

    // Estrai da URL YouTube (channel/UC..., /@handle, /c/nome, /user/nome)
    const matchUrl = input.match(/youtube\.com\/(?:channel\/(UC[\w-]+)|(@[\w.-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i);
    if (matchUrl) {
        if (matchUrl[1]) {
            return await verificaChannelIdTramiteRss(matchUrl[1]);
        }
        const handle = matchUrl[2] || `@${matchUrl[3] || matchUrl[4]}`;
        return await risolviHandleTramiteApi(handle) || await risolviHandleTramiteScraping(handle);
    }

    // ID diretto (UC + 22 caratteri alfanumerici)
    if (/^UC[\w-]{22}$/.test(input)) {
        return await verificaChannelIdTramiteRss(input);
    }

    // Handle: @nomeutente o nomeutente senza @
    const handle = input.startsWith('@') ? input : `@${input}`;
    return await risolviHandleTramiteApi(handle) || await risolviHandleTramiteScraping(handle);
}

async function verificaChannelIdTramiteRss(channelId) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const feed = await rssParser.parseURL(feedUrl);
    return { channelId, name: feed.title || channelId };
}

async function risolviHandleTramiteApi(handle) {
    if (!process.env.YOUTUBE_API_KEY) return null;
    try {
        const { data } = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params: { key: process.env.YOUTUBE_API_KEY, forHandle: handle, part: 'id,snippet' },
            timeout: 8000,
        });
        const item = data.items?.[0];
        if (!item) return null;
        return { channelId: item.id, name: item.snippet.title };
    } catch {
        return null;
    }
}

async function risolviHandleTramiteScraping(handle) {
    const rawHandle = handle.replace(/^@/, '');
    const paginaUrl = `https://www.youtube.com/@${rawHandle}`;
    const { data: html } = await axios.get(paginaUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 12000,
    });

    const patternsChannelId = [
        /"channelId":"(UC[\w-]{22})"/,
        /"externalId":"(UC[\w-]{22})"/,
        /channel\/(UC[\w-]{22})/,
        /<meta itemprop="channelId" content="(UC[\w-]{22})"/i,
    ];

    let channelId = null;
    for (const pattern of patternsChannelId) {
        const m = html.match(pattern);
        if (m) { channelId = m[1]; break; }
    }

    if (!channelId) {
        throw new Error(`Impossibile risolvere il canale YouTube "${handle}". Prova a fornire il Channel ID direttamente (formato: UC...).`);
    }

    let nome = rawHandle;
    const matchNome = html.match(/"author":\{"simpleText":"([^"]+)"\}/)
        || html.match(/"ownerText":\{"runs":\[?\{"text":"([^"]+)"/)
        || html.match(/<title>([^<]+)<\/title>/i);
    if (matchNome) nome = matchNome[1].replace(/ - YouTube$/i, '').trim();

    return { channelId, name: nome };
}

// ── Comando slash /youtube ────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Gestisce le notifiche per i nuovi video YouTube')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Aggiunge un canale YouTube da monitorare')
                .addStringOption(o =>
                    o.setName('canale_yt')
                        .setDescription('Channel ID (UC...), URL YouTube o handle (@nome)')
                        .setRequired(true)
                )
                .addChannelOption(o =>
                    o.setName('canale')
                        .setDescription('Canale Discord dove inviare le notifiche')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Rimuove un canale YouTube dalla lista')
                .addStringOption(o =>
                    o.setName('canale_yt')
                        .setDescription('Channel ID (UC...) o nome del canale')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Mostra i canali YouTube monitorati')
        )
        .addSubcommand(sub =>
            sub.setName('canale')
                .setDescription('Imposta il canale Discord di default per le notifiche YouTube')
                .addChannelOption(o =>
                    o.setName('canale')
                        .setDescription('Canale Discord')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });
        const alerts = config.youtubeAlerts || { channelId: null, channels: [] };

        if (sub === 'add') {
            await interaction.deferReply({ ephemeral: true });

            const inputCanale = interaction.options.getString('canale_yt');
            const discordCanale = interaction.options.getChannel('canale');

            let risolto;
            try {
                risolto = await risolviCanaleYoutube(inputCanale);
            } catch (e) {
                return interaction.editReply({ content: `❌ ${e.message}` });
            }

            if (alerts.channels.find(c => c.channelId === risolto.channelId)) {
                return interaction.editReply({ content: `❌ Il canale **${risolto.name}** è già nella lista.` });
            }

            alerts.channelId = discordCanale.id;
            alerts.channels.push({ channelId: risolto.channelId, name: risolto.name, lastVideoId: null });
            config.youtubeAlerts = alerts;
            config.changed('youtubeAlerts', true);
            await config.save();

            return interaction.editReply({
                content: `✅ Monitoraggio YouTube attivato per **${risolto.name}** (\`${risolto.channelId}\`) → ${discordCanale}`,
            });
        }

        if (sub === 'remove') {
            const inputCanale = interaction.options.getString('canale_yt').trim();
            const prima = alerts.channels.length;

            // Cerca per channel ID esatto o per nome (case-insensitive)
            alerts.channels = alerts.channels.filter(c =>
                c.channelId !== inputCanale &&
                c.name.toLowerCase() !== inputCanale.toLowerCase()
            );

            if (alerts.channels.length === prima) {
                return interaction.reply({ content: `❌ Canale **${inputCanale}** non trovato nella lista.`, ephemeral: true });
            }

            config.youtubeAlerts = alerts;
            config.changed('youtubeAlerts', true);
            await config.save();
            return interaction.reply({ content: `🗑️ Canale **${inputCanale}** rimosso dalla lista YouTube.`, ephemeral: true });
        }

        if (sub === 'list') {
            if (!alerts.channels.length) {
                return interaction.reply({ content: '📋 Nessun canale YouTube monitorato.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('📺 Canali YouTube monitorati')
                .setDescription(alerts.channels.map(c => `• **${c.name}** — \`${c.channelId}\``).join('\n'))
                .addFields({ name: 'Canale notifiche', value: alerts.channelId ? `<#${alerts.channelId}>` : 'Non impostato' });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'canale') {
            const discordCanale = interaction.options.getChannel('canale');
            alerts.channelId = discordCanale.id;
            config.youtubeAlerts = alerts;
            config.changed('youtubeAlerts', true);
            await config.save();
            return interaction.reply({ content: `✅ Canale notifiche YouTube impostato su ${discordCanale}`, ephemeral: true });
        }
    },
};
