const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const registerRegex = /app\.post\("\/register", async \(req, res\) => \{[\s\S]*?const \[insertResult\] = await dbPromise\.query\(sql, \[[^\]]*\]\);/g;
let match = server.match(registerRegex);
if (match) {
    let newRoute = match[0];
    
    // add extraction
    newRoute = newRoute.replace('const isTeamLead =', 'const profileType = String(req.body.profile_type || "fresher").trim();\n      const isTeamLead =');
    
    // add to sql INSERT
    newRoute = newRoute.replace('is_team_lead)', 'is_team_lead, profile_type)');
    newRoute = newRoute.replace('?)",', '?, ?)",');
    
    // add to params
    newRoute = newRoute.replace('isTeamLead,\n        ]', 'isTeamLead,\n          profileType,\n        ]');
    
    server = server.replace(match[0], newRoute);
    fs.writeFileSync('server.js', server);
    console.log('Updated /register for profile_type');
} else {
    console.log('/register pattern mismatch');
}
