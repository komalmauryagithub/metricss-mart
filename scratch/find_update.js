const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('UPDATE users SET'));
console.log(lines.slice(idx - 10, idx + 40).join('\n'));
