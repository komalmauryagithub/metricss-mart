const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');

    // Add User Modal
    const addRoleRegex = /<select name="comp_name"[^>]*>[\s\S]*?<\/select>\n\s*<\/div>/g;
    html = html.replace(addRoleRegex, match => {
        if (match.includes('name="profile_type"')) return match; // already injected
        return match + `
                    <div class="input-group">
                      <label>Profile Type</label>
                      <select name="profile_type">
                        <option value="fresher">Fresher / Intern</option>
                        <option value="experience">Experienced</option>
                      </select>
                    </div>`;
    });

    // Edit User Modal
    const editRoleRegex = /<select id="edit_comp_name"[^>]*>[\s\S]*?<\/select>\n\s*<\/div>/g;
    html = html.replace(editRoleRegex, match => {
        if (match.includes('name="profile_type"')) return match; // already injected
        return match + `
                    <div class="input-group">
                      <label>Profile Type</label>
                      <select name="profile_type" id="edit_profile_type">
                        <option value="fresher">Fresher / Intern</option>
                        <option value="experience">Experienced</option>
                      </select>
                    </div>`;
    });

    fs.writeFileSync(file, html);
    console.log(`Updated ${file}`);
}
