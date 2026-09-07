const fs = require('fs');

for (const file of ['admin.js', 'hr.js']) {
    if (!fs.existsSync(file)) continue;
    
    let js = fs.readFileSync(file, 'utf8');
    
    // Add edit_profile_type population
    if (!js.includes('document.getElementById("edit_profile_type")')) {
        js = js.replace(
            /document\.getElementById\("edit_is_team_lead"\)\.value = user\.is_team_lead \? "1" : "0";/g,
            `document.getElementById("edit_is_team_lead").value = user.is_team_lead ? "1" : "0";\n    if(document.getElementById("edit_profile_type")) document.getElementById("edit_profile_type").value = user.profile_type || "fresher";`
        );
        // Also need to give id to edit modal select
        let html = fs.readFileSync(file.replace('.js', '.html'), 'utf8');
        html = html.replace('<select name="profile_type">', '<select name="profile_type" id="edit_profile_type">'); // Will replace first one, which is add user, wait.
        html = html.replace('<select name="profile_type">', '<select name="profile_type" id="edit_profile_type">'); // The second one!
        // A better approach is in HTML edit modal
    }
    
    fs.writeFileSync(file, js);
}
