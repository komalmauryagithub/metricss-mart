const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(9300, 9350).join('\n'));
