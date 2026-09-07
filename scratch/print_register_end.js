const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.post("/register"'));
console.log(lines.slice(idx + 150, idx + 200).join('\n'));
