const fs = require('fs');
const lines = fs.readFileSync('admin.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('populateNextEmployeeCode(this);'));
console.log(lines.slice(idx - 60, idx - 20).join('\n'));
