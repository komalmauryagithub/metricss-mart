const fs = require('fs');
let js = fs.readFileSync('employee-profile.js', 'utf8');

// Remove broken url token logic
js = js.replace(/if \(window\.location\.protocol[\s\S]*?\}\n/g, '');
js = js.replace(/if \(!profileToken\) \{[\s\S]*?return;\n  \}/g, '');
js = js.replace(/const profileUrl = new URL[\s\S]*?profileUrl\.toString\(\)\);\n    \}/g, '');

// Replace fetch URL in loadProfileData
js = js.replace(
    /\$\{PROFILE_BASE_URL\}\/api\/profile-setup\/\$\{encodeURIComponent\(profileToken\)\}/g,
    '${PROFILE_BASE_URL}/api/employee/profile-setup/${encodeURIComponent(profileUserId)}'
);

fs.writeFileSync('employee-profile.js', js);
console.log('Fixed API calls and token logic in employee-profile.js!');
