const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(9350, 9400).join('\n'));
