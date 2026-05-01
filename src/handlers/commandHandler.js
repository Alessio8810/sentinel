const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('../utils/logger');

async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  const categories = fs.readdirSync(commandsPath);

  const commandsData = [];

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(categoryPath, file));
      if (!command.data || !command.execute) continue;
      client.commands.set(command.data.name, command);
      commandsData.push(command.data.toJSON());
      logger.info(`✅ Comando caricato: ${command.data.name}`);
    }
  }

  // Registra i comandi slash su Discord
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    logger.info('🔄 Registrazione comandi slash...');
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commandsData });
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsData });
    }
    logger.info(`✅ ${commandsData.length} comandi slash registrati`);
  } catch (err) {
    logger.error('❌ Errore registrazione comandi:', err);
  }
}

module.exports = { loadCommands };
