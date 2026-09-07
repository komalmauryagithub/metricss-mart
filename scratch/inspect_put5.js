const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');
const idx = text.indexOf('app.put("/api/admin/users/:id"');
console.log(text.substring(idx+3000, idx+5000));
