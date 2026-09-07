const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');

const parts = text.split('rue });\nprocess.env.TZ = "Asia/Kolkata";');
console.log(`Found ${parts.length} parts (meaning ${parts.length - 1} occurrences)`);
