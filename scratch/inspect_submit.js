const fs = require('fs');
const text = fs.readFileSync('admin.js', 'utf8');
const idx = text.indexOf('adminRegisterForm.addEventListener("submit"');
console.log(text.substring(idx+700, idx+2000));
