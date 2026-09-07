const fs = require('fs');

let js = fs.readFileSync('admin.js', 'utf8');

js = js.replace(
    /title\.textContent = isEditMode \? "Update Team Member" : "User Registration";/,
    'title.textContent = isEditMode ? "Update Team Member" : "User Registration";\n    const unlockBtn = document.getElementById("unlockProfileBtn");\n    if (unlockBtn) unlockBtn.style.display = isEditMode ? "inline-flex" : "none";\n    if (unlockBtn) { unlockBtn.style.alignItems = "center"; unlockBtn.style.justifyContent = "center"; }'
);

fs.writeFileSync('admin.js', js);
console.log('Fixed unlock button logic in admin.js');
