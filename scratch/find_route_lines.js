const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.post("/api/profile-setup/:token"'));
console.log(`app.post("/api/profile-setup/:token" is at line ${idx}`);

const nextIdx = lines.findIndex(l => l.includes('app.post("/api/employee/profile-setup/:userId"'));
console.log(`app.post("/api/employee/profile-setup/:userId" is at line ${nextIdx}`);

const loginIdx = lines.findIndex(l => l.includes('app.post("/login"'));
console.log(`app.post("/login" is at line ${loginIdx}`);
