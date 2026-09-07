const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('app.put("/api/admin/users/:id"'));
const end = lines.findIndex((l, i) => i > start && l.includes('UPDATE users SET'));
console.log(lines.slice(end, end+50).join('\n'));
