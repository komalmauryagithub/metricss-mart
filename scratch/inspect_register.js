const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');
const idx = server.indexOf('app.post("/register"');
console.log(server.substring(idx, idx + 1500));
