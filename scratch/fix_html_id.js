const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    if (!fs.existsSync(file)) continue;
    
    let html = fs.readFileSync(file, 'utf8');
    
    // Find the editUserForm and add id="edit_profile_type" to its select
    const editFormStart = html.indexOf('id="editUserForm"');
    if(editFormStart !== -1) {
        const selectIdx = html.indexOf('<select name="profile_type">', editFormStart);
        if (selectIdx !== -1) {
            html = html.substring(0, selectIdx) + '<select name="profile_type" id="edit_profile_type">' + html.substring(selectIdx + '<select name="profile_type">'.length);
            fs.writeFileSync(file, html);
            console.log(`Added id="edit_profile_type" to ${file}`);
        }
    }
}
