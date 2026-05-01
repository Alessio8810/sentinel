const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Metti in pausa o riprendi la musica'),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue) return interaction.reply({ embeds: [errorEmbed('Nessuna musica in riproduzione.')], ephemeral: true });

    if (queue.node.isPaused()) {
      queue.node.resume();
      return interaction.reply({ embeds: [successEmbed('▶️ Musica ripresa.')] });
    } else {
      queue.node.pause();
      return interaction.reply({ embeds: [successEmbed('⏸️ Musica in pausa.')] });
    }
  },
};
