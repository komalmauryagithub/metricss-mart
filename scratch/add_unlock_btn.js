const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    let html = fs.readFileSync(file, 'utf8');
    
    const target = `<button type="submit" class="submit-btn" id="registerBtn">\n                  <i class="fas fa-user-plus"></i> Create User\n                </button>`;
    
    if (html.includes(target)) {
        html = html.replace(target, target + '\n                <button type="button" class="cancel-btn" id="unlockProfileBtn" style="display: none; margin-left: 10px;" onclick="unlockUserProfile()"><i class="fas fa-unlock"></i> Unlock Profile Setup</button>');
        fs.writeFileSync(file, html);
        console.log(`Added unlock button to ${file}`);
    } else {
        console.log(`Could not find registerBtn in ${file}`);
    }
}
