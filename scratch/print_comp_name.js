const fs = require('fs');
const lines = fs.readFileSync('admin.html', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('name="comp_name"'));
console.log(lines.slice(idx - 2, idx + 15).join('\n'));
