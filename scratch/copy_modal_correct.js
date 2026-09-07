const fs = require('fs');

const adminHtml = fs.readFileSync('admin.html', 'utf8');
let hrHtml = fs.readFileSync('hr.html', 'utf8');

const formStart = adminHtml.indexOf('id="userRegistrationModal"');
if (formStart !== -1) {
    const startTag = '<div\n      id="userRegistrationModal"';
    const actualStart = adminHtml.lastIndexOf('<div', formStart);
    
    // find end of modal by searching for next modal or script
    const formEnd = adminHtml.indexOf('<!-- LEAD APPOINTMENT MODAL -->', actualStart);
    
    if (actualStart !== -1 && formEnd !== -1) {
        let formHtml = adminHtml.substring(actualStart, formEnd);
        
        const hrBodyEnd = hrHtml.indexOf('</body>');
        if (hrBodyEnd !== -1) {
            hrHtml = hrHtml.substring(0, hrBodyEnd) + formHtml + '\n' + hrHtml.substring(hrBodyEnd);
            fs.writeFileSync('hr.html', hrHtml);
            console.log('Added modal to hr.html');
        }
    }
}
