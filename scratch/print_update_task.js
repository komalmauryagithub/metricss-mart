const fs = require('fs');
const lines = fs.readFileSync('dev.js', 'utf8').split('\n');
console.log(lines.slice(4940, 4980).join('\n'));
