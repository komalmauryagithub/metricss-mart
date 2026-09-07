const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex((l, i) => i > 1200 && l.includes('issueProfileSetupInvite('));
console.log(lines.slice(idx - 20, idx + 20).join('\n'));
