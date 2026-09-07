const fs = require('fs');

let js = fs.readFileSync('employee-profile.js', 'utf8');

// Replace populateForm guess
js = js.replace(
    /setProfileType\(\n\s*user\.experience_file[\s\S]*?\);/,
    'setProfileType(user.profile_type || "fresher");'
);

// Remove the event listeners for tabs
const tabsEvtRegex = /profileTypeTabs\.forEach\(\(tab\) => \{[\s\S]*?\}\);/g;
js = js.replace(tabsEvtRegex, '');

// Since we removed tabs from HTML, profileTypeTabs might be undefined or empty.
// Let's remove the querySelector for it.
js = js.replace('const profileTypeTabs = document.querySelectorAll(".profile-type-tab");', 'const profileTypeTabs = [];');

fs.writeFileSync('employee-profile.js', js);
console.log('Updated employee-profile.js');
