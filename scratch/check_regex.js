const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');
const postRouteRegex = /app\.post\("\/api\/profile-setup\/:token", \(req, res\) => \{[\s\S]*?\}\);/;
const postRouteMatch = server.match(postRouteRegex);
if(postRouteMatch) {
    console.log(postRouteMatch[0].length);
    console.log(postRouteMatch[0].substring(postRouteMatch[0].length - 100));
}
