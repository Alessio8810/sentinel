const { EmbedBuilder } = require('discord.js');
const Guild = require('../database/models/Guild');

const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const PLATFORM_EMOJIS = { twitch: '🟣', youtube: '▶️', tiktok: '🎵', instagram: '📸', altro: '🎮' };
const PLATFORM_COLORS = { twitch: '#9146ff', youtube: '#ff0000', tiktok: '#e6edf3', instagram: '#e1306c', altro: '#5865F2' };

// Tiene traccia delle notifiche già inviate per evitare duplicati: `guildId-entryId-week`
const sentNotifications = new Set();

function getWeekKey() {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(((now - new Date(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${week}`;
}

async function checkSchedule(client) {
  const now = new Date();
  const currentDay = now.getDay();   // 0=Dom, 1=Lun, ...
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const weekKey = getWeekKey();

  // Cerca tutte le guild con almeno una live in programma
  const guilds = await Guild.findAll({
    where: {},
  });

  for (const guildConfig of guilds) {
    const schedule = Array.isArray(guildConfig.liveSchedule) ? guildConfig.liveSchedule : [];
    if (schedule.length === 0) continue;

    const guild = client.guilds.cache.get(guildConfig.guildId);
    if (!guild) continue;

    for (const entry of schedule) {
      // Controlla se la live è oggi
      if (entry.giorno !== currentDay) continue;

      // Parsea orario
      const [liveHour, liveMin] = entry.orario.split(':').map(Number);

      // Notifica 30 minuti prima
      const notifyHour = liveHour;
      const notifyMin = liveMin - 30;
      const adjustedHour = notifyMin < 0 ? notifyHour - 1 : notifyHour;
      const adjustedMin = notifyMin < 0 ? notifyMin + 60 : notifyMin;

      if (currentHour !== adjustedHour || currentMin !== adjustedMin) continue;

      const notifKey = `${guildConfig.guildId}-${entry.id}-${weekKey}`;
      if (sentNotifications.has(notifKey)) continue;
      sentNotifications.add(notifKey);

      const embed = new EmbedBuilder()
        .setColor(PLATFORM_COLORS[entry.piattaforma] || '#5865F2')
        .setTitle(`${PLATFORM_EMOJIS[entry.piattaforma] || '🎮'} Live tra 30 minuti!`)
        .setDescription(`**${entry.titolo}**`)
        .addFields(
          { name: 'Giorno', value: DAYS[entry.giorno], inline: true },
          { name: 'Orario', value: entry.orario, inline: true },
          { name: 'Piattaforma', value: entry.piattaforma.charAt(0).toUpperCase() + entry.piattaforma.slice(1), inline: true },
          ...(entry.note ? [{ name: 'Note', value: entry.note }] : []),
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
        .setTimestamp();

      // Notifica nel canale del server (se configurato)
      if (guildConfig.scheduleChannel) {
        const ch = guild.channels.cache.get(guildConfig.scheduleChannel);
        if (ch) {
          await ch.send({ content: '@here', embeds: [embed] }).catch(() => {});
        }
      }

      // DM ai subscriber
      const subscribers = Array.isArray(guildConfig.scheduleSubscribers) ? guildConfig.scheduleSubscribers : [];
      for (const userId of subscribers) {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) continue;
        const dmEmbed = new EmbedBuilder()
          .setColor(PLATFORM_COLORS[entry.piattaforma] || '#5865F2')
          .setTitle(`${PLATFORM_EMOJIS[entry.piattaforma] || '🎮'} Live tra 30 minuti su **${guild.name}**!`)
          .setDescription(`**${entry.titolo}**`)
          .addFields(
            { name: 'Orario', value: entry.orario, inline: true },
            { name: 'Piattaforma', value: entry.piattaforma.charAt(0).toUpperCase() + entry.piattaforma.slice(1), inline: true },
            ...(entry.note ? [{ name: 'Note', value: entry.note }] : []),
          )
          .setFooter({ text: `Server: ${guild.name}` })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    }
  }
}

function startScheduleJob(client) {
  // Controlla ogni minuto
  setInterval(() => checkSchedule(client).catch(console.error), 60000);
}

module.exports = { startScheduleJob };
