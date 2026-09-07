const fs = require('fs');
const lines = fs.readFileSync('admin.html', 'utf8').split('\n');
lines.forEach((l, i) => {
    if (l.includes('name="profile_type"')) {
        console.log(`Line ${i}: ${l}`);
    }
});
