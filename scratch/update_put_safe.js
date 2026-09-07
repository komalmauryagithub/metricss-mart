const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

// First: add extraction
const extractRegex = /const isTeamLead = hasBodyField\(req\.body, "is_team_lead"\) \? \(normalizePayrollBoolean\(req\.body\.is_team_lead\) \? 1 : 0\) : 0;/;
server = server.replace(
    extractRegex,
    'const profileType = req.body.profile_type ? String(req.body.profile_type).trim() : null;\n    const isTeamLead = hasBodyField(req.body, "is_team_lead") ? (normalizePayrollBoolean(req.body.is_team_lead) ? 1 : 0) : 0;'
);

// Second: Add to SELECT query (around line 7500-7600)
const selectRegex = /TIME_FORMAT\(logout_time, '%H:%i'\) AS logout_time,\n\s*skills,/;
server = server.replace(
    selectRegex,
    'TIME_FORMAT(logout_time, \'%H:%i\') AS logout_time,\n            is_team_lead,\n            profile_type,\n            skills,'
);

// Third: Determine next value
const nextTotalExpRegex = /const nextTotalExperience = hasBodyField\(req\.body, "total_experience"\)\n\s*\? totalExperience\n\s*: existingUser\.total_experience \|\| null;/;
server = server.replace(
    nextTotalExpRegex,
    'const nextTotalExperience = hasBodyField(req.body, "total_experience")\n        ? totalExperience\n        : existingUser.total_experience || null;\n      const nextProfileType = profileType !== null ? profileType : existingUser.profile_type || "fresher";\n      const nextIsTeamLead = hasBodyField(req.body, "is_team_lead") ? isTeamLead : Number(existingUser.is_team_lead || 0);'
);

// Fourth: Add to UPDATE users SET
const updateRegex = /certification_file = \?\n\s*`;/;
server = server.replace(
    updateRegex,
    'certification_file = ?,\n          is_team_lead = ?,\n          profile_type = ?\n      `;'
);

// Fifth: Add to params
const paramsRegex = /resumeFile,\n\s*experienceFile,\n\s*certificationFile,\n\s*\];/;
server = server.replace(
    paramsRegex,
    'resumeFile,\n        experienceFile,\n        certificationFile,\n        nextIsTeamLead,\n        nextProfileType,\n      ];'
);

fs.writeFileSync('server.js', server);
console.log('Updated PUT /api/admin/users/:id cleanly!');
