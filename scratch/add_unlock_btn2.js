const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    let html = fs.readFileSync(file, 'utf8');
    
    const regex = /<button type="submit" class="submit-btn" id="registerBtn">[\s\S]*?<\/button>/;
    
    html = html.replace(regex, match => {
        return match + '\n                <button type="button" class="cancel-btn" id="unlockProfileBtn" style="display: none; margin-left: 10px;" onclick="unlockUserProfile()"><i class="fas fa-unlock"></i> Unlock Profile Setup</button>';
    });
    
    fs.writeFileSync(file, html);
    console.log(`Added unlock button to ${file}`);
}
