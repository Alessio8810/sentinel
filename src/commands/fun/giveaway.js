const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/helpers');
const Guild = require('../../database/models/Guild');

const activeGiveaways = new Map(); // guildId -> { messageId, channelId, endTime, prize, winners, participants[] }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gestisci i giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('start').setDescription('Avvia un giveaway')
      .addStringOption(o => o.setName('premio').setRequired(true).setDescription('Premio'))
      .addStringOption(o => o.setName('durata').setRequired(true).setDescription('Durata (es. 10m, 1h, 1d)'))
      .addIntegerOption(o => o.setName('vincitori').setDescription('Numero vincitori').setMinValue(1).setMaxValue(20))
      .addChannelOption(o => o.setName('canale').setDescription('Canale'))
    )
    .addSubcommand(s => s.setName('end').setDescription('Termina anticipatamente un giveaway').addStringOption(o => o.setName('message_id').setRequired(true).setDescription('ID messaggio giveaway')))
    .addSubcommand(s => s.setName('reroll').setDescription('Riesegui l\'estrazione').addStringOption(o => o.setName('message_id').setRequired(true).setDescription('ID messaggio giveaway'))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const { parseDuration, formatDuration } = require('../../utils/helpers');

    if (sub === 'start') {
      const prize = interaction.options.getString('premio');
      const durationStr = interaction.options.getString('durata');
      const winnersCount = interaction.options.getInteger('vincitori') || 1;
      const channel = interaction.options.getChannel('canale') || interaction.channel;

      const duration = parseDuration(durationStr);
      if (!duration) return interaction.editReply({ embeds: [errorEmbed('Durata non valida.')] });

      const endTime = new Date(Date.now() + duration);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(`**Premio:** ${prize}\n\nReagisci con 🎉 per partecipare!\n\n**Scade:** <t:${Math.floor(endTime / 1000)}:R>\n**Vincitori:** ${winnersCount}`)
        .setFooter({ text: `Avviato da ${interaction.user.tag}` })
        .setTimestamp(endTime);

      const msg = await channel.send({ embeds: [embed] });
      await msg.react('🎉');

      const key = `${interaction.guild.id}-${msg.id}`;
      activeGiveaways.set(key, { messageId: msg.id, channelId: channel.id, prize, winnersCount, endTime, hostId: interaction.user.id });

      // Timer per fine giveaway
      setTimeout(async () => {
        await endGiveaway(interaction.guild, msg.id, channel.id, prize, winnersCount);
        activeGiveaways.delete(key);
      }, duration);

      return interaction.editReply({ embeds: [successEmbed(`Giveaway avviato in ${channel}!`)] });
    }

    if (sub === 'end') {
      const msgId = interaction.options.getString('message_id');
      const key = [...activeGiveaways.keys()].find(k => k.endsWith(msgId));
      if (!key) return interaction.editReply({ embeds: [errorEmbed('Giveaway non trovato.')] });

      const ga = activeGiveaways.get(key);
      await endGiveaway(interaction.guild, ga.messageId, ga.channelId, ga.prize, ga.winnersCount);
      activeGiveaways.delete(key);
      return interaction.editReply({ embeds: [successEmbed('Giveaway terminato!')] });
    }

    if (sub === 'reroll') {
      const msgId = interaction.options.getString('message_id');
      const channel = await interaction.guild.channels.cache.find(c => {
        const msgs = c.messages?.cache;
        return msgs && msgs.has(msgId);
      });
      const msg = channel ? await channel.messages.fetch(msgId).catch(() => null) : null;
      if (!msg) return interaction.editReply({ embeds: [errorEmbed('Messaggio non trovato.')] });

      const reactions = msg.reactions.cache.get('🎉');
      if (!reactions) return interaction.editReply({ embeds: [errorEmbed('Nessuna partecipazione trovata.')] });

      const users = await reactions.users.fetch();
      const participants = users.filter(u => !u.bot);
      if (!participants.size) return interaction.editReply({ embeds: [errorEmbed('Nessun partecipante.')] });

      const winner = participants.random();
      await msg.channel.send(`🎉 Nuovo vincitore estratto: <@${winner.id}>! Congratulazioni!`);
      return interaction.editReply({ embeds: [successEmbed('Reroll effettuato!')] });
    }
  },
};

async function endGiveaway(guild, messageId, channelId, prize, winnersCount) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return;

  const reactions = msg.reactions.cache.get('🎉');
  let winners = [];

  if (reactions) {
    const users = await reactions.users.fetch();
    const participants = [...users.filter(u => !u.bot).values()];
    const count = Math.min(winnersCount, participants.length);
    const shuffled = participants.sort(() => Math.random() - 0.5);
    winners = shuffled.slice(0, count);
  }

  const embed = new EmbedBuilder()
    .setColor(winners.length ? '#FFD700' : '#ED4245')
    .setTitle('🎉 Giveaway Terminato!')
    .setDescription(
      winners.length
        ? `**Premio:** ${prize}\n\n🏆 **Vincitor${winners.length > 1 ? 'i' : 'e'}:** ${winners.map(w => `<@${w.id}>`).join(', ')}`
        : `**Premio:** ${prize}\n\n❌ Nessun partecipante valido.`
    )
    .setTimestamp();

  await msg.edit({ embeds: [embed] });
  if (winners.length) {
    await channel.send(`🎉 Congratulazioni ${winners.map(w => `<@${w.id}>`).join(', ')}! Hai vinto **${prize}**!`);
  }
}
