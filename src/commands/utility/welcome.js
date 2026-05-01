const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configura il messaggio di benvenuto')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('set').setDescription('Imposta il canale e il messaggio di benvenuto')
      .addChannelOption(o => o.setName('canale').setRequired(true).setDescription('Canale di benvenuto'))
      .addStringOption(o => o.setName('messaggio').setDescription('Messaggio ({user}, {server}, {memberCount})'))
    )
    .addSubcommand(s => s.setName('toggle').setDescription('Abilita/disabilita i benvenuti').addBooleanOption(o => o.setName('stato').setRequired(true).setDescription('true=abilita')))
    .addSubcommand(s => s.setName('test').setDescription('Testa il messaggio di benvenuto')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const channel = interaction.options.getChannel('canale');
      const msg = interaction.options.getString('messaggio');
      config.welcomeChannel = channel.id;
      if (msg) config.welcomeMessage = msg;
      config.welcomeEnabled = true;
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Benvenuto configurato in ${channel}.`)] });
    }

    if (sub === 'toggle') {
      config.welcomeEnabled = interaction.options.getBoolean('stato');
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Benvenuto ${config.welcomeEnabled ? 'abilitato' : 'disabilitato'}.`)] });
    }

    if (sub === 'test') {
      // Simula un benvenuto
      const { replaceVariables } = require('../../utils/helpers');
      if (!config.welcomeChannel) return interaction.editReply({ embeds: [errorEmbed('Nessun canale di benvenuto configurato.')] });
      const channel = interaction.guild.channels.cache.get(config.welcomeChannel);
      if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canale non trovato.')] });

      const vars = {
        user: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        server: interaction.guild.name,
        memberCount: interaction.guild.memberCount,
      };
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`👋 Benvenuto in ${interaction.guild.name}!`)
        .setDescription(replaceVariables(config.welcomeMessage, vars))
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `[TEST] Membro #${interaction.guild.memberCount}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      return interaction.editReply({ embeds: [successEmbed('Messaggio di test inviato!')] });
    }
  },
};
