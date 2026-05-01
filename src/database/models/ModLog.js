const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const ModLog = sequelize.define('ModLog', {
  guildId: { type: DataTypes.STRING(30), allowNull: false },
  userId: { type: DataTypes.STRING(30), allowNull: false },
  moderatorId: { type: DataTypes.STRING(30), allowNull: false },
  action: {
    type: DataTypes.ENUM('warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'tempban', 'tempmute'),
    allowNull: false,
  },
  reason: { type: DataTypes.TEXT, defaultValue: 'Nessuna ragione specificata' },
  duration: { type: DataTypes.BIGINT, allowNull: true }, // in millisecondi
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'mod_logs',
  timestamps: true,
});

module.exports = ModLog;
