const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.put("/api/admin/users/:id"'));
console.log(lines.slice(idx + 130, idx + 200).join('\n'));
