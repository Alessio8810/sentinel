const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Mostra la coda musicale')
    .addIntegerOption(o => o.setName('pagina').setDescription('Pagina').setMinValue(1)),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      return interaction.reply({ embeds: [errorEmbed('Nessuna musica in riproduzione.')], ephemeral: true });
    }

    const page = interaction.options.getInteger('pagina') || 1;
    const perPage = 10;
    const tracks = queue.tracks.toArray();
    const current = queue.currentTrack;

    const slice = tracks.slice((page - 1) * perPage, page * perPage);
    const list = slice.map((t, i) => `**${(page - 1) * perPage + i + 1}.** [${t.title}](${t.url}) — \`${t.duration}\``).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎵 Coda Musicale')
      .addFields(
        { name: '▶️ In riproduzione', value: `[${current.title}](${current.url}) — \`${current.duration}\`` },
        ...(list ? [{ name: `⏭️ Prossime (${tracks.length} totali)`, value: list }] : []),
      )
      .setFooter({ text: `Pagina ${page}/${Math.ceil((tracks.length || 1) / perPage)}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
