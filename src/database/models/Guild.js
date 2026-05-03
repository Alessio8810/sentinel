const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Guild = sequelize.define('Guild', {
  guildId: { type: DataTypes.STRING(30), primaryKey: true },
  prefix: { type: DataTypes.STRING(10), defaultValue: '!' },
  modLogChannel: { type: DataTypes.STRING(30), allowNull: true },
  welcomeChannel: { type: DataTypes.STRING(30), allowNull: true },
  welcomeMessage: { type: DataTypes.TEXT, defaultValue: 'Benvenuto {user} nel server {server}!' },
  welcomeEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  levelUpChannel: { type: DataTypes.STRING(30), allowNull: true },
  levelUpMessage: { type: DataTypes.TEXT, defaultValue: '{user} è salito al livello {level}! 🎉' },
  levelsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  noXpRoles: { type: DataTypes.JSON, defaultValue: [] },
  noXpChannels: { type: DataTypes.JSON, defaultValue: [] },
  xpMultipliers: { type: DataTypes.JSON, defaultValue: [] },
  automod: {
    type: DataTypes.JSON,
    defaultValue: {
      enabled: false,
      filterLinks: false,
      filterInvites: false,
      filterSpam: false,
      spamThreshold: 5,
      spamInterval: 5000,
      filterEmojis: false,
      emojiLimit: 10,
      badWords: [],
      allowedLinks: [],
      logChannel: null,
    },
  },
  musicChannel: { type: DataTypes.STRING(30), allowNull: true },
  djRole: { type: DataTypes.STRING(30), allowNull: true },
  socialAlerts: { type: DataTypes.JSON, defaultValue: [] },
  reactionRoles: { type: DataTypes.JSON, defaultValue: [] },
  customCommands: { type: DataTypes.JSON, defaultValue: [] },
  ticketCategory: { type: DataTypes.STRING(30), allowNull: true },
  ticketLogChannel: { type: DataTypes.STRING(30), allowNull: true },
  ticketsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  botName: { type: DataTypes.STRING(100), allowNull: true },
  botAvatar: { type: DataTypes.STRING(500), allowNull: true },
  premiumEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  twitchAlerts: { type: DataTypes.JSON, defaultValue: { channelId: null, streamers: [] } },
  tiktokAlerts: { type: DataTypes.JSON, defaultValue: { channelId: null, users: [] } },
  instagramAlerts: { type: DataTypes.JSON, defaultValue: { channelId: null, users: [] } },
  liveSchedule: { type: DataTypes.JSON, defaultValue: [] },
  scheduleChannel: { type: DataTypes.STRING(30), allowNull: true },
  scheduleSubscribers: { type: DataTypes.JSON, defaultValue: [] },
}, {
  tableName: 'guilds',
  timestamps: true,
});

module.exports = Guild;

