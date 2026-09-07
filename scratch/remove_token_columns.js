const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

const regex = /profile_setup_token,[\s\r\n]*profile_setup_expires,/g;
server = server.replace(regex, '');

fs.writeFileSync('server.js', server);
console.log('Removed profile_setup_token and profile_setup_expires from server.js!');
