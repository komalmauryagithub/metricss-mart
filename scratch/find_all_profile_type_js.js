const fs = require('fs');
const lines = fs.readFileSync('admin.js', 'utf8').split('\n');
lines.forEach((l, i) => {
    if (l.includes('profile_type')) {
        console.log(`Line ${i}: ${l.trim()}`);
    }
});
