const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useMainPlayer, QueryType } = require('discord-player');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Riproduci musica da YouTube, Spotify, SoundCloud')
    .addStringOption(o => o.setName('query').setDescription('Titolo canzone, artista o URL').setRequired(true)),
  cooldown: 3,
  async execute(interaction) {
    await interaction.deferReply();

    if (!interaction.member.voice.channel) {
      return interaction.editReply({ embeds: [errorEmbed('Devi essere in un canale vocale.')] });
    }

    const query = interaction.options.getString('query');
    const player = useMainPlayer();

    try {
      const { track } = await player.play(interaction.member.voice.channel, query, {
        noEmbed: true,
        nodeOptions: {
          metadata: interaction,
          defaultFFmpegFilters: [],
        },
      });

      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎵 Aggiunto in coda')
        .setDescription(`**[${track.title}](${track.url})**`)
        .addFields(
          { name: 'Durata', value: track.duration, inline: true },
          { name: 'Autore', value: track.author, inline: true },
          { name: 'Richiesto da', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setThumbnail(track.thumbnail)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed(`Impossibile riprodurre: ${err.message}`)] });
    }
  },
};
