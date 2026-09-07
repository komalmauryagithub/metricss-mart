const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
lines.forEach((l, i) => {
    if (l.includes('await issueProfileSetupInvite')) {
        console.log(`Line ${i}: ${l}`);
    }
});
