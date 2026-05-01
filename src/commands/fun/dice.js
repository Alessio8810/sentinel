const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Tira uno o più dadi')
    .addIntegerOption(o => o.setName('dadi').setDescription('Numero dadi (default 1)').setMinValue(1).setMaxValue(10))
    .addIntegerOption(o => o.setName('facce').setDescription('Facce per dado (default 6)').setMinValue(2).setMaxValue(100)),
  async execute(interaction) {
    const count = interaction.options.getInteger('dadi') || 1;
    const faces = interaction.options.getInteger('facce') || 6;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🎲 Tiro dadi (${count}d${faces})`)
      .setDescription(`Risultati: **${rolls.join(', ')}**\n\nTotale: **${total}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
