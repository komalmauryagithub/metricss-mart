const fs = require('fs');

let js = fs.readFileSync('employee-profile.js', 'utf8');

// Find the last real logic before the garbage
const cutoffIdx = js.indexOf('});\n\nsetProfileType(profileTypeInput?.value || "fresher");');
if (cutoffIdx !== -1) {
    js = js.substring(0, cutoffIdx) + 'loadProfileForm();\n';
    fs.writeFileSync('employee-profile.js', js);
    console.log('Fixed end of file garbage!');
} else {
    console.log('Could not find cutoff.');
}
