const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const fragmentStart = server.indexOf('app.get("/api/employee/profile-setup/:userId", async (req, res) => {\n    const userId = Number(req.params.userId);');
if (fragmentStart !== -1) {
    const fragmentEnd = server.indexOf('      });', fragmentStart) + '      });'.length;
    console.log('Found GET fragment! Removing from', fragmentStart, 'to', fragmentEnd);
    
    server = server.substring(0, fragmentStart) + server.substring(fragmentEnd);
    fs.writeFileSync('server.js', server);
    console.log('GET Fragment removed.');
} else {
    // Let's print the actual match because it might be formatted differently
    const altStart = server.indexOf('app.get("/api/employee/profile-setup/:userId"');
    if (altStart !== -1) {
       console.log('Found alternative start at', altStart);
       console.log(server.substring(altStart, altStart + 500));
       
       // check if it is the fragment or the real one appended at the end
       const lastStart = server.lastIndexOf('app.get("/api/employee/profile-setup/:userId"');
       console.log('Last start is at', lastStart);
       
       if (altStart !== lastStart) {
           const endStr = '      });';
           const endIdx = server.indexOf(endStr, altStart) + endStr.length;
           server = server.substring(0, altStart) + server.substring(endIdx);
           fs.writeFileSync('server.js', server);
           console.log('Removed GET fragment.');
       }
    }
}
