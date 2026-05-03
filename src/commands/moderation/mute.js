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
    await interaction.deferReply();
    const target = interaction.options.getMember('utente');
    const durationStr = interaction.options.getString('durata');
    const reason = interaction.options.getString('motivo') || 'Nessuna ragione specificata';

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Utente non trovato.')] });
    if (!target.moderatable) return interaction.editReply({ embeds: [errorEmbed('Non posso silenziare questo utente.')] });

    const duration = parseDuration(durationStr);
    if (!duration) return interaction.editReply({ embeds: [errorEmbed('Durata non valida. Usa es. `10m`, `2h`, `1d`.')] });
    if (duration > 28 * 24 * 60 * 60 * 1000) return interaction.editReply({ embeds: [errorEmbed('Il timeout massimo di Discord è 28 giorni.')] });

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

    await interaction.editReply({ embeds: [embed] });
  },
};
