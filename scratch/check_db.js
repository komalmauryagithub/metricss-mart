require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

async function checkColumn() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'metrics_mart'
    });

    try {
        const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'profile_type'");
        if (columns.length > 0) {
            console.log("YES! Column 'profile_type' exists.");
        } else {
            console.log("NO! Column 'profile_type' does NOT exist.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
    
    await db.end();
}

checkColumn();
