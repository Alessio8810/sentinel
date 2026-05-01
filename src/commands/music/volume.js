const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Imposta il volume della musica')
    .addIntegerOption(o => o.setName('valore').setDescription('Volume (1-200)').setRequired(true).setMinValue(1).setMaxValue(200)),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue) return interaction.reply({ embeds: [errorEmbed('Nessuna musica in riproduzione.')], ephemeral: true });

    const vol = interaction.options.getInteger('valore');
    queue.node.setVolume(vol);
    await interaction.reply({ embeds: [successEmbed(`🔊 Volume impostato al **${vol}%**.`)] });
  },
};
