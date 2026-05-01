const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configura l\'auto-moderazione')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('enable').setDescription('Abilita/disabilita auto-mod').addBooleanOption(o => o.setName('stato').setDescription('true=abilita, false=disabilita').setRequired(true)))
    .addSubcommand(s => s.setName('filtri').setDescription('Configura i filtri')
      .addBooleanOption(o => o.setName('link').setDescription('Filtra link'))
      .addBooleanOption(o => o.setName('inviti').setDescription('Filtra inviti Discord'))
      .addBooleanOption(o => o.setName('spam').setDescription('Anti-spam'))
      .addBooleanOption(o => o.setName('emoji').setDescription('Limita emoji'))
      .addIntegerOption(o => o.setName('emoji_limit').setDescription('Limite emoji per messaggio').setMinValue(1).setMaxValue(50))
      .addIntegerOption(o => o.setName('spam_soglia').setDescription('Messaggi prima di trigger spam').setMinValue(2).setMaxValue(20))
    )
    .addSubcommand(s => s.setName('badwords').setDescription('Aggiungi/rimuovi parole vietate')
      .addStringOption(o => o.setName('azione').setDescription('add o remove').setRequired(true).addChoices({ name: 'Aggiungi', value: 'add' }, { name: 'Rimuovi', value: 'remove' }))
      .addStringOption(o => o.setName('parola').setDescription('Parola').setRequired(true))
    )
    .addSubcommand(s => s.setName('logchannel').setDescription('Canale per i log auto-mod').addChannelOption(o => o.setName('canale').setDescription('Canale').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('Mostra configurazione attuale')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let [guildConfig] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });

    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      const stato = interaction.options.getBoolean('stato');
      guildConfig.automod = { ...guildConfig.automod, enabled: stato };
      await guildConfig.save();
      return interaction.editReply({ embeds: [successEmbed(`Auto-mod ${stato ? '✅ abilitata' : '❌ disabilitata'}.`)] });
    }

    if (sub === 'filtri') {
      const link = interaction.options.getBoolean('link');
      const inviti = interaction.options.getBoolean('inviti');
      const spam = interaction.options.getBoolean('spam');
      const emoji = interaction.options.getBoolean('emoji');
      const emojiLimit = interaction.options.getInteger('emoji_limit');
      const spamSoglia = interaction.options.getInteger('spam_soglia');

      const updated = { ...guildConfig.automod };
      if (link !== null) updated.filterLinks = link;
      if (inviti !== null) updated.filterInvites = inviti;
      if (spam !== null) updated.filterSpam = spam;
      if (emoji !== null) updated.filterEmojis = emoji;
      if (emojiLimit) updated.emojiLimit = emojiLimit;
      if (spamSoglia) updated.spamThreshold = spamSoglia;
      guildConfig.automod = updated;

      await guildConfig.save();
      return interaction.editReply({ embeds: [successEmbed('Filtri auto-mod aggiornati.')] });
    }

    if (sub === 'badwords') {
      const action = interaction.options.getString('azione');
      const word = interaction.options.getString('parola').toLowerCase();
      const currentWords = guildConfig.automod?.badWords || [];

      if (action === 'add') {
        if (!currentWords.includes(word)) {
          guildConfig.automod = { ...guildConfig.automod, badWords: [...currentWords, word] };
        }
        await guildConfig.save();
        return interaction.editReply({ embeds: [successEmbed(`Parola \`${word}\` aggiunta alla lista.`)] });
      } else {
        guildConfig.automod = { ...guildConfig.automod, badWords: currentWords.filter(w => w !== word) };
        await guildConfig.save();
        return interaction.editReply({ embeds: [successEmbed(`Parola \`${word}\` rimossa dalla lista.`)] });
      }
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('canale');
      guildConfig.automod = { ...guildConfig.automod, logChannel: channel.id };
      await guildConfig.save();
      return interaction.editReply({ embeds: [successEmbed(`Canale log impostato su ${channel}.`)] });
    }

    if (sub === 'status') {
      const a = guildConfig.automod;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Configurazione Auto-Mod')
        .addFields(
          { name: 'Stato', value: a.enabled ? '✅ Abilitato' : '❌ Disabilitato', inline: true },
          { name: 'Filtro Link', value: a.filterLinks ? '✅' : '❌', inline: true },
          { name: 'Filtro Inviti', value: a.filterInvites ? '✅' : '❌', inline: true },
          { name: 'Anti-Spam', value: a.filterSpam ? `✅ (${a.spamThreshold} msg)` : '❌', inline: true },
          { name: 'Filtro Emoji', value: a.filterEmojis ? `✅ (max ${a.emojiLimit})` : '❌', inline: true },
          { name: 'Parole Vietate', value: a.badWords.length ? a.badWords.join(', ') : 'Nessuna', inline: false },
          { name: 'Log Channel', value: a.logChannel ? `<#${a.logChannel}>` : 'Non impostato', inline: true },
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
