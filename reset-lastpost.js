require('dotenv').config();
const { Sequelize } = require('sequelize');
const s = new Sequelize(process.env.MYSQL_DB, process.env.MYSQL_USER, process.env.MYSQL_PASSWORD, {
  host: process.env.MYSQL_HOST, dialect: 'mysql', logging: false
});

(async () => {
  // Legge il record, resetta lastPostId e lastPost per ogni user, risalva
  const [rows] = await s.query("SELECT guildId, tiktokAlerts FROM guilds WHERE tiktokAlerts IS NOT NULL");
  for (const row of rows) {
    let alerts = row.tiktokAlerts;
    if (typeof alerts === 'string') alerts = JSON.parse(alerts);
    if (!alerts?.users?.length) continue;
    let changed = false;
    for (const u of alerts.users) {
      console.log(`Guild ${row.guildId} / @${u.name}: lastPostId=${u.lastPostId}`);
      u.lastPostId = null;
      u.lastPost = null;
      changed = true;
    }
    if (changed) {
      await s.query(
        'UPDATE guilds SET tiktokAlerts = ? WHERE guildId = ?',
        { replacements: [JSON.stringify(alerts), row.guildId] }
      );
      console.log(`  → lastPostId resettato a null`);
    }
  }
  console.log('done');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
