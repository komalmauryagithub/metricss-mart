const fs = require('fs');
const lines = fs.readFileSync('employee-profile.js', 'utf8').split('\n');
console.log(lines.slice(0, 50).join('\n'));
