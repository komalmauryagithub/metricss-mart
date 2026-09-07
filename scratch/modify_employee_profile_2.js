const fs = require('fs');
let js = fs.readFileSync('employee-profile.js', 'utf8');

// Replace fetch URLs
js = js.replace(
    /`${PROFILE_BASE_URL}\/api\/profile-setup\/\${encodeURIComponent\(profileToken\)}`/g,
    '`${PROFILE_BASE_URL}/api/employee/profile-setup/${profileUserId}`'
);

js = js.replace(
    /if \(!profileToken\)/g,
    'if (!profileUserId)'
);

// We need to inject userId into formData before submitting
js = js.replace(
    /const formData = new FormData\(profileForm\);/g,
    `const formData = new FormData(profileForm);\n    formData.append("userId", profileUserId);`
);

// We need to disable the face capture button listener
js = js.replace(/if \(profileFaceCaptureBtn\) \{[\s\S]*?\}/g, '');

// Prevent appending face image 
js = js.replace(/const faceImageData = document.getElementById\("attendance_face_image"\)\?.value;[\s\S]*?if \(faceImageData\) \{[\s\S]*?\}/g, '');

fs.writeFileSync('employee-profile.js', js);
console.log('Fixed API endpoints in employee-profile.js');
