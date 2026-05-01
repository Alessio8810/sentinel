const { errorEmbed } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Gestione cooldown
    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Map());
    }
    const now = Date.now();
    const timestamps = client.cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        const remaining = ((expirationTime - now) / 1000).toFixed(1);
        return interaction.reply({ embeds: [errorEmbed(`Aspetta ancora **${remaining}s** prima di usare \`/${command.data.name}\`.`)], flags: 64 });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction, client);
    } catch (err) {
      logger.error(`Errore eseguendo /${interaction.commandName}: ${err}`);
      try {
        const reply = { embeds: [errorEmbed('Si è verificato un errore durante l\'esecuzione del comando.')], flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch { /* interaction scaduta o già risposta da altra istanza */ }
    }
  },
};
