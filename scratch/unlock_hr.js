require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

async function checkHr() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'metrics_mart'
    });

    try {
        const [users] = await db.query("SELECT id, name, role, profile_setup_status FROM users WHERE role = 'hr'");
        console.log(users);
        
        await db.query("UPDATE users SET profile_setup_status = 'pending' WHERE role = 'hr'");
        console.log("Updated HR profile_setup_status to pending.");
    } catch (err) {
        console.error("Error:", err);
    }
    
    await db.end();
}

checkHr();
