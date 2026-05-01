const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../database/models/User');
const { xpForLevel } = require('../../utils/helpers');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Mostra la tua card di livello o quella di un altro utente')
    .addUserOption(o => o.setName('utente').setDescription('Utente')),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getMember('utente') || interaction.member;
    const userDoc = await User.findOne({ where: { userId: target.id, guildId: interaction.guild.id } });

    const level = userDoc?.level || 0;
    const xp = userDoc?.xp || 0;
    const totalXp = userDoc?.totalXp || 0;
    const xpNeeded = xpForLevel(level);
    const color = userDoc?.rankCardColor || '#5865F2';

    // Ottieni rank nella classifica
    const rank = await User.count({ where: { guildId: interaction.guild.id, totalXp: { [Op.gt]: totalXp } } }) + 1;

    // ─── CANVAS RANK CARD ───
    const canvas = createCanvas(900, 280);
    const ctx = canvas.getContext('2d');

    // Sfondo
    ctx.fillStyle = '#23272A';
    roundRect(ctx, 0, 0, 900, 280, 20);
    ctx.fill();

    // Barra XP sfondo
    ctx.fillStyle = '#2C2F33';
    roundRect(ctx, 220, 190, 640, 35, 17.5);
    ctx.fill();

    // Barra XP avanzamento
    const progress = Math.min(xp / xpNeeded, 1);
    ctx.fillStyle = color;
    if (progress > 0) {
      roundRect(ctx, 220, 190, 640 * progress, 35, 17.5);
      ctx.fill();
    }

    // Avatar
    const avatarURL = target.user.displayAvatarURL({ extension: 'png', size: 256 });
    try {
      const avatar = await loadImage(avatarURL);
      ctx.save();
      ctx.beginPath();
      ctx.arc(120, 140, 90, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 30, 50, 180, 180);
      ctx.restore();
    } catch {}

    // Testi
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(target.user.username, 230, 80);

    ctx.fillStyle = '#B9BBBE';
    ctx.font = '24px sans-serif';
    ctx.fillText(`#${rank}`, 820, 80);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(`Livello ${level}`, 230, 170);

    ctx.fillStyle = '#B9BBBE';
    ctx.font = '22px sans-serif';
    ctx.fillText(`${xp} / ${xpNeeded} XP`, 220, 250);
    ctx.fillText(`XP Totale: ${totalXp}`, 620, 250);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });
    await interaction.editReply({ files: [attachment] });
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
