const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');
const idx = server.indexOf('app.post("/api/employee/profile-setup/:userId"');
console.log(server.substring(idx - 200, idx + 500));
