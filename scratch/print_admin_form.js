const fs = require('fs');
const lines = fs.readFileSync('admin.html', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('id="adminRegisterForm"'));

console.log(lines.slice(idx - 5, idx + 20).join('\n'));
