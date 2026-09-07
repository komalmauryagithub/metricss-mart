const fs = require('fs');

let js = fs.readFileSync('profile-sidebar.js', 'utf8');
js = js.replace('const user = result.data;', 'const user = result.user || result.data;');
fs.writeFileSync('profile-sidebar.js', js);
console.log('Fixed result.user in profile-sidebar.js');
