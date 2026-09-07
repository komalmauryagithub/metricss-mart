const fs = require('fs');

const adminHtml = fs.readFileSync('admin.html', 'utf8');
let hrHtml = fs.readFileSync('hr.html', 'utf8');

const formStart = adminHtml.indexOf('id="userRegistrationModal"');
const actualStart = adminHtml.lastIndexOf('<div', formStart);
    
// We just need the exact end of the modal. 
// A simpler way: extract from actualStart until the next modal marker.
const formEnd = adminHtml.indexOf('<!-- LEAD APPOINTMENT MODAL -->');
console.log('formEnd:', formEnd);

if (actualStart !== -1 && formEnd !== -1) {
    let formHtml = adminHtml.substring(actualStart, formEnd);
    
    // Add it to hr.html
    const hrBodyEnd = hrHtml.indexOf('</body>');
    if (hrBodyEnd !== -1) {
        hrHtml = hrHtml.substring(0, hrBodyEnd) + '\n<!-- USER EDIT MODAL FOR HR -->\n' + formHtml + '\n' + hrHtml.substring(hrBodyEnd);
        fs.writeFileSync('hr.html', hrHtml);
        console.log('Added modal to hr.html');
    }
} else {
    // maybe LEAD APPOINTMENT MODAL isn't there
    const formEnd2 = adminHtml.indexOf('id="adminLeadAppointmentModal"');
    const actualEnd2 = adminHtml.lastIndexOf('<div', formEnd2);
    let formHtml2 = adminHtml.substring(actualStart, actualEnd2);
    
    const hrBodyEnd = hrHtml.indexOf('</body>');
    hrHtml = hrHtml.substring(0, hrBodyEnd) + '\n<!-- USER EDIT MODAL FOR HR -->\n' + formHtml2 + '\n' + hrHtml.substring(hrBodyEnd);
    fs.writeFileSync('hr.html', hrHtml);
    console.log('Added modal to hr.html using fallback');
}
