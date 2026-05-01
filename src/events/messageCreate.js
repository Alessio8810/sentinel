const Guild = require('../database/models/Guild');
const User = require('../database/models/User');
const { xpForLevel, levelFromXp, replaceVariables } = require('../utils/helpers');
const { EmbedBuilder } = require('discord.js');
const automod = require('../modules/automod');

// Cooldown per XP (no spam)
const xpCooldowns = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Carica config guild (findOrCreate = trova o crea in una sola query)
    let [guildConfig] = await Guild.findOrCreate({ where: { guildId: message.guild.id } });

    // ─── AUTO-MOD ───
    if (guildConfig.automod?.enabled) {
      const deleted = await automod.check(message, guildConfig);
      if (deleted) return;
    }

    // ─── CUSTOM COMMANDS ───
    const content = message.content.trim();
    for (const cmd of (guildConfig.customCommands || [])) {
      const trigger = cmd.trigger.toLowerCase();
      const msgLower = content.toLowerCase();
      if (msgLower === trigger || msgLower.startsWith(trigger + ' ')) {
        const vars = {
          user: `<@${message.author.id}>`,
          username: message.author.username,
          channel: `<#${message.channel.id}>`,
          server: message.guild.name,
        };
        const response = replaceVariables(cmd.response, vars);
        if (cmd.deleteOriginal) await message.delete().catch(() => {});
        if (cmd.replyInDm) {
          await message.author.send(response).catch(() => {});
        } else {
          await message.channel.send(response);
        }
        for (const roleId of (cmd.addRoles || [])) {
          await message.member.roles.add(roleId).catch(() => {});
        }
        for (const roleId of (cmd.removeRoles || [])) {
          await message.member.roles.remove(roleId).catch(() => {});
        }
        return;
      }
    }

    // ─── SISTEMA XP / LIVELLI ───
    if (!guildConfig.levelsEnabled) return;
    if ((guildConfig.noXpChannels || []).includes(message.channel.id)) return;
    if (message.member.roles.cache.some(r => (guildConfig.noXpRoles || []).includes(r.id))) return;

    // Cooldown 1 minuto
    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    if (xpCooldowns.has(cooldownKey)) return;
    xpCooldowns.set(cooldownKey, true);
    setTimeout(() => xpCooldowns.delete(cooldownKey), 60000);

    // Calcola moltiplicatore XP
    let multiplier = 1;
    for (const m of (guildConfig.xpMultipliers || [])) {
      if (message.member.roles.cache.has(m.roleId)) {
        multiplier = Math.max(multiplier, m.multiplier);
      }
    }

    const xpGained = Math.floor((Math.random() * 15 + 15) * multiplier);

    let [userDoc] = await User.findOrCreate({ where: { userId: message.author.id, guildId: message.guild.id } });

    const oldLevel = userDoc.level;
    userDoc.xp += xpGained;
    userDoc.totalXp += xpGained;
    userDoc.messages += 1;

    // Controlla level up
    let xpNeeded = xpForLevel(userDoc.level);
    while (userDoc.xp >= xpNeeded) {
      userDoc.xp -= xpNeeded;
      userDoc.level += 1;
      xpNeeded = xpForLevel(userDoc.level);
    }

    await userDoc.save();

    if (userDoc.level > oldLevel) {
      const vars = {
        user: `<@${message.author.id}>`,
        username: message.author.username,
        level: userDoc.level,
        server: message.guild.name,
      };
      const lvlMsg = replaceVariables(guildConfig.levelUpMessage, vars);
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setDescription(`🎉 ${lvlMsg}`)
        .setTimestamp();

      const targetChannel = guildConfig.levelUpChannel
        ? message.guild.channels.cache.get(guildConfig.levelUpChannel) || message.channel
        : message.channel;

      await targetChannel.send({ embeds: [embed] }).catch(() => {});
    }
  },
};
