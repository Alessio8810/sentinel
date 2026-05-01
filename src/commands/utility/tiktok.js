const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tiktok')
        .setDescription('Gestisce le notifiche per i nuovi video TikTok')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Aggiunge un account TikTok da monitorare')
                .addStringOption(o => o.setName('utente').setDescription('Username TikTok (senza @)').setRequired(true))
                .addChannelOption(o => o.setName('canale').setDescription('Canale dove inviare le notifiche').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Rimuove un account TikTok dalla lista')
                .addStringOption(o => o.setName('utente').setDescription('Username TikTok').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Mostra gli account TikTok monitorati')
        )
        .addSubcommand(sub =>
            sub.setName('canale')
                .setDescription('Imposta il canale di default per le notifiche TikTok')
                .addChannelOption(o => o.setName('canale').setDescription('Canale Discord').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });
        const alerts = config.tiktokAlerts || { channelId: null, users: [] };

        if (sub === 'add') {
            const utente = interaction.options.getString('utente').replace(/^@/, '').toLowerCase();
            const channel = interaction.options.getChannel('canale');

            if (alerts.users.find(u => u.name === utente)) {
                return interaction.reply({ content: `❌ **@${utente}** è già nella lista.`, ephemeral: true });
            }
            alerts.channelId = channel.id;
            alerts.users.push({ name: utente, lastPostId: null });
            config.tiktokAlerts = alerts;
            config.changed('tiktokAlerts', true);
            await config.save();
            return interaction.reply({ content: `✅ Monitoraggio TikTok attivato per **@${utente}** → ${channel}`, ephemeral: true });
        }

        if (sub === 'remove') {
            const utente = interaction.options.getString('utente').replace(/^@/, '').toLowerCase();
            const before = alerts.users.length;
            alerts.users = alerts.users.filter(u => u.name !== utente);
            if (alerts.users.length === before) {
                return interaction.reply({ content: `❌ **@${utente}** non trovato nella lista.`, ephemeral: true });
            }
            config.tiktokAlerts = alerts;
            config.changed('tiktokAlerts', true);
            await config.save();
            return interaction.reply({ content: `🗑️ **@${utente}** rimosso dalla lista TikTok.`, ephemeral: true });
        }

        if (sub === 'list') {
            if (!alerts.users.length) {
                return interaction.reply({ content: '📋 Nessun account TikTok monitorato.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0x010101)
                .setTitle('🎵 Account TikTok monitorati')
                .setDescription(alerts.users.map(u => `• **@${u.name}**`).join('\n'))
                .addFields({ name: 'Canale notifiche', value: alerts.channelId ? `<#${alerts.channelId}>` : 'Non impostato' });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'canale') {
            const channel = interaction.options.getChannel('canale');
            alerts.channelId = channel.id;
            config.tiktokAlerts = alerts;
            config.changed('tiktokAlerts', true);
            await config.save();
            return interaction.reply({ content: `✅ Canale notifiche TikTok impostato su ${channel}`, ephemeral: true });
        }
    },
};
