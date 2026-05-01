const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModLog = require('../../database/models/ModLog');
const User = require('../../database/models/User');
const Guild = require('../../database/models/Guild');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avverte un utente')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('utente').setDescription('Utente da avvertire').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(true)),
  cooldown: 3,
  async execute(interaction) {
    const target = interaction.options.getMember('utente');
    const reason = interaction.options.getString('motivo');

    if (!target) return interaction.reply({ embeds: [errorEmbed('Utente non trovato.')], ephemeral: true });

    // findOrCreate evita la doppia query find+create
    let [userDoc] = await User.findOrCreate({ where: { userId: target.id, guildId: interaction.guild.id } });

    // Riassegna l'array (necessario con colonne JSON Sequelize)
    userDoc.warnings = [...(userDoc.warnings || []), { reason, moderatorId: interaction.user.id, date: new Date() }];
    await userDoc.save();

    await ModLog.create({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      action: 'warn',
      reason,
    });

    await target.send(`⚠️ Hai ricevuto un avvertimento in **${interaction.guild.name}**.\n**Motivo:** ${reason}\n**Totale avvertimenti:** ${userDoc.warnings.length}`).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⚠️ Avvertimento')
      .addFields(
        { name: 'Utente', value: `${target.user.tag}`, inline: true },
        { name: 'Avvertimenti', value: `${userDoc.warnings.length}`, inline: true },
        { name: 'Motivo', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
