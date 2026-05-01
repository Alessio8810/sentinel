const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('Configura il sistema di livelli')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('toggle').setDescription('Abilita/disabilita i livelli').addBooleanOption(o => o.setName('stato').setRequired(true).setDescription('true=abilita')))
    .addSubcommand(s => s.setName('channel').setDescription('Canale per messaggi level-up').addChannelOption(o => o.setName('canale').setRequired(true).setDescription('Canale')))
    .addSubcommand(s => s.setName('message').setDescription('Messaggio di level-up ({user}, {level}, {server})').addStringOption(o => o.setName('msg').setRequired(true).setDescription('Messaggio')))
    .addSubcommand(s => s.setName('noxp-role').setDescription('Aggiungi/rimuovi ruolo da escludere dall\'XP')
      .addStringOption(o => o.setName('azione').setRequired(true).setDescription('Azione da eseguire').addChoices({ name: 'Aggiungi', value: 'add' }, { name: 'Rimuovi', value: 'remove' }))
      .addRoleOption(o => o.setName('ruolo').setRequired(true).setDescription('Ruolo'))
    )
    .addSubcommand(s => s.setName('multiplier').setDescription('Imposta moltiplicatore XP per un ruolo')
      .addRoleOption(o => o.setName('ruolo').setRequired(true).setDescription('Ruolo'))
      .addNumberOption(o => o.setName('valore').setRequired(true).setDescription('Moltiplicatore (es. 2 = doppio XP)').setMinValue(0.5).setMaxValue(10))
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });

    const sub = interaction.options.getSubcommand();

    if (sub === 'toggle') {
      config.levelsEnabled = interaction.options.getBoolean('stato');
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Livelli ${config.levelsEnabled ? 'abilitati' : 'disabilitati'}.`)] });
    }
    if (sub === 'channel') {
      config.levelUpChannel = interaction.options.getChannel('canale').id;
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Canale level-up impostato.`)] });
    }
    if (sub === 'message') {
      config.levelUpMessage = interaction.options.getString('msg');
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Messaggio level-up aggiornato.`)] });
    }
    if (sub === 'noxp-role') {
      const role = interaction.options.getRole('ruolo');
      const action = interaction.options.getString('azione');
      const current = config.noXpRoles || [];
      if (action === 'add') {
        if (!current.includes(role.id)) config.noXpRoles = [...current, role.id];
      } else {
        config.noXpRoles = current.filter(r => r !== role.id);
      }
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Ruolo ${action === 'add' ? 'aggiunto agli' : 'rimosso dagli'} esclusi XP.`)] });
    }
    if (sub === 'multiplier') {
      const role = interaction.options.getRole('ruolo');
      const val = interaction.options.getNumber('valore');
      const current = config.xpMultipliers || [];
      const exists = current.find(m => m.roleId === role.id);
      if (exists) {
        config.xpMultipliers = current.map(m => m.roleId === role.id ? { ...m, multiplier: val } : m);
      } else {
        config.xpMultipliers = [...current, { roleId: role.id, multiplier: val }];
      }
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Moltiplicatore XP x${val} impostato per ${role.name}.`)] });
    }
  },
};
