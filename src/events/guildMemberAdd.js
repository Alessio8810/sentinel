const Guild = require('../database/models/Guild');
const { replaceVariables } = require('../utils/helpers');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guildConfig = await Guild.findOne({ where: { guildId: member.guild.id } });
    if (!guildConfig || !guildConfig.welcomeEnabled || !guildConfig.welcomeChannel) return;

    const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
    if (!channel) return;

    const vars = {
      user: `<@${member.id}>`,
      username: member.user.username,
      server: member.guild.name,
      memberCount: member.guild.memberCount,
    };

    const msg = replaceVariables(guildConfig.welcomeMessage, vars);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`👋 Benvenuto in ${member.guild.name}!`)
      .setDescription(msg)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Membro #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => { });
  },
};
