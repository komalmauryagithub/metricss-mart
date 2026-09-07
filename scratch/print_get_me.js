const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.get("/api/me/:id"'));
console.log(lines.slice(idx + 35, idx + 70).join('\n'));
