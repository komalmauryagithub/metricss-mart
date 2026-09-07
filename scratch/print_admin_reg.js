const fs = require('fs');
const lines = fs.readFileSync('admin.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('${BASE_URL}/register'));
console.log(lines.slice(idx - 15, idx + 10).join('\n'));
