const Guild = require('../database/models/Guild');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => { });
    if (!reaction.message.guild) return;

    const guildConfig = await Guild.findOne({ where: { guildId: reaction.message.guild.id } });
    if (!guildConfig) return;

    const rrConfig = (guildConfig.reactionRoles || []).find(
      r => r.messageId === reaction.message.id
    );
    if (!rrConfig) return;

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const emojiKey = reaction.emoji.id || reaction.emoji.name;
    const roleEntry = rrConfig.roles.find(r => r.emoji === emojiKey);
    if (!roleEntry) return;

    if (rrConfig.type !== 'reversed') {
      await member.roles.remove(roleEntry.roleId).catch(() => { });
    }
  },
};
