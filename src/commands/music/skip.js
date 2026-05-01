const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canzone corrente'),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.isPlaying()) return interaction.reply({ embeds: [errorEmbed('Nessuna musica in riproduzione.')], ephemeral: true });
    queue.node.skip();
    await interaction.reply({ embeds: [successEmbed('⏭️ Canzone saltata.')] });
  },
};
