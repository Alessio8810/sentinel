const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Crea un sondaggio')
    .addStringOption(o => o.setName('domanda').setDescription('Domanda').setRequired(true))
    .addStringOption(o => o.setName('opzione1').setDescription('Opzione 1').setRequired(true))
    .addStringOption(o => o.setName('opzione2').setDescription('Opzione 2').setRequired(true))
    .addStringOption(o => o.setName('opzione3').setDescription('Opzione 3'))
    .addStringOption(o => o.setName('opzione4').setDescription('Opzione 4'))
    .addStringOption(o => o.setName('opzione5').setDescription('Opzione 5')),
  cooldown: 5,
  async execute(interaction) {
    const question = interaction.options.getString('domanda');
    const options = [1, 2, 3, 4, 5]
      .map(n => interaction.options.getString(`opzione${n}`))
      .filter(Boolean);

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    const desc = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`📊 ${question}`)
      .setDescription(desc)
      .setFooter({ text: `Sondaggio creato da ${interaction.user.tag}` })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]);
    }
  },
};
