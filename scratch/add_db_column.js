require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

async function addColumn() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'metrics_mart'
    });

    try {
        await db.query("ALTER TABLE users ADD COLUMN profile_type varchar(20) DEFAULT 'fresher' AFTER profile_setup_completed_at");
        console.log("Column 'profile_type' added successfully.");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Column 'profile_type' already exists.");
        } else {
            console.error("Error:", err);
        }
    }
    
    await db.end();
}

addColumn();
