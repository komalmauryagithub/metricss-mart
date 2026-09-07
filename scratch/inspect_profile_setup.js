const fs = require('fs');
let text = fs.readFileSync('server.js', 'utf8');
const idx = text.indexOf('app.post("/api/profile-setup/:token"');
console.log(text.substring(idx, idx+4000));
