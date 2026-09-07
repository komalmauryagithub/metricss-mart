const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.listen(PORT'));
console.log(`app.listen is at line ${idx}`);
console.log(lines.slice(idx, idx + 20).join('\n'));
