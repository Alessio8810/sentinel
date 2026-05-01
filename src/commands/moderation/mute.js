const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModLog = require('../../database/models/ModLog');
const Guild = require('../../database/models/Guild');
const { parseDuration, formatDuration, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silenzia un utente (timeout Discord)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('utente').setDescription('Utente da silenziare').setRequired(true))
    .addStringOption(o => o.setName('durata').setDescription('Durata (es. 10m, 2h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo')),
  cooldown: 5,
  async execute(interaction) {
    const target = interaction.options.getMember('utente');
    const durationStr = interaction.options.getString('durata');
    const reason = interaction.options.getString('motivo') || 'Nessuna ragione specificata';

    if (!target) return interaction.reply({ embeds: [errorEmbed('Utente non trovato.')], ephemeral: true });
    if (!target.moderatable) return interaction.reply({ embeds: [errorEmbed('Non posso silenziare questo utente.')], ephemeral: true });

    const duration = parseDuration(durationStr);
    if (!duration) return interaction.reply({ embeds: [errorEmbed('Durata non valida. Usa es. `10m`, `2h`, `1d`.')], ephemeral: true });
    if (duration > 28 * 24 * 60 * 60 * 1000) return interaction.reply({ embeds: [errorEmbed('Il timeout massimo di Discord è 28 giorni.')], ephemeral: true });

    await target.timeout(duration, reason);

    await ModLog.create({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      action: 'tempmute',
      reason,
      duration,
      expiresAt: new Date(Date.now() + duration),
    });

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🔇 Utente Silenziato')
      .addFields(
        { name: 'Utente', value: `${target.user.tag}`, inline: true },
        { name: 'Durata', value: formatDuration(duration), inline: true },
        { name: 'Motivo', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
