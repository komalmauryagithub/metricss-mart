const fs = require('fs');

for (const file of ['admin.html', 'hr.html']) {
    let html = fs.readFileSync(file, 'utf8');

    html = html.replace(
        /class="cancel-btn" id="unlockProfileBtn" style="display: none; margin-left: 10px;"/g,
        'id="unlockProfileBtn" style="display: none; margin-left: 10px; background: #f59e0b; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;" onmouseover="this.style.background=\'#d97706\'" onmouseout="this.style.background=\'#f59e0b\'"'
    );
    
    fs.writeFileSync(file, html);
    console.log(`Updated CSS for unlock button in ${file}`);
}
