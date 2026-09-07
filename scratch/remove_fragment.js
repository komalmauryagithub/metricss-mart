const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const fragmentStart = server.indexOf('app.post("/api/employee/profile-setup/:userId", (req, res) => {\n  userRegistrationUpload(req, res, async (uploadErr) => {');

if (fragmentStart !== -1) {
    const fragmentEnd = server.indexOf('      });', fragmentStart) + '      });'.length;
    console.log('Found fragment! Removing from', fragmentStart, 'to', fragmentEnd);
    
    server = server.substring(0, fragmentStart) + server.substring(fragmentEnd);
    fs.writeFileSync('server.js', server);
    console.log('Fragment removed.');
} else {
    console.log('Fragment not found?!');
}
