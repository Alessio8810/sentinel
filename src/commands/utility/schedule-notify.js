const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../../database/models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule-notify')
    .setDescription('Iscriviti/disiscriviti dalle notifiche live del server')
    .addSubcommand(sub => sub
      .setName('subscribe')
      .setDescription('Ricevi un DM 30 minuti prima delle live in programma'))
    .addSubcommand(sub => sub
      .setName('unsubscribe')
      .setDescription('Smetti di ricevere notifiche delle live')),

  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await Guild.findOne({ where: { guildId: interaction.guild.id } });
    if (!guildConfig) return interaction.reply({ content: '❌ Configurazione server non trovata.', ephemeral: true });

    const subscribers = Array.isArray(guildConfig.scheduleSubscribers) ? [...guildConfig.scheduleSubscribers] : [];
    const userId = interaction.user.id;

    if (sub === 'subscribe') {
      if (subscribers.includes(userId)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#e3b341').setDescription('⚠️ Sei già iscritto alle notifiche live di questo server.')],
          ephemeral: true,
        });
      }
      subscribers.push(userId);
      guildConfig.scheduleSubscribers = subscribers;
      await guildConfig.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('✅ Iscritto alle notifiche live!')
          .setDescription(`Riceverai un DM **30 minuti prima** di ogni live in programma su **${interaction.guild.name}**.\n\nUsa \`/schedule-notify unsubscribe\` per annullare.`)],
        ephemeral: true,
      });
    }

    if (sub === 'unsubscribe') {
      const idx = subscribers.indexOf(userId);
      if (idx === -1) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor('#e3b341').setDescription('⚠️ Non sei iscritto alle notifiche live di questo server.')],
          ephemeral: true,
        });
      }
      subscribers.splice(idx, 1);
      guildConfig.scheduleSubscribers = subscribers;
      await guildConfig.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ Disiscritto dalle notifiche live di **${interaction.guild.name}**.`)],
        ephemeral: true,
      });
    }
  },
};
