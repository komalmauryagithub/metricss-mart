const fs = require('fs');
const lines = fs.readFileSync('admin.js', 'utf8').split('\n');
const funcs = lines.filter(l => l.includes('function ') && l.includes('User')).map(l => l.trim());
console.log(funcs);
