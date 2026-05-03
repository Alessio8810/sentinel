const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Gestisci la programmazione live del server')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Aggiungi una live in programma')
      .addStringOption(o => o.setName('titolo').setDescription('Titolo/gioco della live').setRequired(true))
      .addStringOption(o => o.setName('giorno').setDescription('Giorno della settimana').setRequired(true)
        .addChoices(
          { name: 'Lunedì', value: '1' },
          { name: 'Martedì', value: '2' },
          { name: 'Mercoledì', value: '3' },
          { name: 'Giovedì', value: '4' },
          { name: 'Venerdì', value: '5' },
          { name: 'Sabato', value: '6' },
          { name: 'Domenica', value: '0' },
        ))
      .addStringOption(o => o.setName('orario').setDescription('Orario della live (es. 21:00)').setRequired(true))
      .addStringOption(o => o.setName('piattaforma').setDescription('Piattaforma').setRequired(false)
        .addChoices(
          { name: '🟣 Twitch', value: 'twitch' },
          { name: '▶️ YouTube', value: 'youtube' },
          { name: '🎵 TikTok', value: 'tiktok' },
          { name: '📸 Instagram', value: 'instagram' },
          { name: '🎮 Altro', value: 'altro' },
        ))
      .addStringOption(o => o.setName('note').setDescription('Note aggiuntive (opzionale)').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Rimuovi una live dalla programmazione')
      .addIntegerOption(o => o.setName('id').setDescription('ID della live (vedi /schedule list)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Visualizza la programmazione live del server'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 3,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: sub !== 'list' });

    const guildConfig = await Guild.findOne({ where: { guildId: interaction.guild.id } });
    if (!guildConfig) return interaction.editReply({ content: '❌ Configurazione server non trovata.' });

    const schedule = Array.isArray(guildConfig.liveSchedule) ? [...guildConfig.liveSchedule] : [];

    // ─── ADD ───
    if (sub === 'add') {
      const titolo = interaction.options.getString('titolo');
      const giorno = parseInt(interaction.options.getString('giorno'));
      const orario = interaction.options.getString('orario');
      const piattaforma = interaction.options.getString('piattaforma') || 'altro';
      const note = interaction.options.getString('note') || '';

      if (!/^\d{1,2}:\d{2}$/.test(orario)) {
        return interaction.editReply({ content: '❌ Formato orario non valido. Usa HH:MM (es. 21:00)' });
      }

      const entry = {
        id: Date.now(),
        titolo,
        giorno,
        orario,
        piattaforma,
        note,
        addedBy: interaction.user.id,
        addedAt: new Date().toISOString(),
      };

      schedule.push(entry);
      guildConfig.liveSchedule = schedule;
      await guildConfig.save();

      const platformEmojis = { twitch: '🟣', youtube: '▶️', tiktok: '🎵', instagram: '📸', altro: '🎮' };
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📅 Live aggiunta alla programmazione')
        .addFields(
          { name: 'Titolo', value: titolo, inline: true },
          { name: 'Giorno', value: DAYS[giorno === 0 ? 6 : giorno - 1], inline: true },
          { name: 'Orario', value: orario, inline: true },
          { name: 'Piattaforma', value: `${platformEmojis[piattaforma]} ${piattaforma.charAt(0).toUpperCase() + piattaforma.slice(1)}`, inline: true },
          ...(note ? [{ name: 'Note', value: note, inline: false }] : []),
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ─── REMOVE ───
    if (sub === 'remove') {
      const id = interaction.options.getInteger('id');
      const idx = schedule.findIndex(e => e.id === id);
      if (idx === -1) return interaction.editReply({ content: `❌ Nessuna live con ID **${id}** trovata.` });

      const removed = schedule.splice(idx, 1)[0];
      guildConfig.liveSchedule = schedule;
      await guildConfig.save();

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ Live **${removed.titolo}** rimossa dalla programmazione.`)],
      });
    }

    // ─── LIST ───
    if (sub === 'list') {
      if (schedule.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#5865F2')
            .setDescription('📅 Nessuna live in programmazione.\nUsa `/schedule add` per aggiungerne una.')],
        });
      }

      const platformEmojis = { twitch: '🟣', youtube: '▶️', tiktok: '🎵', instagram: '📸', altro: '🎮' };

      // Ordina per giorno della settimana, poi orario
      const sorted = [...schedule].sort((a, b) => {
        const dayDiff = a.giorno - b.giorno;
        if (dayDiff !== 0) return dayDiff;
        return a.orario.localeCompare(b.orario);
      });

      // Raggruppa per giorno
      const byDay = {};
      for (const e of sorted) {
        const dayName = DAYS[e.giorno === 0 ? 6 : e.giorno - 1];
        if (!byDay[dayName]) byDay[dayName] = [];
        byDay[dayName].push(e);
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📅 Programmazione Live')
        .setDescription(`**${interaction.guild.name}** — orari settimanali`)
        .setTimestamp();

      for (const [day, entries] of Object.entries(byDay)) {
        const lines = entries.map(e =>
          `${platformEmojis[e.piattaforma]} **${e.orario}** — ${e.titolo}${e.note ? ` *(${e.note})*` : ''} \`ID:${e.id}\``
        ).join('\n');
        embed.addFields({ name: `📆 ${day}`, value: lines });
      }

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
