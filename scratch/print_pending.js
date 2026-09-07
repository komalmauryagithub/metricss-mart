const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes("profile_setup_status = 'pending',"));
console.log(lines.slice(idx - 20, idx + 10).join('\n'));
