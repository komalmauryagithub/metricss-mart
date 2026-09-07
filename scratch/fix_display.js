const fs = require('fs');

for (const file of ['admin.js', 'hr.js']) {
    let js = fs.readFileSync(file, 'utf8');

    js = js.replace(/unlockBtn\.style\.display = "inline-flex"/g, 'unlockBtn.style.display = "flex"');
    js = js.replace(/unlockBtn\.style\.display = isEditMode \? "inline-flex" : "none"/g, 'unlockBtn.style.display = isEditMode ? "flex" : "none"');
    
    fs.writeFileSync(file, js);
    console.log(`Updated display type in ${file}`);
}
