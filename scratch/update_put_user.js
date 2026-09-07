const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const putUserRegex = /app\.put\("\/api\/admin\/users\/:id", \(req, res\) => \{[\s\S]*?await dbPromise\.query\(sql, updateParams\);/g;
let match = server.match(putUserRegex);

if (match) {
    let newRoute = match[0];
    
    // Extract
    newRoute = newRoute.replace('const isTeamLead =', 'const profileType = req.body.profile_type ? String(req.body.profile_type).trim() : null;\n    const isTeamLead =');
    
    // Update SQL
    newRoute = newRoute.replace('is_team_lead = COALESCE(?, is_team_lead)', 'is_team_lead = COALESCE(?, is_team_lead),\n          profile_type = COALESCE(?, profile_type)');
    
    // Add to params
    newRoute = newRoute.replace('nextIsTeamLead,\n        userId', 'nextIsTeamLead,\n          profileType,\n        userId');
    
    server = server.replace(match[0], newRoute);
    fs.writeFileSync('server.js', server);
    console.log('Updated PUT /api/admin/users/:id');
} else {
    console.log('PUT user not found');
}
