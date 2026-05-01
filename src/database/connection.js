const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.MYSQL_DB,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
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
