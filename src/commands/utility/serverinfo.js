const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Mostra informazioni sul server'),
  async execute(interaction) {
    const guild = interaction.guild;
    await guild.fetch();

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👑 Proprietario', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Membri', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Creato il', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '💬 Canali', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Ruoli', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😀 Emoji', value: `${guild.emojis.cache.size}`, inline: true },
        { name: '🔒 Verifica', value: `Livello ${guild.verificationLevel}`, inline: true },
        { name: '✨ Boosts', value: `${guild.premiumSubscriptionCount || 0} (Livello ${guild.premiumTier})`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
