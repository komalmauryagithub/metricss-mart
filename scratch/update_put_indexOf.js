const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const putStart = server.indexOf('app.put("/api/admin/users/:id", (req, res) => {');
if (putStart !== -1) {
    const putEnd = server.indexOf('await dbPromise.query(sql, updateParams);', putStart) + 'await dbPromise.query(sql, updateParams);'.length;
    let putRoute = server.substring(putStart, putEnd);
    
    putRoute = putRoute.replace('const nextIsTeamLead =', 'const profileType = req.body.profile_type ? String(req.body.profile_type).trim() : null;\n    const nextIsTeamLead =');
    putRoute = putRoute.replace('is_team_lead = COALESCE(?, is_team_lead)', 'is_team_lead = COALESCE(?, is_team_lead),\n          profile_type = COALESCE(?, profile_type)');
    putRoute = putRoute.replace('nextIsTeamLead,\n          userId', 'nextIsTeamLead,\n          profileType,\n          userId');
    
    server = server.substring(0, putStart) + putRoute + server.substring(putEnd);
    fs.writeFileSync('server.js', server);
    console.log('Updated PUT /api/admin/users/:id');
} else {
    console.log('PUT user not found');
}
