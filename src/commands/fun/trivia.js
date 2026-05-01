const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const questions = [
  { q: 'Capitale dell\'Italia?', a: 'Roma', choices: ['Milano', 'Roma', 'Napoli', 'Torino'] },
  { q: 'Quanti pianeti ha il sistema solare?', a: '8', choices: ['7', '8', '9', '10'] },
  { q: 'Chi ha scritto la Divina Commedia?', a: 'Dante', choices: ['Petrarca', 'Boccaccio', 'Dante', 'Leopardi'] },
  { q: 'In che anno è finita la Seconda Guerra Mondiale?', a: '1945', choices: ['1943', '1944', '1945', '1946'] },
  { q: 'Qual è il pianeta più grande del sistema solare?', a: 'Giove', choices: ['Saturno', 'Giove', 'Urano', 'Nettuno'] },
];

const emojis = ['🇦', '🇧', '🇨', '🇩'];
const activeTrivia = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Avvia una domanda di trivia'),
  cooldown: 10,
  async execute(interaction) {
    if (activeTrivia.has(interaction.channel.id)) {
      return interaction.reply({ content: '❌ C\'è già una domanda attiva in questo canale!', ephemeral: true });
    }

    const q = questions[Math.floor(Math.random() * questions.length)];
    const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
    const correctIndex = shuffled.indexOf(q.a);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🧠 Trivia!')
      .setDescription(`**${q.q}**\n\n${shuffled.map((c, i) => `${emojis[i]} ${c}`).join('\n')}`)
      .setFooter({ text: 'Reagisci con l\'emoji della risposta corretta! (30 secondi)' })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < shuffled.length; i++) await msg.react(emojis[i]);

    activeTrivia.set(interaction.channel.id, true);

    const filter = (reaction, user) => emojis.includes(reaction.emoji.name) && !user.bot;
    const collector = msg.createReactionCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (reaction, user) => {
      const idx = emojis.indexOf(reaction.emoji.name);
      if (shuffled[idx] === q.a) {
        await interaction.channel.send(`✅ **${user.tag}** ha risposto correttamente! La risposta era: **${q.a}**`);
      } else {
        await interaction.channel.send(`❌ **${user.tag}** ha sbagliato! La risposta corretta era: **${q.a}**`);
      }
    });

    collector.on('end', (collected) => {
      activeTrivia.delete(interaction.channel.id);
      if (collected.size === 0) {
        interaction.channel.send(`⏰ Tempo scaduto! La risposta era: **${q.a}**`);
      }
    });
  },
};
