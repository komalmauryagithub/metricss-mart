const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(14580, 14610).join('\n'));
