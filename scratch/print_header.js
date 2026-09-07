const fs = require('fs');
const lines = fs.readFileSync('me.html', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('<header class="header">'));
console.log(lines.slice(idx, idx + 40).join('\n'));
