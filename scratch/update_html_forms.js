const fs = require('fs');

const insertSelect = (html, afterStr) => {
    const idx = html.indexOf(afterStr);
    if (idx !== -1 && !html.includes('name="profile_type"')) {
        const insert = `
              <div class="input-group">
                <label>Profile Type</label>
                <select name="profile_type">
                  <option value="fresher">Fresher / Intern</option>
                  <option value="experience">Experienced</option>
                </select>
              </div>`;
        return html.substring(0, idx + afterStr.length) + insert + html.substring(idx + afterStr.length);
    }
    return html;
};

for (const file of ['admin.html', 'hr.html']) {
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    
    // Add User Modal
    html = insertSelect(html, '<select name="is_team_lead">\n                  <option value="0">No</option>\n                  <option value="1">Yes</option>\n                </select>\n              </div>');
    
    // Edit User Modal
    html = insertSelect(html, '<select id="edit_is_team_lead" name="is_team_lead">\n                  <option value="0">No</option>\n                  <option value="1">Yes</option>\n                </select>\n              </div>');

    fs.writeFileSync(file, html);
    console.log(`Updated ${file}`);
}
