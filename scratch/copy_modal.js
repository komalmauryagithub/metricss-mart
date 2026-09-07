const fs = require('fs');

const adminHtml = fs.readFileSync('admin.html', 'utf8');
let hrHtml = fs.readFileSync('hr.html', 'utf8');

// Extract userFormBox from admin.html
const formStart = adminHtml.indexOf('<div id="adminRegisterModal"');
const formEnd = adminHtml.indexOf('<!-- LEAD APPOINTMENT MODAL -->');

if (formStart !== -1 && formEnd !== -1) {
    let formHtml = adminHtml.substring(formStart, formEnd);
    
    // Insert into hr.html before the closing body
    const hrBodyEnd = hrHtml.indexOf('</body>');
    if (hrBodyEnd !== -1) {
        hrHtml = hrHtml.substring(0, hrBodyEnd) + formHtml + '\n' + hrHtml.substring(hrBodyEnd);
        fs.writeFileSync('hr.html', hrHtml);
        console.log('Added modal to hr.html');
    }
} else {
    console.log('Could not find modal in admin.html');
}
