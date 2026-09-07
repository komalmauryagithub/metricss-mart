const fs = require('fs');
const lines = fs.readFileSync('employee-profile.js', 'utf8').split('\n');
lines.forEach((l, i) => {
    if (l.includes('profileToken')) {
        console.log(`Line ${i}: ${l.trim()}`);
    }
});
