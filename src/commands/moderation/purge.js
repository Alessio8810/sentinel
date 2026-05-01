const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Elimina un numero di messaggi dal canale')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('quantità').setDescription('Numero di messaggi (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('utente').setDescription('Elimina solo i messaggi di questo utente')),
  cooldown: 5,
  async execute(interaction) {
    const amount = interaction.options.getInteger('quantità');
    const target = interaction.options.getUser('utente');

    await interaction.deferReply({ ephemeral: true });

    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (target) messages = messages.filter(m => m.author.id === target.id);
    messages = [...messages.values()].slice(0, amount);

    const deleted = await interaction.channel.bulkDelete(messages, true).catch(() => null);

    if (!deleted) return interaction.editReply({ embeds: [errorEmbed('Impossibile eliminare i messaggi (potrebbero essere troppo vecchi).')] });

    await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Eliminati **${deleted.size}** messaggi.`).setTimestamp()] });
  },
};
