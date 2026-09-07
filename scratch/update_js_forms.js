const fs = require('fs');

for (const file of ['admin.js', 'hr.js']) {
    if (!fs.existsSync(file)) continue;
    let js = fs.readFileSync(file, 'utf8');

    js = js.replace(
        'setUserFieldValue(form, "comp_name", user.comp_name || "");',
        'setUserFieldValue(form, "comp_name", user.comp_name || "");\n        setUserFieldValue(form, "profile_type", user.profile_type || "fresher");'
    );

    fs.writeFileSync(file, js);
    console.log(`Updated ${file}`);
}
