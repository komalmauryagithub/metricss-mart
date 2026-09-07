const fs = require('fs');
const lines = fs.readFileSync('admin.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('async function openUserEditForm(userId) {'));
console.log(lines.slice(idx + 40, idx + 80).join('\n'));
