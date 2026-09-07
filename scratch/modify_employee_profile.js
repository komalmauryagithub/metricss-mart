const fs = require('fs');

let html = fs.readFileSync('employee-profile.html', 'utf8');

// Remove face section
const faceSectionStart = html.indexOf('<section class="form-card attendance-face-enrollment-card" id="profileFaceSection">');
const faceSectionEnd = html.indexOf('</section>', faceSectionStart) + '</section>'.length;
if(faceSectionStart !== -1) {
    html = html.substring(0, faceSectionStart) + html.substring(faceSectionEnd);
}

// Replace scripts
html = html.replace(/<script src="attendance-face\.js.*?"><\/script>/g, '');
html = html.replace(/<script src="complete-profile\.js.*?"><\/script>/g, '<script src="employee-profile.js"></script>');

fs.writeFileSync('employee-profile.html', html);

let js = fs.readFileSync('employee-profile.js', 'utf8');

// Remove face logic
const faceLogicRegex = /const profileFaceSection = document.getElementById\("profileFaceSection"\);[\s\S]*?const profileFaceCaptureBtn = document.getElementById\("profileFaceCaptureBtn"\);/g;
js = js.replace(faceLogicRegex, '');

// Update token/auth logic
js = js.replace(
    'const profileToken = normalizeProfileToken(profileSearchParams.get("token"));',
    `const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");\nconst profileUserId = currentUser.id;\nif (!profileUserId) { window.location.href = "index.html"; }`
);
js = js.replace('const profileUserId = String(profileSearchParams.get("uid") || "").replace(\n  /\\D/g,\n  "",\n);', '');
js = js.replace('const profileToken = normalizeProfileToken(profileSearchParams.get("token"));', '');
// Wait, I might have messed up the regex for token.

fs.writeFileSync('employee-profile.js', js);
console.log('Modified employee-profile HTML and basic JS.');
