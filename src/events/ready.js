const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`✅ Bot online come ${client.user.tag}`);
    client.user.setActivity('il tuo server 👀', { type: 3 }); // WATCHING
  },
};
