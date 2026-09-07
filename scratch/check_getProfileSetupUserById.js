const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');
const start = server.indexOf('async function getProfileSetupUserById(userId)');
console.log(server.substring(start, start + 1000));
