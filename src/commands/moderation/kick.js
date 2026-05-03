const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Espelle un utente dal server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('utente').setDescription('Utente da espellere').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo')),
  cooldown: 5,\n    await interaction.deferReply();
    const target = interaction.options.getMember('utente');
    const reason = interaction.options.getString('motivo') || 'Nessuna ragione specificata';

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Utente non trovato.')] });
    if (!target.kickable) return interaction.editReply({ embeds: [errorEmbed('Non posso espellere questo utente.')] });

    await target.send(`👢 Sei stato espulso da **${interaction.guild.name}**.\n**Motivo:** ${reason}`).catch(() => {});
    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('👢 Utente Espulso')
      .addFields(
        { name: 'Utente', value: `${target.user.tag}`, inline: true },
        { name: 'Moderatore', value: interaction.user.tag, inline: true },
        { name: 'Motivo', value: reason },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
