const logger = require('../utils/logger');
const { startScheduleJob } = require('../modules/scheduleNotifier');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`✅ Bot online come ${client.user.tag}`);
    client.user.setActivity('il tuo server 👀', { type: 3 }); // WATCHING

    // Registra gli utenti già presenti nei canali vocali al momento dell'avvio
    const { voiceSessions } = require('./voiceStateUpdate');
    for (const guild of client.guilds.cache.values()) {
      for (const [, channel] of guild.channels.cache.filter(c => c.isVoiceBased())) {
        for (const [, member] of channel.members) {
          if (member.user.bot) continue;
          const key = `${guild.id}-${member.id}`;
          if (!voiceSessions.has(key)) {
            voiceSessions.set(key, { joinedAt: Date.now(), guildId: guild.id, userId: member.id });
          }
        }
      }
    // Avvia il job per le notifiche della programmazione live
    startScheduleJob(client);
    logger.info('✅ Schedule notifier avviato');
  },
};
