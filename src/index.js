require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { Player } = require('discord-player');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { connectDB } = require('./database/connection');
const { startSocialAlerts } = require('./modules/socialAlerts');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
client.cooldowns = new Collection();

(async () => {
  // Inizializza discord-player
  const player = new Player(client);
  await player.extractors.loadDefault();
  logger.info('✅ Discord Player inizializzato');

  await connectDB();
  await loadCommands(client);
  await loadEvents(client);
  await client.login(process.env.BOT_TOKEN);

  // Avvia il polling dei social dopo il login
  client.once('ready', () => startSocialAlerts(client));
})();

module.exports = client;
