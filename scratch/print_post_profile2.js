const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.post("/api/employee/profile-setup/:userId"'));
console.log(lines.slice(idx + 70, idx + 150).join('\n'));
