const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra la canzone in riproduzione'),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.isPlaying()) return interaction.reply({ embeds: [errorEmbed('Nessuna musica in riproduzione.')], ephemeral: true });

    const track = queue.currentTrack;
    const progress = queue.node.createProgressBar();

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎵 In Riproduzione')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: 'Autore', value: track.author, inline: true },
        { name: 'Durata', value: track.duration, inline: true },
        { name: 'Richiesto da', value: `<@${track.requestedBy?.id || 'Unknown'}>`, inline: true },
        { name: 'Progresso', value: progress || '—' },
      )
      .setThumbnail(track.thumbnail)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
