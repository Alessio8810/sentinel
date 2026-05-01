const { EmbedBuilder } = require('discord.js');
const Guild = require('../database/models/Guild');
const User = require('../database/models/User');
const { xpForLevel, replaceVariables } = require('../utils/helpers');

// Mappa delle sessioni vocali attive: `guildId-userId` → { joinedAt, guildId, userId }
const voiceSessions = new Map();

// XP guadagnati per ogni minuto in canale vocale (prima dei moltiplicatori)
const VOICE_XP_PER_MINUTE = 10;

async function awardVoiceXp(client, guildId, userId, minutes) {
  if (minutes < 1) return;

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const guildConfig = await Guild.findOne({ where: { guildId } });
    if (!guildConfig || !guildConfig.levelsEnabled) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    // Ruoli esclusi dall'XP
    if (member.roles.cache.some(r => (guildConfig.noXpRoles || []).includes(r.id))) return;

    // Moltiplicatore XP dai ruoli
    let multiplier = 1;
    for (const m of (guildConfig.xpMultipliers || [])) {
      if (member.roles.cache.has(m.roleId)) {
        multiplier = Math.max(multiplier, m.multiplier);
      }
    }

    const xpGained = Math.floor(VOICE_XP_PER_MINUTE * minutes * multiplier);

    let [userDoc] = await User.findOrCreate({ where: { userId, guildId } });

    const oldLevel = userDoc.level;
    userDoc.xp += xpGained;
    userDoc.totalXp += xpGained;

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
        user: `<@${userId}>`,
        username: member.user.username,
        level: userDoc.level,
        server: guild.name,
      };
      const lvlMsg = replaceVariables(guildConfig.levelUpMessage, vars);
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setDescription(`🎉 ${lvlMsg}`)
        .setTimestamp();

      if (guildConfig.levelUpChannel) {
        const ch = guild.channels.cache.get(guildConfig.levelUpChannel);
        if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Voice XP error:', e.message);
  }
}

module.exports = {
  name: 'voiceStateUpdate',
  voiceSessions, // esportato per usarlo nel ready
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.id;
    const guildId = (newState.guild || oldState.guild).id;
    const key = `${guildId}-${userId}`;

    const joinedChannel = !oldState.channel && newState.channel;
    const leftChannel = oldState.channel && !newState.channel;
    const movedChannel = oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id;

    if (joinedChannel) {
      const guildConfig = await Guild.findOne({ where: { guildId } });
      if (guildConfig && (guildConfig.noXpChannels || []).includes(newState.channel.id)) return;
      voiceSessions.set(key, { joinedAt: Date.now(), guildId, userId });

    } else if (leftChannel) {
      const session = voiceSessions.get(key);
      if (session) {
        voiceSessions.delete(key);
        const minutes = Math.floor((Date.now() - session.joinedAt) / 60000);
        await awardVoiceXp(client, guildId, userId, minutes);
      }

    } else if (movedChannel) {
      // Assegna XP per il tempo nel vecchio canale
      const session = voiceSessions.get(key);
      if (session) {
        const minutes = Math.floor((Date.now() - session.joinedAt) / 60000);
        await awardVoiceXp(client, guildId, userId, minutes);
      }
      // Avvia nuova sessione nel nuovo canale (se non escluso)
      const guildConfig = await Guild.findOne({ where: { guildId } });
      if (guildConfig && (guildConfig.noXpChannels || []).includes(newState.channel.id)) {
        voiceSessions.delete(key);
      } else {
        voiceSessions.set(key, { joinedAt: Date.now(), guildId, userId });
      }
    }
  },
};
