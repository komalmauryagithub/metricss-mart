const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

const putStart = server.indexOf('app.put("/api/admin/users/:id", (req, res) => {');
const putEnd = server.indexOf('// ====================== GET USER ======================', putStart);
if (putStart !== -1 && putEnd !== -1) {
    let putRoute = server.substring(putStart, putEnd);

    // 1. Add extraction
    if (!putRoute.includes('const profileType = req.body.profile_type')) {
        const target1 = 'const compName = String(req.body.comp_name || "").trim();';
        putRoute = putRoute.replace(target1, target1 + '\n    const profileType = req.body.profile_type ? String(req.body.profile_type).trim() : null;');
    }
    
    // 2. Add to SELECT query
    if (!putRoute.includes('profile_type,')) {
        putRoute = putRoute.replace(/TIME_FORMAT\(logout_time, '%H:%i'\) AS logout_time,[\s\r\n]*skills,/g, 'TIME_FORMAT(logout_time, \'%H:%i\') AS logout_time,\n            profile_type,\n            skills,');
    }
    
    // 3. Determine next value
    if (!putRoute.includes('const nextProfileType')) {
        putRoute = putRoute.replace(/const nextTotalExperience = hasBodyField\(req\.body, "total_experience"\)[\s\r\n]*\? totalExperience[\s\r\n]*: existingUser\.total_experience \|\| null;/g, 'const nextTotalExperience = hasBodyField(req.body, "total_experience")\n        ? totalExperience\n        : existingUser.total_experience || null;\n      const nextProfileType = profileType !== null ? profileType : existingUser.profile_type || "fresher";');
    }

    // 4. Add to UPDATE users SET
    if (!putRoute.includes('profile_type = ?')) {
        putRoute = putRoute.replace(/certification_file = \?[\s\r\n]*`;/g, 'certification_file = ?,\n          profile_type = ?\n      `;');
    }

    // 5. Add to params
    if (!putRoute.includes('nextProfileType,')) {
        putRoute = putRoute.replace(/resumeFile,[\s\r\n]*experienceFile,[\s\r\n]*certificationFile,[\s\r\n]*\];/g, 'resumeFile,\n        experienceFile,\n        certificationFile,\n        nextProfileType,\n      ];');
    }

    server = server.substring(0, putStart) + putRoute + server.substring(putEnd);
    fs.writeFileSync('server.js', server);
    console.log('Fixed PUT successfully using correct line endings!');
} else {
    console.log('Could not find PUT route boundaries.');
}
