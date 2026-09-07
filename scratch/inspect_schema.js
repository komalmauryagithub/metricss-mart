const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');
const idx = text.indexOf('users (');
console.log(text.substring(idx-100, idx+2000));
