const mysql = require('mysql2/promise');

async function test() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'metrics_mart'
  });

  try {
    const [rows] = await db.query('SELECT * FROM seo_logins');
    console.log('seo_logins table exists!');
  } catch (err) {
    console.log('Error:', err.message);
  }
  
  try {
    const [rows] = await db.query('SELECT * FROM seo_daily_work');
    console.log('seo_daily_work table exists!');
  } catch (err) {
    console.log('Error:', err.message);
  }

  await db.end();
}

test();
