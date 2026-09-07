const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    let html = fs.readFileSync(file, 'utf8');
    const firstIdx = html.indexOf('name="profile_type"');
    if (firstIdx !== -1) {
        const secondIdx = html.indexOf('name="profile_type"', firstIdx + 10);
        if (secondIdx !== -1 && !html.substring(secondIdx, secondIdx + 50).includes('id="edit_profile_type"')) {
            html = html.substring(0, secondIdx) + 'name="profile_type" id="edit_profile_type"' + html.substring(secondIdx + 'name="profile_type"'.length);
            fs.writeFileSync(file, html);
            console.log(`Added ID to second dropdown in ${file}`);
        }
    }
}
