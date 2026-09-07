const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const getByTokenRegex = /async function getProfileSetupUserByToken\(token\) \{[\s\S]*?return rows\[0\];\n\}/;
const getByTokenMatch = server.match(getByTokenRegex);

if (getByTokenMatch) {
    const getByIdFunc = getByTokenMatch[0]
        .replace('getProfileSetupUserByToken(token)', 'getProfileSetupUserById(userId)')
        .replace('WHERE profile_setup_token = ?', 'WHERE id = ?')
        .replace('[token]', '[userId]');
    
    server = server.replace(getByTokenMatch[0], getByTokenMatch[0] + '\n\n' + getByIdFunc);
}

const getRouteRegex = /app\.get\("\/api\/profile-setup\/:token", async \(req, res\) => \{[\s\S]*?\}\);/;
const getRouteMatch = server.match(getRouteRegex);
if(getRouteMatch) {
    let newGetRoute = getRouteMatch[0].replace('"/api/profile-setup/:token"', '"/api/employee/profile-setup/:userId"');
    newGetRoute = newGetRoute.replace('const token = String(req.params.token || "").trim();', 'const userId = Number(req.params.userId);');
    newGetRoute = newGetRoute.replace('if (!token) {', 'if (!userId) {');
    newGetRoute = newGetRoute.replace('message: "Missing profile setup token",', 'message: "Missing user ID",');
    newGetRoute = newGetRoute.replace('getProfileSetupUserByToken(token)', 'getProfileSetupUserById(userId)');
    
    server = server.replace(getRouteMatch[0], getRouteMatch[0] + '\n\n' + newGetRoute);
}

fs.writeFileSync('server.js', server);
console.log('Added GET route and helper for employee profile-setup');
