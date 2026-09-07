const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log(lines.slice(22960, 22980).join('\n'));
