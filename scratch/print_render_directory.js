const fs = require('fs');
const lines = fs.readFileSync('hr.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('function renderEmployeeDirectory'));
console.log(lines.slice(idx, idx + 40).join('\n'));
