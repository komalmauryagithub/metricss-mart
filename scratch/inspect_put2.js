const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');
const idx = text.indexOf('const joiningDate = normalizeDateOnlyValue');
console.log(text.substring(idx, idx+2500));
