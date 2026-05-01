const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Gestisci i reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('create').setDescription('Crea un nuovo messaggio reaction role')
      .addChannelOption(o => o.setName('canale').setRequired(true).setDescription('Canale dove inviare il messaggio'))
      .addStringOption(o => o.setName('testo').setRequired(true).setDescription('Testo del messaggio'))
      .addStringOption(o => o.setName('tipo').setRequired(true).setDescription('Tipo di reaction role').addChoices(
        { name: 'Normal', value: 'normal' },
        { name: 'Unique (un solo ruolo)', value: 'unique' },
        { name: 'Reversed (rimuove al clic)', value: 'reversed' },
      ))
    )
    .addSubcommand(s => s.setName('add').setDescription('Aggiungi un emoji-ruolo a un messaggio esistente')
      .addStringOption(o => o.setName('message_id').setRequired(true).setDescription('ID del messaggio'))
      .addStringOption(o => o.setName('emoji').setRequired(true).setDescription('Emoji'))
      .addRoleOption(o => o.setName('ruolo').setRequired(true).setDescription('Ruolo'))
    )
    .addSubcommand(s => s.setName('delete').setDescription('Elimina un reaction role').addStringOption(o => o.setName('message_id').setRequired(true).setDescription('ID messaggio'))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let [config] = await Guild.findOrCreate({ where: { guildId: interaction.guild.id } });

    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const channel = interaction.options.getChannel('canale');
      const text = interaction.options.getString('testo');
      const type = interaction.options.getString('tipo');

      const embed = new EmbedBuilder().setColor('#5865F2').setDescription(text);
      const msg = await channel.send({ embeds: [embed] });

      config.reactionRoles = [...(config.reactionRoles || []), { messageId: msg.id, channelId: channel.id, type, roles: [] }];
      await config.save();

      return interaction.editReply({ embeds: [successEmbed(`Messaggio reaction role creato in ${channel}.\nID: \`${msg.id}\``)] });
    }

    if (sub === 'add') {
      const msgId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('ruolo');

      const rrList = config.reactionRoles || [];
      const rrIdx = rrList.findIndex(r => r.messageId === msgId);
      if (rrIdx === -1) return interaction.editReply({ embeds: [errorEmbed('Messaggio reaction role non trovato.')] });

      config.reactionRoles = rrList.map((r, i) =>
        i === rrIdx ? { ...r, roles: [...r.roles, { emoji, roleId: role.id }] } : r
      );
      await config.save();

      // Aggiungi reazione al messaggio
      const channel = interaction.guild.channels.cache.get(rrList[rrIdx].channelId);
      if (channel) {
        const msg = await channel.messages.fetch(msgId).catch(() => null);
        if (msg) await msg.react(emoji).catch(() => { });
      }

      return interaction.editReply({ embeds: [successEmbed(`Aggiunto ${emoji} → ${role.name}.`)] });
    }

    if (sub === 'delete') {
      const msgId = interaction.options.getString('message_id');
      config.reactionRoles = (config.reactionRoles || []).filter(r => r.messageId !== msgId);
      await config.save();
      return interaction.editReply({ embeds: [successEmbed('Reaction role rimosso.')] });
    }
  },
};
