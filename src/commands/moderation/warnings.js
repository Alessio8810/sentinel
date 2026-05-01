const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Visualizza gli avvertimenti di un utente')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('utente').setDescription('Utente').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser('utente');
    const userDoc = await User.findOne({ where: { userId: target.id, guildId: interaction.guild.id } });

    if (!userDoc || !userDoc.warnings.length) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ ${target.tag} non ha avvertimenti.`)], ephemeral: true });
    }

    const list = userDoc.warnings.slice(-10).map((w, i) =>
      `**${i + 1}.** ${w.reason} — <@${w.moderatorId}> — <t:${Math.floor(w.date / 1000)}:R>`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`⚠️ Avvertimenti di ${target.tag}`)
      .setDescription(list)
      .setFooter({ text: `Totale: ${userDoc.warnings.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
