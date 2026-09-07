const fs = require('fs');

let js = fs.readFileSync('profile-sidebar.js', 'utf8');
js = js.replace(/\\`/g, '`');
fs.writeFileSync('profile-sidebar.js', js);
console.log('Fixed backticks in profile-sidebar.js');
