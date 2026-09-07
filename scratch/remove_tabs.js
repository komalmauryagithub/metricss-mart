const fs = require('fs');

let html = fs.readFileSync('employee-profile.html', 'utf8');
const tabsRegex = /<div class="profile-type-tabs" role="tablist" aria-label="Profile type">[\s\S]*?<\/div>/;
html = html.replace(tabsRegex, '<!-- profile type tabs removed, handled by backend -->');
fs.writeFileSync('employee-profile.html', html);
console.log('Removed tabs from HTML');

let js = fs.readFileSync('employee-profile.js', 'utf8');
// Replace the logic that handles tab clicks
const tabLogicRegex = /const profileTabs = document\.querySelectorAll\("\.profile-type-tab"\);[\s\S]*?\}\);[\s\S]*?\}\);/g;
// Actually, it's easier to just find the `setProfileType` function and ensure it gets called after fetch.
// Let's check employee-profile.js.
