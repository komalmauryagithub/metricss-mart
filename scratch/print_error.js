const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(7350, 7370).join('\n'));
