const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const postRouteRegex = /app\.post\("\/api\/profile-setup\/:token", \(req, res\) => \{[\s\S]*?\}\);/g;
const postRouteMatch = server.match(postRouteRegex);

if(postRouteMatch) {
    let newPostRoute = postRouteMatch[0].replace('"/api/profile-setup/:token"', '"/api/employee/profile-setup/:userId"');
    newPostRoute = newPostRoute.replace('const token = String(req.params.token || "").trim();', 'const userId = Number(req.params.userId);');
    newPostRoute = newPostRoute.replace('if (!token) {', 'if (!userId) {');
    newPostRoute = newPostRoute.replace('message: "Missing profile setup token",', 'message: "Missing user ID",');
    newPostRoute = newPostRoute.replace('getProfileSetupUserByToken(token)', 'getProfileSetupUserById(userId)');
    
    // Remove the face registration check from POST
    const faceCheckRegex = /if \(statusDetails\.faceStatus === "pending"\) \{[\s\S]*?message: "Face registration is required\. Please complete the live face capture\.",[\s\S]*?\}\n\s*\}/;
    newPostRoute = newPostRoute.replace(faceCheckRegex, '');
    
    // Remove attendance face signature insert
    const faceInsertRegex = /if \(attendanceFaceImage && attendanceFaceSignature\) \{[\s\S]*?\}\n\s*\}/;
    newPostRoute = newPostRoute.replace(faceInsertRegex, '');
    
    // Set status to completed regardless of face status since it's removed
    newPostRoute = newPostRoute.replace(
        'profile_setup_status = IF(statusDetails.faceStatus === "pending", "pending_face", "completed"),',
        'profile_setup_status = "completed",'
    );
    // There might be another place where faceStatus is referenced
    
    server = server.replace(postRouteMatch[0], postRouteMatch[0] + '\n\n' + newPostRoute);
}

fs.writeFileSync('server.js', server);
console.log('Added POST route for employee profile-setup');
