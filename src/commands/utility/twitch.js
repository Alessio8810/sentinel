const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Gestisce le notifiche live Twitch')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Aggiunge uno streamer da monitorare')
                .addStringOption(o => o.setName('streamer').setDescription('Nome utente Twitch').setRequired(true))
                .addChannelOption(o => o.setName('canale').setDescription('Canale dove inviare le notifiche').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Rimuove uno streamer dalla lista')
                .addStringOption(o => o.setName('streamer').setDescription('Nome utente Twitch').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Mostra gli streamer monitorati')
        )
        .addSubcommand(sub =>
            sub.setName('canale')
                .setDescription('Imposta il canale di default per le notifiche Twitch')
                .addChannelOption(o => o.setName('canale').setDescription('Canale Discord').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });
        const alerts = config.twitchAlerts || { channelId: null, streamers: [] };

        if (sub === 'add') {
            const streamer = interaction.options.getString('streamer').toLowerCase();
            const channel = interaction.options.getChannel('canale');

            if (alerts.streamers.find(s => s.name === streamer)) {
                return interaction.reply({ content: `❌ **${streamer}** è già nella lista.`, ephemeral: true });
            }
            alerts.channelId = channel.id;
            alerts.streamers.push({ name: streamer, lastLive: false });
            config.twitchAlerts = alerts;
            config.changed('twitchAlerts', true);
            await config.save();
            return interaction.reply({ content: `✅ Monitoraggio Twitch attivato per **${streamer}** → ${channel}`, ephemeral: true });
        }

        if (sub === 'remove') {
            const streamer = interaction.options.getString('streamer').toLowerCase();
            const before = alerts.streamers.length;
            alerts.streamers = alerts.streamers.filter(s => s.name !== streamer);
            if (alerts.streamers.length === before) {
                return interaction.reply({ content: `❌ **${streamer}** non trovato nella lista.`, ephemeral: true });
            }
            config.twitchAlerts = alerts;
            config.changed('twitchAlerts', true);
            await config.save();
            return interaction.reply({ content: `🗑️ **${streamer}** rimosso dalla lista Twitch.`, ephemeral: true });
        }

        if (sub === 'list') {
            if (!alerts.streamers.length) {
                return interaction.reply({ content: '📋 Nessuno streamer Twitch monitorato.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0x9146ff)
                .setTitle('📡 Streamer Twitch monitorati')
                .setDescription(alerts.streamers.map(s => `• **${s.name}** — ${s.lastLive ? '🔴 Live' : '⚫ Offline'}`).join('\n'))
                .addFields({ name: 'Canale notifiche', value: alerts.channelId ? `<#${alerts.channelId}>` : 'Non impostato' });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'canale') {
            const channel = interaction.options.getChannel('canale');
            alerts.channelId = channel.id;
            config.twitchAlerts = alerts;
            config.changed('twitchAlerts', true);
            await config.save();
            return interaction.reply({ content: `✅ Canale notifiche Twitch impostato su ${channel}`, ephemeral: true });
        }
    },
};
