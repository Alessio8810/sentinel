const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const User = sequelize.define('User', {
  userId: { type: DataTypes.STRING(30), allowNull: false },
  guildId: { type: DataTypes.STRING(30), allowNull: false },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },
  level: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalXp: { type: DataTypes.INTEGER, defaultValue: 0 },
  messages: { type: DataTypes.INTEGER, defaultValue: 0 },
  rankCardBackground: { type: DataTypes.STRING(500), allowNull: true },
  rankCardColor: { type: DataTypes.STRING(10), defaultValue: '#5865F2' },
  warnings: { type: DataTypes.JSON, defaultValue: [] },
  muted: { type: DataTypes.BOOLEAN, defaultValue: false },
  muteExpires: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [{ unique: true, fields: ['userId', 'guildId'] }],
});

module.exports = User;
