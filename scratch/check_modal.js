const fs = require('fs');
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const formStart = adminHtml.indexOf('id="userRegistrationModal"');
console.log('formStart:', formStart);
