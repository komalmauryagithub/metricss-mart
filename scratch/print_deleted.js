const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(7385, 7395).join('\n'));
