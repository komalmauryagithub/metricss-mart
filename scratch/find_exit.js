const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const exits = lines.map((l, i) => [i, l]).filter(([i, l]) => l.includes('process.exit('));
console.log(exits);
