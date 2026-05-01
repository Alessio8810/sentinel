const { EmbedBuilder } = require('discord.js');

// Mappa anti-spam: userId -> [timestamp, ...]
const spamMap = new Map();

async function check(message, config) {
  const automod = config.automod;
  if (!automod?.enabled) return false;

  const content = message.content;
  const member = message.member;

  // Ignora amministratori
  if (member.permissions.has('Administrator')) return false;

  // ─── FILTRO INVITI DISCORD ───
  if (automod.filterInvites && /discord\.gg\/\w+/i.test(content)) {
    await message.delete().catch(() => {});
    await warn(message, 'Inviti Discord non consentiti', config);
    return true;
  }

  // ─── FILTRO LINK ───
  if (automod.filterLinks) {
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const links = content.match(linkRegex) || [];
    const badLinks = links.filter(l => {
      if (!automod.allowedLinks?.length) return true;
      return !automod.allowedLinks.some(allowed => l.includes(allowed));
    });
    if (badLinks.length > 0) {
      await message.delete().catch(() => {});
      await warn(message, 'Link non consentiti', config);
      return true;
    }
  }

  // ─── FILTRO SPAM EMOJI ───
  if (automod.filterEmojis) {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}]|<a?:\w+:\d+>/gu;
    const emojiCount = (content.match(emojiRegex) || []).length;
    if (emojiCount > (automod.emojiLimit || 10)) {
      await message.delete().catch(() => {});
      await warn(message, 'Troppi emoji in un messaggio', config);
      return true;
    }
  }

  // ─── FILTRO PAROLE VIETATE ───
  if (automod.badWords?.length) {
    const lower = content.toLowerCase();
    const found = automod.badWords.some(w => lower.includes(w.toLowerCase()));
    if (found) {
      await message.delete().catch(() => {});
      await warn(message, 'Linguaggio inappropriato', config);
      return true;
    }
  }

  // ─── ANTI-SPAM ───
  if (automod.filterSpam) {
    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const threshold = automod.spamThreshold || 5;
    const interval = automod.spamInterval || 5000;

    if (!spamMap.has(key)) spamMap.set(key, []);
    const times = spamMap.get(key).filter(t => now - t < interval);
    times.push(now);
    spamMap.set(key, times);

    if (times.length >= threshold) {
      // Elimina i messaggi recenti
      const messages = await message.channel.messages.fetch({ limit: threshold }).catch(() => null);
      if (messages) {
        const toDelete = messages.filter(m => m.author.id === message.author.id);
        await message.channel.bulkDelete(toDelete).catch(() => {});
      }
      spamMap.set(key, []);
      await warn(message, 'Spam rilevato', config);
      return true;
    }
  }

  return false;
}

async function warn(message, reason, config) {
  const automod = config.automod;
  if (!automod?.logChannel) return;

  const logChannel = message.guild.channels.cache.get(automod.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('🛡️ Auto-Mod Intervento')
    .addFields(
      { name: 'Utente', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
      { name: 'Canale', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Motivo', value: reason },
      { name: 'Contenuto', value: message.content.slice(0, 1024) || '*(vuoto)*' },
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(() => {});

  // Notifica privata all'utente
  await message.author.send(`⚠️ Il tuo messaggio in **${message.guild.name}** è stato rimosso: **${reason}**`).catch(() => {});
}

module.exports = { check };
