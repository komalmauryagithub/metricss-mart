const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

// The route is probably app.post("/api/admin/users" or similar. Let's find it.
const postUsersRegex = /app\.post\("\/api\/admin\/users", async \(req, res\) => \{[\s\S]*?const \[insertResult\] = await dbPromise\.query\(sql, \[[^\]]*\]\);/g;
let match = server.match(postUsersRegex);
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
    console.log('Updated POST /api/admin/users for profile_type');
} else {
    // If not found, let's just log what we have
    const altRegex = /app\.post\("\/register"/g;
    console.log('POST /api/admin/users not found! Trying /register');
    
    // wait, what is the endpoint for adding employees? Let's find out.
}
