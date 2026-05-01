const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customcommand')
    .setDescription('Gestisci i comandi personalizzati')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('add').setDescription('Aggiungi un comando personalizzato')
      .addStringOption(o => o.setName('trigger').setRequired(true).setDescription('Parola/frase trigger'))
      .addStringOption(o => o.setName('risposta').setRequired(true).setDescription('Risposta ({user}, {username}, {channel}, {server})'))
      .addBooleanOption(o => o.setName('dm').setDescription('Rispondi in DM'))
      .addBooleanOption(o => o.setName('elimina').setDescription('Elimina il messaggio originale'))
    )
    .addSubcommand(s => s.setName('remove').setDescription('Rimuovi un comando').addStringOption(o => o.setName('trigger').setRequired(true).setDescription('Trigger')))
    .addSubcommand(s => s.setName('list').setDescription('Lista comandi personalizzati')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const response = interaction.options.getString('risposta');
      const dm = interaction.options.getBoolean('dm') || false;
      const del = interaction.options.getBoolean('elimina') || false;

      const cmds = config.customCommands || [];
      const exists = cmds.find(c => c.trigger === trigger);
      if (exists) return interaction.editReply({ embeds: [errorEmbed('Esiste già un comando con questo trigger.')] });

      config.customCommands = [...cmds, { trigger, response, replyInDm: dm, deleteOriginal: del }];
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Comando \`${trigger}\` aggiunto.`)] });
    }

    if (sub === 'remove') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      config.customCommands = (config.customCommands || []).filter(c => c.trigger !== trigger);
      await config.save();
      return interaction.editReply({ embeds: [successEmbed(`Comando \`${trigger}\` rimosso.`)] });
    }

    if (sub === 'list') {
      const cmds = config.customCommands || [];
      if (!cmds.length) return interaction.editReply({ embeds: [errorEmbed('Nessun comando personalizzato.')] });
      const list = cmds.map((c, i) => `**${i + 1}.** \`${c.trigger}\` → ${c.response.slice(0, 50)}...`).join('\n');
      const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📋 Comandi Personalizzati').setDescription(list).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
