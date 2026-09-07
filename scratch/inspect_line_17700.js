const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(17700, 17750).join('\n'));
