const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModLog = require('../../database/models/ModLog');
const Guild = require('../../database/models/Guild');
const User = require('../../database/models/User');
const { parseDuration, formatDuration, errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banna un utente dal server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('utente').setDescription('Utente da bannare').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo del ban'))
    .addStringOption(o => o.setName('durata').setDescription('Durata (es. 1d, 12h). Vuoto = permanente'))
    .addIntegerOption(o => o.setName('elimina_messaggi').setDescription('Elimina messaggi degli ultimi N giorni (0-7)').setMinValue(0).setMaxValue(7)),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getMember('utente');
    const reason = interaction.options.getString('motivo') || 'Nessuna ragione specificata';
    const durationStr = interaction.options.getString('durata');
    const deleteDays = interaction.options.getInteger('elimina_messaggi') || 0;

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Utente non trovato.')] });
    if (target.id === interaction.user.id) return interaction.editReply({ embeds: [errorEmbed('Non puoi bannare te stesso.')] });
    if (!target.bannable) return interaction.editReply({ embeds: [errorEmbed('Non posso bannare questo utente.')] });

    let duration = null;
    let expiresAt = null;
    if (durationStr) {
      duration = parseDuration(durationStr);
      if (!duration) return interaction.editReply({ embeds: [errorEmbed('Durata non valida. Usa es. `10m`, `2h`, `1d`.')] });
      expiresAt = new Date(Date.now() + duration);
    }

    await target.send(`🔨 Sei stato bannato da **${interaction.guild.name}**.\n**Motivo:** ${reason}${duration ? `\n**Durata:** ${formatDuration(duration)}` : ''}`).catch(() => {});
    await target.ban({ deleteMessageDays: deleteDays, reason });

    await ModLog.create({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      action: duration ? 'tempban' : 'ban',
      reason,
      duration,
      expiresAt,
    });

    await logAction(interaction, target, duration ? 'tempban' : 'ban', reason, duration);

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🔨 Utente Bannato')
      .addFields(
        { name: 'Utente', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderatore', value: interaction.user.tag, inline: true },
        { name: 'Motivo', value: reason },
        { name: 'Durata', value: duration ? formatDuration(duration) : '⛔ Permanente' },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

async function logAction(interaction, target, action, reason, duration) {
  const guildConfig = await Guild.findOne({ where: { guildId: interaction.guild.id } });
  if (!guildConfig?.modLogChannel) return;
  const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannel);
  if (!logChannel) return;

  const actionLabels = { ban: '🔨 Ban', tempban: '⏱️ TempBan', kick: '👢 Kick', mute: '🔇 Mute', tempmute: '⏱️ TempMute', warn: '⚠️ Warn', unban: '✅ Unban', unmute: '🔊 Unmute' };

  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle(`${actionLabels[action] || action} — Azione Moderazione`)
    .addFields(
      { name: 'Utente', value: `<@${target.id}> (${target.user?.tag || target.tag})`, inline: true },
      { name: 'Moderatore', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Motivo', value: reason },
      ...(duration ? [{ name: 'Durata', value: formatDuration(duration) }] : []),
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

module.exports.logAction = logAction;
