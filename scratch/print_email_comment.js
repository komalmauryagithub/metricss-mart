const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('Complete Your Profile Setup'));
console.log(lines.slice(idx - 10, idx + 10).join('\n'));
