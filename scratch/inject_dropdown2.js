const fs = require('fs');

const insertAfterStr = (html, afterStr, insertStr) => {
    let startIdx = 0;
    while ((idx = html.indexOf(afterStr, startIdx)) !== -1) {
        // check if we already injected nearby
        const nextFewLines = html.substring(idx, idx + 500);
        if (!nextFewLines.includes('name="profile_type"')) {
            html = html.substring(0, idx + afterStr.length) + '\n' + insertStr + html.substring(idx + afterStr.length);
        }
        startIdx = idx + afterStr.length;
    }
    return html;
};

for (const file of ['admin.html', 'hr.html']) {
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');

    // Add Profile Type under Is Team Lead
    const teamLeadStr = '<span>Is Team Lead</span>\r\n                      </label>\r\n                    </div>';
    const teamLeadStr2 = '<span>Is Team Lead</span>\n                      </label>\n                    </div>';
    
    const insertStr = `                    <div class="input-group">
                      <label>Profile Type</label>
                      <select name="profile_type">
                        <option value="fresher">Fresher / Intern</option>
                        <option value="experience">Experienced</option>
                      </select>
                    </div>`;
                    
    html = insertAfterStr(html, teamLeadStr, insertStr);
    html = insertAfterStr(html, teamLeadStr2, insertStr);

    fs.writeFileSync(file, html);
    console.log(`Updated ${file}`);
}
