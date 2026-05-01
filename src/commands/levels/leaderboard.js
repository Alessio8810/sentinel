const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Mostra la classifica XP del server')
    .addIntegerOption(o => o.setName('pagina').setDescription('Pagina').setMinValue(1)),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply();
    const page = interaction.options.getInteger('pagina') || 1;
    const perPage = 10;

    const total = await User.count({ where: { guildId: interaction.guild.id } });
    const users = await User.findAll({
      where: { guildId: interaction.guild.id },
      order: [['totalXp', 'DESC']],
      offset: (page - 1) * perPage,
      limit: perPage,
    });

    if (!users.length) return interaction.editReply('❌ Nessun utente in classifica.');

    const lines = await Promise.all(users.map(async (u, i) => {
      const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
      const name = member ? member.user.username : `Utente (${u.userId})`;
      const pos = (page - 1) * perPage + i + 1;
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      return `${medals[pos] || `**${pos}.**`} ${name} — Lv. **${u.level}** | ${u.totalXp} XP`;
    }));

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🏆 Classifica XP — ${interaction.guild.name}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Pagina ${page}/${Math.ceil(total / perPage)} • ${total} utenti totali` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
