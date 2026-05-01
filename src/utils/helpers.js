const { EmbedBuilder } = require('discord.js');

/**
 * Calcola l'XP necessario per il prossimo livello
 */
function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

/**
 * Calcola il livello dato un totale di XP
 */
function levelFromXp(totalXp) {
  let level = 0;
  let xp = totalXp;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return { level, currentXp: xp };
}

/**
 * Crea un embed standard per il bot
 */
function createEmbed(options = {}) {
  return new EmbedBuilder()
    .setColor(options.color || '#5865F2')
    .setTitle(options.title || null)
    .setDescription(options.description || null)
    .setFooter(options.footer ? { text: options.footer } : null)
    .setTimestamp(options.timestamp !== false ? new Date() : null);
}

/**
 * Embed di errore
 */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setDescription(`❌ ${message}`)
    .setTimestamp();
}

/**
 * Embed di successo
 */
function successEmbed(message) {
  return new EmbedBuilder()
    .setColor('#57F287')
    .setDescription(`✅ ${message}`)
    .setTimestamp();
}

/**
 * Parsa una durata in stringa (es. "10m", "2h", "1d") in millisecondi
 */
function parseDuration(str) {
  const ms = require('ms');
  const parsed = ms(str);
  if (!parsed || isNaN(parsed)) return null;
  return parsed;
}

/**
 * Formatta una durata in ms in stringa leggibile
 */
function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days) parts.push(`${days}g`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

/**
 * Sostituisce le variabili in una stringa
 */
function replaceVariables(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);
}

module.exports = { xpForLevel, levelFromXp, createEmbed, errorEmbed, successEmbed, parseDuration, formatDuration, replaceVariables };
