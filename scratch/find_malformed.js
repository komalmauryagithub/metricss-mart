const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const badInjectionRegex = /app\.post\("\/api\/employee\/profile-setup\/:userId", \(req, res\) => \{[\s\S]*?\}\);/;
// Wait, since we appended the correct one at the end of the file, there are TWO `app.post("/api/employee/profile-setup/:userId"` now!
// The first one is the malformed one.
// Let's find its start and end.
const firstIndex = server.indexOf('app.post("/api/employee/profile-setup/:userId"');
const lastIndex = server.lastIndexOf('app.post("/api/employee/profile-setup/:userId"');

if (firstIndex !== lastIndex) {
    // There are two. The first one is the malformed one.
    // It ends with `message,\n      });` (the 400 response).
    // Let's locate the end of the malformed one.
    const endStr = '      });\n';
    const endIndex = server.indexOf(endStr, firstIndex + 100);
    
    // We should remove from `app.post("/api/employee/profile...` to `      });\n`
    // Let's just print it out to be safe first.
    console.log(server.substring(firstIndex, endIndex + endStr.length + 100));
} else {
    console.log('Only one found?');
}
