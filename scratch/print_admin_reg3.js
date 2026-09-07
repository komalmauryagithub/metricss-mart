const fs = require('fs');
const lines = fs.readFileSync('admin.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('const formData = new FormData(this);'));
console.log(lines.slice(idx - 20, idx).join('\n'));
