const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.post("/api/profile-setup/:token"'));
console.log(lines.slice(idx, idx + 500).filter(l => l.startsWith('app.')).join('\n'));
