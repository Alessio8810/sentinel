const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue, QueueRepeatMode } = require('discord-player');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Imposta la modalità di ripetizione')
    .addStringOption(o => o.setName('modalità').setDescription('Modalità').setRequired(true)
      .addChoices(
        { name: '❌ Off', value: 'off' },
        { name: '🔂 Canzone', value: 'track' },
        { name: '🔁 Coda', value: 'queue' },
        { name: '🔀 Autoplay', value: 'autoplay' },
      )
    ),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue) return interaction.reply({ embeds: [errorEmbed('Nessuna musica in riproduzione.')], ephemeral: true });

    const mode = interaction.options.getString('modalità');
    const modeMap = {
      off: QueueRepeatMode.OFF,
      track: QueueRepeatMode.TRACK,
      queue: QueueRepeatMode.QUEUE,
      autoplay: QueueRepeatMode.AUTOPLAY,
    };

    queue.setRepeatMode(modeMap[mode]);
    const labels = { off: '❌ Off', track: '🔂 Canzone', queue: '🔁 Coda', autoplay: '🔀 Autoplay' };
    await interaction.reply({ embeds: [successEmbed(`Ripetizione impostata su **${labels[mode]}**.`)] });
  },
};
