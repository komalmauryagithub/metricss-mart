const fs = require('fs');
const text = fs.readFileSync('admin.js', 'utf8');
const idx = text.indexOf('const fileValidationMessage = validateUserRegistrationFiles(this);');
console.log(text.substring(idx, idx+2000));
