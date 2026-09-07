const fs = require('fs');

let js = fs.readFileSync('admin.js', 'utf8');

js = js.replace(/currentEditUserId/g, 'editingUserId');

fs.writeFileSync('admin.js', js);
console.log('Fixed editingUserId in admin.js');
