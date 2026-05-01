const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Railway fornisce MYSQL_URL (interno) o MYSQL_PUBLIC_URL (esterno/locale)
const mysqlUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;

const sequelize = mysqlUrl
  ? new Sequelize(mysqlUrl, { dialect: 'mysql', logging: false })
  : new Sequelize(
      process.env.MYSQL_DB || process.env.MYSQLDATABASE,
      process.env.MYSQL_USER || process.env.MYSQLUSER,
      process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD,
      {
        host: process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || process.env.MYSQLPORT) || 3306,
        dialect: 'mysql',
        logging: false,
      }
    );

async function connectDB() {
  try {
    await sequelize.authenticate();
    // Crea/aggiorna le tabelle automaticamente
    await sequelize.sync({ alter: true });
    logger.info('✅ Connesso a MySQL');
  } catch (err) {
    logger.error('❌ Errore connessione MySQL:', err);
    process.exit(1);
  }
}

module.exports = { connectDB, sequelize };
